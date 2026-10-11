import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { EmployeeService } from './employee.service';
import {
  CreateEmployeeDto,
  UpdateEmployeeDto,
  UpdateStatusDto,
  MakeTechnicianDto,
} from './dto/create-employee.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { ModuleName, PermissionAction, StaffStatus } from '@prisma/client';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import {
  createMulterConfig,
  resolveUploadedFile,
} from '../common/upload/multer.config';

@Controller('employees')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class EmployeeController {
  constructor(private readonly employeeService: EmployeeService) {}

  @Get('technicians')
  @RequirePermission({ module: ModuleName.HRM, action: PermissionAction.READ })
  findTechnicians() {
    return this.employeeService.findTechnicians();
  }

  @Get('eligible-for-technician')
  @RequirePermission({ module: ModuleName.HRM, action: PermissionAction.READ })
  findEligibleForTechnician() {
    return this.employeeService.findEligibleForTechnician();
  }

  @Get()
  @RequirePermission({ module: ModuleName.HRM, action: PermissionAction.READ })
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query('department') department?: string,
    @Query('role') role?: string,
    @Query('branch') branch?: string,
    @Query('status') status?: StaffStatus,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.employeeService.findAll(
      {
        department,
        role,
        branch,
        status,
        search,
        page: page ? parseInt(page, 10) : undefined,
        limit: limit ? parseInt(limit, 10) : undefined,
      },
      user,
    );
  }

  @Get(':id/document/:field')
  async getEmployeeDocument(
    @Param('id') id: string,
    @Param('field') field: string,
    @CurrentUser() user: JwtPayload,
    @Res() res: any,
  ) {
    return this.employeeService.streamEmployeeDocument(id, field, user, res);
  }

  @Get(':id')
  @RequirePermission({ module: ModuleName.HRM, action: PermissionAction.READ })
  findOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.employeeService.findOne(id, user);
  }

  @Post()
  @RequirePermission({
    module: ModuleName.HRM,
    action: PermissionAction.CREATE,
  })
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'profilePhoto', maxCount: 1 },
        { name: 'birthCertificate', maxCount: 1 },
      ],
      createMulterConfig('staff-documents'),
    ),
  )
  async create(
    @Body() createEmployeeDto: CreateEmployeeDto,
    @CurrentUser() user: JwtPayload,
    @UploadedFiles()
    files?: {
      profilePhoto?: Express.Multer.File[];
      birthCertificate?: Express.Multer.File[];
    },
  ) {
    if (files?.profilePhoto?.[0]) {
      createEmployeeDto.photo =
        (await resolveUploadedFile(files.profilePhoto[0], 'staff-documents')) ||
        `/uploads/staff-documents/${files.profilePhoto[0].filename}`;
    }
    if (files?.birthCertificate?.[0]) {
      createEmployeeDto.birthCertificateUrl =
        (await resolveUploadedFile(
          files.birthCertificate[0],
          'staff-documents',
        )) || `/uploads/staff-documents/${files.birthCertificate[0].filename}`;
    }
    return this.employeeService.create(createEmployeeDto, user);
  }

  @Patch(':id')
  @RequirePermission({
    module: ModuleName.HRM,
    action: PermissionAction.UPDATE,
  })
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'profilePhoto', maxCount: 1 },
        { name: 'birthCertificate', maxCount: 1 },
      ],
      createMulterConfig('staff-documents'),
    ),
  )
  async update(
    @Param('id') id: string,
    @Body() updateEmployeeDto: UpdateEmployeeDto,
    @UploadedFiles()
    files?: {
      profilePhoto?: Express.Multer.File[];
      birthCertificate?: Express.Multer.File[];
    },
  ) {
    if (files?.profilePhoto?.[0]) {
      updateEmployeeDto.photo =
        (await resolveUploadedFile(files.profilePhoto[0], 'staff-documents')) ||
        `/uploads/staff-documents/${files.profilePhoto[0].filename}`;
    }
    if (files?.birthCertificate?.[0]) {
      updateEmployeeDto.birthCertificateUrl =
        (await resolveUploadedFile(
          files.birthCertificate[0],
          'staff-documents',
        )) || `/uploads/staff-documents/${files.birthCertificate[0].filename}`;
    }
    return this.employeeService.update(id, updateEmployeeDto);
  }

  @Post(':id/make-technician')
  @RequirePermission({
    module: ModuleName.HRM,
    action: PermissionAction.UPDATE,
  })
  makeTechnician(@Param('id') id: string, @Body() dto: MakeTechnicianDto) {
    return this.employeeService.makeTechnician(id, dto);
  }

  @Patch(':id/technician')
  @RequirePermission({
    module: ModuleName.HRM,
    action: PermissionAction.UPDATE,
  })
  updateTechnician(@Param('id') id: string, @Body() dto: MakeTechnicianDto) {
    return this.employeeService.updateTechnician(id, dto);
  }

  @Delete(':id/technician')
  @RequirePermission({
    module: ModuleName.HRM,
    action: PermissionAction.UPDATE,
  })
  removeTechnician(@Param('id') id: string) {
    return this.employeeService.removeTechnician(id);
  }

  @Patch(':id/reset-password')
  @RequirePermission({
    module: ModuleName.HRM,
    action: PermissionAction.UPDATE,
  })
  resetPassword(@Param('id') id: string) {
    return this.employeeService.resetPassword(id);
  }

  @Patch(':id/status')
  @RequirePermission({
    module: ModuleName.HRM,
    action: PermissionAction.UPDATE,
  })
  updateStatus(
    @Param('id') id: string,
    @Body() updateStatusDto: UpdateStatusDto,
  ) {
    return this.employeeService.updateStatus(id, updateStatusDto);
  }

  @Delete(':id')
  @RequirePermission({
    module: ModuleName.HRM,
    action: PermissionAction.DELETE,
  })
  remove(@Param('id') id: string) {
    return this.employeeService.remove(id);
  }
}
