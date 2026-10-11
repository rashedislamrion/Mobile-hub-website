import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  OrderStatus,
  PayrollStatus,
  ExpenseStatus,
  Prisma,
  PaymentStatus,
  WalletTxnType,
  SaleType,
  StaffStatus,
  PurchaseOrderStatus,
  ModuleName,
  PermissionAction,
} from '@prisma/client';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { BranchScopeService } from '../common/branch/branch-scope.service';

@Injectable()
export class ReportService {
  constructor(
    private prisma: PrismaService,
    private branchScopeService: BranchScopeService,
  ) {}

  async hasPermission(
    roleId?: string,
    module?: ModuleName,
    action?: PermissionAction,
  ): Promise<boolean> {
    if (!roleId || !module || !action) return false;
    const perm = await this.prisma.rolePermission.findUnique({
      where: {
        roleId_module_action: {
          roleId,
          module,
          action,
        },
      },
    });
    return !!perm?.allowed;
  }

  async isTechnicianUser(
    userId?: string,
    roleId?: string,
    roleName?: string,
  ): Promise<boolean> {
    if (roleName?.toLowerCase().includes('technician')) return true;
    if (userId) {
      const staff = await this.prisma.staff.findUnique({
        where: { id: userId },
        select: { isTechnician: true, role: { select: { name: true } } },
      });
      if (
        staff?.isTechnician ||
        staff?.role?.name?.toLowerCase().includes('technician')
      ) {
        return true;
      }
    }
    if (roleId) {
      const role = await this.prisma.role.findUnique({
        where: { id: roleId },
        select: { name: true },
      });
      if (role?.name?.toLowerCase().includes('technician')) return true;
    }
    return false;
  }

  private async resolveBranchId(
    branchParam?: string,
    user?: JwtPayload,
  ): Promise<any> {
    let resolvedParam = branchParam;
    if (
      branchParam &&
      branchParam !== 'ALL' &&
      branchParam !== 'GLOBAL' &&
      branchParam !== 'All Outlets' &&
      branchParam !== 'All Branches'
    ) {
      const branch = await this.prisma.branch.findFirst({
        where: {
          OR: [
            { id: branchParam },
            { name: { equals: branchParam, mode: 'insensitive' } },
          ],
        },
        select: { id: true },
      });
      if (branch) resolvedParam = branch.id;
    }

    return this.branchScopeService.getBranchFilter(user, resolvedParam);
  }

  // ============================= PRODUCT ANALYTICS =============================

  async getProductAnalytics(
    query?: {
      branch?: string;
      category?: string;
      dateFrom?: string;
      dateTo?: string;
      search?: string;
    },
    user?: JwtPayload,
  ) {
    const branchId = await this.resolveBranchId(query?.branch, user);
    const orderWhere: Prisma.OrderWhereInput = {
      status: {
        in: [
          OrderStatus.DELIVERED,
          OrderStatus.COMPLETED,
          OrderStatus.CONFIRMED,
          OrderStatus.PARCEL_BOOKED,
        ],
      },
    };

    if (branchId) orderWhere.branchId = branchId;
    if (query?.dateFrom || query?.dateTo) {
      orderWhere.createdAt = {};
      if (query.dateFrom) orderWhere.createdAt.gte = new Date(query.dateFrom);
      if (query.dateTo) {
        const to = new Date(query.dateTo);
        to.setHours(23, 59, 59, 999);
        orderWhere.createdAt.lte = to;
      }
    }

    const orderItems = await this.prisma.orderItem.findMany({
      where: {
        order: orderWhere,
        ...(query?.category ? { product: { categoryId: query.category } } : {}),
      },
      include: {
        product: {
          include: {
            category: { select: { id: true, name: true } },
            brand: { select: { id: true, name: true } },
            images: { take: 1 },
            variants: { select: { stock: true } },
          },
        },
        order: { select: { createdAt: true } },
      },
    });

    const productMap = new Map<
      string,
      {
        id: string;
        productId: string;
        name: string;
        category: string;
        brand: string;
        rating: number;
        image: string | null;
        unitsSold: number;
        totalSold: number;
        revenue: number;
        totalRevenue: number;
        totalProfit: number;
        currentStock: number;
        revenueContributionPct: number;
      }
    >();

    for (const item of orderItems) {
      const pId = item.productId;
      const units = item.quantity;
      const rev = Number(item.lineTotal);

      if (!productMap.has(pId)) {
        const stock =
          item.product?.variants?.reduce((sum, v) => sum + (v.stock || 0), 0) ||
          0;
        productMap.set(pId, {
          id: pId,
          productId: pId,
          name: item.productNameSnapshot || item.product?.name || 'Product',
          category: item.product?.category?.name || 'Uncategorized',
          brand: item.product?.brand?.name || 'Brand',
          rating: 4.8,
          image: item.product?.images?.[0]?.url || null,
          unitsSold: 0,
          totalSold: 0,
          revenue: 0,
          totalRevenue: 0,
          totalProfit: 0,
          currentStock: stock,
          revenueContributionPct: 0,
        });
      }

      const p = productMap.get(pId)!;
      p.unitsSold += units;
      p.totalSold += units;
      p.revenue += rev;
      p.totalRevenue += rev;
      p.totalProfit += Math.round(rev * 0.25);
    }

    const products = Array.from(productMap.values()).sort(
      (a, b) => b.totalRevenue - a.totalRevenue,
    );
    const totalRevenue = products.reduce((sum, p) => sum + p.totalRevenue, 0);
    const totalUnitsSold = products.reduce((sum, p) => sum + p.totalSold, 0);

    products.forEach((p) => {
      p.revenueContributionPct =
        totalRevenue > 0
          ? Math.round((p.totalRevenue / totalRevenue) * 100 * 10) / 10
          : 0;
    });

    // 6-month Category Trend
    const now = new Date();
    const monthlyCategoryTrend: any[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1),
      );
      const nextD = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i + 1, 1),
      );
      const label = d.toLocaleString('en-US', {
        month: 'short',
        year: 'numeric',
      });

      const monthItems = orderItems.filter((item) => {
        const itemDate = new Date(item.order.createdAt);
        return itemDate >= d && itemDate < nextD;
      });

      const catAgg: Record<string, number> = {};
      for (const item of monthItems) {
        const cat = item.product?.category?.name || 'Other';
        catAgg[cat] = (catAgg[cat] || 0) + Number(item.lineTotal);
      }

      monthlyCategoryTrend.push({
        month: label,
        Smartphones: catAgg['Smartphones'] || 0,
        Accessories: catAgg['Accessories'] || 0,
        Audio: catAgg['Audio'] || 0,
        Laptops: catAgg['Laptops'] || 0,
        ...catAgg,
      });
    }

    return {
      summary: {
        totalUnitsSold,
        totalRevenue,
        totalProductsSold: products.length,
      },
      topProducts: products.slice(0, 10),
      allProducts: products,
      salesTrendByCategory: monthlyCategoryTrend,
      categoryTrends: monthlyCategoryTrend,
    };
  }

  // ============================= CUSTOMER DUE =============================

  async getCustomerDue(
    query?: {
      branch?: string;
      dueRange?: string;
      dateFrom?: string;
      dateTo?: string;
      search?: string;
    },
    user?: JwtPayload,
  ) {
    const branchId = await this.resolveBranchId(query?.branch, user);
    const orderWhere: Prisma.OrderWhereInput = {
      dueAmount: { gt: 0 },
      status: { notIn: [OrderStatus.CANCELLED, OrderStatus.RETURNED] },
    };

    if (branchId) orderWhere.branchId = branchId;
    if (query?.dateFrom || query?.dateTo) {
      orderWhere.createdAt = {};
      if (query.dateFrom) orderWhere.createdAt.gte = new Date(query.dateFrom);
      if (query.dateTo) {
        const to = new Date(query.dateTo);
        to.setHours(23, 59, 59, 999);
        orderWhere.createdAt.lte = to;
      }
    }

    const orders = await this.prisma.order.findMany({
      where: orderWhere,
      include: {
        customer: {
          select: { id: true, name: true, phone: true, email: true },
        },
        branch: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const customerMap = new Map<
      string,
      {
        id: string;
        customerId: string;
        customerName: string;
        phone: string;
        email: string;
        branch: string;
        source: string;
        totalOrders: number;
        totalSpent: number;
        totalDue: number;
        lastOrderDate: Date;
      }
    >();

    for (const ord of orders) {
      const cId = ord.customerId || `customer-${ord.id}`;
      const derivedSource =
        ord.saleType === 'POS' ? 'POS' : !ord.customerId ? 'Walk-In' : 'Online';
      if (!customerMap.has(cId)) {
        customerMap.set(cId, {
          id: cId,
          customerId: cId,
          customerName: ord.customer?.name || 'Walk-in Customer',
          phone: ord.customer?.phone || 'N/A',
          email: ord.customer?.email || 'N/A',
          branch: ord.branch?.name || 'Global',
          source: derivedSource,
          totalOrders: 0,
          totalSpent: 0,
          totalDue: 0,
          lastOrderDate: ord.createdAt,
        });
      }

      const c = customerMap.get(cId)!;
      c.totalOrders += 1;
      c.totalSpent += Number(ord.totalAmount);
      c.totalDue += Number(ord.dueAmount);
      if (new Date(ord.createdAt) > new Date(c.lastOrderDate)) {
        c.lastOrderDate = ord.createdAt;
      }
    }

    let records = Array.from(customerMap.values()).sort(
      (a, b) => b.totalDue - a.totalDue,
    );

    if (query?.dueRange) {
      if (query.dueRange === '0-1000' || query.dueRange === '0-5000')
        records = records.filter((r) => r.totalDue <= 5000);
      else if (
        query.dueRange === '1000-5000' ||
        query.dueRange === '5000-20000'
      )
        records = records.filter(
          (r) => r.totalDue > 1000 && r.totalDue <= 20000,
        );
      else if (query.dueRange === '5000+' || query.dueRange === '20000+')
        records = records.filter((r) => r.totalDue > 5000);
    }

    if (query?.search?.trim()) {
      const q = query.search.trim().toLowerCase();
      records = records.filter(
        (r) =>
          r.customerName.toLowerCase().includes(q) ||
          r.phone.toLowerCase().includes(q),
      );
    }

    const totalCustomersWithDue = records.length;
    const totalDueAmount = records.reduce((sum, r) => sum + r.totalDue, 0);

    return {
      summary: {
        totalCustomersWithDue,
        totalDueAmount,
        totalDue: totalDueAmount,
        customersWithDueCount: totalCustomersWithDue,
        highDueCount: records.filter((r) => r.totalDue > 5000).length,
      },
      data: records,
      customerDues: records,
    };
  }

  async getUnpaidOrdersForCustomer(customerId: string) {
    const rawId = customerId.startsWith('customer-')
      ? customerId.replace('customer-', '')
      : customerId;
    const orders = await this.prisma.order.findMany({
      where: {
        dueAmount: { gt: 0 },
        status: { notIn: [OrderStatus.CANCELLED, OrderStatus.RETURNED] },
        OR: [{ customerId }, { id: rawId }],
      },
      include: {
        branch: { select: { name: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    return orders.map((o) => ({
      id: o.id,
      orderNumber: o.id.slice(-8).toUpperCase(),
      createdAt: o.createdAt,
      totalAmount: Number(o.totalAmount),
      paidAmount: Number(o.paidAmount),
      dueAmount: Number(o.dueAmount),
      status: o.status,
      branch: o.branch?.name || 'Global',
    }));
  }

  async recordCustomerDuePayment(
    dto: {
      customerId: string;
      amount: number;
      extraDiscount?: number;
      walletTypeId: string;
      paymentMethod?: string;
      paymentDate?: string;
      notes?: string;
      orderIds?: string[];
    },
    staffId?: string,
  ) {
    const amount = Number(dto.amount) || 0;
    const extraDiscount = Number(dto.extraDiscount) || 0;
    const effectiveReduction = amount + extraDiscount;

    if (effectiveReduction <= 0) {
      throw new BadRequestException(
        'Payment amount or discount must be greater than 0.',
      );
    }

    const wallet = await this.prisma.walletType.findUnique({
      where: { id: dto.walletTypeId },
    });
    if (!wallet)
      throw new NotFoundException('Selected deposit wallet not found.');

    const rawId = dto.customerId.startsWith('customer-')
      ? dto.customerId.replace('customer-', '')
      : dto.customerId;
    const orderWhere: Prisma.OrderWhereInput = {
      dueAmount: { gt: 0 },
      status: { notIn: [OrderStatus.CANCELLED, OrderStatus.RETURNED] },
      OR: [{ customerId: dto.customerId }, { id: rawId }],
    };

    if (dto.orderIds && dto.orderIds.length > 0) {
      orderWhere.id = { in: dto.orderIds };
    }

    const unpaidOrders = await this.prisma.order.findMany({
      where: orderWhere,
      orderBy: { createdAt: 'asc' },
    });

    if (unpaidOrders.length === 0) {
      throw new BadRequestException(
        'No unpaid orders found for this customer.',
      );
    }

    const totalDue = unpaidOrders.reduce(
      (sum, o) => sum + Number(o.dueAmount),
      0,
    );
    if (effectiveReduction > totalDue) {
      throw new BadRequestException(
        `Total settlement amount (৳${effectiveReduction.toLocaleString()}) exceeds the customer's total due balance of ৳${totalDue.toLocaleString()}.`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      let recordedById = staffId;
      if (!recordedById) {
        const firstStaff = await tx.staff.findFirst({ select: { id: true } });
        recordedById = firstStaff?.id || 'admin';
      }

      // 1. Credit wallet if amount > 0
      let newWalletBal = Number(wallet.currentBalance);
      if (amount > 0) {
        newWalletBal += amount;
        await tx.walletType.update({
          where: { id: dto.walletTypeId },
          data: { currentBalance: newWalletBal },
        });

        const referenceNo = `TXN-CDUE-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
        const noteText = dto.notes ? `: ${dto.notes}` : '';
        await tx.walletTransaction.create({
          data: {
            walletTypeId: dto.walletTypeId,
            type: WalletTxnType.DEPOSIT,
            amount,
            referenceNo,
            note: `Customer due payment from ${dto.customerId}${extraDiscount > 0 ? ` (Discount: ৳${extraDiscount})` : ''}${noteText}`,
            recordedById,
            balanceAfter: newWalletBal,
          },
        });
      }

      // 2. Allocate payment & discount across target orders
      let remainingToAllocate = effectiveReduction;
      const updatedOrders: any[] = [];

      for (const ord of unpaidOrders) {
        if (remainingToAllocate <= 0) break;
        const currentDue = Number(ord.dueAmount);
        if (currentDue <= 0) continue;

        const alloc = Math.min(currentDue, remainingToAllocate);
        const newDue = currentDue - alloc;
        const newPaid = Number(ord.paidAmount) + alloc;
        const newPaymentStatus =
          newDue === 0 ? PaymentStatus.PAID : PaymentStatus.DUE;

        const updated = await tx.order.update({
          where: { id: ord.id },
          data: {
            dueAmount: newDue,
            paidAmount: newPaid,
            paymentStatus: newPaymentStatus,
          },
        });

        updatedOrders.push(updated);
        remainingToAllocate -= alloc;
      }

      return {
        success: true,
        amountPaid: amount,
        extraDiscount,
        totalSettled: effectiveReduction,
        updatedOrderCount: updatedOrders.length,
        remainingDue: Math.max(0, totalDue - effectiveReduction),
      };
    });
  }

  // ============================= SUPPLIER DUE =============================

  async getSupplierDue(query?: {
    supplier?: string;
    dateFrom?: string;
    dateTo?: string;
    dueRange?: string;
    search?: string;
  }) {
    const where: Prisma.SupplierWhereInput = {};
    if (query?.supplier) where.id = query.supplier;

    const suppliers = await this.prisma.supplier.findMany({
      where,
      include: {
        purchaseOrders: {
          select: {
            grandTotal: true,
            amountPaid: true,
            dueAmount: true,
            createdAt: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    let data = suppliers.map((s) => {
      const totalOrders = s.purchaseOrders.length;
      const totalPurchased = s.purchaseOrders.reduce(
        (sum, po) => sum + Number(po.grandTotal),
        0,
      );
      const totalPaid = s.purchaseOrders.reduce(
        (sum, po) => sum + Number(po.amountPaid),
        0,
      );
      const totalDue = Number(s.totalDue);
      const lastOrder = s.purchaseOrders.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )[0];

      return {
        id: s.id,
        supplierId: s.id,
        supplierName: s.name,
        companyName: s.companyName || s.name,
        name: s.name,
        contactPerson: s.contactPerson,
        phone: s.phone,
        email: s.email,
        totalOrders,
        totalPurchases: totalPurchased,
        totalPurchased,
        totalPaid,
        totalDue,
        lastPurchaseDate: lastOrder ? lastOrder.createdAt : null,
      };
    });

    if (query?.dueRange) {
      if (query.dueRange === '0-50000')
        data = data.filter((s) => s.totalDue <= 50000);
      else if (query.dueRange === '50000-200000')
        data = data.filter((s) => s.totalDue > 50000 && s.totalDue <= 200000);
      else if (query.dueRange === '200000+')
        data = data.filter((s) => s.totalDue > 200000);
    }

    if (query?.search?.trim()) {
      const q = query.search.trim().toLowerCase();
      data = data.filter(
        (s) =>
          s.name.toLowerCase().includes(q) || s.phone.toLowerCase().includes(q),
      );
    }

    const totalSuppliersWithDue = data.filter((s) => s.totalDue > 0).length;
    const totalDueAmount = data.reduce((sum, s) => sum + s.totalDue, 0);

    return {
      summary: {
        totalSuppliers: data.length,
        totalSuppliersWithDue,
        totalDueAmount,
        totalDue: totalDueAmount,
        suppliersWithDueCount: totalSuppliersWithDue,
        highDueCount: data.filter((s) => s.totalDue > 200000).length,
      },
      data,
      supplierDues: data,
    };
  }

  // ============================= WEBSITE SALES =============================
  async getWebsiteSalesReport(
    query?: {
      branch?: string;
      status?: string;
      dateFrom?: string;
      dateTo?: string;
      search?: string;
      page?: number;
      limit?: number;
    },
    user?: JwtPayload,
  ) {
    const branchId = await this.resolveBranchId(query?.branch, user);
    const where: Prisma.OrderWhereInput = {
      NOT: {
        saleType: { in: [SaleType.POS, SaleType.COURIER, SaleType.DIAGNOSING] },
      },
    };

    if (branchId) where.branchId = branchId;
    if (query?.status && query.status !== 'ALL') {
      where.status = query.status as any;
    }
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
      const q = query.search.trim();
      where.OR = [
        { orderCode: { contains: q, mode: 'insensitive' } },
        { customer: { name: { contains: q, mode: 'insensitive' } } },
        { customer: { phone: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const [allMatchingOrders, orders] = await Promise.all([
      this.prisma.order.findMany({
        where,
        select: {
          totalAmount: true,
          status: true,
        },
      }),
      this.prisma.order.findMany({
        where,
        include: {
          customer: {
            select: { id: true, name: true, phone: true, email: true },
          },
          branch: { select: { id: true, name: true } },
          items: {
            include: {
              product: { select: { id: true, name: true, code: true } },
              variant: {
                select: { id: true, color: true, quality: true, sku: true },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const completedTotal = allMatchingOrders
      .filter((o) =>
        [OrderStatus.DELIVERED, OrderStatus.COMPLETED].includes(
          o.status as any,
        ),
      )
      .reduce((sum, o) => sum + Number(o.totalAmount), 0);

    const pendingTotal = allMatchingOrders
      .filter((o) =>
        [
          OrderStatus.PENDING,
          OrderStatus.CONFIRMED,
          OrderStatus.PARCEL_BOOKED,
          OrderStatus.DIAGNOSING,
        ].includes(o.status as any),
      )
      .reduce((sum, o) => sum + Number(o.totalAmount), 0);

    const netTotal = allMatchingOrders
      .filter(
        (o) =>
          ![OrderStatus.CANCELLED, OrderStatus.RETURNED].includes(
            o.status as any,
          ),
      )
      .reduce((sum, o) => sum + Number(o.totalAmount), 0);

    const data = orders.map((o) => {
      const itemsSummary = o.items
        .map(
          (i) =>
            `${i.productNameSnapshot || i.product?.name || 'Product'} (x${i.quantity})`,
        )
        .join(', ');
      return {
        id: o.id,
        orderCode: o.orderCode || `#EM${o.id.slice(-6).toUpperCase()}`,
        orderDate: o.createdAt,
        createdAt: o.createdAt,
        branch: o.branch?.name || 'Main Branch',
        customer: {
          id: o.customer?.id || '',
          name: o.customer?.name || 'Online Customer',
          phone: o.customer?.phone || 'N/A',
          email: o.customer?.email || 'N/A',
        },
        items: o.items.map((i) => ({
          id: i.id,
          productName: i.productNameSnapshot || i.product?.name || 'Product',
          variant: i.variant
            ? `${i.variant.color || ''} ${i.variant.quality || ''}`.trim() ||
              i.variant.sku
            : 'Standard',
          quantity: i.quantity,
          unitPrice: Number(i.unitPrice),
          lineTotal: Number(i.lineTotal),
        })),
        itemsSummary: itemsSummary || 'No items',
        totalAmount: Number(o.totalAmount),
        paidAmount: Number(o.paidAmount),
        dueAmount: Number(o.dueAmount),
        status: o.status,
        paymentStatus: o.paymentStatus,
        paymentMethod: o.paymentMethod || 'Online',
      };
    });

    return {
      summary: {
        totalOrders: allMatchingOrders.length,
        completedTotal,
        pendingTotal,
        netTotal,
        totalSales: netTotal,
      },
      data,
    };
  }

  // ============================= POS SALES =============================
  async getPosSalesReport(
    query?: {
      branch?: string;
      status?: string;
      dateFrom?: string;
      dateTo?: string;
      search?: string;
      staffId?: string;
    },
    user?: JwtPayload,
  ) {
    const branchId = await this.resolveBranchId(query?.branch, user);
    const where: Prisma.OrderWhereInput = {
      saleType: SaleType.POS,
    };

    if (branchId) where.branchId = branchId;
    if (query?.status && query.status !== 'ALL') {
      where.status = query.status as any;
    }
    if (query?.staffId) {
      where.staffId = query.staffId;
    }
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
      const q = query.search.trim();
      where.OR = [
        { orderCode: { contains: q, mode: 'insensitive' } },
        { customer: { name: { contains: q, mode: 'insensitive' } } },
        { customer: { phone: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const dateFilter: { gte?: Date; lte?: Date } = {};
    if (query?.dateFrom) dateFilter.gte = new Date(query.dateFrom);
    if (query?.dateTo) {
      const to = new Date(query.dateTo);
      to.setHours(23, 59, 59, 999);
      dateFilter.lte = to;
    }
    const hasDateFilter = Boolean(query?.dateFrom || query?.dateTo);

    const [posOrders, courierOrders, diagnosingOrders, returnedOrders] =
      await Promise.all([
        this.prisma.order.findMany({
          where,
          include: {
            customer: { select: { id: true, name: true, phone: true } },
            branch: { select: { id: true, name: true } },
            staff: { select: { id: true, name: true } },
            items: {
              include: {
                product: { select: { name: true } },
                variant: { select: { color: true, quality: true, sku: true } },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.order.findMany({
          where: {
            saleType: SaleType.COURIER,
            ...(branchId ? { branchId } : {}),
            ...(hasDateFilter ? { createdAt: dateFilter } : {}),
          },
          select: { totalAmount: true },
        }),
        this.prisma.order.findMany({
          where: {
            saleType: SaleType.DIAGNOSING,
            ...(branchId ? { branchId } : {}),
            ...(hasDateFilter ? { createdAt: dateFilter } : {}),
          },
          select: { totalAmount: true },
        }),
        this.prisma.order.findMany({
          where: {
            status: OrderStatus.RETURNED,
            ...(branchId ? { branchId } : {}),
            ...(hasDateFilter ? { createdAt: dateFilter } : {}),
          },
          select: { totalAmount: true },
        }),
      ]);

    const totalSales = posOrders.reduce(
      (sum, o) => sum + Number(o.totalAmount),
      0,
    );
    const totalDiscount = posOrders.reduce(
      (sum, o) => sum + Number(o.discountAmount),
      0,
    );
    const netSales = Math.max(0, totalSales - totalDiscount);
    const totalUnpaid = posOrders.reduce(
      (sum, o) => sum + Number(o.dueAmount),
      0,
    );
    const courierSales = courierOrders.reduce(
      (sum, o) => sum + Number(o.totalAmount),
      0,
    );
    const diagnosingTotal = diagnosingOrders.reduce(
      (sum, o) => sum + Number(o.totalAmount),
      0,
    );
    const returnedTotal = returnedOrders.reduce(
      (sum, o) => sum + Number(o.totalAmount),
      0,
    );

    const data = posOrders.map((o) => {
      const itemsSummary = o.items
        .map(
          (i) =>
            `${i.productNameSnapshot || i.product?.name || 'Item'} (x${i.quantity})`,
        )
        .join(', ');
      const totalQty = o.items.reduce((sum, i) => sum + i.quantity, 0);
      return {
        id: o.id,
        orderCode: o.orderCode || `#POS-${o.id.slice(-6).toUpperCase()}`,
        createdAt: o.createdAt,
        branch: o.branch?.name || 'Counter',
        customer: {
          id: o.customer?.id || '',
          name: o.customer?.name || 'Walk-in Customer',
          phone: o.customer?.phone || 'N/A',
        },
        itemsSummary: itemsSummary || 'Standard Sale',
        totalQty,
        subTotal: Number(o.subtotal || o.totalAmount),
        discountAmount: Number(o.discountAmount || 0),
        totalAmount: Number(o.totalAmount),
        paidAmount: Number(o.paidAmount),
        dueAmount: Number(o.dueAmount),
        paymentStatus: o.paymentStatus,
        payments:
          o.paymentMethod || (Number(o.dueAmount) > 0 ? 'PARTIAL' : 'CASH'),
        staff: o.staff?.name || 'Counter Staff',
      };
    });

    return {
      summary: {
        totalSales,
        netSales,
        totalUnpaid,
        courierSales,
        diagnosingTotal,
        returnedTotal,
      },
      data,
    };
  }

  // ============================= SERVICE SALES =============================
  async getServiceSalesReport(
    query?: {
      branch?: string;
      status?: string;
      technicianId?: string;
      dateFrom?: string;
      dateTo?: string;
      search?: string;
    },
    user?: JwtPayload,
  ) {
    const branchId = await this.resolveBranchId(query?.branch, user);
    const where: Prisma.ServiceJobWhereInput = {};

    if (branchId) {
      where.order = { branchId };
    }
    if (query?.technicianId && query.technicianId !== 'ALL') {
      where.technicianId = query.technicianId;
    }
    if (query?.status && query.status !== 'ALL') {
      where.status = query.status as any;
    }
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
      const q = query.search.trim();
      where.OR = [
        { invoiceNo: { contains: q, mode: 'insensitive' } },
        { device: { contains: q, mode: 'insensitive' } },
        { issueDescription: { contains: q, mode: 'insensitive' } },
        { order: { orderCode: { contains: q, mode: 'insensitive' } } },
        { order: { customer: { name: { contains: q, mode: 'insensitive' } } } },
        {
          order: { customer: { phone: { contains: q, mode: 'insensitive' } } },
        },
      ];
    }

    const jobs = await this.prisma.serviceJob.findMany({
      where,
      include: {
        technician: { select: { id: true, name: true, commissionRate: true } },
        order: {
          include: {
            customer: { select: { id: true, name: true, phone: true } },
            branch: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const totalService = jobs.reduce(
      (sum, j) => sum + Number(j.serviceCharge),
      0,
    );
    const totalPaid = jobs.reduce(
      (sum, j) => sum + Number(j.order?.paidAmount || j.serviceCharge),
      0,
    );
    const totalUnpaid = jobs.reduce(
      (sum, j) => sum + Number(j.order?.dueAmount || 0),
      0,
    );
    const totalCommission = jobs.reduce((sum, j) => {
      const commRate = Number(j.technician?.commissionRate || 0);
      return sum + Number(j.serviceCharge) * (commRate / 100);
    }, 0);
    const netServiceRevenue = Math.max(0, totalService - totalCommission);
    const diagnosing = jobs.filter((j) =>
      ['PENDING', 'IN_PROGRESS', 'DIAGNOSING'].includes(j.status as string),
    ).length;
    const inCourier = jobs.filter(
      (j) => j.order?.saleType === SaleType.COURIER,
    ).length;

    const data = jobs.map((j) => {
      const commRate = Number(j.technician?.commissionRate || 0);
      const commAmount = Number(j.serviceCharge) * (commRate / 100);
      return {
        id: j.id,
        orderId: j.orderId,
        jobCode: j.order?.orderCode || `#SRV-${j.id.slice(-6).toUpperCase()}`,
        createdAt: j.createdAt,
        branch: j.order?.branch?.name || 'Service Center',
        customer: {
          id: j.order?.customer?.id || '',
          name: j.order?.customer?.name || 'Walk-in Client',
          phone: j.order?.customer?.phone || 'N/A',
        },
        device: j.device,
        issueDescription: j.issueDescription,
        serviceItem: `${j.device} (${j.issueDescription || 'Repair'})`,
        serviceFee: Number(j.serviceCharge),
        status: j.status,
        technician: {
          id: j.technician?.id || '',
          name: j.technician?.name || 'Unassigned',
          commissionRate: commRate,
          commissionAmount: commAmount,
        },
      };
    });

    return {
      summary: {
        totalService,
        totalPaid,
        totalUnpaid,
        netServiceRevenue,
        diagnosing,
        inCourier,
      },
      data,
    };
  }

  // ============================= FIX PASS 21: GLOBAL SERVICE REPORT =============================
  async getGlobalServiceReport(
    query?: {
      branch?: string;
      technicianId?: string;
      dateFrom?: string;
      dateTo?: string;
      search?: string;
    },
    user?: JwtPayload,
  ) {
    const branchId = await this.resolveBranchId(query?.branch, user);
    const where: Prisma.ServiceJobWhereInput = {};

    if (branchId) {
      where.OR = [{ order: { branchId } }, { technician: { branchId } }];
    }
    if (
      query?.technicianId &&
      query.technicianId !== 'all' &&
      query.technicianId !== 'ALL'
    ) {
      where.technicianId = query.technicianId;
    }
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
      const q = query.search.trim();
      where.OR = [
        { invoiceNo: { contains: q, mode: 'insensitive' } },
        { customerName: { contains: q, mode: 'insensitive' } },
        { customerPhone: { contains: q, mode: 'insensitive' } },
        { technician: { name: { contains: q, mode: 'insensitive' } } },
        { device: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [jobs, allTechnicians] = await Promise.all([
      this.prisma.serviceJob.findMany({
        where,
        include: {
          technician: {
            select: {
              id: true,
              name: true,
              phone: true,
              profitSharePercentage: true,
              commissionRate: true,
              branchId: true,
            },
          },
          customer: { select: { id: true, name: true, phone: true } },
          materials: { include: { supplier: true, product: true } },
          order: {
            include: {
              branch: { select: { id: true, name: true } },
              payments: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.staff.findMany({
        where: { isTechnician: true, status: StaffStatus.ACTIVE },
        select: {
          id: true,
          name: true,
          phone: true,
          profitSharePercentage: true,
          commissionRate: true,
          branch: { select: { id: true, name: true } },
        },
      }),
    ]);

    // Summary Calculations
    const totalServices = jobs.length;
    let totalCollection = 0;
    let totalMaterialCost = 0;
    let totalTechProfitShare = 0;

    const paymentMethodTotals: Record<
      string,
      { amount: number; count: number }
    > = {
      CASH: { amount: 0, count: 0 },
      BKASH: { amount: 0, count: 0 },
      NAGAD: { amount: 0, count: 0 },
      CARD: { amount: 0, count: 0 },
      BANK: { amount: 0, count: 0 },
      OTHER: { amount: 0, count: 0 },
    };

    jobs.forEach((j) => {
      const bill = Number(j.finalAmount || j.totalBill || j.serviceCharge || 0);
      const partsCost = Number(j.materialCost || 0);
      const share = Number(j.technicianProfitShare || 0);

      totalCollection += bill;
      totalMaterialCost += partsCost;
      totalTechProfitShare += share;

      // Track Payments
      if (j.order?.payments && j.order.payments.length > 0) {
        j.order.payments.forEach((p) => {
          const m = (p.paymentMethod || 'CASH').toUpperCase();
          const bucket = paymentMethodTotals[m] ? m : 'OTHER';
          paymentMethodTotals[bucket].amount += Number(p.amount || 0);
          paymentMethodTotals[bucket].count += 1;
        });
      } else if (j.paymentDetails && Array.isArray(j.paymentDetails)) {
        (j.paymentDetails as any[]).forEach((p) => {
          const m = (p.method || 'CASH').toUpperCase();
          const bucket = paymentMethodTotals[m] ? m : 'OTHER';
          paymentMethodTotals[bucket].amount += Number(p.amount || 0);
          paymentMethodTotals[bucket].count += 1;
        });
      } else {
        paymentMethodTotals.CASH.amount += bill;
        paymentMethodTotals.CASH.count += 1;
      }
    });

    const grossProfit = Math.max(0, totalCollection - totalMaterialCost);
    const ownerProfit = Math.max(0, grossProfit - totalTechProfitShare);

    // Group by technician
    const techMap = new Map<
      string,
      {
        technicianId: string;
        technicianName: string;
        phone: string;
        branchName: string;
        profitShareRate: number;
        servicesCount: number;
        collection: number;
        materialCost: number;
        profit: number;
        profitShare: number;
        ownerProfit: number;
        jobs: any[];
      }
    >();

    // Initialize all technicians so zero-service staff also appear if relevant
    allTechnicians.forEach((t) => {
      const rawRate = Number(t.profitSharePercentage ?? t.commissionRate ?? 0);
      techMap.set(t.id, {
        technicianId: t.id,
        technicianName: t.name,
        phone: t.phone,
        branchName: t.branch?.name || 'Dhaka Main',
        profitShareRate: rawRate > 0 ? rawRate : 50,
        servicesCount: 0,
        collection: 0,
        materialCost: 0,
        profit: 0,
        profitShare: 0,
        ownerProfit: 0,
        jobs: [],
      });
    });

    // Bucket actual jobs
    jobs.forEach((j) => {
      const techId = j.technicianId || 'unassigned';
      if (!techMap.has(techId)) {
        const rawRate = Number(
          j.technician?.profitSharePercentage ??
            j.technician?.commissionRate ??
            0,
        );
        techMap.set(techId, {
          technicianId: techId,
          technicianName: j.technician?.name || 'Unassigned Staff',
          phone: j.technician?.phone || 'N/A',
          branchName: j.order?.branch?.name || 'Main',
          profitShareRate: rawRate > 0 ? rawRate : 50,
          servicesCount: 0,
          collection: 0,
          materialCost: 0,
          profit: 0,
          profitShare: 0,
          ownerProfit: 0,
          jobs: [],
        });
      }

      const row = techMap.get(techId)!;
      const bill = Number(j.finalAmount || j.totalBill || j.serviceCharge || 0);
      const partsCost = Number(j.materialCost || 0);
      const profit = Math.max(0, bill - partsCost);
      const share = Number(j.technicianProfitShare || 0);

      row.servicesCount += 1;
      row.collection += bill;
      row.materialCost += partsCost;
      row.profit += profit;
      row.profitShare += share;
      row.ownerProfit += Math.max(0, profit - share);
      row.jobs.push({
        id: j.id,
        invoiceNo: j.invoiceNo || j.order?.orderCode || `SRV-${j.id.slice(-6)}`,
        device: j.device,
        model: j.model,
        customerName: j.customerName || j.customer?.name || 'Walk-in',
        customerPhone: j.customerPhone || j.customer?.phone || 'N/A',
        totalBill: bill,
        materialCost: partsCost,
        profit,
        profitShare: share,
        status: j.status,
        createdAt: j.createdAt,
      });
    });

    const technicianList = Array.from(techMap.values()).filter((t) =>
      query?.technicianId && query.technicianId !== 'all'
        ? t.technicianId === query.technicianId
        : true,
    );

    const collectionMethods = Object.entries(paymentMethodTotals).map(
      ([method, val]) => ({
        method,
        amount: val.amount,
        count: val.count,
      }),
    );

    return {
      summary: {
        totalServices,
        totalCollection,
        totalMaterialCost,
        grossProfit,
        ownerProfit,
        totalTechProfitShare,
      },
      collectionMethods,
      technicians: technicianList,
      rawJobsCount: jobs.length,
    };
  }

  // ============================= FIX PASS 21: SERVICING REPORT (TECHNICIAN VIEW) =============================
  async getServicingTechnicianReport(
    technicianId: string,
    query?: {
      dateFrom?: string;
      dateTo?: string;
      search?: string;
    },
  ) {
    const technician = await this.prisma.staff.findUnique({
      where: { id: technicianId },
      include: { branch: true },
    });

    if (!technician) {
      throw new NotFoundException(
        `Technician with ID "${technicianId}" not found`,
      );
    }

    const where: Prisma.ServiceJobWhereInput = {
      technicianId,
    };

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
      const q = query.search.trim();
      where.OR = [
        { invoiceNo: { contains: q, mode: 'insensitive' } },
        { customerName: { contains: q, mode: 'insensitive' } },
        { customerPhone: { contains: q, mode: 'insensitive' } },
        { device: { contains: q, mode: 'insensitive' } },
      ];
    }

    const jobs = await this.prisma.serviceJob.findMany({
      where,
      include: {
        customer: true,
        order: { include: { branch: true } },
        materials: {
          include: {
            supplier: { select: { id: true, name: true, phone: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const rawRate = Number(
      technician.profitSharePercentage ?? technician.commissionRate ?? 0,
    );
    const rate = rawRate > 0 ? rawRate : 50;

    let totalMaterialCost = 0;
    let totalLaborProfit = 0;
    let totalProfitShare = 0;
    let totalCollection = 0;

    const details = jobs.map((j) => {
      const totalCost = Number(
        j.finalAmount || j.totalBill || j.serviceCharge || 0,
      );
      const materialCost = Number(j.materialCost || 0);
      const profit = Math.max(0, totalCost - materialCost);
      const profitShare =
        Number(j.technicianProfitShare || 0) > 0
          ? Number(j.technicianProfitShare)
          : (profit * rate) / 100;

      totalCollection += totalCost;
      totalMaterialCost += materialCost;
      totalLaborProfit += profit;
      totalProfitShare += profitShare;

      return {
        id: j.id,
        invoiceNo: j.invoiceNo || j.order?.orderCode || `SRV-${j.id.slice(-6)}`,
        serviceDetails: `${j.device} - ${j.issueDescription || 'Repair Ticket'}`,
        device: j.device,
        model: j.model,
        customerName: j.customerName || j.customer?.name || 'Walk-in Customer',
        customerPhone: j.customerPhone || j.customer?.phone || 'N/A',
        totalCost,
        materialCost,
        profit,
        profitShare,
        materials: j.materials || [],
        status: j.status,
        createdAt: j.createdAt,
      };
    });

    const completedJobs = jobs.filter((j) =>
      ['DELIVERED', 'READY_FOR_PICKUP', 'COMPLETED'].includes(j.status),
    ).length;
    return {
      technician: {
        id: technician.id,
        name: technician.name,
        branch: technician.branch?.name || 'Main Branch',
        phone: technician.phone,
        profitShareRate: rawRate > 0 ? rawRate : 50,
      },
      dateRange: {
        from: query?.dateFrom || 'All Time',
        to: query?.dateTo || 'Present',
      },
      summary: {
        totalJobs: jobs.length,
        completedJobs,
        totalCollection,
        totalMaterialCost,
        totalProfit: totalLaborProfit,
        technicianEarnings: totalProfitShare,
        ownerProfit: Math.max(0, totalLaborProfit - totalProfitShare),
      },
      materialCost: totalMaterialCost,
      profit: totalLaborProfit,
      technicianShare: totalProfitShare,
      details,
    };
  }

  // ============================= FIX PASS 21: TECHNICIAN PERFORMANCE REPORT =============================
  async getTechnicianPerformanceReport(
    query?: {
      branch?: string;
      dateFrom?: string;
      dateTo?: string;
    },
    user?: JwtPayload,
  ) {
    const report = await this.getGlobalServiceReport(query, user);
    const performance = report.technicians.map((t) => {
      const completedJobs = t.jobs.filter(
        (j: any) => j.status === 'DELIVERED',
      ).length;
      const pendingJobs = t.jobs.filter((j: any) =>
        ['PENDING', 'IN_PROGRESS'].includes(j.status),
      ).length;
      const avgJobValue =
        t.servicesCount > 0 ? Math.round(t.collection / t.servicesCount) : 0;
      return {
        technicianId: t.technicianId,
        name: t.technicianName,
        branch: t.branchName,
        totalJobs: t.servicesCount,
        completedJobs,
        pendingJobs,
        totalRevenue: t.collection,
        avgJobValue,
      };
    });

    return {
      summary: report.summary,
      performance,
    };
  }

  // ============================= FIX PASS 21: TECHNICIAN PROFIT REPORT =============================
  async getTechnicianProfitReport(
    query?: {
      branch?: string;
      dateFrom?: string;
      dateTo?: string;
    },
    user?: JwtPayload,
  ) {
    const report = await this.getGlobalServiceReport(query, user);
    const profitData = report.technicians.map((t) => ({
      technicianId: t.technicianId,
      name: t.technicianName,
      branch: t.branchName,
      profitShareRate: t.profitShareRate,
      laborBilling: t.collection,
      materialCost: t.materialCost,
      netProfit: t.profit,
      technicianProfitShare: t.profitShare,
      ownerRetainedProfit: t.ownerProfit,
    }));

    return {
      summary: report.summary,
      profitData,
    };
  }

  // ============================= FIX PASS 21: SHOPWISE REPORT =============================
  async getShopwiseReport(query?: { dateFrom?: string; dateTo?: string }) {
    const branches = await this.prisma.branch.findMany({
      select: { id: true, name: true, code: true, city: true },
    });

    const dateFilter: Prisma.DateTimeFilter = {};
    if (query?.dateFrom) dateFilter.gte = new Date(query.dateFrom);
    if (query?.dateTo) {
      const to = new Date(query.dateTo);
      to.setHours(23, 59, 59, 999);
      dateFilter.lte = to;
    }

    const shopwiseData = await Promise.all(
      branches.map(async (b) => {
        const orderWhere: Prisma.OrderWhereInput = { branchId: b.id };
        if (query?.dateFrom || query?.dateTo) orderWhere.saleDate = dateFilter;

        const serviceWhere: Prisma.ServiceJobWhereInput = {
          order: { branchId: b.id },
        };
        if (query?.dateFrom || query?.dateTo)
          serviceWhere.createdAt = dateFilter;

        const [orders, serviceJobs] = await Promise.all([
          this.prisma.order.findMany({
            where: orderWhere,
            select: { totalAmount: true, paidAmount: true },
          }),
          this.prisma.serviceJob.findMany({
            where: serviceWhere,
            select: { finalAmount: true, materialCost: true },
          }),
        ]);

        const totalOrders = orders.length;
        const totalSalesAmount = orders.reduce(
          (sum, o) => sum + Number(o.totalAmount || 0),
          0,
        );
        const totalServiceJobs = serviceJobs.length;
        const serviceRevenue = serviceJobs.reduce(
          (sum, s) => sum + Number(s.finalAmount || 0),
          0,
        );
        const materialCost = serviceJobs.reduce(
          (sum, s) => sum + Number(s.materialCost || 0),
          0,
        );
        const netServiceProfit = Math.max(0, serviceRevenue - materialCost);

        return {
          branchId: b.id,
          branchName: b.name,
          code: b.code,
          city: b.city,
          totalOrders,
          totalSalesAmount,
          totalServiceJobs,
          serviceRevenue,
          materialCost,
          netServiceProfit,
          totalCombinedRevenue: totalSalesAmount + serviceRevenue,
        };
      }),
    );

    return {
      totalBranches: branches.length,
      shopwiseData,
    };
  }

  // ============================= FIX PASS 21: MARKETING FEE COLLECTION REPORT =============================
  async getMarketingFeeReport(
    query?: {
      branch?: string;
      dateFrom?: string;
      dateTo?: string;
    },
    user?: JwtPayload,
  ) {
    const where: Prisma.ServiceJobWhereInput = {
      referralNumber: { not: null },
    };

    const branchId = await this.resolveBranchId(query?.branch, user);
    if (branchId) where.branchId = branchId;

    if (query?.dateFrom || query?.dateTo) {
      where.createdAt = {};
      if (query.dateFrom) where.createdAt.gte = new Date(query.dateFrom);
      if (query.dateTo) {
        const to = new Date(query.dateTo);
        to.setHours(23, 59, 59, 999);
        where.createdAt.lte = to;
      }
    }

    const jobs = await this.prisma.serviceJob.findMany({
      where,
      include: {
        order: { include: { branch: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const totalReferredJobs = jobs.length;
    const totalReferredAmount = jobs.reduce(
      (sum, j) => sum + Number(j.finalAmount || 0),
      0,
    );
    // Standard referral marketing fee assumption: 5% of service labor or 100 BDT flat
    const estimatedMarketingFee = Math.round(totalReferredAmount * 0.05);

    const items = jobs.map((j) => ({
      serviceJobId: j.id,
      invoiceNo: j.invoiceNo || j.order?.orderCode || `SRV-${j.id.slice(-6)}`,
      customerName: j.customerName || 'Walk-in',
      customerPhone: j.customerPhone,
      referralNumber: j.referralNumber,
      device: j.device,
      totalAmount: Number(j.finalAmount || 0),
      marketingFee: Math.round(Number(j.finalAmount || 0) * 0.05),
      branch: j.order?.branch?.name || 'Main',
      createdAt: j.createdAt,
    }));

    return {
      summary: {
        totalReferredJobs,
        totalReferredAmount,
        estimatedMarketingFee,
      },
      items,
    };
  }

  // ============================= EXPENSE REPORT =============================
  async getExpenseReport(
    query?: {
      categoryId?: string;
      branch?: string;
      walletTypeId?: string;
      dateFrom?: string;
      dateTo?: string;
      search?: string;
    },
    user?: JwtPayload,
  ) {
    const branchId = await this.resolveBranchId(query?.branch, user);
    const where: Prisma.ExpenseWhereInput = {};

    if (branchId) where.branchId = branchId;
    if (query?.categoryId && query.categoryId !== 'ALL') {
      where.categoryId = query.categoryId;
    }
    if (query?.walletTypeId && query.walletTypeId !== 'ALL') {
      where.walletTypeId = query.walletTypeId;
    }
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
      const q = query.search.trim();
      where.OR = [
        { description: { contains: q, mode: 'insensitive' } },
        { referenceNo: { contains: q, mode: 'insensitive' } },
        { category: { name: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const [expenses, categories, payrolls] = await Promise.all([
      this.prisma.expense.findMany({
        where,
        include: {
          category: { select: { id: true, name: true } },
          branch: { select: { id: true, name: true } },
          walletType: { select: { id: true, name: true, kind: true } },
          recordedBy: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.expenseCategory.findMany({
        include: {
          expenses: {
            where: {
              ...(branchId ? { branchId } : {}),
            },
            select: { amount: true },
          },
        },
      }),
      this.prisma.payroll.findMany({
        where: {
          status: PayrollStatus.PAID,
          ...(branchId ? { staff: { branchId } } : {}),
        },
        select: { netSalary: true },
      }),
    ]);

    const totalExpenses = expenses.reduce(
      (sum, e) => sum + Number(e.amount),
      0,
    );
    const totalPayroll = payrolls.reduce(
      (sum, p) => sum + Number(p.netSalary),
      0,
    );
    const total = totalExpenses + totalPayroll;

    const categoryBreakdown = categories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      amount: cat.expenses.reduce((sum, e) => sum + Number(e.amount), 0),
    }));

    if (totalPayroll > 0) {
      categoryBreakdown.push({
        id: 'cat-payroll',
        name: 'Staff Payroll',
        amount: totalPayroll,
      });
    }

    const data = expenses.map((e) => ({
      id: e.id,
      referenceNo: e.referenceNo,
      date: e.createdAt,
      createdAt: e.createdAt,
      branch: e.branch?.name || 'Main Branch',
      category: e.category?.name || 'General Expense',
      wallet: e.walletType?.name || 'Cash',
      amount: Number(e.amount),
      notes: e.description,
      description: e.description,
      recordedBy: e.recordedBy?.name || 'Admin',
      status: e.status,
    }));

    return {
      summary: {
        total,
        totalExpenses,
        totalPayroll,
      },
      categoryBreakdown,
      data,
    };
  }

  // ============================= PURCHASE REPORT =============================
  async getPurchaseReport(
    query?: {
      supplierId?: string;
      branch?: string;
      paymentStatus?: string;
      dateFrom?: string;
      dateTo?: string;
      search?: string;
    },
    user?: JwtPayload,
  ) {
    const branchId = await this.resolveBranchId(query?.branch, user);
    const where: Prisma.PurchaseOrderWhereInput = {};

    if (branchId) where.branchId = branchId;
    if (query?.supplierId && query.supplierId !== 'ALL') {
      where.supplierId = query.supplierId;
    }
    if (query?.paymentStatus && query.paymentStatus !== 'ALL') {
      if (query.paymentStatus === 'PAID') where.dueAmount = 0;
      else if (query.paymentStatus === 'DUE') where.dueAmount = { gt: 0 };
    }
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
      const q = query.search.trim();
      where.OR = [
        { poNumber: { contains: q, mode: 'insensitive' } },
        { invoiceNumber: { contains: q, mode: 'insensitive' } },
        { supplier: { name: { contains: q, mode: 'insensitive' } } },
        { supplier: { phone: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const [purchaseOrders, stockReturns] = await Promise.all([
      this.prisma.purchaseOrder.findMany({
        where,
        include: {
          supplier: {
            select: { id: true, name: true, phone: true, companyName: true },
          },
          branch: { select: { id: true, name: true } },
          items: {
            include: {
              product: { select: { name: true } },
              variant: { select: { color: true, quality: true, sku: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.stockAdjustment.findMany({
        where: {
          reason: { contains: 'Purchase Return', mode: 'insensitive' },
        },
        select: { quantityChange: true, productId: true },
      }),
    ]);

    const totalPurchase = purchaseOrders.reduce(
      (sum, po) => sum + Number(po.grandTotal),
      0,
    );
    const totalPaid = purchaseOrders.reduce(
      (sum, po) => sum + Number(po.amountPaid),
      0,
    );
    const totalUnpaid = purchaseOrders.reduce(
      (sum, po) => sum + Number(po.dueAmount),
      0,
    );
    const totalPurchaseQty = purchaseOrders.reduce(
      (sum, po) =>
        sum + po.items.reduce((iSum, item) => iSum + item.quantityOrdered, 0),
      0,
    );
    const returnQty = stockReturns.reduce(
      (sum, sr) => sum + Math.abs(sr.quantityChange),
      0,
    );
    const totalReturned = returnQty * 1500;

    const data = purchaseOrders.map((po) => {
      const itemsSummary = po.items
        .map((i) => `${i.product?.name || 'Item'} (x${i.quantityOrdered})`)
        .join(', ');
      const totalQty = po.items.reduce((sum, i) => sum + i.quantityOrdered, 0);
      const isPaid = Number(po.dueAmount) <= 0;
      const isPartial = Number(po.amountPaid) > 0 && Number(po.dueAmount) > 0;
      const paymentStatus = isPaid ? 'PAID' : isPartial ? 'PARTIAL' : 'DUE';

      return {
        id: po.id,
        memo: po.poNumber || `PO-${po.id.slice(-6).toUpperCase()}`,
        invoiceNumber: po.invoiceNumber || 'N/A',
        date: po.createdAt,
        createdAt: po.createdAt,
        branch: po.branch?.name || 'Main Warehouse',
        supplier: {
          id: po.supplier?.id || '',
          name: po.supplier?.name || 'Supplier',
          phone: po.supplier?.phone || 'N/A',
          companyName:
            po.supplier?.companyName || po.supplier?.name || 'Company',
        },
        itemsSummary: itemsSummary || 'General Stock Purchase',
        qty: totalQty,
        total: Number(po.grandTotal),
        paid: Number(po.amountPaid),
        due: Number(po.dueAmount),
        paymentStatus,
        status: po.status,
        staff: 'Purchase Manager',
      };
    });

    return {
      summary: {
        totalPurchase,
        totalPaid,
        totalUnpaid,
        totalPurchaseQty,
        totalReturned,
        returnQty,
      },
      data,
    };
  }

  // ============================= TRANSACTIONS REPORT =============================
  async getTransactionsReport(
    query?: {
      walletTypeId?: string;
      branch?: string;
      type?: string;
      payType?: string;
      dateFrom?: string;
      dateTo?: string;
      search?: string;
    },
    user?: JwtPayload,
  ) {
    const branchId = await this.resolveBranchId(query?.branch, user);
    const where: Prisma.WalletTransactionWhereInput = {};

    if (branchId) {
      where.branchId = branchId;
    }

    if (query?.walletTypeId && query.walletTypeId !== 'ALL') {
      where.walletTypeId = query.walletTypeId;
    }
    if (query?.type && query.type !== 'ALL') {
      where.type = query.type as any;
    }
    if (query?.payType && query.payType !== 'ALL') {
      where.payType = query.payType as any;
    }
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
      const q = query.search.trim();
      where.OR = [
        { referenceNo: { contains: q, mode: 'insensitive' } },
        { note: { contains: q, mode: 'insensitive' } },
        { walletType: { name: { contains: q, mode: 'insensitive' } } },
        { recordedBy: { name: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const txns = await this.prisma.walletTransaction.findMany({
      where,
      include: {
        walletType: { select: { id: true, name: true, kind: true } },
        recordedBy: {
          select: { id: true, name: true, branch: { select: { name: true } } },
        },
        staff: {
          select: { id: true, name: true, branch: { select: { name: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const totalInflow = txns
      .filter((t) => t.type === WalletTxnType.DEPOSIT)
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const totalOutflow = txns
      .filter((t) => t.type === WalletTxnType.WITHDRAWAL)
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const netFlow = totalInflow - totalOutflow;

    const breakdownMap = new Map<string, number>();
    for (const t of txns) {
      const tag =
        t.payType ||
        (t.type === WalletTxnType.DEPOSIT ? 'Deposit' : 'Expense / Withdrawal');
      breakdownMap.set(tag, (breakdownMap.get(tag) || 0) + Number(t.amount));
    }
    const typeBreakdown = Array.from(breakdownMap.entries()).map(
      ([type, amount]) => ({
        type,
        amount,
      }),
    );

    const data = txns.map((t) => ({
      id: t.id,
      referenceNo: t.referenceNo,
      date: t.createdAt,
      createdAt: t.createdAt,
      branch:
        t.staff?.branch?.name || t.recordedBy?.branch?.name || 'Main Branch',
      type: t.type,
      payType: t.payType,
      source:
        t.payType ||
        (t.type === WalletTxnType.DEPOSIT ? 'Deposit' : 'Withdrawal'),
      wallet: {
        id: t.walletType.id,
        name: t.walletType.name,
        kind: t.walletType.kind,
      },
      amount: Number(t.amount),
      balanceAfter: Number(t.balanceAfter),
      recordedBy: t.recordedBy?.name || 'Admin',
      note: t.note || '',
    }));

    return {
      summary: {
        totalInflow,
        totalOutflow,
        netFlow,
      },
      typeBreakdown,
      data,
    };
  }

  // ============================= PRODUCT STOCK REPORT =============================
  async getProductStockReport(
    query?: {
      inStockOnly?: string;
      branch?: string;
      brand?: string;
      category?: string;
      quality?: string;
      color?: string;
      search?: string;
    },
    user?: JwtPayload,
  ) {
    const branchId = await this.resolveBranchId(query?.branch, user);

    const productWhere: Prisma.ProductWhereInput = {
      status: { not: 'DRAFT' },
    };

    if (query?.brand && query.brand !== 'ALL') {
      productWhere.brandId = query.brand;
    }
    if (query?.category && query.category !== 'ALL') {
      productWhere.categoryId = query.category;
    }

    const where: Prisma.ProductVariantWhereInput = {
      product: productWhere,
    };

    if (query?.quality && query.quality !== 'ALL') {
      where.quality = query.quality;
    }
    if (query?.color && query.color !== 'ALL') {
      where.color = query.color;
    }
    if (query?.search?.trim()) {
      const q = query.search.trim();
      where.OR = [
        { sku: { contains: q, mode: 'insensitive' } },
        { product: { name: { contains: q, mode: 'insensitive' } } },
        { product: { code: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const variants = await this.prisma.productVariant.findMany({
      where,
      include: {
        branchInventories: branchId !== undefined
          ? { where: typeof branchId === 'string' ? { branchId } : { branchId } }
          : true,
        product: {
          include: {
            brand: { select: { id: true, name: true } },
            category: { select: { id: true, name: true } },
            images: { take: 1 },
          },
        },
        purchaseOrderItems: {
          take: 1,
          select: { unitCost: true },
        },
      },
      orderBy: [{ product: { name: 'asc' } }, { sku: 'asc' }],
    });

    const mappedVariants = variants.map((v) => {
      const effectiveStock = branchId !== undefined
        ? v.branchInventories.reduce((sum, b) => sum + Number(b.quantity), 0)
        : v.stock;
      return {
        ...v,
        effectiveStock,
      };
    }).filter((v) => {
      if (query?.inStockOnly === 'true') {
        return v.effectiveStock > 0;
      }
      return true;
    });

    const totalStockQty = mappedVariants.reduce((sum, v) => sum + v.effectiveStock, 0);
    const totalStockValueFIFO = mappedVariants.reduce((sum, v) => {
      const unitCost = Number(
        v.purchaseOrderItems?.[0]?.unitCost || Number(v.price) * 0.7,
      );
      return sum + Math.max(0, v.effectiveStock) * unitCost;
    }, 0);
    const outOfStockCount = mappedVariants.filter((v) => v.effectiveStock <= 0).length;
    const lowStockCount = mappedVariants.filter(
      (v) => v.effectiveStock > 0 && v.effectiveStock <= 5,
    ).length;

    const data = mappedVariants.map((v) => ({
      id: v.id,
      productId: v.productId,
      productName: v.product.name,
      productCode: v.product.code || 'N/A',
      image: v.product.images?.[0]?.url || null,
      brand: v.product.brand?.name || 'Unbranded',
      category: v.product.category?.name || 'General',
      color: v.color || 'Standard',
      quality: v.quality || 'Original',
      sku: v.sku,
      stock: v.effectiveStock,
      buyingPrice: Number(
        v.purchaseOrderItems?.[0]?.unitCost || Number(v.price) * 0.7,
      ),
      sellingPrice: Number(v.price),
      salePrice: v.product.salePrice ? Number(v.product.salePrice) : null,
      wholesalePrice: v.wholesalePrice ? Number(v.wholesalePrice) : null,
      branch: query?.branch || 'All Branches',
    }));

    return {
      summary: {
        totalStockQty,
        totalStockValueFIFO,
        outOfStockCount,
        lowStockCount,
      },
      data,
    };
  }

  // ============================= COURIER REPORT =============================
  async getCourierReport(
    query?: {
      branch?: string;
      status?: string;
      dateFrom?: string;
      dateTo?: string;
      search?: string;
    },
    user?: JwtPayload,
  ) {
    const branchId = await this.resolveBranchId(query?.branch, user);
    const where: Prisma.OrderWhereInput = {
      saleType: SaleType.COURIER,
    };

    if (branchId) where.branchId = branchId;

    if (query?.status && query.status !== 'ALL') {
      where.status = query.status as any;
    }
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
      const q = query.search.trim();
      where.OR = [
        { orderCode: { contains: q, mode: 'insensitive' } },
        { customer: { name: { contains: q, mode: 'insensitive' } } },
        { customer: { phone: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const orders = await this.prisma.order.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        branch: { select: { id: true, name: true } },
        shippingAddress: true,
        shipment: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const totalOrders = orders.length;
    const totalAmount = orders.reduce(
      (sum, o) => sum + Number(o.totalAmount),
      0,
    );
    const totalDeliveryCharges = orders.reduce(
      (sum, o) => sum + Number(o.deliveryCharge || 0),
      0,
    );
    const totalPaid = orders.reduce((sum, o) => sum + Number(o.paidAmount), 0);
    const totalUnpaid = orders.reduce((sum, o) => sum + Number(o.dueAmount), 0);

    const data = orders.map((o, idx) => ({
      sl: idx + 1,
      id: o.id,
      orderCode: o.orderCode || `#EM-CR-${o.id.slice(-6).toUpperCase()}`,
      orderDate: o.createdAt,
      createdAt: o.createdAt,
      customer: {
        name: o.customer?.name || 'Courier Customer',
        phone: o.customer?.phone || 'N/A',
        address: o.shippingAddress?.fullAddress || 'N/A',
      },
      courierPartner: o.shipment?.courierPartner || 'Steadfast Courier',
      trackingNumber:
        o.shipment?.trackingNo || `TRK-${o.id.slice(-8).toUpperCase()}`,
      totalAmount: Number(o.totalAmount),
      deliveryCharge: Number(o.deliveryCharge || 0),
      paymentStatus: o.paymentStatus,
      orderStatus: o.status,
    }));

    return {
      summary: {
        totalOrders,
        totalAmount,
        totalDeliveryCharges,
        totalPaid,
        totalUnpaid,
      },
      data,
    };
  }

  // ============================= SUMMARY =============================

  async getSummary(
    query?: {
      branch?: string;
      dateFrom?: string;
      dateTo?: string;
    },
    user?: JwtPayload,
  ) {
    const branchId = await this.resolveBranchId(query?.branch, user);
    const dateFilter: { gte?: Date; lte?: Date } = {};
    if (query?.dateFrom) dateFilter.gte = new Date(query.dateFrom);
    if (query?.dateTo) {
      const to = new Date(query.dateTo);
      to.setHours(23, 59, 59, 999);
      dateFilter.lte = to;
    }
    const hasDateFilter = Boolean(query?.dateFrom || query?.dateTo);

    const [orders, serviceJobs, expenses, payrolls, purchaseOrders] =
      await Promise.all([
        this.prisma.order.findMany({
          where: {
            ...(branchId ? { branchId } : {}),
            ...(hasDateFilter ? { createdAt: dateFilter } : {}),
          },
          select: {
            totalAmount: true,
            paidAmount: true,
            dueAmount: true,
            discountAmount: true,
            status: true,
          },
        }),
        this.prisma.serviceJob.findMany({
          where: {
            ...(branchId ? { order: { branchId } } : {}),
            ...(hasDateFilter ? { createdAt: dateFilter } : {}),
          },
          select: {
            serviceCharge: true,
            status: true,
          },
        }),
        this.prisma.expense.findMany({
          where: {
            ...(branchId ? { branchId } : {}),
            ...(hasDateFilter ? { createdAt: dateFilter } : {}),
          },
          select: {
            amount: true,
            status: true,
          },
        }),
        this.prisma.payroll.findMany({
          where: {
            ...(branchId ? { staff: { branchId } } : {}),
            ...(hasDateFilter ? { createdAt: dateFilter } : {}),
          },
          select: {
            netSalary: true,
            status: true,
          },
        }),
        this.prisma.purchaseOrder.findMany({
          where: {
            ...(branchId ? { branchId } : {}),
            ...(hasDateFilter ? { createdAt: dateFilter } : {}),
          },
          select: {
            grandTotal: true,
            amountPaid: true,
            dueAmount: true,
            status: true,
          },
        }),
      ]);

    // Sales calculations
    const totalSales = orders.reduce(
      (sum, o) => sum + Number(o.totalAmount),
      0,
    );
    const totalOrders = orders.length;
    const completedOrders = orders.filter((o) =>
      [OrderStatus.DELIVERED, OrderStatus.COMPLETED].includes(o.status as any),
    ).length;
    const pendingOrders = orders.filter((o) =>
      [
        OrderStatus.CONFIRMED,
        OrderStatus.PENDING,
        OrderStatus.PARCEL_BOOKED,
      ].includes(o.status as any),
    ).length;
    const totalDue = orders.reduce((sum, o) => sum + Number(o.dueAmount), 0);
    const totalDiscount = orders.reduce(
      (sum, o) => sum + Number(o.discountAmount),
      0,
    );

    // Service calculations
    const totalServiceRevenue = serviceJobs.reduce(
      (sum, j) => sum + Number(j.serviceCharge),
      0,
    );
    const totalJobs = serviceJobs.length;
    const completedJobs = serviceJobs.filter(
      (j) => (j.status as string) === 'DELIVERED',
    ).length;
    const pendingJobs = serviceJobs.filter((j) =>
      ['PENDING', 'IN_PROGRESS'].includes(j.status as string),
    ).length;
    const readyJobs = serviceJobs.filter(
      (j) => (j.status as string) === 'READY_FOR_PICKUP',
    ).length;

    // Expense calculations
    const totalExpenses = expenses.reduce(
      (sum, e) => sum + Number(e.amount),
      0,
    );
    const paidExpenses = expenses
      .filter((e) => e.status === ExpenseStatus.PAID)
      .reduce((sum, e) => sum + Number(e.amount), 0);
    const pendingExpenses = totalExpenses - paidExpenses;

    // Payroll calculations
    const totalPayroll = payrolls.reduce(
      (sum, p) => sum + Number(p.netSalary),
      0,
    );
    const paidPayroll = payrolls
      .filter((p) => p.status === PayrollStatus.PAID)
      .reduce((sum, p) => sum + Number(p.netSalary), 0);
    const pendingPayroll = totalPayroll - paidPayroll;

    // Purchase calculations
    const totalPurchases = purchaseOrders.reduce(
      (sum, po) => sum + Number(po.grandTotal),
      0,
    );
    const totalPOs = purchaseOrders.length;
    const receivedPOs = purchaseOrders.filter(
      (po) => po.status === 'RECEIVED',
    ).length;
    const dueAmount = purchaseOrders.reduce(
      (sum, po) => sum + Number(po.dueAmount),
      0,
    );

    return {
      salesSummary: {
        totalSales,
        totalOrders,
        completedOrders,
        pendingOrders,
        totalDue,
        totalDiscount,
      },
      serviceSummary: {
        totalServiceRevenue,
        totalJobs,
        completedJobs,
        pendingJobs,
        readyJobs,
      },
      expenseSummary: {
        totalExpenses,
        totalCount: expenses.length,
        paidExpenses,
        pendingExpenses,
      },
      payrollSummary: {
        totalPayroll,
        paidPayroll,
        pendingPayroll,
        totalSheets: payrolls.length,
      },
      purchaseSummary: {
        totalPurchases,
        totalPOs,
        receivedPOs,
        dueAmount,
      },
    };
  }

  // ============================= DISCOUNT REPORT =============================

  async getDiscountReport(
    query?: {
      branch?: string;
      dateFrom?: string;
      dateTo?: string;
      search?: string;
    },
    user?: JwtPayload,
  ) {
    const branchId = await this.resolveBranchId(query?.branch, user);
    const where: Prisma.OrderWhereInput = {
      discountAmount: { gt: 0 },
      status: { notIn: [OrderStatus.CANCELLED, OrderStatus.RETURNED] },
    };

    if (branchId) where.branchId = branchId;
    if (query?.dateFrom || query?.dateTo) {
      where.createdAt = {};
      if (query.dateFrom) where.createdAt.gte = new Date(query.dateFrom);
      if (query.dateTo) {
        const to = new Date(query.dateTo);
        to.setHours(23, 59, 59, 999);
        where.createdAt.lte = to;
      }
    }

    const orders = await this.prisma.order.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        branch: { select: { id: true, name: true } },
        notes: true,
        statusHistory: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const totalDiscountGiven = orders.reduce(
      (acc, o) => acc + Number(o.discountAmount),
      0,
    );
    const totalOrderValueBeforeDiscount = orders.reduce(
      (acc, o) => acc + Number(o.totalAmount) + Number(o.discountAmount),
      0,
    );

    const avgDiscountPercentage =
      totalOrderValueBeforeDiscount > 0
        ? Math.round(
            (totalDiscountGiven / totalOrderValueBeforeDiscount) * 100 * 10,
          ) / 10
        : 0;

    const mappedOrders = orders.map((o) => {
      let promoCodeName =
        o.saleType === 'WEBSITE' ? 'PROMO_CODE' : 'MANUAL_POS_DISCOUNT';
      const historyWithPromo = o.statusHistory?.find((h) =>
        h.note?.includes('Promo'),
      );
      const noteWithPromo = o.notes?.find((n) => n.note?.includes('Promo'));
      const promoText = historyWithPromo?.note || noteWithPromo?.note;
      if (promoText) {
        const match = promoText.match(
          /Promo(?::|\s+applied:|\s+code applied:)\s*([A-Za-z0-9_-]+)/i,
        );
        if (match?.[1]) {
          promoCodeName = match[1].toUpperCase();
        }
      }

      return {
        id: o.id,
        orderNumber: o.orderCode,
        orderCode: o.orderCode,
        createdAt: o.createdAt,
        date: o.createdAt,
        customerName: o.customer?.name || 'Walk-in',
        customerPhone: o.customer?.phone || 'N/A',
        branch: o.branch?.name || 'Global',
        orderTotal: Number(o.totalAmount),
        totalAmount: Number(o.totalAmount),
        discount: Number(o.discountAmount),
        discountAmount: Number(o.discountAmount),
        discountPercentage:
          Number(o.totalAmount) + Number(o.discountAmount) > 0
            ? Math.round(
                (Number(o.discountAmount) /
                  (Number(o.totalAmount) + Number(o.discountAmount))) *
                  100,
              )
            : 0,
        promoCode: promoCodeName,
        status: o.status,
      };
    });

    return {
      summary: {
        totalDiscountGiven,
        discountedOrdersCount: orders.length,
        ordersWithDiscountCount: orders.length,
        avgDiscountPercentage,
      },
      orders: mappedOrders,
      ordersWithDiscount: mappedOrders,
    };
  }

  // ============================= FIX PASS 24: DASHBOARD DATA =============================

  private parsePeriodToDateRange(
    period?: string,
    dateFrom?: string,
    dateTo?: string,
  ): { gte?: Date; lte?: Date; hasFilter: boolean } {
    if (dateFrom || dateTo) {
      const filter: { gte?: Date; lte?: Date } = {};
      if (dateFrom) filter.gte = new Date(dateFrom);
      if (dateTo) {
        const to = new Date(dateTo);
        to.setHours(23, 59, 59, 999);
        filter.lte = to;
      }
      return { ...filter, hasFilter: true };
    }

    if (
      !period ||
      period === 'ALL' ||
      period === 'All Time' ||
      period === 'All Outlets'
    ) {
      return { hasFilter: false };
    }

    const now = new Date();
    const normalized = period.toLowerCase().trim().replace(/[-_]/g, ' ');

    if (normalized === 'today') {
      const gte = new Date(now);
      gte.setHours(0, 0, 0, 0);
      const lte = new Date(now);
      lte.setHours(23, 59, 59, 999);
      return { gte, lte, hasFilter: true };
    }

    if (normalized === 'this week') {
      const gte = new Date(now);
      const day = gte.getDay(); // 0 is Sunday
      const diff = gte.getDate() - day + (day === 0 ? -6 : 1);
      gte.setDate(diff);
      gte.setHours(0, 0, 0, 0);
      const lte = new Date(now);
      lte.setHours(23, 59, 59, 999);
      return { gte, lte, hasFilter: true };
    }

    if (normalized === 'this month') {
      const gte = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      const lte = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        0,
        23,
        59,
        59,
        999,
      );
      return { gte, lte, hasFilter: true };
    }

    if (normalized === 'this year') {
      const gte = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
      const lte = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
      return { gte, lte, hasFilter: true };
    }

    return { hasFilter: false };
  }

  async getDashboardData(
    query?: {
      branch?: string;
      period?: string;
      dateFrom?: string;
      dateTo?: string;
    },
    user?: JwtPayload,
  ) {
    const branchId = await this.resolveBranchId(query?.branch, user);
    const parsedRange = this.parsePeriodToDateRange(
      query?.period,
      query?.dateFrom,
      query?.dateTo,
    );

    const dateFilter: { gte?: Date; lte?: Date } = {};
    if (parsedRange.gte) dateFilter.gte = parsedRange.gte;
    if (parsedRange.lte) dateFilter.lte = parsedRange.lte;
    const hasDateFilter = parsedRange.hasFilter;

    const orderWhere: Prisma.OrderWhereInput = {
      ...(branchId ? { branchId } : {}),
      ...(hasDateFilter ? { createdAt: dateFilter } : {}),
    };

    const serviceJobWhere: Prisma.ServiceJobWhereInput = {
      ...(branchId
        ? {
            OR: [{ order: { branchId } }, { technician: { branchId } }],
          }
        : {}),
      ...(hasDateFilter ? { createdAt: dateFilter } : {}),
    };

    const expenseWhere: Prisma.ExpenseWhereInput = {
      ...(branchId ? { branchId } : {}),
      ...(hasDateFilter ? { createdAt: dateFilter } : {}),
    };

    const payrollWhere: Prisma.PayrollWhereInput = {
      ...(branchId ? { staff: { branchId } } : {}),
      ...(hasDateFilter ? { createdAt: dateFilter } : {}),
    };

    const purchaseWhere: Prisma.PurchaseOrderWhereInput = {
      ...(branchId ? { branchId } : {}),
      ...(hasDateFilter ? { createdAt: dateFilter } : {}),
      status: {
        notIn: [PurchaseOrderStatus.CANCELLED, PurchaseOrderStatus.DRAFT],
      },
    };

    const [
      allOrders,
      serviceJobs,
      expenses,
      payrolls,
      purchaseOrders,
      openSupplierPOs,
      allCustomers,
    ] = await Promise.all([
      this.prisma.order.findMany({
        where: orderWhere,
        include: {
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  productCategory: true,
                  productType: true,
                  costPrice: true,
                  buyingPrice: true,
                  regularPrice: true,
                  images: { take: 1, select: { url: true } },
                  category: { select: { id: true, name: true } },
                },
              },
              variant: {
                select: {
                  id: true,
                  buyingPrice: true,
                  price: true,
                },
              },
              phoneUnits: {
                select: {
                  id: true,
                  buyingPrice: true,
                  sellingPrice: true,
                  status: true,
                },
              },
            },
          },
          customer: {
            select: { id: true, name: true, phone: true, email: true },
          },
          branch: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.serviceJob.findMany({
        where: serviceJobWhere,
        select: {
          id: true,
          status: true,
          finalAmount: true,
          totalBill: true,
          serviceCharge: true,
          laborCost: true,
          materialCost: true,
          paidAmount: true,
          dueAmount: true,
          createdAt: true,
        },
      }),
      this.prisma.expense.findMany({
        where: expenseWhere,
        select: {
          id: true,
          amount: true,
          status: true,
          createdAt: true,
        },
      }),
      this.prisma.payroll.findMany({
        where: payrollWhere,
        select: {
          id: true,
          netSalary: true,
          status: true,
          createdAt: true,
        },
      }),
      this.prisma.purchaseOrder.findMany({
        where: purchaseWhere,
        select: {
          id: true,
          grandTotal: true,
          amountPaid: true,
          dueAmount: true,
          status: true,
          createdAt: true,
        },
      }),
      // Supplier Due is a running balance as of now (unaffected by historical date filter)
      this.prisma.purchaseOrder.findMany({
        where: {
          ...(branchId ? { branchId } : {}),
          status: {
            notIn: [PurchaseOrderStatus.CANCELLED, PurchaseOrderStatus.DRAFT],
          },
          dueAmount: { gt: 0 },
        },
        select: { dueAmount: true },
      }),
      this.prisma.customer.findMany({
        where: branchId ? { orders: { some: { branchId } } } : {},
        take: 10,
        include: {
          orders: {
            where: orderWhere,
            select: { totalAmount: true },
          },
        },
      }),
    ]);

    // ============================= 1. REVENUE CARDS & COGS =============================
    let totalPhoneSales = 0;
    let totalPhoneCOGS = 0;
    let totalDisplaySales = 0;
    let totalDisplayCOGS = 0;
    let totalGadgetSales = 0;
    let totalGadgetCOGS = 0;

    // Filter valid completed product orders (excluding cancelled, returned, and pure repair orders)
    const completedProductOrders = allOrders.filter(
      (o) =>
        o.status !== OrderStatus.CANCELLED &&
        o.status !== OrderStatus.RETURNED &&
        o.saleType !== SaleType.DIAGNOSING,
    );

    for (const order of completedProductOrders) {
      const orderSubtotal = Number(order.subtotal || 0);
      const orderDiscount = Number(order.discountAmount || 0);
      const discountRatio =
        orderSubtotal > 0 && orderDiscount > 0
          ? orderDiscount / orderSubtotal
          : 0;

      for (const item of order.items) {
        const grossLineTotal = Number(item.lineTotal || 0);
        const netLineTotal = Math.max(
          0,
          Math.round(grossLineTotal * (1 - discountRatio) * 100) / 100,
        );

        const p = item.product;
        const rawCat = (p?.productCategory || '').toUpperCase();
        const rawType = (p?.productType || '').toLowerCase();
        const catName = (p?.category?.name || '').toLowerCase();

        // 1. Phone Category: IMEI tracking / PhoneUnit / PHONE enum / phone in name/type
        const isPhone =
          (item.phoneUnits && item.phoneUnits.length > 0) ||
          rawCat === 'PHONE' ||
          rawType === 'phone' ||
          rawType.includes('smartphone') ||
          catName.includes('phone') ||
          catName.includes('smartphone');

        // 2. Display / Spare Part Category
        const isDisplay =
          !isPhone &&
          (rawCat === 'SPARE_PART' ||
            rawCat === 'DISPLAY' ||
            rawType.includes('display') ||
            rawType.includes('spare') ||
            rawType.includes('screen') ||
            catName.includes('display') ||
            catName.includes('screen') ||
            catName.includes('spare'));

        // 3. Gadget / Accessory Category
        const isGadget =
          !isPhone &&
          !isDisplay &&
          (rawCat === 'ACCESSORY' ||
            rawCat === 'GADGET' ||
            rawType.includes('gadget') ||
            rawType.includes('accessory') ||
            catName.includes('gadget') ||
            catName.includes('accessory'));

        // Calculate COGS using historical buying prices at intake
        let itemCOGS = 0;
        if (isPhone && item.phoneUnits && item.phoneUnits.length > 0) {
          itemCOGS = item.phoneUnits.reduce((sum, pu) => {
            const buyingCost =
              Number(pu.buyingPrice) ||
              Number(item.variant?.buyingPrice) ||
              Number(p?.buyingPrice) ||
              Number(p?.costPrice) ||
              0;
            return sum + buyingCost;
          }, 0);
        } else {
          const unitBuyingCost =
            Number(item.variant?.buyingPrice) ||
            Number(p?.buyingPrice) ||
            Number(p?.costPrice) ||
            0;
          itemCOGS = unitBuyingCost * Number(item.quantity || 1);
        }

        if (isPhone) {
          totalPhoneSales += netLineTotal;
          totalPhoneCOGS += itemCOGS;
        } else if (isGadget) {
          totalGadgetSales += netLineTotal;
          totalGadgetCOGS += itemCOGS;
        } else {
          // Defaults to Display / Spare Part for any spare-part products
          totalDisplaySales += netLineTotal;
          totalDisplayCOGS += itemCOGS;
        }
      }
    }

    // Round categorized sales
    totalPhoneSales = Math.round(totalPhoneSales * 100) / 100;
    totalDisplaySales = Math.round(totalDisplaySales * 100) / 100;
    totalGadgetSales = Math.round(totalGadgetSales * 100) / 100;

    // ============================= 2. SERVICES REVENUE =============================
    const completedServiceJobs = serviceJobs.filter(
      (j) =>
        (j.status as string) === 'DELIVERED' ||
        (j.status as string) === 'COMPLETED',
    );

    const totalServices = completedServiceJobs.reduce((sum, j) => {
      const revenue =
        Number(j.finalAmount) ||
        Number(j.totalBill) ||
        Number(j.serviceCharge) ||
        0;
      return sum + revenue;
    }, 0);

    const serviceMaterialCost = completedServiceJobs.reduce(
      (sum, j) => sum + Number(j.materialCost || 0),
      0,
    );

    // Headline Total Sales = sum of all 4 revenue streams
    const totalSales =
      Math.round(
        (totalPhoneSales +
          totalDisplaySales +
          totalGadgetSales +
          totalServices) *
          100,
      ) / 100;

    // ============================= 3. PROFIT CALCULATION =============================
    const totalCOGS = totalPhoneCOGS + totalDisplayCOGS + totalGadgetCOGS;
    const totalProfit =
      Math.round((totalSales - totalCOGS - serviceMaterialCost) * 100) / 100;

    // ============================= 4. PURCHASES & SUPPLIER DUE =============================
    const totalPurchase = purchaseOrders.reduce(
      (sum, po) => sum + Number(po.grandTotal || 0),
      0,
    );

    let totalSupplierDue = openSupplierPOs.reduce(
      (sum, po) => sum + Number(po.dueAmount || 0),
      0,
    );
    // If global (no branch filter) and POs don't cover non-PO supplier dues, reconcile with supplier ledger
    if (!branchId) {
      const supplierDueAggregate = await this.prisma.supplier.aggregate({
        _sum: { totalDue: true },
      });
      const ledgerTotalDue = Number(supplierDueAggregate._sum.totalDue || 0);
      if (ledgerTotalDue > totalSupplierDue) {
        totalSupplierDue = ledgerTotalDue;
      }
    }

    // ============================= 5. OPERATIONAL / LEGACY KPIS =============================
    const netProductSales =
      totalPhoneSales + totalDisplaySales + totalGadgetSales;
    const netServiceRevenue = totalServices;
    const totalRevenue = totalSales;

    const liquidSales =
      completedProductOrders.reduce(
        (sum, o) => sum + Number(o.paidAmount || 0),
        0,
      ) +
      completedServiceJobs.reduce(
        (sum, j) => sum + (Number(j.paidAmount) || Number(j.finalAmount) || 0),
        0,
      );

    const totalPaidExpense = expenses
      .filter((e) => e.status === ExpenseStatus.PAID)
      .reduce((sum, e) => sum + Number(e.amount), 0);

    const totalPaidPayroll = payrolls
      .filter((p) => p.status === PayrollStatus.PAID)
      .reduce((sum, p) => sum + Number(p.netSalary), 0);

    const totalExpensePayroll = totalPaidExpense + totalPaidPayroll;
    const totalSupplierPayment = purchaseOrders.reduce(
      (sum, po) => sum + Number(po.amountPaid),
      0,
    );
    const totalDueSales = completedProductOrders.reduce(
      (sum, o) => sum + Number(o.dueAmount || 0),
      0,
    );
    const totalExpense = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
    const payrollSalary = payrolls.reduce(
      (sum, p) => sum + Number(p.netSalary),
      0,
    );

    // ============================= 6. ORDER STATUS BREAKDOWN =============================
    const orderStatusCounts = {
      pending: allOrders.filter((o) => o.status === OrderStatus.PENDING).length,
      confirmed: allOrders.filter((o) => o.status === OrderStatus.CONFIRMED)
        .length,
      parcelBooked: allOrders.filter(
        (o) => o.status === OrderStatus.PARCEL_BOOKED,
      ).length,
      delivered: allOrders.filter((o) => o.status === OrderStatus.DELIVERED)
        .length,
      returned: allOrders.filter((o) => o.status === OrderStatus.RETURNED)
        .length,
      cancelled: allOrders.filter((o) => o.status === OrderStatus.CANCELLED)
        .length,
      diagnosing:
        allOrders.filter((o) => o.status === OrderStatus.DIAGNOSING).length +
        serviceJobs.filter((j) =>
          ['PENDING', 'IN_PROGRESS', 'DIAGNOSING'].includes(j.status as string),
        ).length,
      completed:
        allOrders.filter((o) => o.status === OrderStatus.COMPLETED).length +
        serviceJobs.filter((j) =>
          ['DELIVERED', 'COMPLETED', 'READY_FOR_PICKUP'].includes(
            j.status as string,
          ),
        ).length,
    };

    // Chart Data (Last 7 Days)
    const chartDays = 7;
    const chartData: any[] = [];
    const now = new Date();
    for (let i = chartDays - 1; i >= 0; i--) {
      const d = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i),
      );
      const dayStart = new Date(d);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(d);
      dayEnd.setHours(23, 59, 59, 999);
      const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });

      const dayOrders = allOrders.filter((o) => {
        const oDate = new Date(o.createdAt);
        return oDate >= dayStart && oDate <= dayEnd;
      });

      const dayExpenses = expenses.filter((e) => {
        const eDate = new Date(e.createdAt);
        return eDate >= dayStart && eDate <= dayEnd;
      });

      const dayIncome = dayOrders.reduce(
        (sum, o) => sum + Number(o.totalAmount),
        0,
      );
      const dayExpenseTotal = dayExpenses.reduce(
        (sum, e) => sum + Number(e.amount),
        0,
      );

      chartData.push({
        name: dayName,
        income: dayIncome,
        expense: dayExpenseTotal,
        order: dayOrders.length,
      });
    }

    // Top Selling Products
    const prodMap = new Map<
      string,
      {
        id: string;
        name: string;
        category: string;
        price: number;
        unitsSold: number;
        image: string | null;
      }
    >();
    for (const order of completedProductOrders) {
      for (const item of order.items) {
        const pid = item.productId;
        if (!prodMap.has(pid)) {
          prodMap.set(pid, {
            id: pid,
            name: item.productNameSnapshot || item.product?.name || 'Product',
            category: item.product?.category?.name || 'Category',
            price: Number(item.unitPrice),
            unitsSold: 0,
            image: item.product?.images?.[0]?.url || null,
          });
        }
        prodMap.get(pid)!.unitsSold += item.quantity;
      }
    }
    const topSellingProducts = Array.from(prodMap.values())
      .sort((a, b) => b.unitsSold - a.unitsSold)
      .slice(0, 5);

    // Top Customers
    const topCustomersList = allCustomers
      .map((c) => ({
        id: c.id,
        name: c.name,
        phone: c.phone || 'N/A',
        ordersCount: c.orders.length,
        totalSpend: c.orders.reduce((sum, o) => sum + Number(o.totalAmount), 0),
      }))
      .sort((a, b) => b.totalSpend - a.totalSpend)
      .slice(0, 5);

    // Permission-based financial data masking (Fail-closed)
    const rolePermissions = user?.roleId
      ? await this.prisma.rolePermission.findMany({
          where: { roleId: user.roleId, allowed: true },
          select: { module: true, action: true },
        })
      : [];

    const hasReportRead = rolePermissions.some(
      (p) => p.module === ModuleName.REPORT && p.action === PermissionAction.READ,
    );
    const hasSalesRead = rolePermissions.some(
      (p) => p.module === ModuleName.SALES && p.action === PermissionAction.READ,
    );
    const hasPurchaseRead = rolePermissions.some(
      (p) => p.module === ModuleName.PURCHASE && p.action === PermissionAction.READ,
    );

    const isTech = await this.isTechnicianUser(
      user?.sub,
      user?.roleId,
      user?.roleName,
    );

    let roleName = user?.roleName || '';
    if (!roleName && user?.roleId) {
      const role = await this.prisma.role.findUnique({
        where: { id: user.roleId },
        select: { name: true },
      });
      roleName = role?.name || '';
    }
    const roleLower = roleName.toLowerCase();
    const isPurchaseRole =
      roleLower.includes('purchase manager') ||
      (hasPurchaseRead && !hasSalesRead && !isTech);

    // Sales KPIs: only with SALES:READ, and not a technician (technicians only view service work)
    const maskSales = !hasSalesRead || isTech;

    // Financial KPIs (profit, expenses, payroll): strictly only with REPORT:READ
    const maskFinancials = !hasReportRead;

    // Purchase & Supplier KPIs: only with REPORT:READ or PURCHASE:READ for procurement roles
    const maskPurchases = !hasReportRead && !isPurchaseRole;

    return {
      kpi: {
        // 8 Core Fix Pass 24 Cards
        totalSales: maskSales ? 0 : totalSales,
        totalPhoneSales: maskSales ? 0 : totalPhoneSales,
        totalDisplaySales: maskSales ? 0 : totalDisplaySales,
        totalGadgetSales: maskSales ? 0 : totalGadgetSales,
        totalServices, // Realized repair servicing jobs - relevant to operational staff
        totalProfit: maskFinancials ? 0 : totalProfit,
        totalPurchase: maskPurchases ? 0 : totalPurchase,
        totalSupplierDue: maskPurchases ? 0 : totalSupplierDue,

        // Operational / Legacy Cards
        totalRevenue: maskSales ? 0 : totalRevenue,
        netProductSales: maskSales ? 0 : netProductSales,
        netServiceRevenue: totalServices,
        liquidSales: maskSales ? 0 : liquidSales,
        totalExpensePayroll: maskFinancials ? 0 : totalExpensePayroll,
        totalSupplierPayment: maskPurchases ? 0 : totalSupplierPayment,
        totalDueSales: maskSales ? 0 : totalDueSales,
        totalExpense: maskFinancials ? 0 : totalExpense,
        payrollSalary: maskFinancials ? 0 : payrollSalary,
      },
      orderStatuses: orderStatusCounts,
      chartData: chartData.map((c) => ({
        ...c,
        income: maskSales ? 0 : c.income,
        expense: maskFinancials ? 0 : c.expense,
      })),
      topProducts: maskSales && !isPurchaseRole ? [] : topSellingProducts,
      recentOrders: allOrders.slice(0, 5).map((o) => ({
        id: o.id,
        orderCode: o.orderCode,
        customerName: o.customer?.name || 'Customer',
        branchName: o.branch?.name || 'Global',
        totalAmount: maskSales ? 0 : Number(o.totalAmount),
        status: o.status,
        createdAt: o.createdAt.toISOString(),
      })),
      topCustomers: maskSales ? [] : topCustomersList,
    };
  }
}
