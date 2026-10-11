import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type, Transform, plainToInstance } from 'class-transformer';
import { ProductStatus } from '@prisma/client';
import {
  ProductVariantDto,
  ProductSpecificationDto,
  transformStringArray,
} from './create-product.dto';

export class UpdateProductDto {
  @IsString()
  @IsOptional()
  code?: string;

  @IsString()
  @IsOptional()
  name?: string;

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

  @Transform(({ value }) =>
    value !== undefined && value !== '' ? Number(value) : undefined,
  )
  @IsNumber()
  @Min(0)
  @IsOptional()
  regularPrice?: number;

  @Transform(({ value }) =>
    value !== undefined ? (value === '' ? null : Number(value)) : undefined,
  )
  @IsNumber()
  @Min(0)
  @IsOptional()
  salePrice?: number | null;

  @Transform(({ value }) =>
    value !== undefined ? (value === '' ? null : Number(value)) : undefined,
  )
  @IsNumber()
  @Min(0)
  @IsOptional()
  costPrice?: number | null;

  @Transform(({ value }) =>
    value !== undefined ? (value === '' ? null : Number(value)) : undefined,
  )
  @IsNumber()
  @Min(0)
  @IsOptional()
  buyingPrice?: number | null;

  @Transform(({ value }) =>
    value !== undefined ? (value === '' ? null : Number(value)) : undefined,
  )
  @IsNumber()
  @Min(0)
  @IsOptional()
  wholesalePrice?: number | null;

  @Transform(({ value }) =>
    value !== undefined && value !== '' ? Number(value) : undefined,
  )
  @IsNumber()
  @Min(1)
  @IsOptional()
  minOrderQty?: number;

  @IsString()
  @IsOptional()
  warranty?: string;

  @IsString()
  @IsOptional()
  productType?: string;

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

  @Transform(transformStringArray)
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  removedImageIds?: string[];

  @Transform(transformStringArray)
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  imagesToKeep?: string[];
}
