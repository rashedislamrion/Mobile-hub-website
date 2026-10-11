import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { SalesReturnService } from './sales-return.service';
import {
  CreateSalesReturnDto,
  RejectSalesReturnDto,
} from './dto/create-sales-return.dto';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { ModuleName, PermissionAction, ReturnStatus } from '@prisma/client';

@Controller('sales-returns')
export class SalesReturnController {
  constructor(private readonly salesReturnService: SalesReturnService) {}

  @RequirePermission({
    module: ModuleName.SALES,
    action: PermissionAction.READ,
  })
  @Get()
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query('status') status?: ReturnStatus,
    @Query('branch') branch?: string,
    @Query('search') search?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.salesReturnService.findAll(
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
    action: PermissionAction.READ,
  })
  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.salesReturnService.findOne(id, user);
  }

  @RequirePermission({
    module: ModuleName.SALES,
    action: PermissionAction.CREATE,
  })
  @Post()
  create(
    @Body() dto: CreateSalesReturnDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.salesReturnService.create(dto, user);
  }

  @RequirePermission({
    module: ModuleName.SALES,
    action: PermissionAction.UPDATE,
  })
  @Patch(':id/approve')
  approve(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.salesReturnService.approve(id, user);
  }

  @RequirePermission({
    module: ModuleName.SALES,
    action: PermissionAction.UPDATE,
  })
  @Patch(':id/reject')
  reject(
    @Param('id') id: string,
    @Body() dto: RejectSalesReturnDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.salesReturnService.reject(id, dto, user);
  }

  @RequirePermission({
    module: ModuleName.SALES,
    action: PermissionAction.UPDATE,
  })
  @Patch(':id/refund')
  refund(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.salesReturnService.refund(id, user);
  }
}
