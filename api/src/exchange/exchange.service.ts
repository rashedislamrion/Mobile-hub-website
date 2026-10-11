import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateExchangeDto,
  RejectExchangeDto,
} from './dto/create-exchange.dto';
import { ExchangeStatus, Prisma } from '@prisma/client';
import { BranchScopeService } from '../common/branch/branch-scope.service';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

@Injectable()
export class ExchangeService {
  constructor(
    private prisma: PrismaService,
    private branchScopeService: BranchScopeService,
  ) {}

  async findAll(
    query: {
      status?: ExchangeStatus;
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

    const where: Prisma.ExchangeWhereInput = {};

    if (query.status) where.status = query.status;

    const branchFilter = await this.branchScopeService.getBranchFilter(
      user,
      query.branch,
    );
    if (branchFilter !== undefined) {
      where.order = { branchId: branchFilter };
    }

    if (query.search?.trim()) {
      const s = query.search.trim();
      where.OR = [
        { exchangeCode: { contains: s, mode: 'insensitive' } },
        { order: { orderCode: { contains: s, mode: 'insensitive' } } },
        { order: { customer: { name: { contains: s, mode: 'insensitive' } } } },
      ];
    }

    const [total, data] = await Promise.all([
      this.prisma.exchange.count({ where }),
      this.prisma.exchange.findMany({
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
          oldOrderItem: {
            include: {
              product: { select: { id: true, name: true } },
              variant: { select: { id: true, color: true, quality: true } },
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
    const exchange = await this.prisma.exchange.findUnique({
      where: { id },
      include: {
        order: {
          include: {
            customer: true,
            branch: true,
            items: true,
          },
        },
        oldOrderItem: {
          include: {
            product: true,
            variant: true,
          },
        },
      },
    });

    if (!exchange) throw new NotFoundException(`Exchange "${id}" not found.`);

    if (user) {
      await this.branchScopeService.validateBranchAccess(
        user,
        exchange.order.branchId,
      );
    }

    // Fetch new product / variant details
    const newProduct = await this.prisma.product.findUnique({
      where: { id: exchange.newProductId },
      include: { variants: true },
    });
    const newVariant = exchange.newVariantId
      ? newProduct?.variants.find((v) => v.id === exchange.newVariantId)
      : null;

    return {
      ...exchange,
      newProduct,
      newVariant,
    };
  }

  async create(dto: CreateExchangeDto, user?: JwtPayload) {
    const order = await this.prisma.order.findUnique({
      where: { id: dto.orderId },
      include: { items: true },
    });
    if (!order)
      throw new NotFoundException(`Order "${dto.orderId}" not found.`);

    if (user) {
      await this.branchScopeService.validateBranchAccess(user, order.branchId);
    }

    const oldOrderItem = order.items.find((oi) => oi.id === dto.oldOrderItemId);
    if (!oldOrderItem)
      throw new NotFoundException(
        `OrderItem "${dto.oldOrderItemId}" not found in order.`,
      );

    const newProduct = await this.prisma.product.findUnique({
      where: { id: dto.newProductId },
      include: { variants: true },
    });
    if (!newProduct)
      throw new NotFoundException(
        `New product "${dto.newProductId}" not found.`,
      );

    let newUnitPrice = Number(newProduct.regularPrice);
    if (dto.newVariantId) {
      const v = newProduct.variants.find((vr) => vr.id === dto.newVariantId);
      if (v) newUnitPrice = Number(v.price);
    }

    const priceDifference =
      dto.priceDifference !== undefined
        ? dto.priceDifference
        : newUnitPrice * oldOrderItem.quantity - Number(oldOrderItem.lineTotal);

    const exchangeCode = `EX${Date.now().toString().slice(-6)}${Math.floor(100 + Math.random() * 900)}`;

    return this.prisma.exchange.create({
      data: {
        exchangeCode,
        orderId: dto.orderId,
        oldOrderItemId: dto.oldOrderItemId,
        newProductId: dto.newProductId,
        newVariantId: dto.newVariantId || null,
        priceDifference,
        status: ExchangeStatus.REQUESTED,
      },
      include: {
        order: true,
        oldOrderItem: true,
      },
    });
  }

  async approve(id: string, user?: JwtPayload) {
    await this.findOne(id, user);

    const exchange = await this.prisma.exchange.findUnique({ where: { id } });
    if (!exchange) throw new NotFoundException(`Exchange "${id}" not found.`);
    if (exchange.status !== ExchangeStatus.REQUESTED) {
      throw new BadRequestException(
        `Only REQUESTED exchanges can be approved. Current: ${exchange.status}`,
      );
    }

    return this.prisma.exchange.update({
      where: { id },
      data: { status: ExchangeStatus.APPROVED },
      include: { order: true, oldOrderItem: true },
    });
  }

  async itemReceived(id: string, user?: JwtPayload) {
    await this.findOne(id, user);

    const exchange = await this.prisma.exchange.findUnique({
      where: { id },
      include: { oldOrderItem: true },
    });
    if (!exchange) throw new NotFoundException(`Exchange "${id}" not found.`);
    if (exchange.status !== ExchangeStatus.APPROVED) {
      throw new BadRequestException(
        `Only APPROVED exchanges can mark item received. Current: ${exchange.status}`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      // Restore stock of old item
      if (exchange.oldOrderItem?.variantId) {
        await tx.productVariant.update({
          where: { id: exchange.oldOrderItem.variantId },
          data: { stock: { increment: exchange.oldOrderItem.quantity } },
        });
      }

      return tx.exchange.update({
        where: { id },
        data: { status: ExchangeStatus.ITEM_RECEIVED },
        include: { order: true, oldOrderItem: true },
      });
    });
  }

  async complete(id: string, user?: JwtPayload) {
    await this.findOne(id, user);

    const exchange = await this.prisma.exchange.findUnique({
      where: { id },
      include: { oldOrderItem: true },
    });
    if (!exchange) throw new NotFoundException(`Exchange "${id}" not found.`);
    if (exchange.status !== ExchangeStatus.ITEM_RECEIVED) {
      throw new BadRequestException(
        `Only ITEM_RECEIVED exchanges can be completed. Current: ${exchange.status}`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      // Deduct stock of new item
      if (exchange.newVariantId) {
        const newVariant = await tx.productVariant.findUnique({
          where: { id: exchange.newVariantId },
        });
        const qty = exchange.oldOrderItem?.quantity || 1;
        if (!newVariant || newVariant.stock < qty) {
          throw new ConflictException(
            `Insufficient stock for exchange replacement variant.`,
          );
        }
        await tx.productVariant.update({
          where: { id: exchange.newVariantId },
          data: { stock: { decrement: qty } },
        });
      }

      return tx.exchange.update({
        where: { id },
        data: { status: ExchangeStatus.COMPLETED },
        include: { order: true, oldOrderItem: true },
      });
    });
  }

  async reject(id: string, dto?: RejectExchangeDto, user?: JwtPayload) {
    await this.findOne(id, user);

    const exchange = await this.prisma.exchange.findUnique({ where: { id } });
    if (!exchange) throw new NotFoundException(`Exchange "${id}" not found.`);
    if (exchange.status === ExchangeStatus.COMPLETED) {
      throw new BadRequestException(
        `Cannot reject an already completed exchange.`,
      );
    }

    return this.prisma.exchange.update({
      where: { id },
      data: { status: ExchangeStatus.REJECTED },
      include: { order: true, oldOrderItem: true },
    });
  }
}
