import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { ProductService } from '../product/product.service';
import { OrderService } from '../order/order.service';
import { ServiceJobService } from '../service-job/service-job.service';
import { CreateOrderDto } from '../order/dto/create-order.dto';
import { CreateServiceJobDto } from '../service-job/dto/create-service-job.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { ModuleName, PermissionAction, SaleType } from '@prisma/client';

@Controller('pos')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PosController {
  constructor(
    private readonly productService: ProductService,
    private readonly orderService: OrderService,
    private readonly serviceJobService: ServiceJobService,
  ) {}

  @RequirePermission({
    module: ModuleName.SALES,
    action: PermissionAction.READ,
  })
  @Get('products')
  getPosProducts(
    @CurrentUser() user: JwtPayload,
    @Query('search') search?: string,
    @Query('category') category?: string,
    @Query('branchId') branchId?: string,
    @Query('branch') branch?: string,
    @Query('inStock') inStock?: string,
    @Query('limit') limit?: number,
  ) {
    return this.productService.posSearch(
      {
        search,
        category,
        branch: branchId || branch,
        branchId: branchId || branch,
        inStock,
        limit,
      },
      user,
    );
  }

  @RequirePermission({
    module: ModuleName.SALES,
    action: PermissionAction.CREATE,
  })
  @Post('sales')
  createPosSale(@Body() dto: CreateOrderDto, @CurrentUser() user: JwtPayload) {
    return this.orderService.create(
      {
        ...dto,
        saleType: dto.saleType || SaleType.POS,
      },
      user,
    );
  }

  @RequirePermission({
    module: ModuleName.SALES,
    action: PermissionAction.READ,
  })
  @Get('services')
  getPosServices(
    @CurrentUser() user: JwtPayload,
    @Query('status') status?: any,
    @Query('branch') branch?: string,
    @Query('search') search?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.serviceJobService.findAll(
      {
        status,
        branch,
        search,
        page,
        limit,
      },
      user,
    );
  }

  @RequirePermission({
    module: ModuleName.SALES,
    action: PermissionAction.CREATE,
  })
  @Post('service-jobs')
  createServiceJob(
    @Body() dto: CreateServiceJobDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.serviceJobService.create(dto, user);
  }
}
