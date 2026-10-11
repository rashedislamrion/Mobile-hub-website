import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreatePromoCodeDto,
  UpdatePromoCodeDto,
  ValidatePromoCodeDto,
} from './dto/promo-code.dto';
import {
  Prisma,
  PromoAdStatus,
  PromoApplicableTo,
  PromoDiscountType,
} from '@prisma/client';

@Injectable()
export class PromoCodeService {
  constructor(private prisma: PrismaService) {}

  async findAll(query?: { status?: PromoAdStatus; search?: string }) {
    const where: Prisma.PromoCodeWhereInput = {};
    if (query?.status) where.status = query.status;
    if (query?.search?.trim()) {
      where.code = { contains: query.search.trim(), mode: 'insensitive' };
    }

    const promos = await this.prisma.promoCode.findMany({
      where,
      orderBy: { validUntil: 'desc' },
    });
    return promos.map((p) => ({
      ...p,
      singleUserLimit: p.perCustomerLimit,
    }));
  }

  async findOne(id: string) {
    const promo = await this.prisma.promoCode.findUnique({ where: { id } });
    if (!promo)
      throw new NotFoundException(`Promo code with ID "${id}" not found.`);
    return {
      ...promo,
      singleUserLimit: promo.perCustomerLimit,
    };
  }

  async create(dto: CreatePromoCodeDto) {
    const existing = await this.prisma.promoCode.findUnique({
      where: { code: dto.code.trim().toUpperCase() },
    });
    if (existing) {
      throw new ConflictException(
        `Promo code "${dto.code.toUpperCase()}" already exists.`,
      );
    }

    return this.prisma.promoCode.create({
      data: {
        code: dto.code.trim().toUpperCase(),
        discountType: dto.discountType,
        discountValue: dto.discountValue,
        maxDiscountCap:
          dto.maxDiscountCap !== undefined ? dto.maxDiscountCap : null,
        minOrderAmount:
          dto.minOrderAmount !== undefined ? dto.minOrderAmount : null,
        usageLimit: dto.usageLimit !== undefined ? dto.usageLimit : null,
        usedCount: 0,
        perCustomerLimit:
          dto.singleUserLimit !== undefined
            ? dto.singleUserLimit
            : dto.perCustomerLimit !== undefined
              ? dto.perCustomerLimit
              : null,
        applicableTo: dto.applicableTo || PromoApplicableTo.ALL,
        applicableCategoryId: dto.applicableCategoryId || null,
        applicableProductIds: dto.applicableProductIds || [],
        validFrom: new Date(dto.validFrom),
        validUntil: new Date(dto.validUntil),
        status: dto.status || PromoAdStatus.ACTIVE,
      },
    });
  }

  async update(id: string, dto: UpdatePromoCodeDto) {
    await this.findOne(id);

    if (dto.code) {
      const existing = await this.prisma.promoCode.findFirst({
        where: {
          code: dto.code.trim().toUpperCase(),
          NOT: { id },
        },
      });
      if (existing) {
        throw new ConflictException(
          `Promo code "${dto.code.toUpperCase()}" is already in use.`,
        );
      }
    }

    return this.prisma.promoCode.update({
      where: { id },
      data: {
        code: dto.code ? dto.code.trim().toUpperCase() : undefined,
        discountType: dto.discountType,
        discountValue: dto.discountValue,
        maxDiscountCap:
          dto.maxDiscountCap !== undefined ? dto.maxDiscountCap : undefined,
        minOrderAmount:
          dto.minOrderAmount !== undefined ? dto.minOrderAmount : undefined,
        usageLimit: dto.usageLimit !== undefined ? dto.usageLimit : undefined,
        perCustomerLimit:
          dto.singleUserLimit !== undefined
            ? dto.singleUserLimit
            : dto.perCustomerLimit !== undefined
              ? dto.perCustomerLimit
              : undefined,
        applicableTo: dto.applicableTo,
        applicableCategoryId:
          dto.applicableCategoryId !== undefined
            ? dto.applicableCategoryId
            : undefined,
        applicableProductIds: dto.applicableProductIds,
        validFrom: dto.validFrom ? new Date(dto.validFrom) : undefined,
        validUntil: dto.validUntil ? new Date(dto.validUntil) : undefined,
        status: dto.status,
      },
    });
  }

  async validatePromoCode(dto: ValidatePromoCodeDto) {
    const code = dto.code.trim().toUpperCase();
    const promo = await this.prisma.promoCode.findUnique({
      where: { code },
    });

    if (!promo) {
      throw new BadRequestException(
        `Promo code "${code}" is invalid or does not exist.`,
      );
    }

    if (promo.status !== PromoAdStatus.ACTIVE) {
      throw new BadRequestException(`Promo code "${code}" is not active.`);
    }

    const now = new Date();
    if (now < promo.validFrom) {
      throw new BadRequestException(`Promo code "${code}" is not valid yet.`);
    }
    if (now > promo.validUntil) {
      throw new BadRequestException(`Promo code "${code}" has expired.`);
    }

    if (promo.usageLimit !== null && promo.usedCount >= promo.usageLimit) {
      throw new BadRequestException(
        `Promo code "${code}" has reached its maximum usage limit.`,
      );
    }

    const subtotal = Number(dto.orderSubtotal ?? dto.orderAmount ?? 0);
    if (
      promo.minOrderAmount !== null &&
      subtotal < Number(promo.minOrderAmount)
    ) {
      throw new BadRequestException(
        `Minimum order amount of ৳${Number(promo.minOrderAmount).toLocaleString()} required to use promo code "${code}".`,
      );
    }

    // Applicability checks
    if (promo.applicableTo === PromoApplicableTo.CATEGORY) {
      if (promo.applicableCategoryId) {
        const matchesCategory =
          dto.categoryIds &&
          dto.categoryIds.includes(promo.applicableCategoryId);
        if (!matchesCategory) {
          throw new BadRequestException(
            `Promo code "${code}" is not applicable to the items in your cart.`,
          );
        }
      }
    } else if (promo.applicableTo === PromoApplicableTo.PRODUCT) {
      if (promo.applicableProductIds && promo.applicableProductIds.length > 0) {
        const matchesProduct =
          dto.productIds &&
          dto.productIds.some((pId) =>
            promo.applicableProductIds.includes(pId),
          );
        if (!matchesProduct) {
          throw new BadRequestException(
            `Promo code "${code}" is not applicable to the products in your cart.`,
          );
        }
      }
    }

    // Calculate discount amount
    let discountAmount = 0;
    const discountVal = Number(promo.discountValue);
    if (promo.discountType === PromoDiscountType.PERCENTAGE) {
      discountAmount = (subtotal * discountVal) / 100;
      if (promo.maxDiscountCap !== null && Number(promo.maxDiscountCap) > 0) {
        discountAmount = Math.min(discountAmount, Number(promo.maxDiscountCap));
      }
    } else {
      // FIXED
      discountAmount = Math.min(subtotal, discountVal);
    }

    discountAmount = Math.round(discountAmount * 100) / 100;

    return {
      valid: true,
      code: promo.code,
      promoCodeId: promo.id,
      discountType: promo.discountType,
      discountValue: Number(promo.discountValue),
      maxDiscountCap: promo.maxDiscountCap
        ? Number(promo.maxDiscountCap)
        : null,
      discountAmount,
      finalSubtotal: Math.max(0, subtotal - discountAmount),
    };
  }

  async remove(id: string) {
    const promo = await this.findOne(id);
    if (promo.usedCount > 0) {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        message: `Cannot delete promo code "${promo.code}". It has been used in ${promo.usedCount} order(s). Please set its status to INACTIVE or EXPIRED instead.`,
        canDeactivate: true,
        blockers: { usedCount: promo.usedCount },
      });
    }

    return this.prisma.promoCode.delete({ where: { id } });
  }
}
