import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { StaffStatus } from '@prisma/client';

export class CreateBannerDto {
  @IsString()
  @IsOptional()
  imageUrl?: string;

  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  linkUrl?: string = '';

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  sortOrder?: number = 0;

  @IsString()
  @IsOptional()
  startDate?: string;

  @IsString()
  @IsOptional()
  endDate?: string;

  @IsEnum(StaffStatus)
  @IsOptional()
  status?: StaffStatus = StaffStatus.ACTIVE;
}

export class UpdateBannerDto {
  @IsString()
  @IsOptional()
  imageUrl?: string;

  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  linkUrl?: string;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  sortOrder?: number;

  @IsString()
  @IsOptional()
  startDate?: string;

  @IsString()
  @IsOptional()
  endDate?: string;

  @IsEnum(StaffStatus)
  @IsOptional()
  status?: StaffStatus;
}

export class ReorderBannersDto {
  @IsArray()
  @IsString({ each: true })
  bannerIds: string[];
}
