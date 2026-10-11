import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RunPayrollDto, MarkPaidDto } from './dto/payroll.dto';
import {
  PayrollStatus,
  Prisma,
  StaffStatus,
  WalletTxnType,
} from '@prisma/client';

import { BranchScopeService } from '../common/branch/branch-scope.service';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

@Injectable()
export class PayrollService {
  constructor(
    private prisma: PrismaService,
    private branchScopeService: BranchScopeService,
  ) {}

  private parseMonthStringToDate(monthStr: string): Date {
    const [year, month] = monthStr.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
  }

  async findAll(
    query?: {
      branch?: string;
      department?: string;
      month?: string;
      status?: PayrollStatus;
      search?: string;
      page?: number;
      limit?: number;
    },
    user?: JwtPayload,
  ) {
    const page = Math.max(1, Number(query?.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query?.limit) || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.PayrollWhereInput = {};

    const branchFilter = await this.branchScopeService.getBranchFilter(
      user,
      query?.branch,
    );
    if (branchFilter !== undefined) {
      where.staff = {
        ...(where.staff as Prisma.StaffWhereInput),
        branchId: branchFilter,
      };
    }

    if (query?.month) {
      const startOfMonth = this.parseMonthStringToDate(query.month);
      const endOfMonth = new Date(startOfMonth);
      endOfMonth.setUTCMonth(endOfMonth.getUTCMonth() + 1);

      where.month = {
        gte: startOfMonth,
        lt: endOfMonth,
      };
    }

    if (query?.department) {
      where.staff = { departmentId: query.department };
    }

    if (query?.status) {
      where.status = query.status;
    }

    if (query?.search?.trim()) {
      const term = query.search.trim();
      where.OR = [
        { staff: { name: { contains: term, mode: 'insensitive' } } },
        { staff: { employeeId: { contains: term, mode: 'insensitive' } } },
        { staff: { email: { contains: term, mode: 'insensitive' } } },
      ];
    }

    const [total, data, summaryAgg] = await Promise.all([
      this.prisma.payroll.count({ where }),
      this.prisma.payroll.findMany({
        where,
        include: {
          staff: {
            select: {
              id: true,
              employeeId: true,
              name: true,
              email: true,
              phone: true,
              photo: true,
              department: { select: { id: true, name: true } },
              role: { select: { id: true, name: true } },
              branch: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.payroll.findMany({
        where: query?.month
          ? {
              month: {
                gte: this.parseMonthStringToDate(query.month),
                lt: new Date(
                  this.parseMonthStringToDate(query.month).getTime() +
                    32 * 24 * 60 * 60 * 1000,
                ),
              },
            }
          : {},
        select: {
          netSalary: true,
          status: true,
        },
      }),
    ]);

    let totalThisMonth = 0;
    let paidThisMonth = 0;
    let pendingThisMonth = 0;

    for (const p of summaryAgg) {
      const amount = Number(p.netSalary);
      totalThisMonth += amount;
      if (p.status === PayrollStatus.PAID) {
        paidThisMonth += amount;
      } else {
        pendingThisMonth += amount;
      }
    }

    return {
      data,
      summary: {
        totalThisMonth,
        paidThisMonth,
        pendingThisMonth,
      },
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string, user?: JwtPayload) {
    const payroll = await this.prisma.payroll.findUnique({
      where: { id },
      include: {
        staff: {
          include: {
            department: true,
            role: true,
            branch: true,
          },
        },
      },
    });

    if (!payroll)
      throw new NotFoundException(`Payroll record "${id}" not found.`);

    if (user) {
      await this.branchScopeService.validateBranchAccess(
        user,
        payroll.staff.branchId,
      );
    }

    return payroll;
  }

  async runPayroll(dto: RunPayrollDto, user?: JwtPayload) {
    const monthDate = this.parseMonthStringToDate(dto.month);

    const staffWhere: Prisma.StaffWhereInput = {
      status: StaffStatus.ACTIVE,
    };
    if (dto.departmentId) {
      staffWhere.departmentId = dto.departmentId;
    }

    const branchFilter = await this.branchScopeService.getBranchFilter(
      user,
      dto.branchId,
    );
    if (branchFilter !== undefined) {
      staffWhere.branchId = branchFilter;
    }

    const activeStaff = await this.prisma.staff.findMany({
      where: staffWhere,
      include: { department: true, role: true },
    });

    if (activeStaff.length === 0) {
      return {
        message: 'No active staff found for the selected criteria.',
        createdCount: 0,
        skippedCount: 0,
        records: [],
      };
    }

    const existingPayrolls = await this.prisma.payroll.findMany({
      where: {
        month: monthDate,
        staffId: { in: activeStaff.map((s) => s.id) },
      },
      select: { staffId: true },
    });

    const existingStaffIds = new Set(existingPayrolls.map((p) => p.staffId));
    const toCreate = activeStaff.filter((s) => !existingStaffIds.has(s.id));

    if (toCreate.length === 0) {
      return {
        message: `All ${activeStaff.length} active employee(s) already have payroll generated for ${dto.month}.`,
        createdCount: 0,
        skippedCount: existingPayrolls.length,
        records: [],
      };
    }

    const createdRecords = await this.prisma.$transaction(async (tx) => {
      const records: any[] = [];
      for (const staff of toCreate) {
        const basicSalary = Number(staff.basicSalary || 0);

        let allowancesTotal = 0;
        if (staff.allowances && typeof staff.allowances === 'object') {
          for (const val of Object.values(staff.allowances)) {
            const num = Number(val);
            if (!isNaN(num)) allowancesTotal += num;
          }
        }

        const netSalary = Math.max(0, basicSalary + allowancesTotal);

        const record = await tx.payroll.create({
          data: {
            staffId: staff.id,
            month: monthDate,
            basicSalary,
            allowances: staff.allowances
              ? (staff.allowances as any)
              : undefined,
            netSalary,
            status: PayrollStatus.PENDING,
            paymentMethod: staff.paymentMethod,
          },
          include: {
            staff: {
              select: {
                id: true,
                employeeId: true,
                name: true,
                department: { select: { name: true } },
              },
            },
          },
        });
        records.push(record);
      }
      return records;
    });

    return {
      message: `Payroll successfully generated for ${createdRecords.length} employee(s).`,
      createdCount: createdRecords.length,
      skippedCount: existingStaffIds.size,
      records: createdRecords,
    };
  }

  async markPaid(
    id: string,
    dto: MarkPaidDto,
    user?: JwtPayload | string,
  ) {
    const userPayload = typeof user === 'string' ? undefined : user;
    let recordedById = typeof user === 'string' ? user : user?.sub;
    if (!recordedById) {
      const adminStaff = await this.prisma.staff.findFirst({
        where: { status: 'ACTIVE' },
        orderBy: { createdAt: 'asc' },
      });
      recordedById = adminStaff?.id || 'system';
    }

    const payroll = await this.findOne(id, userPayload);

    if (payroll.status === PayrollStatus.PAID) {
      throw new BadRequestException(
        'This payroll record has already been marked as PAID.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      let walletTxn: any = null;

      if (dto.walletTypeId) {
        const wallet = await tx.walletType.findUnique({
          where: { id: dto.walletTypeId },
        });
        if (!wallet)
          throw new NotFoundException('Designated payment wallet not found.');

        const netSalary = Number(payroll.netSalary);
        const currentBal = Number(wallet.currentBalance);

        if (currentBal < netSalary) {
          throw new BadRequestException(
            `Insufficient balance in wallet "${wallet.name}". Required: ৳${netSalary.toLocaleString()}, Available: ৳${currentBal.toLocaleString()}.`,
          );
        }

        const newBal = currentBal - netSalary;
        await tx.walletType.update({
          where: { id: dto.walletTypeId },
          data: { currentBalance: newBal },
        });

        const monthStr = payroll.month.toISOString().slice(0, 7);
        const createdTxns: any[] = [];
        let runningBal = currentBal;

        const basicSalary = Number(payroll.basicSalary || 0);
        const allowancesObj =
          payroll.allowances && typeof payroll.allowances === 'object'
            ? (payroll.allowances as Record<string, number>)
            : {};

        const hasAllowances = Object.keys(allowancesObj).length > 0;

        if (basicSalary > 0 || !hasAllowances) {
          const salaryAmount = basicSalary > 0 ? basicSalary : netSalary;
          runningBal -= salaryAmount;
          const salTxn = await tx.walletTransaction.create({
            data: {
              walletTypeId: dto.walletTypeId,
              type: WalletTxnType.WITHDRAWAL,
              payType: 'SALARY',
              staffId: payroll.staffId,
              amount: salaryAmount,
              referenceNo: `PAY-SAL-${payroll.id.slice(-6).toUpperCase()}-${Date.now()}`,
              note:
                dto.note ||
                `Salary payment for ${payroll.staff.name} (${payroll.staff.employeeId}) for ${monthStr}`,
              recordedById,
              balanceAfter: runningBal,
            },
          });
          createdTxns.push(salTxn);
        }

        let alwIndex = 1;
        for (const [key, val] of Object.entries(allowancesObj)) {
          const alwVal = Number(val);
          if (alwVal > 0) {
            runningBal -= alwVal;
            const alwTxn = await tx.walletTransaction.create({
              data: {
                walletTypeId: dto.walletTypeId,
                type: WalletTxnType.WITHDRAWAL,
                payType: 'ALLOWANCE',
                staffId: payroll.staffId,
                amount: alwVal,
                referenceNo: `PAY-ALW-${payroll.id.slice(-6).toUpperCase()}-${Date.now()}-${alwIndex++}`,
                note: `Allowance (${key}) for ${payroll.staff.name} (${payroll.staff.employeeId}) for ${monthStr}`,
                recordedById,
                balanceAfter: runningBal,
              },
            });
            createdTxns.push(alwTxn);
          }
        }

        walletTxn = createdTxns[0] || null;
      }

      const updatedPayroll = await tx.payroll.update({
        where: { id },
        data: {
          status: PayrollStatus.PAID,
          paymentDate: new Date(),
        },
        include: {
          staff: {
            include: { department: true, role: true, branch: true },
          },
        },
      });

      return {
        payroll: updatedPayroll,
        walletTransaction: walletTxn,
      };
    });
  }

  async getPayslip(id: string, user?: JwtPayload) {
    const payroll = await this.findOne(id, user);

    return {
      id: payroll.id,
      month: payroll.month.toISOString().slice(0, 7),
      paymentDate: payroll.paymentDate,
      status: payroll.status,
      paymentMethod: payroll.paymentMethod,
      employee: {
        id: payroll.staff.id,
        employeeId: payroll.staff.employeeId,
        name: payroll.staff.name,
        email: payroll.staff.email,
        phone: payroll.staff.phone,
        department: payroll.staff.department?.name || 'N/A',
        role: payroll.staff.role?.name || 'N/A',
        branch: payroll.staff.branch?.name || 'N/A',
        joiningDate: payroll.staff.joiningDate,
        bankAccountNo: payroll.staff.bankAccountNo,
      },
      earnings: {
        basicSalary: Number(payroll.basicSalary),
        allowances: payroll.allowances || {},
      },
      deductions: payroll.deductions || {},
      netSalary: Number(payroll.netSalary),
    };
  }
}
