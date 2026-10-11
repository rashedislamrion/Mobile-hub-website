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
  UploadedFile,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { ExpenseService } from './expense.service';
import {
  CreateExpenseCategoryDto,
  UpdateExpenseCategoryDto,
  CreateExpenseDto,
  MarkExpensePaidDto,
} from './dto/expense.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import {
  createMulterConfig,
  resolveUploadedFile,
} from '../common/upload/multer.config';
import { ExpenseStatus, ModuleName, PermissionAction } from '@prisma/client';

@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ExpenseController {
  constructor(private readonly expenseService: ExpenseService) {}

  // ============================= CATEGORIES =============================

  @Get('expense-categories')
  @RequirePermission({ module: ModuleName.EXPENSE, action: PermissionAction.READ })
  findAllCategories() {
    return this.expenseService.findAllCategories();
  }

  @Get('expense-categories/:id')
  @RequirePermission({ module: ModuleName.EXPENSE, action: PermissionAction.READ })
  findOneCategory(@Param('id') id: string) {
    return this.expenseService.findOneCategory(id);
  }

  @Post('expense-categories')
  @RequirePermission({ module: ModuleName.EXPENSE, action: PermissionAction.CREATE })
  createCategory(@Body() dto: CreateExpenseCategoryDto) {
    return this.expenseService.createCategory(dto);
  }

  @Patch('expense-categories/:id')
  @RequirePermission({ module: ModuleName.EXPENSE, action: PermissionAction.UPDATE })
  updateCategory(
    @Param('id') id: string,
    @Body() dto: UpdateExpenseCategoryDto,
  ) {
    return this.expenseService.updateCategory(id, dto);
  }

  @Delete('expense-categories/:id')
  @RequirePermission({ module: ModuleName.EXPENSE, action: PermissionAction.DELETE })
  removeCategory(@Param('id') id: string) {
    return this.expenseService.removeCategory(id);
  }

  // ============================= EXPENSES =============================

  @Get('expenses')
  @RequirePermission({ module: ModuleName.EXPENSE, action: PermissionAction.READ })
  findAllExpenses(
    @CurrentUser() user: JwtPayload,
    @Query('branch') branch?: string,
    @Query('category') category?: string,
    @Query('status') status?: ExpenseStatus,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.expenseService.findAllExpenses(
      {
        branch,
        category,
        status,
        dateFrom,
        dateTo,
        search,
        page: page ? parseInt(page, 10) : undefined,
        limit: limit ? parseInt(limit, 10) : undefined,
      },
      user,
    );
  }

  @Get('expenses/:id/attachment')
  @RequirePermission({ module: ModuleName.EXPENSE, action: PermissionAction.READ })
  streamAttachment(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Res() res: any,
  ) {
    return this.expenseService.streamAttachment(id, user, res);
  }

  @Get('expenses/:id')
  @RequirePermission({ module: ModuleName.EXPENSE, action: PermissionAction.READ })
  findOneExpense(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.expenseService.findOneExpense(id, user);
  }

  @Post('expenses')
  @RequirePermission({ module: ModuleName.EXPENSE, action: PermissionAction.CREATE })
  @UseInterceptors(FileInterceptor('attachment', createMulterConfig('expenses')))
  async createExpense(
    @Body() dto: CreateExpenseDto,
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() user: JwtPayload,
  ) {
    const attachmentUrl = file
      ? (await resolveUploadedFile(file, 'expenses')) ||
        `/uploads/expenses/${file.filename}`
      : undefined;
    return this.expenseService.createExpense(dto, user, attachmentUrl);
  }

  @Patch('expenses/:id/mark-paid')
  @RequirePermission({ module: ModuleName.EXPENSE, action: PermissionAction.UPDATE })
  markPaid(
    @Param('id') id: string,
    @Body() dto: MarkExpensePaidDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.expenseService.markPaid(id, dto, user);
  }

  @Delete('expenses/:id')
  @RequirePermission({ module: ModuleName.EXPENSE, action: PermissionAction.DELETE })
  removeExpense(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.expenseService.removeExpense(id, user);
  }
}
