import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateEmployeeDto,
  UpdateEmployeeDto,
  UpdateStatusDto,
  MakeTechnicianDto,
} from './dto/create-employee.dto';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { Prisma, StaffStatus } from '@prisma/client';
import { Response } from 'express';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { BranchScopeService } from '../common/branch/branch-scope.service';
import { storageService } from '../common/upload/storage.service';
import {
  resolvePrivateFilePath,
  streamLocalFile,
} from '../common/upload/private-file.helper';

export const STAFF_SELECT_SAFE = {
  id: true,
  employeeId: true,
  name: true,
  email: true,
  phone: true,
  photo: true,
  address: true,
  birthCertificateUrl: true,
  bonusLimit: true,
  adminPanelAccess: true,
  isTechnician: true,
  commissionRate: true,
  emergencyContactName: true,
  emergencyContactPhone: true,
  emergencyContactRelationship: true,
  sendCredentialsEmailOnCreate: true,
  gender: true,
  dob: true,
  nidNumber: true,
  roleId: true,
  role: { select: { id: true, name: true, scope: true } },
  departmentId: true,
  department: { select: { id: true, name: true } },
  branchId: true,
  branch: { select: { id: true, name: true, code: true } },
  branchAccess: {
    select: {
      id: true,
      branchId: true,
      branch: { select: { id: true, name: true, code: true } },
    },
  },
  employmentType: true,
  joiningDate: true,
  reportingManagerId: true,
  reportingManager: { select: { id: true, name: true, employeeId: true } },
  status: true,
  basicSalary: true,
  allowances: true,
  paymentMethod: true,
  bankAccountNo: true,
  createdAt: true,
  updatedAt: true,
};

@Injectable()
export class EmployeeService {
  constructor(
    private prisma: PrismaService,
    private branchScopeService: BranchScopeService,
  ) {}

  private async generateNextEmployeeId(): Promise<string> {
    const lastStaff = await this.prisma.staff.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { employeeId: true },
    });

    if (!lastStaff || !lastStaff.employeeId) {
      return 'EMP-0001';
    }

    const match = lastStaff.employeeId.match(/EMP-(\d+)/);
    if (match) {
      const nextNum = parseInt(match[1], 10) + 1;
      return `EMP-${String(nextNum).padStart(4, '0')}`;
    }

    const count = await this.prisma.staff.count();
    return `EMP-${String(count + 1).padStart(4, '0')}`;
  }

  private mapStaffAccess(staff: any) {
    const access = staff.role?.scope === 'GLOBAL' ? 'Admin' : 'Branch Only';
    return {
      ...staff,
      access,
    };
  }

  async findAll(
    query?: {
      department?: string;
      role?: string;
      branch?: string;
      status?: StaffStatus;
      search?: string;
      page?: number;
      limit?: number;
    },
    user?: JwtPayload,
  ) {
    const page = Math.max(1, Number(query?.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query?.limit) || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.StaffWhereInput = {};

    // Branch scoping
    const branchFilter = await this.branchScopeService.getBranchFilter(
      user,
      query?.branch,
    );
    if (branchFilter !== undefined) {
      where.OR = [
        { branchId: branchFilter },
        { branchAccess: { some: { branchId: branchFilter } } },
      ];
    } else if (query?.branch) {
      where.OR = [
        { branchId: query.branch },
        { branchAccess: { some: { branchId: query.branch } } },
      ];
    }

    if (query?.department) where.departmentId = query.department;
    if (query?.role) {
      where.OR = [
        { roleId: query.role },
        { role: { name: { equals: query.role, mode: 'insensitive' } } },
      ];
    }
    if (query?.status) where.status = query.status;

    if (query?.search?.trim()) {
      const term = query.search.trim();
      where.OR = [
        { name: { contains: term, mode: 'insensitive' } },
        { email: { contains: term, mode: 'insensitive' } },
        { phone: { contains: term, mode: 'insensitive' } },
        { employeeId: { contains: term, mode: 'insensitive' } },
      ];
    }

    const [total, rawData] = await Promise.all([
      this.prisma.staff.count({ where }),
      this.prisma.staff.findMany({
        where,
        select: STAFF_SELECT_SAFE,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    const data = rawData.map((s) => this.mapStaffAccess(s));

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async findOne(id: string, user?: JwtPayload) {
    const staff = await this.prisma.staff.findUnique({
      where: { id },
      select: {
        ...STAFF_SELECT_SAFE,
        managedBranches: { select: { id: true, name: true, code: true } },
        headOfDepartments: { select: { id: true, name: true } },
        reports: {
          select: { id: true, name: true, employeeId: true, status: true },
        },
      },
    });

    if (!staff)
      throw new NotFoundException(`Employee with ID "${id}" not found.`);

    if (user && user.sub !== id) {
      await this.branchScopeService.validateBranchAccess(user, staff.branchId);
    }

    return this.mapStaffAccess(staff);
  }

  async streamEmployeeDocument(
    id: string,
    field: string,
    user: JwtPayload,
    res: Response,
  ) {
    const staff = await this.prisma.staff.findUnique({
      where: { id },
      select: {
        id: true,
        branchId: true,
        photo: true,
        birthCertificateUrl: true,
      },
    });

    if (!staff) {
      throw new NotFoundException('Employee not found.');
    }

    if (user.sub !== id) {
      await this.branchScopeService.validateBranchAccess(user, staff.branchId);
    }

    let filePathOrUrl: string | null = null;
    const norm = field.toLowerCase();
    if (norm === 'photo' || norm === 'profilephoto') {
      filePathOrUrl = staff.photo;
    } else if (
      norm === 'birthcertificate' ||
      norm === 'birthcertificateurl' ||
      norm === 'nid'
    ) {
      filePathOrUrl = staff.birthCertificateUrl;
    } else {
      throw new BadRequestException(
        `Invalid document field "${field}". Allowed: photo, birthCertificate.`,
      );
    }

    if (!filePathOrUrl) {
      throw new NotFoundException(`No document attached for field "${field}".`);
    }

    const resolved = resolvePrivateFilePath('staff-documents', filePathOrUrl);
    if (!resolved) {
      throw new NotFoundException('Document file not found on disk.');
    }

    streamLocalFile(resolved, res);
  }

  async create(dto: CreateEmployeeDto, user?: JwtPayload) {
    const rawPassword =
      dto.password || crypto.randomBytes(8).toString('hex') + '!Aa1';
    const passwordHash = await bcrypt.hash(rawPassword, 10);
    const employeeId = await this.generateNextEmployeeId();

    const branchIds =
      dto.branchIds && dto.branchIds.length > 0
        ? [...dto.branchIds]
        : dto.branchId
          ? [dto.branchId]
          : [];

    if (user) {
      const scope = await this.branchScopeService.resolveScope(user);
      if (!scope.isGlobal) {
        if (branchIds.length === 0 && scope.allowedBranchIds.length === 1) {
          branchIds.push(scope.allowedBranchIds[0]);
        }
        for (const bid of branchIds) {
          if (!scope.allowedBranchIds.includes(bid)) {
            throw new ForbiddenException(
              `You cannot assign an employee to branch "${bid}" without branch access.`,
            );
          }
        }
      }
    }

    const primaryBranchId =
      branchIds.length > 0 ? branchIds[0] : dto.branchId || null;

    try {
      return await this.prisma.$transaction(async (tx) => {
        const staff = await tx.staff.create({
          data: {
            employeeId,
            name: dto.name,
            email: dto.email.toLowerCase().trim(),
            phone: dto.phone.trim(),
            passwordHash,
            photo: dto.photo || null,
            address: dto.address || null,
            birthCertificateUrl: dto.birthCertificateUrl || null,
            bonusLimit:
              dto.bonusLimit !== undefined
                ? new Prisma.Decimal(dto.bonusLimit)
                : new Prisma.Decimal(0),
            adminPanelAccess: dto.adminPanelAccess ?? false,
            isTechnician: dto.isTechnician ?? false,
            commissionRate:
              dto.commissionRate !== undefined
                ? new Prisma.Decimal(dto.commissionRate)
                : new Prisma.Decimal(0),
            emergencyContactName: dto.emergencyContactName || null,
            emergencyContactPhone: dto.emergencyContactPhone || null,
            emergencyContactRelationship:
              dto.emergencyContactRelationship || null,
            sendCredentialsEmailOnCreate: dto.sendCredentialsEmail ?? false,
            gender: dto.gender || null,
            dob: dto.dob ? new Date(dto.dob) : null,
            nidNumber: dto.nidNumber || null,
            roleId: dto.roleId,
            departmentId: dto.departmentId || null,
            branchId: primaryBranchId,
            employmentType: dto.employmentType || 'FULL_TIME',
            joiningDate: dto.joiningDate
              ? new Date(dto.joiningDate)
              : new Date(),
            reportingManagerId: dto.reportingManagerId || null,
            status: dto.status || StaffStatus.ACTIVE,
            basicSalary: dto.basicSalary
              ? new Prisma.Decimal(dto.basicSalary)
              : new Prisma.Decimal(0),
            allowances: dto.allowances ? (dto.allowances as any) : undefined,
            paymentMethod: dto.paymentMethod || null,
            bankAccountNo: dto.bankAccountNo || null,
          },
        });

        if (branchIds.length > 0) {
          await tx.staffBranchAccess.createMany({
            data: branchIds.map((bId) => ({
              staffId: staff.id,
              branchId: bId,
            })),
            skipDuplicates: true,
          });
        }

        const fullStaff = await tx.staff.findUnique({
          where: { id: staff.id },
          select: STAFF_SELECT_SAFE,
        });

        return this.mapStaffAccess(fullStaff);
      });
    } catch (e: any) {
      if (e.code === 'P2002') {
        const target = e.meta?.target || [];
        throw new ConflictException(
          `An employee with this ${Array.isArray(target) ? target.join('/') : 'email/phone'} already exists.`,
        );
      }
      throw e;
    }
  }

  async update(id: string, dto: UpdateEmployeeDto) {
    await this.findOne(id);

    const updateData: Prisma.StaffUpdateInput = {};

    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.email !== undefined)
      updateData.email = dto.email.toLowerCase().trim();
    if (dto.phone !== undefined) updateData.phone = dto.phone.trim();
    if (dto.password) {
      updateData.passwordHash = await bcrypt.hash(dto.password, 10);
    }
    if (dto.photo !== undefined) updateData.photo = dto.photo || null;
    if (dto.address !== undefined) updateData.address = dto.address || null;
    if (dto.birthCertificateUrl !== undefined)
      updateData.birthCertificateUrl = dto.birthCertificateUrl || null;
    if (dto.bonusLimit !== undefined)
      updateData.bonusLimit = new Prisma.Decimal(dto.bonusLimit);
    if (dto.adminPanelAccess !== undefined)
      updateData.adminPanelAccess = dto.adminPanelAccess;
    if (dto.isTechnician !== undefined)
      updateData.isTechnician = dto.isTechnician;
    if (dto.commissionRate !== undefined)
      updateData.commissionRate = new Prisma.Decimal(dto.commissionRate);
    if (dto.emergencyContactName !== undefined)
      updateData.emergencyContactName = dto.emergencyContactName || null;
    if (dto.emergencyContactPhone !== undefined)
      updateData.emergencyContactPhone = dto.emergencyContactPhone || null;
    if (dto.emergencyContactRelationship !== undefined)
      updateData.emergencyContactRelationship =
        dto.emergencyContactRelationship || null;
    if (dto.sendCredentialsEmail !== undefined)
      updateData.sendCredentialsEmailOnCreate = dto.sendCredentialsEmail;

    if (dto.gender !== undefined) updateData.gender = dto.gender || null;
    if (dto.dob !== undefined)
      updateData.dob = dto.dob ? new Date(dto.dob) : null;
    if (dto.nidNumber !== undefined)
      updateData.nidNumber = dto.nidNumber || null;
    if (dto.roleId !== undefined)
      updateData.role = { connect: { id: dto.roleId } };
    if (dto.departmentId !== undefined) {
      updateData.department = dto.departmentId
        ? { connect: { id: dto.departmentId } }
        : { disconnect: true };
    }

    if (dto.branchIds !== undefined) {
      const primaryId = dto.branchIds.length > 0 ? dto.branchIds[0] : null;
      updateData.branch = primaryId
        ? { connect: { id: primaryId } }
        : { disconnect: true };
    } else if (dto.branchId !== undefined) {
      updateData.branch = dto.branchId
        ? { connect: { id: dto.branchId } }
        : { disconnect: true };
    }

    if (dto.employmentType !== undefined)
      updateData.employmentType = dto.employmentType;
    if (dto.joiningDate !== undefined) {
      updateData.joiningDate = dto.joiningDate
        ? new Date(dto.joiningDate)
        : undefined;
    }
    if (dto.reportingManagerId !== undefined) {
      updateData.reportingManager = dto.reportingManagerId
        ? { connect: { id: dto.reportingManagerId } }
        : { disconnect: true };
    }
    if (dto.status !== undefined) updateData.status = dto.status;
    if (dto.basicSalary !== undefined)
      updateData.basicSalary = new Prisma.Decimal(dto.basicSalary);
    if (dto.allowances !== undefined) updateData.allowances = dto.allowances;
    if (dto.paymentMethod !== undefined)
      updateData.paymentMethod = dto.paymentMethod || null;
    if (dto.bankAccountNo !== undefined)
      updateData.bankAccountNo = dto.bankAccountNo || null;

    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.staff.update({
          where: { id },
          data: updateData,
        });

        if (dto.branchIds !== undefined) {
          await tx.staffBranchAccess.deleteMany({
            where: { staffId: id },
          });

          if (dto.branchIds.length > 0) {
            await tx.staffBranchAccess.createMany({
              data: dto.branchIds.map((bId) => ({
                staffId: id,
                branchId: bId,
              })),
              skipDuplicates: true,
            });
          }
        }

        const fullStaff = await tx.staff.findUnique({
          where: { id },
          select: STAFF_SELECT_SAFE,
        });

        return this.mapStaffAccess(fullStaff);
      });
    } catch (e: any) {
      if (e.code === 'P2002') {
        throw new ConflictException(
          'An employee with this email or phone already exists.',
        );
      }
      throw e;
    }
  }

  async resetPassword(id: string) {
    const staff = await this.findOne(id);
    const tempPassword = `Nova@${Math.floor(100000 + Math.random() * 900000)}`;
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    await this.prisma.staff.update({
      where: { id },
      data: { passwordHash },
    });

    return {
      message: `Password reset successfully for ${staff.name}.`,
      tempPassword,
    };
  }

  async updateStatus(id: string, dto: UpdateStatusDto) {
    await this.findOne(id);
    const updated = await this.prisma.staff.update({
      where: { id },
      data: { status: dto.status },
      select: STAFF_SELECT_SAFE,
    });
    return this.mapStaffAccess(updated);
  }

  async remove(id: string) {
    const staff = await this.prisma.staff.findUnique({
      where: { id },
      include: {
        managedBranches: { select: { id: true, name: true } },
        headOfDepartments: { select: { id: true, name: true } },
        _count: {
          select: {
            Order: true,
            ServiceJob: true,
            Payroll: true,
            Expense: true,
            StockAdjustment: true,
            WastedProduct: true,
            SupplierPayment: true,
            recordedWalletTransactions: true,
          },
        },
      },
    });

    if (!staff)
      throw new NotFoundException(`Employee with ID "${id}" not found.`);

    const blockers: string[] = [];
    const blockerCounts: Record<string, any> = {};

    if (staff.managedBranches.length > 0) {
      blockers.push(
        `assigned as Branch Manager for "${staff.managedBranches[0].name}"`,
      );
      blockerCounts.managedBranches = staff.managedBranches.length;
    }

    if (staff.headOfDepartments.length > 0) {
      blockers.push(
        `Department Head of "${staff.headOfDepartments[0].name}"`,
      );
      blockerCounts.headOfDepartments = staff.headOfDepartments.length;
    }

    if (staff._count.Order > 0) {
      blockers.push(`${staff._count.Order} historical order(s)`);
      blockerCounts.orders = staff._count.Order;
    }

    if (staff._count.ServiceJob > 0) {
      blockers.push(`${staff._count.ServiceJob} service job(s)`);
      blockerCounts.serviceJobs = staff._count.ServiceJob;
    }

    if (staff._count.Payroll > 0) {
      blockers.push(`${staff._count.Payroll} payroll record(s)`);
      blockerCounts.payrolls = staff._count.Payroll;
    }

    if (staff._count.Expense > 0) {
      blockers.push(`${staff._count.Expense} expense record(s)`);
      blockerCounts.expenses = staff._count.Expense;
    }

    if (staff._count.StockAdjustment > 0) {
      blockers.push(`${staff._count.StockAdjustment} stock adjustment(s)`);
      blockerCounts.stockAdjustments = staff._count.StockAdjustment;
    }

    if (staff._count.WastedProduct > 0) {
      blockers.push(`${staff._count.WastedProduct} wasted product record(s)`);
      blockerCounts.wastedProducts = staff._count.WastedProduct;
    }

    if (staff._count.SupplierPayment > 0) {
      blockers.push(`${staff._count.SupplierPayment} supplier payment(s) recorded`);
      blockerCounts.supplierPayments = staff._count.SupplierPayment;
    }

    if (blockers.length > 0) {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        message: `Cannot delete employee "${staff.name}". Blockers: ${blockers.join(', ')}. Please mark them as INACTIVE, SUSPENDED, or TERMINATED instead.`,
        canDeactivate: true,
        blockers: blockerCounts,
      });
    }

    // Safely remove employee uploads if hard deleted
    if (staff.photo) {
      await storageService.safeUnlink(staff.photo);
    }
    if (staff.birthCertificateUrl) {
      await storageService.safeUnlink(staff.birthCertificateUrl);
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.staffBranchAccess.deleteMany({ where: { staffId: id } });
      await tx.refreshToken.deleteMany({ where: { staffId: id } });
      return tx.staff.delete({
        where: { id },
        select: { id: true, name: true, employeeId: true },
      });
    });
  }

  // ============================= TECHNICIANS =============================

  async findTechnicians() {
    const techs = await this.prisma.staff.findMany({
      where: {
        OR: [
          { isTechnician: true },
          { role: { name: { contains: 'technician', mode: 'insensitive' } } },
        ],
      },
      select: {
        ...STAFF_SELECT_SAFE,
        ServiceJob: {
          select: {
            id: true,
            status: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    return techs.map((t) => {
      const activeJobs = t.ServiceJob.filter(
        (j) => j.status === 'PENDING' || j.status === 'IN_PROGRESS',
      ).length;
      const completedJobs = t.ServiceJob.filter(
        (j) => j.status === 'READY_FOR_PICKUP' || j.status === 'DELIVERED',
      ).length;

      const { ServiceJob, ...rest } = t;
      const mapped = this.mapStaffAccess(rest);
      return {
        ...mapped,
        activeJobsCount: activeJobs,
        completedJobsCount: completedJobs,
        totalJobsCount: t.ServiceJob.length,
      };
    });
  }

  async findEligibleForTechnician() {
    return this.prisma.staff.findMany({
      where: {
        status: StaffStatus.ACTIVE,
        isTechnician: false,
      },
      select: {
        id: true,
        name: true,
        employeeId: true,
        phone: true,
        email: true,
        photo: true,
        department: { select: { id: true, name: true } },
        role: { select: { id: true, name: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async makeTechnician(id: string, dto: MakeTechnicianDto) {
    await this.findOne(id);
    const updated = await this.prisma.staff.update({
      where: { id },
      data: {
        isTechnician: true,
        commissionRate: new Prisma.Decimal(dto.commissionRate || 0),
      },
      select: STAFF_SELECT_SAFE,
    });
    return this.mapStaffAccess(updated);
  }

  async updateTechnician(id: string, dto: MakeTechnicianDto) {
    await this.findOne(id);
    const updated = await this.prisma.staff.update({
      where: { id },
      data: {
        commissionRate: new Prisma.Decimal(dto.commissionRate || 0),
      },
      select: STAFF_SELECT_SAFE,
    });
    return this.mapStaffAccess(updated);
  }

  async removeTechnician(id: string) {
    await this.findOne(id);
    const updated = await this.prisma.staff.update({
      where: { id },
      data: {
        isTechnician: false,
      },
      select: STAFF_SELECT_SAFE,
    });
    return this.mapStaffAccess(updated);
  }
}
