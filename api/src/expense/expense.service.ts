import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateExpenseCategoryDto,
  UpdateExpenseCategoryDto,
  CreateExpenseDto,
  MarkExpensePaidDto,
} from './dto/expense.dto';
import { ExpenseStatus, Prisma, WalletTxnType } from '@prisma/client';
import { Response } from 'express';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { BranchScopeService } from '../common/branch/branch-scope.service';
import {
  resolvePrivateFilePath,
  streamLocalFile,
} from '../common/upload/private-file.helper';
import { storageService } from '../common/upload/storage.service';

@Injectable()
export class ExpenseService {
  constructor(
    private prisma: PrismaService,
    private branchScopeService: BranchScopeService,
  ) {}

  // ============================= CATEGORIES =============================

  async findAllCategories() {
    const now = new Date();
    const startOfMonth = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
    );

    const categories = await this.prisma.expenseCategory.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { expenses: true } },
        expenses: {
          where: {
            createdAt: { gte: startOfMonth },
            status: ExpenseStatus.PAID,
          },
          select: { amount: true },
        },
      },
    });

    return categories.map((cat) => {
      const thisMonthSpent = cat.expenses.reduce(
        (sum, e) => sum + Number(e.amount),
        0,
      );
      const budget = cat.monthlyBudget ? Number(cat.monthlyBudget) : 0;
      const budgetRemaining = budget > 0 ? Math.max(0, budget - thisMonthSpent) : null;
      return {
        id: cat.id,
        name: cat.name,
        icon: cat.icon,
        monthlyBudget: cat.monthlyBudget ? Number(cat.monthlyBudget) : null,
        expenseCount: cat._count.expenses,
        thisMonthSpent,
        budgetRemaining,
      };
    });
  }

  async findOneCategory(id: string) {
    const cat = await this.prisma.expenseCategory.findUnique({
      where: { id },
      include: {
        _count: { select: { expenses: true } },
      },
    });
    if (!cat) throw new NotFoundException(`Expense Category "${id}" not found.`);
    return cat;
  }

  async createCategory(dto: CreateExpenseCategoryDto) {
    const existing = await this.prisma.expenseCategory.findUnique({
      where: { name: dto.name },
    });
    if (existing) {
      throw new ConflictException(
        'An expense category with this name already exists.',
      );
    }
    return this.prisma.expenseCategory.create({
      data: {
        name: dto.name,
        icon: dto.icon || 'receipt',
        monthlyBudget: dto.monthlyBudget ? new Prisma.Decimal(dto.monthlyBudget) : null,
      },
    });
  }

  async updateCategory(id: string, dto: UpdateExpenseCategoryDto) {
    await this.findOneCategory(id);
    return this.prisma.expenseCategory.update({
      where: { id },
      data: {
        name: dto.name,
        icon: dto.icon,
        monthlyBudget:
          dto.monthlyBudget !== undefined
            ? dto.monthlyBudget
              ? new Prisma.Decimal(dto.monthlyBudget)
              : null
            : undefined,
      },
    });
  }

  async removeCategory(id: string) {
    const cat = await this.findOneCategory(id);
    const count = await this.prisma.expense.count({ where: { categoryId: id } });
    if (count > 0) {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        message: `Cannot delete expense category "${cat.name}". It has ${count} linked expense record(s). Reassign or delete those records first.`,
        blockers: { expenses: count },
      });
    }
    return this.prisma.expenseCategory.delete({ where: { id } });
  }

  // ============================= EXPENSES =============================

  async findAllExpenses(
    query?: {
      branch?: string;
      category?: string;
      status?: ExpenseStatus;
      dateFrom?: string;
      dateTo?: string;
      search?: string;
      page?: number;
      limit?: number;
    },
    user?: JwtPayload,
  ) {
    const page = Math.max(1, Number(query?.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query?.limit) || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.ExpenseWhereInput = {};

    // Branch scoping via unified service
    const branchFilter = await this.branchScopeService.getBranchFilter(
      user,
      query?.branch,
    );
    if (branchFilter !== undefined) {
      where.branchId = branchFilter;
    }

    if (query?.category) where.categoryId = query.category;
    if (query?.status) where.status = query.status;

    if (query?.dateFrom || query?.dateTo) {
      where.createdAt = {};
      if (query.dateFrom) where.createdAt.gte = new Date(query.dateFrom);
      if (query.dateTo) {
        const to = new Date(query.dateTo);
        to.setHours(23, 59, 59, 999);
        where.createdAt.lte = to;
      }
    }

    if (query?.search?.trim()) {
      const term = query.search.trim();
      where.OR = [
        { referenceNo: { contains: term, mode: 'insensitive' } },
        { description: { contains: term, mode: 'insensitive' } },
      ];
    }

    const now = new Date();
    const startOfMonth = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
    );

    const [total, data, thisMonthExpenses] = await Promise.all([
      this.prisma.expense.count({ where }),
      this.prisma.expense.findMany({
        where,
        include: {
          branch: { select: { id: true, name: true, code: true } },
          category: { select: { id: true, name: true, icon: true } },
          walletType: { select: { id: true, name: true, kind: true } },
          recordedBy: { select: { id: true, name: true, employeeId: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.expense.findMany({
        where: {
          createdAt: { gte: startOfMonth },
          ...(branchFilter !== undefined ? { branchId: branchFilter } : {}),
        },
        select: { amount: true, status: true },
      }),
    ]);

    let thisMonthTotal = 0;
    let thisMonthPaid = 0;
    let thisMonthPending = 0;

    for (const exp of thisMonthExpenses) {
      const amt = Number(exp.amount);
      thisMonthTotal += amt;
      if (exp.status === ExpenseStatus.PAID) {
        thisMonthPaid += amt;
      } else {
        thisMonthPending += amt;
      }
    }

    return {
      data,
      summary: {
        thisMonthTotal,
        thisMonthPaid,
        thisMonthPending,
      },
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOneExpense(id: string, user?: JwtPayload) {
    const exp = await this.prisma.expense.findUnique({
      where: { id },
      include: {
        branch: true,
        category: true,
        walletType: true,
        recordedBy: { select: { id: true, name: true, employeeId: true } },
      },
    });
    if (!exp) throw new NotFoundException(`Expense record "${id}" not found.`);
    if (user) {
      await this.branchScopeService.validateBranchAccess(user, exp.branchId);
    }
    return exp;
  }

  async streamAttachment(id: string, user: JwtPayload, res: Response) {
    const exp = await this.prisma.expense.findUnique({
      where: { id },
      select: { id: true, branchId: true, attachmentUrl: true },
    });
    if (!exp) throw new NotFoundException(`Expense record "${id}" not found.`);

    await this.branchScopeService.validateBranchAccess(user, exp.branchId);

    if (!exp.attachmentUrl) {
      throw new NotFoundException('No attachment associated with this expense.');
    }

    const resolved = resolvePrivateFilePath('expenses', exp.attachmentUrl);
    if (!resolved) {
      throw new NotFoundException('Attachment file not found on disk.');
    }

    streamLocalFile(resolved, res);
  }

  async createExpense(
    dto: CreateExpenseDto,
    user: JwtPayload,
    attachmentUrl?: string,
  ) {
    const recordedById = user.sub;
    const amount = Number(dto.amount);
    const referenceNo = `EXP-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;

    const branchId = await this.branchScopeService.determineCreateBranchId(
      user,
      dto.branchId,
    );

    return this.prisma.$transaction(async (tx) => {
      let walletTypeId = dto.walletTypeId;
      if (!walletTypeId) {
        const defaultWallet = await tx.walletType.findFirst();
        if (!defaultWallet) throw new NotFoundException('No wallet found.');
        walletTypeId = defaultWallet.id;
      }

      let walletTxn: any = null;

      // If status is PAID, deduct from wallet
      if (dto.status === ExpenseStatus.PAID) {
        const wallet = await tx.walletType.findUnique({
          where: { id: walletTypeId },
        });
        if (!wallet)
          throw new NotFoundException('Selected expense wallet not found.');

        const currentBal = Number(wallet.currentBalance);
        if (currentBal < amount) {
          throw new BadRequestException(
            `Insufficient balance in wallet "${wallet.name}". Required: ৳${amount.toLocaleString()}, Current Balance: ৳${currentBal.toLocaleString()}.`,
          );
        }

        const newBal = currentBal - amount;
        await tx.walletType.update({
          where: { id: walletTypeId },
          data: { currentBalance: newBal },
        });

        walletTxn = await tx.walletTransaction.create({
          data: {
            walletTypeId,
            type: WalletTxnType.WITHDRAWAL,
            amount,
            referenceNo: `TXN-${referenceNo}`,
            note: `Expense: ${dto.description}`,
            recordedById,
            balanceAfter: newBal,
          },
        });
      }

      const expense = await tx.expense.create({
        data: {
          referenceNo,
          amount,
          description: dto.description,
          status: dto.status || ExpenseStatus.PAID,
          attachmentUrl: attachmentUrl || (dto as any).attachmentUrl || null,
          branchId,
          categoryId: dto.categoryId,
          walletTypeId,
          recordedById,
        },
        include: {
          branch: true,
          category: true,
          walletType: true,
          recordedBy: { select: { id: true, name: true } },
        },
      });

      return { expense, walletTransaction: walletTxn };
    });
  }

  async markPaid(id: string, dto: MarkExpensePaidDto, user: JwtPayload) {
    const exp = await this.findOneExpense(id, user);
    const recordedById = user.sub;

    if (exp.status === ExpenseStatus.PAID) {
      throw new BadRequestException('This expense is already marked as PAID.');
    }

    const amount = Number(exp.amount);

    return this.prisma.$transaction(async (tx) => {
      const walletTypeId = dto.walletTypeId || exp.walletTypeId;
      if (!walletTypeId) {
        throw new BadRequestException(
          'No wallet specified for paying this expense.',
        );
      }

      const wallet = await tx.walletType.findUnique({
        where: { id: walletTypeId },
      });
      if (!wallet) throw new NotFoundException('Selected wallet not found.');

      const currentBal = Number(wallet.currentBalance);
      if (currentBal < amount) {
        throw new BadRequestException(
          `Insufficient balance in wallet "${wallet.name}". Required: ৳${amount.toLocaleString()}, Current Balance: ৳${currentBal.toLocaleString()}.`,
        );
      }

      const newBal = currentBal - amount;
      await tx.walletType.update({
        where: { id: walletTypeId },
        data: { currentBalance: newBal },
      });

      const walletTxn = await tx.walletTransaction.create({
        data: {
          walletTypeId,
          type: WalletTxnType.WITHDRAWAL,
          amount,
          referenceNo: `TXN-${exp.referenceNo}-${Date.now()}`,
          note: `Payment for expense: ${exp.description}`,
          recordedById,
          balanceAfter: newBal,
        },
      });

      const updatedExpense = await tx.expense.update({
        where: { id },
        data: {
          status: ExpenseStatus.PAID,
          walletTypeId,
        },
        include: {
          branch: true,
          category: true,
          walletType: true,
          recordedBy: { select: { id: true, name: true } },
        },
      });

      return { expense: updatedExpense, walletTransaction: walletTxn };
    });
  }

  async removeExpense(id: string, user?: JwtPayload) {
    const exp = await this.findOneExpense(id, user);
    if (exp.status === ExpenseStatus.PAID) {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        message: `Cannot delete paid expense "${exp.referenceNo}". It has ledger/financial impact.`,
      });
    }
    if (exp.attachmentUrl) {
      await storageService.safeUnlink(exp.attachmentUrl);
    }
    return this.prisma.expense.delete({ where: { id } });
  }
}
