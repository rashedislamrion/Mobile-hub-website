import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { StockAdjustmentService } from './stock-adjustment.service';
import {
  CreateStockAdjustmentDto,
  CreateBatchStockAdjustmentDto,
} from './dto/create-stock-adjustment.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import {
  ModuleName,
  PermissionAction,
  StockAdjustmentType,
} from '@prisma/client';

@Controller('stock-adjustments')
export class StockAdjustmentController {
  constructor(
    private readonly stockAdjustmentService: StockAdjustmentService,
  ) {}

  @RequirePermission({
    module: ModuleName.STOCK_ADJUSTMENTS,
    action: PermissionAction.READ,
    branchParam: 'branchId',
  })
  @Get()
  findAll(
    @Query('branch') branch?: string,
    @Query('branchId') branchId?: string,
    @Query('type') type?: StockAdjustmentType,
    @Query('search') search?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @CurrentUser() user?: JwtPayload,
  ) {
    return this.stockAdjustmentService.findAll(
      {
        branch,
        branchId,
        type,
        search,
        dateFrom,
        dateTo,
        page,
        limit,
      },
      user,
    );
  }

  @RequirePermission({
    module: ModuleName.STOCK_ADJUSTMENTS,
    action: PermissionAction.CREATE,
    branchParam: 'branchId',
  })
  @Post('batch')
  createBatch(
    @Body() dto: CreateBatchStockAdjustmentDto,
    @CurrentUser() user?: JwtPayload,
  ) {
    return this.stockAdjustmentService.createBatch(dto, user);
  }

  @RequirePermission({
    module: ModuleName.STOCK_ADJUSTMENTS,
    action: PermissionAction.READ,
  })
  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user?: JwtPayload) {
    return this.stockAdjustmentService.findOne(id, user);
  }

  @RequirePermission({
    module: ModuleName.STOCK_ADJUSTMENTS,
    action: PermissionAction.CREATE,
    branchParam: 'branchId',
  })
  @Post()
  create(
    @Body() dto: CreateStockAdjustmentDto,
    @CurrentUser() user?: JwtPayload,
  ) {
    return this.stockAdjustmentService.create(dto, user);
  }
}
