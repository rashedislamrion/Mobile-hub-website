import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { ExchangeService } from './exchange.service';
import {
  CreateExchangeDto,
  RejectExchangeDto,
} from './dto/create-exchange.dto';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { ExchangeStatus, ModuleName, PermissionAction } from '@prisma/client';

@Controller('exchanges')
export class ExchangeController {
  constructor(private readonly exchangeService: ExchangeService) {}

  @RequirePermission({
    module: ModuleName.SALES,
    action: PermissionAction.READ,
  })
  @Get()
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query('status') status?: ExchangeStatus,
    @Query('branch') branch?: string,
    @Query('search') search?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.exchangeService.findAll(
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
    return this.exchangeService.findOne(id, user);
  }

  @RequirePermission({
    module: ModuleName.SALES,
    action: PermissionAction.CREATE,
  })
  @Post()
  create(@Body() dto: CreateExchangeDto, @CurrentUser() user: JwtPayload) {
    return this.exchangeService.create(dto, user);
  }

  @RequirePermission({
    module: ModuleName.SALES,
    action: PermissionAction.UPDATE,
  })
  @Patch(':id/approve')
  approve(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.exchangeService.approve(id, user);
  }

  @RequirePermission({
    module: ModuleName.SALES,
    action: PermissionAction.UPDATE,
  })
  @Patch(':id/item-received')
  itemReceived(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.exchangeService.itemReceived(id, user);
  }

  @RequirePermission({
    module: ModuleName.SALES,
    action: PermissionAction.UPDATE,
  })
  @Patch(':id/complete')
  complete(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.exchangeService.complete(id, user);
  }

  @RequirePermission({
    module: ModuleName.SALES,
    action: PermissionAction.UPDATE,
  })
  @Patch(':id/reject')
  reject(
    @Param('id') id: string,
    @Body() dto: RejectExchangeDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.exchangeService.reject(id, dto, user);
  }
}
