import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PayrollService } from './payroll.service';
import { RunPayrollDto, MarkPaidDto } from './dto/payroll.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { ModuleName, PayrollStatus, PermissionAction } from '@prisma/client';

@Controller('payroll')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PayrollController {
  constructor(private readonly payrollService: PayrollService) {}

  @Get()
  @RequirePermission({ module: ModuleName.HRM, action: PermissionAction.READ })
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query('branch') branch?: string,
    @Query('branchId') branchId?: string,
    @Query('department') department?: string,
    @Query('month') month?: string,
    @Query('status') status?: PayrollStatus,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.payrollService.findAll(
      {
        branch: branchId || branch,
        department,
        month,
        status,
        search,
        page: page ? parseInt(page, 10) : undefined,
        limit: limit ? parseInt(limit, 10) : undefined,
      },
      user,
    );
  }

  @Post('run')
  @RequirePermission({
    module: ModuleName.HRM,
    action: PermissionAction.CREATE,
  })
  runPayroll(
    @Body() runPayrollDto: RunPayrollDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.payrollService.runPayroll(runPayrollDto, user);
  }

  @Get(':id/payslip')
  @RequirePermission({ module: ModuleName.HRM, action: PermissionAction.READ })
  getPayslip(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.payrollService.getPayslip(id, user);
  }

  @Get(':id')
  @RequirePermission({ module: ModuleName.HRM, action: PermissionAction.READ })
  findOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.payrollService.findOne(id, user);
  }

  @Patch(':id/mark-paid')
  @RequirePermission({
    module: ModuleName.HRM,
    action: PermissionAction.UPDATE,
  })
  markPaid(
    @Param('id') id: string,
    @Body() markPaidDto: MarkPaidDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.payrollService.markPaid(id, markPaidDto, user);
  }
}
