import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type, Transform, plainToInstance } from 'class-transformer';
import { ProductStatus } from '@prisma/client';

export function transformStringArray({ value }: { value: any }): string[] {
  if (value === undefined || value === null || value === '') {
    return [];
  }
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === 'string' ? item.trim() : String(item)))
      .filter(Boolean);
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return [];
    }
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed
            .map((item) =>
              typeof item === 'string' ? item.trim() : String(item),
            )
            .filter(Boolean);
        }
      } catch {
        // Fall back to comma-separated split
      }
    }
    if (trimmed.includes(',')) {
      return trimmed
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
    }
    return [trimmed];
  }
  return [String(value)];
}

export class ProductFlagsDto {
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  @IsOptional()
  isNewest?: boolean;

  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  @IsOptional()
  isFeatured?: boolean;

  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  @IsOptional()
  isHomepage?: boolean;

  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  @IsOptional()
  isBestDeal?: boolean;
}

export class ProductVariantDto {
  @IsString()
  @IsOptional()
  id?: string;

  @IsString()
  @IsOptional()
  color?: string;

  @IsString()
  @IsOptional()
  quality?: string;

  @Transform(({ value }) =>
    value !== undefined && value !== null ? Number(value) : 0,
  )
  @IsNumber()
  @Min(0)
  price: number;

  @Transform(({ value }) =>
    value !== undefined && value !== null ? Number(value) : undefined,
  )
  @IsNumber()
  @Min(0)
  @IsOptional()
  buyingPrice?: number;

  @Transform(({ value }) =>
    value !== undefined && value !== null ? Number(value) : undefined,
  )
  @IsNumber()
  @Min(0)
  @IsOptional()
  wholesalePrice?: number;

  @Transform(({ value }) =>
    value !== undefined && value !== null ? Number(value) : undefined,
  )
  @IsNumber()
  @Min(0)
  @IsOptional()
  discountedPrice?: number;

  @Transform(({ value }) =>
    value !== undefined && value !== null ? Number(value) : undefined,
  )
  @IsNumber()
  @Min(0)
  @IsOptional()
  offerPrice?: number;

  @Transform(({ value }) =>
    value !== undefined && value !== null ? Number(value) : 0,
  )
  @IsNumber()
  @Min(0)
  stock: number;

  @IsString()
  @IsOptional()
  sku?: string;

  @Transform(({ value }) => {
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    }
    return value;
  })
  @IsOptional()
  attributes?: Record<string, any>;
}

export class ProductSpecificationDto {
  @IsString()
  @IsOptional()
  id?: string;

  @IsString()
  @IsNotEmpty()
  label: string;

  @IsString()
  @IsNotEmpty()
  value: string;
}

export class CreateProductDto {
  @IsString()
  @IsOptional()
  code?: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  slug?: string;

  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  @IsOptional()
  isNewest?: boolean;

  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  @IsOptional()
  isFeatured?: boolean;

  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  @IsOptional()
  isHomepage?: boolean;

  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  @IsOptional()
  isBestDeal?: boolean;

  @IsString()
  @IsOptional()
  shortDescription?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  categoryId?: string;

  @IsString()
  @IsOptional()
  brandId?: string;

  @IsString()
  @IsOptional()
  seriesId?: string;

  @IsString()
  @IsOptional()
  unitId?: string;

  @Transform(({ value }) => Number(value))
  @IsNumber()
  @Min(0)
  regularPrice: number;

  @Transform(({ value }) =>
    value !== undefined && value !== '' && value !== null
      ? Number(value)
      : undefined,
  )
  @IsNumber()
  @Min(0)
  @IsOptional()
  salePrice?: number;

  @Transform(({ value }) =>
    value !== undefined && value !== '' && value !== null
      ? Number(value)
      : undefined,
  )
  @IsNumber()
  @Min(0)
  @IsOptional()
  costPrice?: number;

  @Transform(({ value }) =>
    value !== undefined && value !== '' && value !== null
      ? Number(value)
      : undefined,
  )
  @IsNumber()
  @Min(0)
  @IsOptional()
  buyingPrice?: number;

  @Transform(({ value }) =>
    value !== undefined && value !== '' && value !== null
      ? Number(value)
      : undefined,
  )
  @IsNumber()
  @Min(0)
  @IsOptional()
  wholesalePrice?: number;

  @Transform(({ value }) =>
    value !== undefined && value !== '' && value !== null ? Number(value) : 1,
  )
  @IsNumber()
  @Min(1)
  @IsOptional()
  minOrderQty?: number = 1;

  @IsString()
  @IsOptional()
  warranty?: string;

  @IsString()
  @IsOptional()
  productType?: string = 'Spare Parts';

  @IsString()
  @IsOptional()
  condition?: string;

  @IsString()
  @IsOptional()
  ogImageUrl?: string;

  @Transform(transformStringArray)
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  categoryIds?: string[];

  @Transform(transformStringArray)
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @IsString()
  @IsOptional()
  branchId?: string;

  @IsEnum(ProductStatus)
  @IsOptional()
  status?: ProductStatus;

  @IsString()
  @IsOptional()
  metaTitle?: string;

  @IsString()
  @IsOptional()
  metaDescription?: string;

  @IsString()
  @IsOptional()
  metaKeywords?: string;

  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') {
      return [];
    }
    let parsed = value;
    if (typeof value === 'string') {
      try {
        parsed = JSON.parse(value);
      } catch {
        parsed = [];
      }
    }
    if (Array.isArray(parsed)) {
      return parsed.map((item) => plainToInstance(ProductVariantDto, item));
    }
    return parsed;
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductVariantDto)
  @IsOptional()
  variants?: ProductVariantDto[];

  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') {
      return [];
    }
    let parsed = value;
    if (typeof value === 'string') {
      try {
        parsed = JSON.parse(value);
      } catch {
        parsed = [];
      }
    }
    if (Array.isArray(parsed)) {
      return parsed.map((item) =>
        plainToInstance(ProductSpecificationDto, item),
      );
    }
    return parsed;
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductSpecificationDto)
  @IsOptional()
  specifications?: ProductSpecificationDto[];
}
