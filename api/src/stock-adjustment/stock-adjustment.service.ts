import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateStockAdjustmentDto,
  CreateBatchStockAdjustmentDto,
} from './dto/create-stock-adjustment.dto';
import { Prisma, StockAdjustmentType } from '@prisma/client';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

import { BranchScopeService } from '../common/branch/branch-scope.service';

@Injectable()
export class StockAdjustmentService {
  constructor(
    private prisma: PrismaService,
    private branchScopeService: BranchScopeService,
  ) {}

  private async resolveBranchId(
    branchParam?: string,
  ): Promise<string | undefined> {
    if (!branchParam || branchParam === 'all' || branchParam === 'GLOBAL') {
      return undefined;
    }
    const branch = await this.prisma.branch.findFirst({
      where: {
        OR: [
          { id: branchParam },
          { name: { equals: branchParam, mode: 'insensitive' } },
          { code: { equals: branchParam, mode: 'insensitive' } },
        ],
      },
      select: { id: true },
    });
    return branch ? branch.id : branchParam;
  }

  async findAll(
    query?: {
      branch?: string;
      branchId?: string;
      type?: StockAdjustmentType;
      search?: string;
      dateFrom?: string;
      dateTo?: string;
      page?: number;
      limit?: number;
    },
    user?: JwtPayload,
  ) {
    const page = Math.max(1, Number(query?.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query?.limit) || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.StockAdjustmentWhereInput = {};

    const requestedBranch = query?.branchId || query?.branch;
    const resolvedBranch = await this.resolveBranchId(requestedBranch);
    const branchFilter = await this.branchScopeService.getBranchFilter(
      user,
      resolvedBranch,
    );
    if (branchFilter !== undefined) {
      where.branchId = branchFilter;
    }

    if (query?.type) {
      where.type = query.type;
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
      const term = query.search.trim();
      where.OR = [
        { referenceNo: { contains: term, mode: 'insensitive' } },
        { reason: { contains: term, mode: 'insensitive' } },
        { notes: { contains: term, mode: 'insensitive' } },
        { product: { name: { contains: term, mode: 'insensitive' } } },
        { variant: { sku: { contains: term, mode: 'insensitive' } } },
      ];
    }

    const [total, data] = await Promise.all([
      this.prisma.stockAdjustment.count({ where }),
      this.prisma.stockAdjustment.findMany({
        where,
        include: {
          product: {
            select: {
              id: true,
              name: true,
              regularPrice: true,
              images: { take: 1, select: { url: true } },
            },
          },
          variant: {
            select: {
              id: true,
              sku: true,
              color: true,
              quality: true,
              stock: true,
              price: true,
            },
          },
          branch: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          adjustedBy: {
            select: {
              id: true,
              name: true,
              employeeId: true,
            },
          },
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

  async findOne(id: string, user?: JwtPayload) {
    const adjustment = await this.prisma.stockAdjustment.findUnique({
      where: { id },
      include: {
        product: true,
        variant: true,
        branch: true,
        adjustedBy: { select: { id: true, name: true, employeeId: true } },
      },
    });

    if (!adjustment) {
      throw new NotFoundException(
        `Stock adjustment with ID "${id}" not found.`,
      );
    }

    if (user) {
      await this.branchScopeService.validateBranchAccess(
        user,
        adjustment.branchId,
      );
    }

    return adjustment;
  }

  async create(dto: CreateStockAdjustmentDto, user?: JwtPayload) {
    const requestedBranch = (await this.resolveBranchId(dto.branchId)) || dto.branchId;
    const branchId = await this.branchScopeService.determineCreateBranchId(
      user,
      requestedBranch,
    );
    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
    });
    if (!branch) throw new NotFoundException(`Branch not found.`);

    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
      include: { variants: true },
    });
    if (!product) throw new NotFoundException(`Product not found.`);

    let targetVariant = dto.variantId
      ? product.variants.find((v) => v.id === dto.variantId)
      : product.variants[0];

    if (!targetVariant && product.variants.length > 0) {
      targetVariant = product.variants[0];
    }

    if (!targetVariant) {
      throw new BadRequestException(
        `No variant found for product "${product.name}".`,
      );
    }

    // Resolve adjustedBy staff
    let adjustedById = user?.sub;
    if (!adjustedById || user?.userType !== 'STAFF') {
      const firstStaff = await this.prisma.staff.findFirst({
        select: { id: true },
      });
      if (!firstStaff)
        throw new BadRequestException(
          `No staff record found to author adjustment.`,
        );
      adjustedById = firstStaff.id;
    }

    const currentStock = Number(targetVariant.stock || 0);
    const quantity = Number(dto.quantity) || 0;

    let quantityChange = 0;
    let stockAfter = currentStock;

    if (dto.type === StockAdjustmentType.INCREASE) {
      quantityChange = quantity;
      stockAfter = currentStock + quantity;
    } else if (dto.type === StockAdjustmentType.DECREASE) {
      if (currentStock < quantity) {
        throw new BadRequestException(
          `Insufficient stock for "${product.name}" (${targetVariant.sku || 'N/A'}). Current stock: ${currentStock}, requested reduction: ${quantity}.`,
        );
      }
      quantityChange = -quantity;
      stockAfter = currentStock - quantity;
    } else if (dto.type === StockAdjustmentType.RECOUNT) {
      if (quantity < 0) {
        throw new BadRequestException(
          `Recount quantity cannot be negative (${quantity}).`,
        );
      }
      quantityChange = quantity - currentStock;
      stockAfter = quantity;
    }

    const referenceNo = `ADJ-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;

    return this.prisma.$transaction(async (tx) => {
      // Update variant stock
      await tx.productVariant.update({
        where: { id: targetVariant.id },
        data: { stock: stockAfter },
      });

      // Create StockAdjustment record
      return tx.stockAdjustment.create({
        data: {
          referenceNo,
          productId: product.id,
          variantId: targetVariant.id,
          branchId: branch.id,
          type: dto.type,
          quantityChange,
          stockBefore: currentStock,
          stockAfter,
          reason: dto.reason,
          notes: dto.notes || null,
          adjustedById,
        },
        include: {
          product: {
            select: {
              id: true,
              name: true,
              regularPrice: true,
              images: { take: 1, select: { url: true } },
            },
          },
          variant: {
            select: {
              id: true,
              sku: true,
              color: true,
              quality: true,
              stock: true,
              price: true,
            },
          },
          branch: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          adjustedBy: {
            select: {
              id: true,
              name: true,
              employeeId: true,
            },
          },
        },
      });
    });
  }

  async createBatch(dto: CreateBatchStockAdjustmentDto, user?: JwtPayload) {
    const requestedBranch = (await this.resolveBranchId(dto.branchId)) || dto.branchId;
    const branchId = await this.branchScopeService.determineCreateBranchId(
      user,
      requestedBranch,
    );
    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
    });
    if (!branch) throw new NotFoundException(`Branch not found.`);

    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException(
        `At least one adjustment item is required in the batch.`,
      );
    }

    // Resolve adjustedBy staff
    let adjustedById = user?.sub;
    if (!adjustedById || user?.userType !== 'STAFF') {
      const firstStaff = await this.prisma.staff.findFirst({
        select: { id: true },
      });
      if (!firstStaff)
        throw new BadRequestException(
          `No staff record found to author adjustment.`,
        );
      adjustedById = firstStaff.id;
    }

    return this.prisma.$transaction(async (tx) => {
      const createdAdjustments: any[] = [];

      for (let i = 0; i < dto.items.length; i++) {
        const item = dto.items[i];
        const quantity = Number(item.quantity) || 0;
        if (quantity <= 0) {
          throw new BadRequestException(
            `Item #${i + 1} has invalid quantity (${item.quantity}). Quantity must be at least 1.`,
          );
        }

        // Look up product & variant fresh from database inside transaction
        const product = await tx.product.findUnique({
          where: { id: item.productId },
          include: { variants: true },
        });
        if (!product) {
          throw new NotFoundException(
            `Product with ID "${item.productId}" not found.`,
          );
        }

        let targetVariant = item.variantId
          ? product.variants.find((v) => v.id === item.variantId)
          : product.variants[0];

        if (!targetVariant && product.variants.length > 0) {
          targetVariant = product.variants[0];
        }

        if (!targetVariant) {
          throw new BadRequestException(
            `No variant found for product "${product.name}".`,
          );
        }

        const currentStock = Number(targetVariant.stock || 0);
        let quantityChange = 0;
        let stockAfter = currentStock;

        if (item.type === StockAdjustmentType.INCREASE) {
          quantityChange = quantity;
          stockAfter = Number(currentStock) + Number(quantity);
        } else if (item.type === StockAdjustmentType.DECREASE) {
          if (currentStock < quantity) {
            throw new ConflictException(
              `Insufficient stock for "${product.name}" (${targetVariant.sku || 'N/A'}). Current stock: ${currentStock}, requested reduction: ${quantity}. Entire batch rejected.`,
            );
          }
          quantityChange = -quantity;
          stockAfter = Number(currentStock) - Number(quantity);
        } else if (item.type === StockAdjustmentType.RECOUNT) {
          quantityChange = Number(quantity) - Number(currentStock);
          stockAfter = Number(quantity);
        }

        const referenceNo = `ADJ-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;

        // Update variant stock atomically
        await tx.productVariant.update({
          where: { id: targetVariant.id },
          data: { stock: stockAfter },
        });

        // Create StockAdjustment record
        const adj = await tx.stockAdjustment.create({
          data: {
            referenceNo,
            productId: product.id,
            variantId: targetVariant.id,
            branchId: branch.id,
            type: item.type,
            quantityChange,
            stockBefore: currentStock,
            stockAfter,
            reason: dto.reason,
            notes: dto.notes || null,
            adjustedById,
          },
          include: {
            product: {
              select: {
                id: true,
                name: true,
                regularPrice: true,
                images: { take: 1, select: { url: true } },
              },
            },
            variant: {
              select: {
                id: true,
                sku: true,
                color: true,
                quality: true,
                stock: true,
                price: true,
              },
            },
            branch: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
            adjustedBy: {
              select: {
                id: true,
                name: true,
                employeeId: true,
              },
            },
          },
        });

        createdAdjustments.push(adj);
      }

      return createdAdjustments;
    });
  }
}
