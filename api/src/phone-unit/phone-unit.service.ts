import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePhoneUnitDto } from './dto/phone-unit.dto';
import { PhoneUnitStatus, Prisma } from '@prisma/client';
import { BranchScopeService } from '../common/branch/branch-scope.service';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

@Injectable()
export class PhoneUnitService {
  constructor(
    private prisma: PrismaService,
    private branchScopeService: BranchScopeService,
  ) {}

  async checkImei(imei: string) {
    if (!imei || !imei.trim()) {
      return { exists: false, message: 'No IMEI provided' };
    }
    const cleanImei = imei.trim();

    const existing = await this.prisma.phoneUnit.findFirst({
      where: {
        OR: [{ imei1: cleanImei }, { imei2: cleanImei }],
      },
      include: {
        branch: { select: { id: true, name: true } },
        productVariant: {
          select: {
            id: true,
            sku: true,
            color: true,
            quality: true,
            product: { select: { id: true, name: true, productType: true } },
          },
        },
      },
    });

    if (existing) {
      return {
        exists: true,
        available: false,
        message: `IMEI ${cleanImei} already exists (${existing.status} at ${existing.branch?.name || 'Branch'})`,
        unit: existing,
      };
    }

    return {
      exists: false,
      available: true,
      message: 'New IMEI available',
    };
  }

  async getAvailableUnits(
    variantId: string,
    branchId?: string,
    user?: JwtPayload,
  ) {
    const where: Prisma.PhoneUnitWhereInput = {
      productVariantId: variantId,
      status: PhoneUnitStatus.IN_STOCK,
    };

    const branchFilter = await this.branchScopeService.getBranchFilter(
      user,
      branchId,
    );
    if (branchFilter !== undefined) {
      where.branchId = branchFilter;
    }

    return this.prisma.phoneUnit.findMany({
      where,
      include: {
        branch: { select: { id: true, name: true } },
        productVariant: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                productType: true,
                condition: true,
                brand: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findAll(
    query: {
      branchId?: string;
      status?: PhoneUnitStatus;
      variantId?: string;
      search?: string;
      page?: number;
      limit?: number;
    },
    user?: JwtPayload,
  ) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.PhoneUnitWhereInput = {};

    const branchFilter = await this.branchScopeService.getBranchFilter(
      user,
      query.branchId,
    );
    if (branchFilter !== undefined) {
      where.branchId = branchFilter;
    }

    if (query.status) where.status = query.status;
    if (query.variantId) where.productVariantId = query.variantId;

    if (query.search?.trim()) {
      const s = query.search.trim();
      where.OR = [
        { imei1: { contains: s, mode: 'insensitive' } },
        { imei2: { contains: s, mode: 'insensitive' } },
        { serialNumber: { contains: s, mode: 'insensitive' } },
        {
          productVariant: {
            product: { name: { contains: s, mode: 'insensitive' } },
          },
        },
      ];
    }

    const [total, data] = await Promise.all([
      this.prisma.phoneUnit.count({ where }),
      this.prisma.phoneUnit.findMany({
        where,
        skip,
        take: limit,
        include: {
          branch: { select: { id: true, name: true } },
          productVariant: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  productType: true,
                  condition: true,
                  brand: { select: { id: true, name: true } },
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
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
    const unit = await this.prisma.phoneUnit.findUnique({
      where: { id },
      include: {
        branch: true,
        productVariant: {
          include: {
            product: { include: { brand: true, category: true } },
          },
        },
        purchase: true,
        sale: { include: { customer: true } },
      },
    });
    if (!unit) {
      throw new NotFoundException(`Phone unit with ID "${id}" not found.`);
    }

    if (user) {
      await this.branchScopeService.validateBranchAccess(user, unit.branchId);
    }

    return unit;
  }

  async create(dto: CreatePhoneUnitDto, user?: JwtPayload) {
    const branchId = await this.branchScopeService.determineCreateBranchId(
      user,
      dto.branchId,
    );

    const imei1Check = await this.checkImei(dto.imei1);
    if (imei1Check.exists) {
      throw new ConflictException(
        `IMEI 1 "${dto.imei1}" already exists in the system.`,
      );
    }

    if (dto.imei2) {
      const imei2Check = await this.checkImei(dto.imei2);
      if (imei2Check.exists) {
        throw new ConflictException(
          `IMEI 2 "${dto.imei2}" already exists in the system.`,
        );
      }
    }

    return this.prisma.phoneUnit.create({
      data: {
        productVariantId: dto.productVariantId,
        branchId,
        imei1: dto.imei1.trim(),
        imei2: dto.imei2?.trim() || null,
        serialNumber: dto.serialNumber?.trim() || null,
        status: dto.status || PhoneUnitStatus.IN_STOCK,
        buyingPrice: dto.buyingPrice
          ? new Prisma.Decimal(dto.buyingPrice)
          : null,
        sellingPrice: dto.sellingPrice
          ? new Prisma.Decimal(dto.sellingPrice)
          : null,
        purchaseId: dto.purchaseId || null,
        warrantyType: dto.warrantyType || null,
        warrantyPeriod: dto.warrantyPeriod || null,
      },
      include: {
        productVariant: { include: { product: true } },
        branch: true,
      },
    });
  }
}
