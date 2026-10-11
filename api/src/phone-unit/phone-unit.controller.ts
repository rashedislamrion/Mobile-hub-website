import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PhoneUnitService } from './phone-unit.service';
import { CreatePhoneUnitDto } from './dto/phone-unit.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { ModuleName, PermissionAction, PhoneUnitStatus } from '@prisma/client';

@Controller('phone-units')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PhoneUnitController {
  constructor(private readonly phoneUnitService: PhoneUnitService) {}

  @RequirePermission({
    module: ModuleName.PRODUCTS,
    action: PermissionAction.READ,
  })
  @Get('check-imei')
  checkImei(@Query('imei') imei: string) {
    return this.phoneUnitService.checkImei(imei);
  }

  @RequirePermission({
    module: ModuleName.PRODUCTS,
    action: PermissionAction.READ,
  })
  @Get('available')
  getAvailable(
    @Query('variantId') variantId: string,
    @CurrentUser() user: JwtPayload,
    @Query('branchId') branchId?: string,
  ) {
    return this.phoneUnitService.getAvailableUnits(variantId, branchId, user);
  }

  @RequirePermission({
    module: ModuleName.PRODUCTS,
    action: PermissionAction.READ,
  })
  @Get()
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query('branchId') branchId?: string,
    @Query('status') status?: PhoneUnitStatus,
    @Query('variantId') variantId?: string,
    @Query('search') search?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.phoneUnitService.findAll(
      {
        branchId,
        status,
        variantId,
        search,
        page,
        limit,
      },
      user,
    );
  }

  @RequirePermission({
    module: ModuleName.PRODUCTS,
    action: PermissionAction.READ,
  })
  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.phoneUnitService.findOne(id, user);
  }

  @RequirePermission({
    module: ModuleName.PRODUCTS,
    action: PermissionAction.CREATE,
  })
  @Post()
  create(
    @Body() dto: CreatePhoneUnitDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.phoneUnitService.create(dto, user);
  }
}
