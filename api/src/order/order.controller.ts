import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import type { Response, Request } from 'express';
import { OrderService } from './order.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { AddOrderNoteDto } from './dto/add-order-note.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { CheckoutOrderDto } from './dto/checkout-order.dto';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import {
  ModuleName,
  OrderStatus,
  PermissionAction,
  PaymentStatus,
  SaleType,
} from '@prisma/client';

@Controller('orders')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @RequirePermission({
    module: ModuleName.ORDERS,
    action: PermissionAction.READ,
    branchParam: 'branchId',
  })
  @Get()
  findAll(
    @Query('status') status?: OrderStatus,
    @Query('saleType') saleType?: SaleType,
    @Query('branch') branch?: string,
    @Query('branchId') branchId?: string,
    @Query('paymentStatus') paymentStatus?: PaymentStatus,
    @Query('needsStockReview') needsStockReview?: string,
    @Query('search') search?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @CurrentUser() user?: JwtPayload,
  ) {
    return this.orderService.findAll(
      {
        status,
        saleType,
        branch,
        branchId,
        paymentStatus,
        needsStockReview,
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
    module: ModuleName.SALES,
    action: PermissionAction.READ,
  })
  @Get('customers/search')
  searchCustomers(@Query('q') query?: string) {
    return this.orderService.searchCustomers(query);
  }

  @Get('my')
  findMyOrders(
    @CurrentUser() user: JwtPayload,
    @Query('status') status?: OrderStatus,
  ) {
    return this.orderService.findMyOrders(user.sub, status);
  }

  @Get(':id/invoice.pdf')
  async exportInvoicePdf(
    @Param('id') id: string,
    @Res() res: Response,
    @CurrentUser() user?: JwtPayload,
    @Req() req?: Request,
  ) {
    const { buffer, filename } = await this.orderService.generateInvoice(
      id,
      'pdf',
      user,
      req,
    );
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length.toString(),
    });
    res.end(buffer);
  }

  @Get(':id/invoice.png')
  async exportInvoicePng(
    @Param('id') id: string,
    @Res() res: Response,
    @CurrentUser() user?: JwtPayload,
    @Req() req?: Request,
  ) {
    const { buffer, filename } = await this.orderService.generateInvoice(
      id,
      'png',
      user,
      req,
    );
    res.set({
      'Content-Type': 'image/png',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length.toString(),
    });
    res.end(buffer);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user?: JwtPayload) {
    return this.orderService.findOne(id, user);
  }

  @Public()
  @Post('checkout')
  checkout(@Body() dto: CheckoutOrderDto, @CurrentUser() user?: JwtPayload) {
    return this.orderService.checkout(dto, user);
  }

  @RequirePermission({
    module: ModuleName.ORDERS,
    action: PermissionAction.CREATE,
  })
  @Post()
  create(@Body() dto: CreateOrderDto, @CurrentUser() user?: JwtPayload) {
    return this.orderService.create(dto, user);
  }

  @RequirePermission({
    module: ModuleName.ORDERS,
    action: PermissionAction.UPDATE,
    branchParam: 'branchId',
  })
  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
    @CurrentUser() user?: JwtPayload,
  ) {
    return this.orderService.updateStatus(id, dto, user);
  }

  @RequirePermission({
    module: ModuleName.ORDERS,
    action: PermissionAction.UPDATE,
  })
  @Post(':id/notes')
  addNote(
    @Param('id') id: string,
    @Body() dto: AddOrderNoteDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.orderService.addNote(id, dto, user);
  }

  @RequirePermission({
    module: ModuleName.ORDERS,
    action: PermissionAction.UPDATE,
  })
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateOrderDto,
    @CurrentUser() user?: JwtPayload,
  ) {
    return this.orderService.update(id, dto, user);
  }

  @RequirePermission({
    module: ModuleName.ORDERS,
    action: PermissionAction.DELETE,
    branchParam: 'branchId',
  })
  @Delete(':id')
  remove(
    @Param('id') id: string,
    @CurrentUser() user?: JwtPayload,
  ) {
    return this.orderService.remove(id, user);
  }
}
