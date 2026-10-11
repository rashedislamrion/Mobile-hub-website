import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateSalesReturnDto,
  RejectSalesReturnDto,
} from './dto/create-sales-return.dto';
import { Prisma, ReturnStatus } from '@prisma/client';
import { BranchScopeService } from '../common/branch/branch-scope.service';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

@Injectable()
export class SalesReturnService {
  constructor(
    private prisma: PrismaService,
    private branchScopeService: BranchScopeService,
  ) {}

  async findAll(
    query: {
      status?: ReturnStatus;
      branch?: string;
      search?: string;
      page?: number;
      limit?: number;
    },
    user?: JwtPayload,
  ) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.SalesReturnWhereInput = {};

    if (query.status) where.status = query.status;

    const branchFilter = await this.branchScopeService.getBranchFilter(
      user,
      query.branch,
    );
    if (branchFilter !== undefined) {
      where.branchId = branchFilter;
    }

    if (query.search?.trim()) {
      const s = query.search.trim();
      where.OR = [
        { returnCode: { contains: s, mode: 'insensitive' } },
        { order: { orderCode: { contains: s, mode: 'insensitive' } } },
        { order: { customer: { name: { contains: s, mode: 'insensitive' } } } },
      ];
    }

    const [total, data] = await Promise.all([
      this.prisma.salesReturn.count({ where }),
      this.prisma.salesReturn.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          order: {
            include: {
              customer: { select: { id: true, name: true, phone: true } },
              branch: { select: { id: true, name: true } },
            },
          },
          items: {
            include: {
              orderItem: {
                include: {
                  product: { select: { id: true, name: true } },
                  variant: { select: { id: true, color: true, quality: true } },
                },
              },
            },
          },
        },
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

  async findOne(id: string, user?: JwtPayload) {
    const returnRecord = await this.prisma.salesReturn.findUnique({
      where: { id },
      include: {
        order: {
          include: {
            customer: true,
            branch: true,
            items: {
              include: {
                product: true,
                variant: true,
              },
            },
          },
        },
        items: {
          include: {
            orderItem: {
              include: {
                product: true,
                variant: true,
              },
            },
          },
        },
      },
    });

    if (!returnRecord)
      throw new NotFoundException(`Sales return "${id}" not found.`);

    if (user) {
      await this.branchScopeService.validateBranchAccess(
        user,
        returnRecord.branchId,
      );
    }

    return returnRecord;
  }

  async create(dto: CreateSalesReturnDto, user?: JwtPayload) {
    const order = await this.prisma.order.findUnique({
      where: { id: dto.orderId },
      include: { items: true },
    });
    if (!order)
      throw new NotFoundException(`Order "${dto.orderId}" not found.`);

    if (user) {
      await this.branchScopeService.validateBranchAccess(user, order.branchId);
    }

    const existingReturn = await this.prisma.salesReturn.findUnique({
      where: { orderId: dto.orderId },
    });
    if (existingReturn)
      throw new ConflictException(
        `A sales return for order "${order.orderCode}" already exists.`,
      );

    let refundAmount = 0;
    const itemsData: any[] = [];

    for (const item of dto.items) {
      const orderItem = order.items.find((oi) => oi.id === item.orderItemId);
      if (!orderItem) {
        throw new BadRequestException(
          `OrderItem "${item.orderItemId}" not found in order "${order.orderCode}".`,
        );
      }
      if (item.quantity > orderItem.quantity) {
        throw new BadRequestException(
          `Return quantity (${item.quantity}) cannot exceed purchased quantity (${orderItem.quantity}).`,
        );
      }
      const itemRefund = Number(orderItem.unitPrice) * item.quantity;
      refundAmount += itemRefund;
      itemsData.push({
        orderItemId: orderItem.id,
        quantity: item.quantity,
      });
    }

    const returnCode = `SR${Date.now().toString().slice(-6)}${Math.floor(100 + Math.random() * 900)}`;

    return this.prisma.salesReturn.create({
      data: {
        returnCode,
        orderId: dto.orderId,
        branchId: order.branchId,
        reason: dto.reason,
        refundAmount,
        status: ReturnStatus.REQUESTED,
        items: {
          create: itemsData,
        },
      },
      include: {
        order: true,
        items: true,
      },
    });
  }

  async approve(id: string, user?: JwtPayload) {
    await this.findOne(id, user);

    const salesReturn = await this.prisma.salesReturn.findUnique({
      where: { id },
      include: {
        items: {
          include: { orderItem: true },
        },
      },
    });
    if (!salesReturn)
      throw new NotFoundException(`Sales return "${id}" not found.`);
    if (salesReturn.status !== ReturnStatus.REQUESTED) {
      throw new BadRequestException(
        `Only returns with status REQUESTED can be approved. Current: ${salesReturn.status}`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      // Restore stock for returned items
      for (const item of salesReturn.items) {
        if (item.orderItem?.variantId) {
          await tx.productVariant.update({
            where: { id: item.orderItem.variantId },
            data: { stock: { increment: item.quantity } },
          });
        }
      }

      return tx.salesReturn.update({
        where: { id },
        data: { status: ReturnStatus.APPROVED },
        include: { order: true, items: true },
      });
    });
  }

  async reject(id: string, dto?: RejectSalesReturnDto, user?: JwtPayload) {
    await this.findOne(id, user);

    const salesReturn = await this.prisma.salesReturn.findUnique({
      where: { id },
    });
    if (!salesReturn)
      throw new NotFoundException(`Sales return "${id}" not found.`);
    if (salesReturn.status !== ReturnStatus.REQUESTED) {
      throw new BadRequestException(
        `Only returns with status REQUESTED can be rejected. Current: ${salesReturn.status}`,
      );
    }

    return this.prisma.salesReturn.update({
      where: { id },
      data: {
        status: ReturnStatus.REJECTED,
        reason: dto?.reason
          ? `${salesReturn.reason} (Rejected: ${dto.reason})`
          : salesReturn.reason,
      },
      include: { order: true, items: true },
    });
  }

  async refund(id: string, user?: JwtPayload) {
    await this.findOne(id, user);

    const salesReturn = await this.prisma.salesReturn.findUnique({
      where: { id },
    });
    if (!salesReturn)
      throw new NotFoundException(`Sales return "${id}" not found.`);
    if (salesReturn.status !== ReturnStatus.APPROVED) {
      throw new BadRequestException(
        `Only APPROVED returns can be marked as refunded. Current: ${salesReturn.status}`,
      );
    }

    return this.prisma.salesReturn.update({
      where: { id },
      data: { status: ReturnStatus.REFUNDED },
      include: { order: true, items: true },
    });
  }
}
