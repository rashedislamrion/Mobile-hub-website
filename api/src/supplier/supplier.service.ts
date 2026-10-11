import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateSupplierDto,
  UpdateSupplierDto,
  CreateSupplierPaymentDto,
} from './dto/supplier.dto';
import { Prisma, StaffStatus, WalletTxnType } from '@prisma/client';
import { storageService } from '../common/upload/storage.service';

@Injectable()
export class SupplierService {
  constructor(private prisma: PrismaService) {}

  // ============================= SUPPLIERS =============================

  async findAllSuppliers(query?: {
    status?: StaffStatus;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, Number(query?.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query?.limit) || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.SupplierWhereInput = {};

    if (query?.status) where.status = query.status;

    if (query?.search?.trim()) {
      const term = query.search.trim();
      where.OR = [
        { name: { contains: term, mode: 'insensitive' } },
        { companyName: { contains: term, mode: 'insensitive' } },
        { contactPerson: { contains: term, mode: 'insensitive' } },
        { phone: { contains: term, mode: 'insensitive' } },
        { email: { contains: term, mode: 'insensitive' } },
      ];
    }

    const [total, data] = await Promise.all([
      this.prisma.supplier.count({ where }),
      this.prisma.supplier.findMany({
        where,
        include: {
          purchaseOrders: {
            select: { grandTotal: true },
          },
          _count: {
            select: { purchaseOrders: true, payments: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    const mapped = data.map((supplier) => {
      const totalSpent = (supplier.purchaseOrders || []).reduce(
        (sum, po) => sum + Number(po.grandTotal || 0),
        0,
      );
      const { purchaseOrders, ...rest } = supplier;
      return {
        ...rest,
        totalSpent,
      };
    });

    return {
      data: mapped,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOneSupplier(id: string) {
    const supplier = await this.prisma.supplier.findUnique({
      where: { id },
      include: {
        purchaseOrders: {
          orderBy: { createdAt: 'desc' },
          include: {
            branch: { select: { id: true, name: true } },
            items: {
              include: {
                product: { select: { id: true, name: true } },
                variant: true,
              },
            },
          },
        },
        payments: {
          orderBy: { createdAt: 'desc' },
          include: {
            walletType: { select: { id: true, name: true } },
            recordedBy: { select: { id: true, name: true } },
          },
        },
        _count: {
          select: { purchaseOrders: true, payments: true },
        },
      },
    });

    if (!supplier)
      throw new NotFoundException(`Supplier with ID "${id}" not found.`);
    return supplier;
  }

  async createSupplier(dto: CreateSupplierDto) {
    return this.prisma.supplier.create({
      data: {
        name: dto.name,
        companyName: dto.companyName || null,
        logo: dto.logo || null,
        contactPerson: dto.contactPerson || dto.name,
        phone: dto.phone,
        email: dto.email || null,
        address: dto.address,
        productsCategory: dto.productsCategory || null,
        productsSupplied: dto.productsSupplied || [],
        paymentTerms: dto.paymentTerms || 'COD',
        advanceBalance: dto.advanceBalance || 0,
        totalDue: dto.totalDue || 0,
        status: dto.status || StaffStatus.ACTIVE,
      },
    });
  }

  async updateSupplier(id: string, dto: UpdateSupplierDto) {
    await this.findOneSupplier(id);

    return this.prisma.supplier.update({
      where: { id },
      data: {
        name: dto.name,
        companyName:
          dto.companyName !== undefined ? dto.companyName || null : undefined,
        logo: dto.logo !== undefined ? dto.logo || null : undefined,
        contactPerson: dto.contactPerson,
        phone: dto.phone,
        email: dto.email !== undefined ? dto.email || null : undefined,
        address: dto.address,
        productsCategory:
          dto.productsCategory !== undefined
            ? dto.productsCategory || null
            : undefined,
        productsSupplied: dto.productsSupplied,
        paymentTerms: dto.paymentTerms,
        advanceBalance:
          dto.advanceBalance !== undefined ? dto.advanceBalance : undefined,
        status: dto.status,
      },
    });
  }

  async removeSupplier(id: string) {
    const supplier = await this.findOneSupplier(id);

    const blockers: string[] = [];
    const blockerCounts: Record<string, any> = {};

    if (Number(supplier.totalDue) > 0) {
      blockers.push(`outstanding due amount of ৳${Number(supplier.totalDue).toLocaleString()}`);
      blockerCounts.totalDue = Number(supplier.totalDue);
    }

    if (supplier._count.purchaseOrders > 0) {
      blockers.push(`${supplier._count.purchaseOrders} purchase order(s)`);
      blockerCounts.purchaseOrders = supplier._count.purchaseOrders;
    }

    if (supplier._count.payments > 0) {
      blockers.push(`${supplier._count.payments} payment record(s)`);
      blockerCounts.payments = supplier._count.payments;
    }

    if (blockers.length > 0) {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        message: `Cannot delete supplier "${supplier.name}". Blocker details: ${blockers.join(', ')}. Please mark them as INACTIVE instead.`,
        canDeactivate: true,
        blockers: blockerCounts,
      });
    }

    if (supplier.logo) {
      await storageService.safeUnlink(supplier.logo);
    }

    return this.prisma.supplier.delete({ where: { id } });
  }

  // ============================= SUPPLIER PAYMENTS =============================

  async findAllPayments(query?: {
    supplier?: string;
    method?: string;
    dateFrom?: string;
    dateTo?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, Number(query?.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query?.limit) || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.SupplierPaymentWhereInput = {};

    if (query?.supplier) where.supplierId = query.supplier;
    if (query?.method)
      where.method = { contains: query.method, mode: 'insensitive' };

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
        { note: { contains: term, mode: 'insensitive' } },
        { supplier: { name: { contains: term, mode: 'insensitive' } } },
      ];
    }

    const [total, data] = await Promise.all([
      this.prisma.supplierPayment.count({ where }),
      this.prisma.supplierPayment.findMany({
        where,
        include: {
          supplier: { select: { id: true, name: true, phone: true } },
          walletType: { select: { id: true, name: true, kind: true } },
          purchaseOrder: { select: { id: true, poNumber: true } },
          recordedBy: { select: { id: true, name: true, employeeId: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async createPayment(dto: CreateSupplierPaymentDto, recordedById: string) {
    const supplier = await this.findOneSupplier(dto.supplierId);
    const amount = Number(dto.amount || dto.amountPaid || 0);
    const extraDiscount = Number(dto.extraDiscount || 0);
    const effectiveReduction = amount + extraDiscount;
    const method = dto.method || dto.paymentMethod || 'BANK_TRANSFER';
    const totalDue = Number(supplier.totalDue);

    if (effectiveReduction > totalDue) {
      throw new BadRequestException(
        `Total settlement amount of ৳${effectiveReduction.toLocaleString()} exceeds the supplier's total due balance of ৳${totalDue.toLocaleString()}.`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const wallet = await tx.walletType.findUnique({
        where: { id: dto.walletTypeId },
      });
      if (!wallet)
        throw new NotFoundException('Selected payment wallet not found.');

      const currentBal = Number(wallet.currentBalance);
      if (currentBal < amount) {
        throw new BadRequestException(
          `Insufficient balance in wallet "${wallet.name}". Required: ৳${amount.toLocaleString()}, Available: ৳${currentBal.toLocaleString()}.`,
        );
      }

      const newWalletBal = currentBal - amount;
      await tx.walletType.update({
        where: { id: dto.walletTypeId },
        data: { currentBalance: newWalletBal },
      });

      const referenceNo = `SPAY-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;

      const noteText = dto.notes || dto.note || '';
      const fullNote =
        extraDiscount > 0
          ? `Payment: ৳${amount.toLocaleString()} + Discount: ৳${extraDiscount.toLocaleString()}${noteText ? ` (${noteText})` : ''}`
          : noteText;

      const walletTxn = await tx.walletTransaction.create({
        data: {
          walletTypeId: dto.walletTypeId,
          type: WalletTxnType.WITHDRAWAL,
          amount,
          referenceNo: `TXN-${referenceNo}`,
          note: `Payment to supplier ${supplier.name}${fullNote ? `: ${fullNote}` : ''}`,
          recordedById,
          balanceAfter: newWalletBal,
        },
      });

      // PO Allocation
      let targetPoIds: string[] = [];
      if (dto.purchaseOrderIds && dto.purchaseOrderIds.length > 0) {
        targetPoIds = dto.purchaseOrderIds;
      } else if (dto.purchaseOrderId) {
        targetPoIds = [dto.purchaseOrderId];
      }

      let posToUpdate: any[] = [];
      if (targetPoIds.length > 0) {
        posToUpdate = await tx.purchaseOrder.findMany({
          where: {
            id: { in: targetPoIds },
            supplierId: dto.supplierId,
          },
          orderBy: { createdAt: 'asc' },
        });
      } else {
        // Quick payment: oldest unpaid POs first
        posToUpdate = await tx.purchaseOrder.findMany({
          where: {
            supplierId: dto.supplierId,
            dueAmount: { gt: 0 },
          },
          orderBy: { createdAt: 'asc' },
        });
      }

      let remainingToAllocate = effectiveReduction;
      for (const po of posToUpdate) {
        if (remainingToAllocate <= 0) break;
        const currentPoDue = Number(po.dueAmount || 0);
        if (currentPoDue <= 0) continue;

        const alloc = Math.min(currentPoDue, remainingToAllocate);
        const newPoDue = currentPoDue - alloc;
        const newPoPaid = Number(po.amountPaid || 0) + alloc;

        await tx.purchaseOrder.update({
          where: { id: po.id },
          data: {
            dueAmount: newPoDue,
            amountPaid: newPoPaid,
          },
        });

        remainingToAllocate -= alloc;
      }

      const newTotalDue = Math.max(0, totalDue - effectiveReduction);
      await tx.supplier.update({
        where: { id: dto.supplierId },
        data: { totalDue: newTotalDue },
      });

      const payment = await tx.supplierPayment.create({
        data: {
          referenceNo,
          supplierId: dto.supplierId,
          amount,
          method,
          walletTypeId: dto.walletTypeId,
          purchaseOrderId: posToUpdate[0]?.id || null,
          note: fullNote || null,
          recordedById,
        },
        include: {
          supplier: true,
          walletType: true,
          purchaseOrder: true,
          recordedBy: { select: { id: true, name: true } },
        },
      });

      return { ...payment, payment, walletTransaction: walletTxn };
    });
  }
}
