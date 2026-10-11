import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';
import { PayrollStatus } from '@prisma/client';

export class RunPayrollDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}$/, {
    message: 'Month must be in YYYY-MM format (e.g. 2026-08)',
  })
  month: string;

  @IsString()
  @IsOptional()
  departmentId?: string;

  @IsString()
  @IsOptional()
  branchId?: string;
}

export class MarkPaidDto {
  @IsString()
  @IsOptional()
  walletTypeId?: string;

  @IsString()
  @IsOptional()
  note?: string;
}
