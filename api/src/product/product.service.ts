import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { slugify } from '../common/utils/slug.util';
import { Prisma, ProductStatus } from '@prisma/client';
import * as fs from 'fs';
import { join } from 'path';
import {
  getUploadRoot,
  resolveUploadedFiles,
} from '../common/upload/multer.config';
import { storageService } from '../common/upload/storage.service';

export function sanitizePublicProduct<T extends Record<string, any>>(product: T): T {
  if (!product) return product;
  const {
    costPrice,
    buyingPrice,
    wholesalePrice,
    supplier,
    supplierId,
    internalNotes,
    ...cleanProduct
  } = product as any;

  if (Array.isArray(cleanProduct.variants)) {
    cleanProduct.variants = cleanProduct.variants.map((v: any) => {
      const {
        costPrice: _cp,
        buyingPrice: _bp,
        wholesalePrice: _wp,
        supplier: _s,
        supplierId: _sid,
        phoneUnits: _pu,
        branchInventories: _bi,
        ...cleanVariant
      } = v;
      return cleanVariant;
    });
  }

  if (Array.isArray(cleanProduct.relatedProducts)) {
    cleanProduct.relatedProducts = cleanProduct.relatedProducts.map((rp: any) =>
      sanitizePublicProduct(rp),
    );
  }

  return cleanProduct as T;
}

import { BranchScopeService } from '../common/branch/branch-scope.service';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

@Injectable()
export class ProductService {
  constructor(
    private prisma: PrismaService,
    private branchScopeService: BranchScopeService,
  ) {}

  private async generateUniqueSlug(
    baseName: string,
    existingId?: string,
  ): Promise<string> {
    const baseSlug = slugify(baseName) || `product-${Date.now()}`;
    let slug = baseSlug;
    let counter = 1;

    while (true) {
      const existing = await this.prisma.product.findFirst({
        where: {
          slug,
          ...(existingId ? { id: { not: existingId } } : {}),
        },
        select: { id: true },
      });

      if (!existing) {
        return slug;
      }

      counter++;
      slug = `${baseSlug}-${counter}`;
    }
  }

  private async generateUniqueCode(
    providedCode?: string,
    existingId?: string,
  ): Promise<string> {
    if (providedCode && providedCode.trim()) {
      const trimmed = providedCode.trim();
      const existing = await this.prisma.product.findFirst({
        where: {
          code: trimmed,
          ...(existingId ? { id: { not: existingId } } : {}),
        },
        select: { id: true },
      });
      if (existing) {
        throw new ConflictException(
          `Product code "${trimmed}" already exists.`,
        );
      }
      return trimmed;
    }

    while (true) {
      const randomCode = Math.floor(100000 + Math.random() * 900000).toString();
      const existing = await this.prisma.product.findUnique({
        where: { code: randomCode },
        select: { id: true },
      });
      if (!existing) {
        return randomCode;
      }
    }
  }

  async findAllPublic(query: {
    category?: string;
    brand?: string;
    color?: string;
    quality?: string;
    guarantee?: string;
    frame?: string;
    type?: string;
    service?: string;
    sort?: string;
    page?: number;
    limit?: number;
    search?: string;
    featured?: string | boolean;
    bestDeal?: string | boolean;
    homepage?: string | boolean;
    newest?: string | boolean;
    productCategory?: string;
  }) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(query.limit) || 12));
    const skip = (page - 1) * limit;

    const where: Prisma.ProductWhereInput = {
      status: ProductStatus.ACTIVE,
    };

    if (query.featured !== undefined) {
      where.isFeatured = query.featured === true || query.featured === 'true';
    }
    if (query.bestDeal !== undefined) {
      where.isBestDeal = query.bestDeal === true || query.bestDeal === 'true';
    }
    if (query.homepage !== undefined) {
      where.isHomepage = query.homepage === true || query.homepage === 'true';
    }
    if (query.newest !== undefined) {
      where.isNewest = query.newest === true || query.newest === 'true';
    }

    if (
      query.productCategory ||
      (query.type && query.type.toUpperCase() === 'PHONE')
    ) {
      const catVal = (query.productCategory || query.type || '').toUpperCase();
      if (catVal === 'PHONE') {
        where.OR = [
          { productCategory: 'PHONE' },
          { productType: { contains: 'phone', mode: 'insensitive' } },
          { category: { name: { contains: 'phone', mode: 'insensitive' } } },
          { category: { slug: { contains: 'phone', mode: 'insensitive' } } },
        ];
      } else if (catVal === 'SPARE_PART' || catVal === 'SPARE_PARTS') {
        where.OR = [
          { productCategory: 'SPARE_PART' },
          { productType: { contains: 'spare', mode: 'insensitive' } },
          { category: { name: { contains: 'display', mode: 'insensitive' } } },
        ];
      }
    }

    if (query.category) {
      where.OR = [
        { categoryId: query.category },
        { category: { slug: query.category } },
        { category: { parent: { slug: query.category } } },
      ];
    }

    if (query.brand) {
      const brands = query.brand
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (brands.length > 0) {
        where.brand = {
          OR: [
            { id: { in: brands } },
            ...brands.map((b) => ({
              name: { equals: b, mode: 'insensitive' as const },
            })),
          ],
        };
      }
    }

    const variantFilters: Prisma.ProductVariantWhereInput[] = [];
    if (query.color) {
      const colors = query.color
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (colors.length > 0) {
        variantFilters.push({
          OR: colors.map((c) => ({
            color: { equals: c, mode: 'insensitive' as const },
          })),
        });
      }
    }
    if (query.quality) {
      const qualities = query.quality
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (qualities.length > 0) {
        variantFilters.push({
          OR: qualities.map((q) => ({
            quality: { equals: q, mode: 'insensitive' as const },
          })),
        });
      }
    }
    if (variantFilters.length > 0) {
      where.variants = { some: { AND: variantFilters } };
    }

    const specFilters: Prisma.ProductSpecificationWhereInput[] = [];
    ['guarantee', 'frame', 'service'].forEach((specKey) => {
      const val = query[specKey as keyof typeof query];
      if (val && typeof val === 'string') {
        const vals = val
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
        vals.forEach((v) => {
          specFilters.push({
            OR: [
              {
                label: { contains: specKey, mode: 'insensitive' },
                value: { contains: v, mode: 'insensitive' },
              },
              { value: { contains: v, mode: 'insensitive' } },
            ],
          });
        });
      }
    });

    if (specFilters.length > 0) {
      where.specifications = { some: { OR: specFilters } };
    }

    if (query.search) {
      const search = query.search.trim();
      where.AND = [
        ...(Array.isArray(where.AND)
          ? where.AND
          : where.AND
            ? [where.AND]
            : []),
        {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { code: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } },
            { shortDescription: { contains: search, mode: 'insensitive' } },
            {
              variants: {
                some: { sku: { contains: search, mode: 'insensitive' } },
              },
            },
          ],
        },
      ];
    }

    let orderBy:
      | Prisma.ProductOrderByWithRelationInput
      | Prisma.ProductOrderByWithRelationInput[] = { createdAt: 'desc' };
    if (query.sort === 'price_asc') {
      orderBy = { regularPrice: 'asc' };
    } else if (query.sort === 'price_desc') {
      orderBy = { regularPrice: 'desc' };
    } else if (query.sort === 'newest') {
      orderBy = { createdAt: 'desc' };
    } else if (query.sort === 'popular') {
      orderBy = [{ orderItems: { _count: 'desc' } }, { createdAt: 'desc' }];
    }

    const [total, data] = await Promise.all([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          images: { orderBy: { sortOrder: 'asc' } },
          variants: {
            include: {
              phoneUnits: {
                where: { status: 'IN_STOCK' },
                select: { id: true },
              },
            },
          },
          specifications: true,
          category: { select: { id: true, name: true, slug: true } },
          brand: { select: { id: true, name: true, logo: true } },
        },
      }),
    ]);

    const mappedData = data.map((p) => {
      const isPhone =
        p.productCategory === 'PHONE' ||
        p.productType?.toLowerCase() === 'phone' ||
        p.category?.name?.toLowerCase().includes('phone');
      const mappedVariants = p.variants.map((v: any) => ({
        ...v,
        stock: isPhone ? (v.phoneUnits?.length ?? 0) : v.stock,
      }));
      const totalStock = mappedVariants.reduce(
        (sum, v) => sum + (Number(v.stock) || 0),
        0,
      );
      return sanitizePublicProduct({
        ...p,
        variants: mappedVariants,
        totalStock,
      });
    });

    return {
      data: mappedData,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async findBySlug(slugOrId: string) {
    const product = await this.prisma.product.findFirst({
      where: {
        OR: [{ slug: slugOrId }, { id: slugOrId }, { code: slugOrId }],
      },
      include: {
        images: { orderBy: { sortOrder: 'asc' } },
        variants: {
          include: {
            phoneUnits: {
              where: { status: 'IN_STOCK' },
              select: { id: true, imei1: true, imei2: true, branchId: true },
            },
          },
        },
        specifications: true,
        category: true,
        brand: true,
        unit: true,
        reviews: {
          include: {
            customer: { select: { id: true, name: true, photo: true } },
          },
        },
      },
    });

    if (!product) {
      throw new NotFoundException(
        `Product with identifier "${slugOrId}" not found`,
      );
    }

    const isPhone =
      product.productCategory === 'PHONE' ||
      product.productType?.toLowerCase() === 'phone' ||
      product.category?.name?.toLowerCase().includes('phone');
    const mappedVariants = product.variants.map((v: any) => ({
      ...v,
      stock: isPhone ? (v.phoneUnits?.length ?? 0) : v.stock,
      phoneUnits: undefined, // Never expose raw IMEIs on public storefront
    }));
    const totalStock = mappedVariants.reduce(
      (sum, v) => sum + (Number(v.stock) || 0),
      0,
    );

    const relatedProducts = await this.prisma.product.findMany({
      where: {
        categoryId: product.categoryId,
        id: { not: product.id },
        status: ProductStatus.ACTIVE,
      },
      take: 8,
      include: {
        images: { orderBy: { sortOrder: 'asc' } },
        variants: {
          include: {
            phoneUnits: {
              where: { status: 'IN_STOCK' },
              select: { id: true },
            },
          },
        },
        category: { select: { id: true, name: true, slug: true } },
        brand: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const mappedRelated = relatedProducts.map((p) => {
      const relIsPhone = p.productType?.toLowerCase() === 'phone';
      const relVariants = p.variants.map((v: any) => ({
        ...v,
        stock: relIsPhone ? (v.phoneUnits?.length ?? 0) : v.stock,
      }));
      return {
        ...p,
        variants: relVariants,
        totalStock: relVariants.reduce(
          (sum, v) => sum + (Number(v.stock) || 0),
          0,
        ),
      };
    });

    return sanitizePublicProduct({
      ...product,
      variants: mappedVariants,
      totalStock,
      relatedProducts: mappedRelated,
    });
  }

  async findAllAdmin(query: {
    search?: string;
    categoryId?: string;
    brandId?: string;
    branchId?: string;
    status?: ProductStatus;
    homepage?: string | boolean;
    newest?: string | boolean;
    featured?: string | boolean;
    bestDeal?: string | boolean;
    sort?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.ProductWhereInput = {};
    if (query.categoryId && query.categoryId !== 'all')
      where.categoryId = query.categoryId;
    if (query.brandId && query.brandId !== 'all') where.brandId = query.brandId;
    if (query.status && query.status !== ('all' as any))
      where.status = query.status;

    if (query.homepage !== undefined && query.homepage !== 'all') {
      where.isHomepage = query.homepage === true || query.homepage === 'true';
    }
    if (query.newest !== undefined && query.newest !== 'all') {
      where.isNewest = query.newest === true || query.newest === 'true';
    }
    if (query.featured !== undefined && query.featured !== 'all') {
      where.isFeatured = query.featured === true || query.featured === 'true';
    }
    if (query.bestDeal !== undefined && query.bestDeal !== 'all') {
      where.isBestDeal = query.bestDeal === true || query.bestDeal === 'true';
    }

    if (query.search?.trim()) {
      const tokens = query.search.trim().split(/\s+/).filter(Boolean);
      if (tokens.length > 0) {
        where.AND = tokens.map((t) => ({
          OR: [
            { name: { contains: t, mode: 'insensitive' } },
            { code: { contains: t, mode: 'insensitive' } },
            { slug: { contains: t, mode: 'insensitive' } },
            { brand: { name: { contains: t, mode: 'insensitive' } } },
            { series: { name: { contains: t, mode: 'insensitive' } } },
            {
              variants: {
                some: {
                  OR: [
                    { sku: { contains: t, mode: 'insensitive' } },
                  ],
                },
              },
            },
          ],
        }));
      }
    }

    let orderBy:
      | Prisma.ProductOrderByWithRelationInput
      | Prisma.ProductOrderByWithRelationInput[] = { createdAt: 'desc' };
    if (query.sort === 'oldest') {
      orderBy = { createdAt: 'asc' };
    } else if (query.sort === 'price_asc') {
      orderBy = { regularPrice: 'asc' };
    } else if (query.sort === 'price_desc') {
      orderBy = { regularPrice: 'desc' };
    } else if (query.sort === 'name_asc') {
      orderBy = { name: 'asc' };
    } else if (query.sort === 'name_desc') {
      orderBy = { name: 'desc' };
    }

    const [total, products] = await Promise.all([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          images: { orderBy: { sortOrder: 'asc' } },
          variants: {
            include: {
              branchInventories: true,
            },
          },
          category: { select: { id: true, name: true, slug: true } },
          brand: { select: { id: true, name: true, logo: true } },
          series: { select: { id: true, name: true } },
          unit: { select: { id: true, name: true, shortCode: true } },
          _count: { select: { orderItems: true } },
        },
      }),
    ]);

    const targetBranch =
      query.branchId && query.branchId !== 'all' ? query.branchId : null;

    const data = products.map((p) => {
      const variantsWithStock = p.variants.map((v) => {
        let variantStock = Number(v.stock || 0);
        if (targetBranch) {
          const bInv = v.branchInventories?.find(
            (b) => b.branchId === targetBranch,
          );
          variantStock = bInv ? Number(bInv.quantity) : 0;
        } else if (v.branchInventories && v.branchInventories.length > 0) {
          variantStock = v.branchInventories.reduce(
            (sum, b) => sum + Number(b.quantity),
            0,
          );
        }
        return {
          ...v,
          stock: variantStock,
        };
      });

      const totalStock = variantsWithStock.reduce((sum, v) => sum + v.stock, 0);
      return {
        ...p,
        variants: variantsWithStock,
        totalStock,
      };
    });

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

  async updateFlags(
    id: string,
    dto: {
      isNewest?: boolean;
      isFeatured?: boolean;
      isHomepage?: boolean;
      isBestDeal?: boolean;
    },
  ) {
    const existing = await this.prisma.product.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Product with ID "${id}" not found`);
    }

    return this.prisma.product.update({
      where: { id },
      data: {
        ...(dto.isNewest !== undefined ? { isNewest: dto.isNewest } : {}),
        ...(dto.isFeatured !== undefined ? { isFeatured: dto.isFeatured } : {}),
        ...(dto.isHomepage !== undefined ? { isHomepage: dto.isHomepage } : {}),
        ...(dto.isBestDeal !== undefined ? { isBestDeal: dto.isBestDeal } : {}),
      },
    });
  }

  async create(dto: CreateProductDto, files?: Express.Multer.File[]) {
    const slug = await this.generateUniqueSlug(dto.slug || dto.name);
    const code = await this.generateUniqueCode(dto.code);
    const allCategoryIds = Array.from(
      new Set(
        [
          dto.categoryId,
          ...(Array.isArray(dto.categoryIds) ? dto.categoryIds : []),
        ].filter(Boolean) as string[],
      ),
    );

    if (allCategoryIds.length === 0) {
      throw new BadRequestException('At least one Category must be selected.');
    }

    const existingCats = await this.prisma.category.findMany({
      where: { id: { in: allCategoryIds } },
      select: { id: true },
    });
    const existingCatIds = new Set(existingCats.map((c) => c.id));
    for (const catId of allCategoryIds) {
      if (!existingCatIds.has(catId)) {
        throw new BadRequestException(
          `Category with ID "${catId}" does not exist.`,
        );
      }
    }
    const categoryId = allCategoryIds[0];

    return this.prisma.$transaction(async (tx) => {
      const defaultBranch = await tx.branch.findFirst();
      const branchId = dto.branchId || defaultBranch?.id;

      const product = await tx.product.create({
        data: {
          code,
          name: dto.name,
          slug,
          shortDescription: dto.shortDescription || null,
          description: dto.description || null,
          categoryId,
          brandId: dto.brandId || null,
          seriesId: dto.seriesId || null,
          unitId: dto.unitId || null,
          regularPrice: new Prisma.Decimal(dto.regularPrice || 0),
          salePrice: dto.salePrice ? new Prisma.Decimal(dto.salePrice) : null,
          costPrice: dto.costPrice ? new Prisma.Decimal(dto.costPrice) : null,
          buyingPrice: dto.buyingPrice
            ? new Prisma.Decimal(dto.buyingPrice)
            : null,
          wholesalePrice: dto.wholesalePrice
            ? new Prisma.Decimal(dto.wholesalePrice)
            : null,
          minOrderQty:
            dto.minOrderQty !== undefined ? Number(dto.minOrderQty) : 1,
          warranty: dto.warranty || null,
          productType: dto.productType || 'Spare Parts',
          condition: dto.condition || null,
          ogImageUrl: dto.ogImageUrl || null,
          isNewest: dto.isNewest !== undefined ? dto.isNewest : false,
          isFeatured: dto.isFeatured !== undefined ? dto.isFeatured : false,
          isHomepage: dto.isHomepage !== undefined ? dto.isHomepage : false,
          isBestDeal: dto.isBestDeal !== undefined ? dto.isBestDeal : false,
          status: dto.status || ProductStatus.ACTIVE,
          metaTitle: dto.metaTitle || null,
          metaDescription: dto.metaDescription || null,
          metaKeywords: dto.metaKeywords || null,
        },
      });

      if (files && files.length > 0) {
        const uploadedUrls = await resolveUploadedFiles(files, 'products');
        await tx.productImage.createMany({
          data: uploadedUrls.map((url, idx) => ({
            productId: product.id,
            url,
            sortOrder: idx,
          })),
        });
      }

      if (dto.variants && dto.variants.length > 0) {
        for (let idx = 0; idx < dto.variants.length; idx++) {
          const v = dto.variants[idx];
          const variant = await tx.productVariant.create({
            data: {
              productId: product.id,
              color: v.color || null,
              quality: v.quality || null,
              price: new Prisma.Decimal(v.price || dto.regularPrice || 0),
              stock: Number(v.stock) || 0,
              sku: v.sku?.trim() || `${slug.toUpperCase()}-V${idx + 1}`,
              buyingPrice: v.buyingPrice
                ? new Prisma.Decimal(v.buyingPrice)
                : dto.buyingPrice
                  ? new Prisma.Decimal(dto.buyingPrice)
                  : null,
              wholesalePrice: v.wholesalePrice
                ? new Prisma.Decimal(v.wholesalePrice)
                : dto.wholesalePrice
                  ? new Prisma.Decimal(dto.wholesalePrice)
                  : null,
              discountedPrice: v.discountedPrice
                ? new Prisma.Decimal(v.discountedPrice)
                : null,
              offerPrice: v.offerPrice
                ? new Prisma.Decimal(v.offerPrice)
                : null,
              attributes: v.attributes
                ? typeof v.attributes === 'object'
                  ? v.attributes
                  : JSON.parse(v.attributes)
                : null,
            },
          });

          if (branchId) {
            await tx.branchInventory.upsert({
              where: {
                branchId_productVariantId: {
                  branchId,
                  productVariantId: variant.id,
                },
              },
              create: {
                branchId,
                productVariantId: variant.id,
                quantity: Number(v.stock) || 0,
              },
              update: {
                quantity: Number(v.stock) || 0,
              },
            });
          }
        }
      } else {
        const defVariant = await tx.productVariant.create({
          data: {
            productId: product.id,
            price: new Prisma.Decimal(dto.regularPrice || 0),
            stock: 0,
            sku: `${slug.toUpperCase()}-DEFAULT`,
            buyingPrice: dto.buyingPrice
              ? new Prisma.Decimal(dto.buyingPrice)
              : null,
            wholesalePrice: dto.wholesalePrice
              ? new Prisma.Decimal(dto.wholesalePrice)
              : null,
          },
        });

        if (branchId) {
          await tx.branchInventory.upsert({
            where: {
              branchId_productVariantId: {
                branchId,
                productVariantId: defVariant.id,
              },
            },
            create: {
              branchId,
              productVariantId: defVariant.id,
              quantity: 0,
            },
            update: {
              quantity: 0,
            },
          });
        }
      }

      if (dto.specifications && dto.specifications.length > 0) {
        await tx.productSpecification.createMany({
          data: dto.specifications.map((s) => ({
            productId: product.id,
            label: s.label,
            value: s.value,
          })),
        });
      }

      return tx.product.findUnique({
        where: { id: product.id },
        include: {
          images: { orderBy: { sortOrder: 'asc' } },
          variants: {
            include: {
              branchInventories: true,
            },
          },
          specifications: true,
          category: true,
          brand: true,
        },
      });
    });
  }

  async update(
    id: string,
    dto: UpdateProductDto,
    files?: Express.Multer.File[],
  ) {
    const existing = await this.prisma.product.findUnique({
      where: { id },
      include: { images: true },
    });

    if (!existing) {
      throw new NotFoundException(`Product with ID "${id}" not found`);
    }

    if (
      dto.categoryId !== undefined ||
      (dto.categoryIds && dto.categoryIds.length > 0)
    ) {
      const updateCatIds = Array.from(
        new Set(
          [
            dto.categoryId,
            ...(Array.isArray(dto.categoryIds) ? dto.categoryIds : []),
          ].filter(Boolean) as string[],
        ),
      );
      if (updateCatIds.length > 0) {
        const existingCats = await this.prisma.category.findMany({
          where: { id: { in: updateCatIds } },
          select: { id: true },
        });
        const existingCatIds = new Set(existingCats.map((c) => c.id));
        for (const catId of updateCatIds) {
          if (!existingCatIds.has(catId)) {
            throw new BadRequestException(
              `Category with ID "${catId}" does not exist.`,
            );
          }
        }
      }
    }

    let slug = existing.slug;
    if (dto.slug && dto.slug !== existing.slug) {
      slug = await this.generateUniqueSlug(dto.slug, id);
    } else if (dto.name && dto.name !== existing.name && !dto.slug) {
      slug = await this.generateUniqueSlug(dto.name, id);
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Remove requested images
      if (dto.removedImageIds && dto.removedImageIds.length > 0) {
        const toDelete = existing.images.filter((img) =>
          dto.removedImageIds!.includes(img.id),
        );
        for (const img of toDelete) {
          try {
            const filePath = join(
              process.cwd(),
              img.url.startsWith('/') ? img.url.slice(1) : img.url,
            );
            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
            }
          } catch (e) {
            // Ignore file deletion errors
          }
        }
        await tx.productImage.deleteMany({
          where: { id: { in: dto.removedImageIds } },
        });
      }

      // 2. Add newly uploaded files
      if (files && files.length > 0) {
        const currentCount = await tx.productImage.count({
          where: { productId: id },
        });
        const uploadedUrls = await resolveUploadedFiles(files, 'products');
        await tx.productImage.createMany({
          data: uploadedUrls.map((url, idx) => ({
            productId: id,
            url,
            sortOrder: currentCount + idx,
          })),
        });
      }

      // 3. Update variants if provided
      if (dto.variants !== undefined) {
        const oldVariants = await tx.productVariant.findMany({
          where: { productId: id },
          select: { id: true },
        });
        const oldVariantIds = oldVariants.map((v) => v.id);

        if (oldVariantIds.length > 0) {
          await tx.branchInventory.deleteMany({
            where: { productVariantId: { in: oldVariantIds } },
          });
          await tx.productVariant.deleteMany({
            where: { id: { in: oldVariantIds } },
          });
        }

        const defaultBranch = await tx.branch.findFirst();
        const branchId = dto.branchId || defaultBranch?.id;

        for (let idx = 0; idx < dto.variants.length; idx++) {
          const v = dto.variants[idx];
          const createdVariant = await tx.productVariant.create({
            data: {
              productId: id,
              color: v.color || null,
              quality: v.quality || null,
              price: new Prisma.Decimal(
                v.price ?? dto.regularPrice ?? existing.regularPrice,
              ),
              stock: Number(v.stock) || 0,
              sku: v.sku?.trim() || `${slug.toUpperCase()}-V${idx + 1}`,
              buyingPrice: v.buyingPrice
                ? new Prisma.Decimal(v.buyingPrice)
                : null,
              wholesalePrice: v.wholesalePrice
                ? new Prisma.Decimal(v.wholesalePrice)
                : null,
              discountedPrice: v.discountedPrice
                ? new Prisma.Decimal(v.discountedPrice)
                : null,
              offerPrice: v.offerPrice
                ? new Prisma.Decimal(v.offerPrice)
                : null,
              attributes: v.attributes
                ? typeof v.attributes === 'object'
                  ? v.attributes
                  : JSON.parse(v.attributes)
                : null,
            },
          });

          if (branchId) {
            await tx.branchInventory.upsert({
              where: {
                branchId_productVariantId: {
                  branchId,
                  productVariantId: createdVariant.id,
                },
              },
              create: {
                branchId,
                productVariantId: createdVariant.id,
                quantity: Number(v.stock) || 0,
              },
              update: {
                quantity: Number(v.stock) || 0,
              },
            });
          }
        }
      }

      // 4. Update specifications if provided
      if (dto.specifications !== undefined) {
        await tx.productSpecification.deleteMany({ where: { productId: id } });
        if (dto.specifications.length > 0) {
          await tx.productSpecification.createMany({
            data: dto.specifications.map((s) => ({
              productId: id,
              label: s.label,
              value: s.value,
            })),
          });
        }
      }

      // 5. Update base fields
      const updateData: Prisma.ProductUpdateInput = {
        slug,
      };
      if (dto.code !== undefined && dto.code.trim()) {
        const uniqueCode = await this.generateUniqueCode(dto.code, id);
        updateData.code = uniqueCode;
      }
      if (dto.name !== undefined) updateData.name = dto.name;
      if (dto.isNewest !== undefined) updateData.isNewest = dto.isNewest;
      if (dto.isFeatured !== undefined) updateData.isFeatured = dto.isFeatured;
      if (dto.isHomepage !== undefined) updateData.isHomepage = dto.isHomepage;
      if (dto.isBestDeal !== undefined) updateData.isBestDeal = dto.isBestDeal;
      if (dto.shortDescription !== undefined)
        updateData.shortDescription = dto.shortDescription || null;
      if (dto.description !== undefined)
        updateData.description = dto.description || null;
      if (dto.categoryId !== undefined) {
        updateData.category = { connect: { id: dto.categoryId } };
      } else if (dto.categoryIds && dto.categoryIds.length > 0) {
        updateData.category = { connect: { id: dto.categoryIds[0] } };
      }
      if (dto.brandId !== undefined) {
        updateData.brand = dto.brandId
          ? { connect: { id: dto.brandId } }
          : { disconnect: true };
      }
      if (dto.seriesId !== undefined) {
        updateData.series = dto.seriesId
          ? { connect: { id: dto.seriesId } }
          : { disconnect: true };
      }
      if (dto.unitId !== undefined) {
        updateData.unit = dto.unitId
          ? { connect: { id: dto.unitId } }
          : { disconnect: true };
      }
      if (dto.regularPrice !== undefined)
        updateData.regularPrice = new Prisma.Decimal(dto.regularPrice);
      if (dto.salePrice !== undefined) {
        updateData.salePrice = dto.salePrice
          ? new Prisma.Decimal(dto.salePrice)
          : null;
      }
      if (dto.costPrice !== undefined) {
        updateData.costPrice = dto.costPrice
          ? new Prisma.Decimal(dto.costPrice)
          : null;
      }
      if (dto.buyingPrice !== undefined) {
        updateData.buyingPrice = dto.buyingPrice
          ? new Prisma.Decimal(dto.buyingPrice)
          : null;
      }
      if (dto.wholesalePrice !== undefined) {
        updateData.wholesalePrice = dto.wholesalePrice
          ? new Prisma.Decimal(dto.wholesalePrice)
          : null;
      }
      if (dto.minOrderQty !== undefined) {
        updateData.minOrderQty = Number(dto.minOrderQty);
      }
      if (dto.warranty !== undefined) {
        updateData.warranty = dto.warranty || null;
      }
      if (dto.productType !== undefined) {
        updateData.productType = dto.productType || null;
      }
      if (dto.condition !== undefined) {
        updateData.condition = dto.condition || null;
      }
      if (dto.ogImageUrl !== undefined) {
        updateData.ogImageUrl = dto.ogImageUrl || null;
      }
      if (dto.status !== undefined) updateData.status = dto.status;
      if (dto.metaTitle !== undefined)
        updateData.metaTitle = dto.metaTitle || null;
      if (dto.metaDescription !== undefined)
        updateData.metaDescription = dto.metaDescription || null;
      if (dto.metaKeywords !== undefined)
        updateData.metaKeywords = dto.metaKeywords || null;

      return tx.product.update({
        where: { id },
        data: updateData,
        include: {
          images: { orderBy: { sortOrder: 'asc' } },
          variants: {
            include: {
              branchInventories: true,
            },
          },
          specifications: true,
          category: true,
          brand: true,
        },
      });
    });
  }

  async remove(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            orderItems: true,
            purchaseOrderItems: true,
            wastedProducts: true,
          },
        },
        images: true,
        variants: {
          select: {
            id: true,
            branchInventories: {
              where: {
                quantity: { gt: 0 },
              },
              select: { branchId: true, quantity: true },
            },
          },
        },
      },
    });

    if (!product) {
      throw new NotFoundException(`Product with ID "${id}" not found`);
    }

    const variantIds = product.variants.map((v) => v.id);
    const phoneUnitsCount =
      variantIds.length > 0
        ? await this.prisma.phoneUnit.count({
            where: { productVariantId: { in: variantIds } },
          })
        : 0;

    const blockers: string[] = [];
    const blockerCounts: Record<string, number> = {};

    if (product._count.orderItems > 0) {
      blockers.push(`${product._count.orderItems} order item(s)`);
      blockerCounts.orderItems = product._count.orderItems;
    }
    if (product._count.purchaseOrderItems > 0) {
      blockers.push(`${product._count.purchaseOrderItems} purchase order item(s)`);
      blockerCounts.purchaseOrderItems = product._count.purchaseOrderItems;
    }
    if (phoneUnitsCount > 0) {
      blockers.push(`${phoneUnitsCount} IMEI unit(s)`);
      blockerCounts.phoneUnits = phoneUnitsCount;
    }

    const positiveStockBranches = product.variants.flatMap(
      (v) => v.branchInventories,
    );
    if (positiveStockBranches.length > 0) {
      const totalStock = positiveStockBranches.reduce(
        (sum, inv) => sum + inv.quantity,
        0,
      );
      blockers.push(`${totalStock} active unit(s) in branch stock`);
      blockerCounts.stock = totalStock;
    }

    if (blockers.length > 0) {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        message: `Cannot delete product "${product.name}". It has ${blockers.join(', ')}. Please set its status to INACTIVE, DRAFT, or DISCONTINUED instead.`,
        canDeactivate: true,
        blockers: blockerCounts,
      });
    }

    for (const img of product.images) {
      await storageService.safeUnlink(img.url);
    }

    if (variantIds.length > 0) {
      await this.prisma.branchInventory.deleteMany({
        where: { productVariantId: { in: variantIds } },
      });
    }

    return this.prisma.product.delete({
      where: { id },
    });
  }

  async posSearch(
    query: {
      search?: string;
      category?: string;
      branch?: string;
      branchId?: string;
      inStock?: string | boolean;
      limit?: number;
    },
    user?: JwtPayload,
  ) {
    const limit = Math.max(1, Math.min(200, Number(query.limit) || 60));

    const productWhere: Prisma.ProductWhereInput = {
      status: ProductStatus.ACTIVE,
    };

    if (query.category && query.category !== 'all') {
      productWhere.OR = [
        { categoryId: query.category },
        { category: { slug: query.category } },
        {
          category: { name: { contains: query.category, mode: 'insensitive' } },
        },
      ];
    }

    if (query.search?.trim()) {
      const tokens = query.search.trim().split(/\s+/).filter(Boolean);
      if (tokens.length > 0) {
        productWhere.AND = tokens.map((t) => ({
          OR: [
            { id: t },
            { name: { contains: t, mode: 'insensitive' } },
            { code: { contains: t, mode: 'insensitive' } },
            { slug: { contains: t, mode: 'insensitive' } },
            { brand: { name: { contains: t, mode: 'insensitive' } } },
            { series: { name: { contains: t, mode: 'insensitive' } } },
            {
              variants: {
                some: {
                  OR: [
                    { id: t },
                    { sku: { contains: t, mode: 'insensitive' } },
                    { color: { contains: t, mode: 'insensitive' } },
                    { quality: { contains: t, mode: 'insensitive' } },
                  ],
                },
              },
            },
            {
              specifications: {
                some: { value: { contains: t, mode: 'insensitive' } },
              },
            },
          ],
        }));
      }
    }

    const products = await this.prisma.product.findMany({
      where: productWhere,
      take: limit,
      include: {
        images: { orderBy: { sortOrder: 'asc' } },
        category: { select: { id: true, name: true, slug: true } },
        brand: { select: { id: true, name: true } },
        variants: {
          include: {
            branchInventories: true,
            phoneUnits: {
              where: { status: 'IN_STOCK' },
              select: {
                id: true,
                imei1: true,
                imei2: true,
                serialNumber: true,
                branchId: true,
                status: true,
                sellingPrice: true,
                buyingPrice: true,
                warrantyType: true,
                warrantyPeriod: true,
                createdAt: true,
              },
            },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    let targetBranch =
      (query.branchId || query.branch) &&
      (query.branchId || query.branch) !== 'all'
        ? query.branchId || query.branch
        : null;

    if (user) {
      const scope = await this.branchScopeService.resolveScope(user);
      if (!scope.isGlobal) {
        if (targetBranch) {
          await this.branchScopeService.validateBranchAccess(
            user,
            targetBranch,
          );
        } else {
          targetBranch = scope.allowedBranchIds[0] || null;
        }
      }
    }

    const flatVariants: any[] = [];

    for (const product of products) {
      const isPhone = product.productType?.toLowerCase() === 'phone';

      if (product.variants && product.variants.length > 0) {
        for (const variant of product.variants) {
          let variantStock = Number(variant.stock || 0);
          let availableUnits: any[] = [];

          if (isPhone) {
            availableUnits = targetBranch
              ? variant.phoneUnits?.filter(
                  (u: any) => u.branchId === targetBranch,
                ) || []
              : variant.phoneUnits || [];
            variantStock = availableUnits.length;
          } else {
            if (targetBranch) {
              const bInv = variant.branchInventories?.find(
                (b) => b.branchId === targetBranch,
              );
              variantStock = bInv ? Number(bInv.quantity) : 0;
            } else if (
              variant.branchInventories &&
              variant.branchInventories.length > 0
            ) {
              variantStock = variant.branchInventories.reduce(
                (sum, b) => sum + Number(b.quantity),
                0,
              );
            }
          }

          if (
            (query.inStock === true || query.inStock === 'true') &&
            variantStock <= 0
          ) {
            continue;
          }

          flatVariants.push({
            id: variant.id,
            productId: product.id,
            productName: product.name,
            productSlug: product.slug,
            productImage:
              product.images?.[0]?.url ||
              'https://images.unsplash.com/photo-1592899677977-9c10ca588bbd?w=200&h=200&fit=crop',
            color: variant.color || null,
            quality: variant.quality || null,
            attributes: variant.attributes || null,
            sku: variant.sku,
            stock: variantStock,
            isPhone,
            condition: product.condition || null,
            productType: product.productType,
            phoneUnits: availableUnits,
            price: Number(
              variant.price || product.salePrice || product.regularPrice,
            ),
            regularPrice: Number(product.regularPrice),
            salePrice: product.salePrice ? Number(product.salePrice) : null,
            buyingPrice: variant.buyingPrice
              ? Number(variant.buyingPrice)
              : product.buyingPrice
                ? Number(product.buyingPrice)
                : null,
            wholesalePrice: variant.wholesalePrice
              ? Number(variant.wholesalePrice)
              : product.wholesalePrice
                ? Number(product.wholesalePrice)
                : null,
            offerPrice: variant.offerPrice ? Number(variant.offerPrice) : null,
            categoryName: product.category?.name || 'General',
            categoryId: product.categoryId,
            categorySlug: product.category?.slug || '',
            brandName: product.brand?.name || null,
            allVariants: product.variants.map((v) => {
              let vStock = Number(v.stock || 0);
              let vUnits: any[] = [];
              if (isPhone) {
                vUnits = targetBranch
                  ? v.phoneUnits?.filter(
                      (u: any) => u.branchId === targetBranch,
                    ) || []
                  : v.phoneUnits || [];
                vStock = vUnits.length;
              } else {
                if (targetBranch) {
                  const bInv = v.branchInventories?.find(
                    (b) => b.branchId === targetBranch,
                  );
                  vStock = bInv ? Number(bInv.quantity) : 0;
                } else if (
                  v.branchInventories &&
                  v.branchInventories.length > 0
                ) {
                  vStock = v.branchInventories.reduce(
                    (sum, b) => sum + Number(b.quantity),
                    0,
                  );
                }
              }
              return {
                id: v.id,
                color: v.color,
                quality: v.quality,
                attributes: v.attributes || null,
                sku: v.sku,
                stock: vStock,
                isPhone,
                phoneUnits: vUnits,
                price: Number(
                  v.price || product.salePrice || product.regularPrice,
                ),
                buyingPrice: v.buyingPrice ? Number(v.buyingPrice) : null,
                wholesalePrice: v.wholesalePrice
                  ? Number(v.wholesalePrice)
                  : null,
                offerPrice: v.offerPrice ? Number(v.offerPrice) : null,
              };
            }),
          });
        }
      } else {
        flatVariants.push({
          id: `pv-${product.id}`,
          productId: product.id,
          productName: product.name,
          productSlug: product.slug,
          productImage:
            product.images?.[0]?.url ||
            'https://images.unsplash.com/photo-1592899677977-9c10ca588bbd?w=200&h=200&fit=crop',
          color: null,
          quality: null,
          sku: product.slug.toUpperCase(),
          stock: 0,
          price: Number(product.salePrice || product.regularPrice),
          regularPrice: Number(product.regularPrice),
          salePrice: product.salePrice ? Number(product.salePrice) : null,
          categoryName: product.category?.name || 'General',
          categoryId: product.categoryId,
          categorySlug: product.category?.slug || '',
          brandName: product.brand?.name || null,
          allVariants: [],
        });
      }
    }

    if (query.search?.trim()) {
      const tokens = query.search.toLowerCase().trim().split(/\s+/).filter(Boolean);
      flatVariants.sort((a, b) => {
        let scoreA = 0;
        let scoreB = 0;
        const nameA = (a.productName || '').toLowerCase();
        const nameB = (b.productName || '').toLowerCase();
        const skuA = (a.sku || '').toLowerCase();
        const skuB = (b.sku || '').toLowerCase();
        const brandA = (a.brandName || '').toLowerCase();
        const brandB = (b.brandName || '').toLowerCase();

        for (const tok of tokens) {
          if (skuA === tok) scoreA += 100;
          if (skuB === tok) scoreB += 100;
          if (nameA.startsWith(tok)) scoreA += 50;
          if (nameB.startsWith(tok)) scoreB += 50;
          if (nameA.includes(tok)) scoreA += 25;
          if (nameB.includes(tok)) scoreB += 25;
          if (brandA.includes(tok)) scoreA += 15;
          if (brandB.includes(tok)) scoreB += 15;
          if (skuA.includes(tok)) scoreA += 10;
          if (skuB.includes(tok)) scoreB += 10;
        }

        if (scoreB !== scoreA) {
          return scoreB - scoreA;
        }
        return nameA.localeCompare(nameB);
      });
    }

    return flatVariants.slice(0, limit);
  }

  async getCategoriesTree() {
    const categories = await this.prisma.category.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { name: 'asc' },
    });

    const categoryMap = new Map<string, any>();
    categories.forEach((cat) => {
      categoryMap.set(cat.id, { ...cat, children: [] });
    });

    const tree: any[] = [];
    categories.forEach((cat) => {
      const node = categoryMap.get(cat.id);
      if (cat.parentId && categoryMap.has(cat.parentId)) {
        categoryMap.get(cat.parentId).children.push(node);
      } else {
        tree.push(node);
      }
    });

    return tree;
  }

  async getBrands() {
    return this.prisma.brand.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { name: 'asc' },
    });
  }

  async getSeries(brandId?: string) {
    return this.prisma.series.findMany({
      where: {
        status: 'ACTIVE',
        ...(brandId ? { brandId } : {}),
      },
      orderBy: { name: 'asc' },
    });
  }

  async getUnits() {
    return this.prisma.unit.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { name: 'asc' },
    });
  }

  async getAttributes() {
    return this.prisma.attribute.findMany({
      where: { status: 'ACTIVE' },
      include: {
        values: {
          orderBy: { value: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    });
  }
}
