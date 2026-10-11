import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateServiceJobDto,
  AssignTechnicianDto,
  CreateRepairJobDto,
} from './dto/create-service-job.dto';
import { UpdateServiceJobStatusDto } from './dto/update-service-job-status.dto';
import { UpdateServiceJobDto } from './dto/update-service-job.dto';
import {
  Prisma,
  ServiceJobStatus,
  SaleType,
  OrderStatus,
  PaymentStatus,
  ServiceMaterialSourceType,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { BranchScopeService } from '../common/branch/branch-scope.service';

@Injectable()
export class ServiceJobService {
  constructor(
    private prisma: PrismaService,
    private branchScopeService: BranchScopeService,
  ) {}

  async getNextInvoiceNo(): Promise<{ invoiceNo: string }> {
    const count = await this.prisma.serviceJob.count();
    const nextNum = count + 1;
    const padded = String(nextNum).padStart(4, '0');
    return { invoiceNo: `INV-${padded}` };
  }

  async findAll(
    query: {
      status?: ServiceJobStatus;
      branch?: string;
      technicianId?: string;
      search?: string;
      page?: number;
      limit?: number;
      startDate?: string;
      endDate?: string;
    },
    user?: JwtPayload,
  ) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.ServiceJobWhereInput = {};

    if (query.status) where.status = query.status;
    if (query.technicianId) where.technicianId = query.technicianId;

    const branchFilter = await this.branchScopeService.getBranchFilter(
      user,
      query.branch,
    );
    if (branchFilter !== undefined) {
      where.branchId = branchFilter;
    }

    if (query.search?.trim()) {
      const s = query.search.trim();
      where.OR = [
        { invoiceNo: { contains: s, mode: 'insensitive' } },
        { customerPhone: { contains: s, mode: 'insensitive' } },
        { customerName: { contains: s, mode: 'insensitive' } },
        { device: { contains: s, mode: 'insensitive' } },
        { model: { contains: s, mode: 'insensitive' } },
        { issueDescription: { contains: s, mode: 'insensitive' } },
        { order: { orderCode: { contains: s, mode: 'insensitive' } } },
      ];
    }

    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) {
        where.createdAt.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        const endDate = new Date(query.endDate);
        endDate.setUTCHours(23, 59, 59, 999);
        where.createdAt.lte = endDate;
      }
    }

    const [total, data] = await Promise.all([
      this.prisma.serviceJob.count({ where }),
      this.prisma.serviceJob.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          technician: {
            select: {
              id: true,
              name: true,
              phone: true,
              profitSharePercentage: true,
            },
          },
          customer: { select: { id: true, name: true, phone: true } },
          supplier: {
            select: { id: true, name: true, phone: true, companyName: true },
          },
          deviceType: true,
          brand: { select: { id: true, name: true } },
          materials: {
            include: {
              supplier: { select: { id: true, name: true, phone: true } },
              product: { select: { id: true, name: true } },
            },
          },
          order: {
            include: {
              customer: { select: { id: true, name: true, phone: true } },
              branch: { select: { id: true, name: true } },
              payments: true,
            },
          },
        },
      }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findMy(technicianId: string) {
    return this.prisma.serviceJob.findMany({
      where: { technicianId },
      orderBy: { createdAt: 'desc' },
      include: {
        technician: {
          select: {
            id: true,
            name: true,
            phone: true,
            profitSharePercentage: true,
          },
        },
        customer: true,
        deviceType: true,
        brand: true,
        materials: {
          include: {
            supplier: true,
            product: true,
          },
        },
        order: {
          include: {
            customer: true,
            branch: true,
            payments: true,
          },
        },
      },
    });
  }

  async findOne(id: string, user?: JwtPayload) {
    const job = await this.prisma.serviceJob.findUnique({
      where: { id },
      include: {
        branch: true,
        technician: true,
        customer: true,
        supplier: true,
        deviceType: true,
        brand: true,
        materials: {
          include: {
            supplier: true,
            product: true,
          },
        },
        order: {
          include: {
            customer: true,
            branch: true,
            items: true,
            payments: true,
          },
        },
      },
    });
    if (!job) throw new NotFoundException(`Service job "${id}" not found.`);
    if (user) {
      await this.branchScopeService.validateBranchAccess(user, job.branchId);
    }
    return job;
  }

  async create(dto: CreateServiceJobDto, user?: JwtPayload) {
    const order = await this.prisma.order.findUnique({
      where: { id: dto.orderId },
    });
    if (!order)
      throw new NotFoundException(`Order "${dto.orderId}" not found.`);

    if (user) {
      await this.branchScopeService.validateBranchAccess(user, order.branchId);
    }

    return this.prisma.serviceJob.create({
      data: {
        orderId: dto.orderId,
        branchId: order.branchId,
        technicianId: dto.technicianId || null,
        device: dto.device,
        issueDescription: dto.issueDescription,
        specialization: dto.specialization || null,
        serviceCharge: dto.serviceCharge,
        laborCost: dto.serviceCharge,
        totalBill: dto.serviceCharge,
        finalAmount: dto.serviceCharge,
      },
      include: {
        branch: true,
        technician: true,
        order: true,
      },
    });
  }

  async createRepairJob(dto: CreateRepairJobDto, currentUser?: any) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Resolve Customer
      let customer: any = null;
      if (dto.customerId) {
        customer = await tx.customer.findUnique({
          where: { id: dto.customerId },
        });
      }
      if (!customer && dto.customerPhone) {
        const cleanPhone = dto.customerPhone.trim();
        customer = await tx.customer.findUnique({
          where: { phone: cleanPhone },
        });
        if (!customer) {
          const tempPassword = await bcrypt.hash('Customer@12345', 10);
          customer = await tx.customer.create({
            data: {
              name: dto.customerName || 'Walk-in Customer',
              phone: cleanPhone,
              passwordHash: tempPassword,
              source: 'SERVICE_WALKIN',
            },
          });
        }
      }

      // 2. Resolve Invoice Number
      let invoiceNo = dto.invoiceNo?.trim();
      if (!invoiceNo) {
        const next = await this.getNextInvoiceNo();
        invoiceNo = next.invoiceNo;
      }

      // Check if invoice number already used
      const existing = await tx.serviceJob.findUnique({ where: { invoiceNo } });
      if (existing) {
        // Append timestamp suffix to guarantee uniqueness if user supplied duplicate
        invoiceNo = `${invoiceNo}-${Date.now().toString().slice(-4)}`;
      }

      // 3. Resolve Branch
      const branchId = await this.branchScopeService.determineCreateBranchId(
        currentUser,
        dto.branchId,
      );

      // 4. Resolve Pricing & Profit Share
      const laborCost = Number(dto.laborCost || 0);
      const materialCost = Number(dto.materialCost || 0);
      const totalBill = Number(dto.totalBill || laborCost + materialCost);
      const discount = Number(dto.discount || 0);
      const finalAmount = Number(dto.finalAmount || totalBill - discount);
      const paidAmount = Number(dto.paidAmount || 0);
      const dueAmount = Math.max(0, finalAmount - paidAmount);

      let technicianId = dto.technicianId || null;
      if (currentUser?.roleName?.toLowerCase().includes('technician')) {
        technicianId = currentUser.sub;
      }

      let technicianProfitShare = 0;
      if (technicianId) {
        const technician = await tx.staff.findUnique({
          where: { id: technicianId },
        });
        if (technician) {
          const rawRate = Number(
            technician.profitSharePercentage ?? technician.commissionRate ?? 0,
          );
          const rate = rawRate > 0 ? rawRate : 50;
          // Profit share = 50% (or configured rate) * (finalAmount - materialCost)
          const laborProfit = Math.max(0, finalAmount - materialCost);
          technicianProfitShare = (laborProfit * rate) / 100;
        }
      }

      // 5. Create underlying Order for unified accounting, customer activities, and payment history
      let paymentStatus: PaymentStatus = PaymentStatus.PENDING;
      if (dueAmount <= 0) {
        paymentStatus = PaymentStatus.PAID;
      } else if (paidAmount > 0) {
        paymentStatus = PaymentStatus.DUE;
      }

      let orderCode = `SRV-${invoiceNo.replace(/[^A-Za-z0-9]/g, '')}`;
      let counter = 1;
      while (await tx.order.findUnique({ where: { orderCode } })) {
        orderCode = `SRV-${invoiceNo.replace(/[^A-Za-z0-9]/g, '')}-${counter++}`;
      }

      const order = await tx.order.create({
        data: {
          orderCode,
          branchId,
          customerId: customer?.id || null,
          saleType: SaleType.DIAGNOSING,
          status: OrderStatus.CONFIRMED,
          paymentStatus,
          paymentMethod:
            dto.payments && dto.payments.length > 0
              ? (dto.payments[0].method as any)
              : null,
          subtotal: totalBill,
          discountAmount: discount,
          deliveryCharge: 0,
          totalAmount: finalAmount,
          paidAmount,
          dueAmount,
          staffId: currentUser?.sub || null,
          saleDate: new Date(),
        },
      });

      // 6. Create ServiceJob record
      const jobStatus: ServiceJobStatus =
        (dto.status as ServiceJobStatus) || ServiceJobStatus.PENDING;

      const serviceJob = await tx.serviceJob.create({
        data: {
          invoiceNo,
          orderId: order.id,
          branchId,
          customerId: customer?.id || null,
          customerName: dto.customerName,
          customerPhone: dto.customerPhone,
          referralNumber: dto.referralNumber || null,
          technicianId: technicianId || null,
          device: dto.device || 'Mobile Device',
          deviceTypeId: dto.deviceTypeId || null,
          brandId: dto.brandId || null,
          model: dto.model || null,
          issueDescription: dto.issueDescription || 'Repair Service',
          problems: dto.problems || null,
          warrantyPeriod: dto.warrantyPeriod || null,
          warrantyStartDate: dto.warrantyStartDate
            ? new Date(dto.warrantyStartDate)
            : null,
          warrantyEndDate: dto.warrantyEndDate
            ? new Date(dto.warrantyEndDate)
            : null,
          laborCost,
          materialCost,
          totalBill,
          discount,
          finalAmount,
          paidAmount,
          dueAmount,
          serviceCharge: laborCost,
          paymentDetails: dto.payments
            ? (dto.payments as any)
            : dto.paymentDetails
              ? dto.paymentDetails
              : undefined,
          technicianProfitShare,
          status: jobStatus,
        },
      });

      // 7. Create Material History rows (supplier-linked or sourced parts)
      if (dto.materials && Array.isArray(dto.materials)) {
        for (const mat of dto.materials) {
          if (!mat.partName?.trim()) continue;

          const rawSourceType = mat.sourceType || 'OWN_STOCK';
          const sourceType = Object.values(ServiceMaterialSourceType).includes(
            rawSourceType,
          )
            ? rawSourceType
            : ServiceMaterialSourceType.OWN_STOCK;

          // Validation rules per Fix Pass 33:
          if (
            sourceType === ServiceMaterialSourceType.SUPPLIER &&
            !mat.supplierId?.trim()
          ) {
            throw new BadRequestException(
              `Registered Supplier is required for part "${mat.partName.trim()}" when Source Type is "Registered Supplier".`,
            );
          }
          if (
            sourceType === ServiceMaterialSourceType.OTHER &&
            !mat.sourcedFromName?.trim() &&
            !mat.sourceNote?.trim()
          ) {
            throw new BadRequestException(
              `Sourcing Notes are required for part "${mat.partName.trim()}" when Source Type is "Other / Ad-hoc Source".`,
            );
          }

          const cost = Number(mat.cost || 0);
          const qty = Number(mat.quantity || 1);
          const total = Number(mat.total || cost * qty);

          await tx.serviceJobMaterial.create({
            data: {
              serviceJobId: serviceJob.id,
              partName: mat.partName.trim(),
              productId: mat.productId || null,
              sourceType,
              supplierId:
                sourceType === ServiceMaterialSourceType.SUPPLIER
                  ? mat.supplierId?.trim() || null
                  : null,
              sourcedFromName:
                sourceType === ServiceMaterialSourceType.OTHER
                  ? mat.sourcedFromName?.trim() || null
                  : null,
              sourceNote:
                sourceType === ServiceMaterialSourceType.OTHER || mat.sourceNote
                  ? mat.sourceNote?.trim() || null
                  : null,
              cost,
              quantity: qty,
              total,
            },
          });
        }
      }

      // 8. Create Split Payments & Customer Activity
      const paymentsList =
        dto.payments && Array.isArray(dto.payments)
          ? dto.payments
          : dto.paymentDetails && Array.isArray(dto.paymentDetails)
            ? dto.paymentDetails
            : [];

      if (customer && paymentsList.length > 0) {
        for (const p of paymentsList) {
          const amt = Number(p.amount || 0);
          if (amt > 0) {
            await tx.payment.create({
              data: {
                customerId: customer.id,
                orderId: order.id,
                amount: amt,
                discount: 0,
                paymentMethod: p.method || 'CASH',
              },
            });
          }
        }

        // Log Customer Activity
        await tx.customerActivity.create({
          data: {
            customerId: customer.id,
            type: 'ORDER_PLACED',
            description: `Created repair service ticket #${invoiceNo} for ৳${finalAmount.toLocaleString()}`,
            metadata: {
              serviceJobId: serviceJob.id,
              invoiceNo,
              totalBill,
              finalAmount,
              device: dto.device,
            },
          },
        });
      }

      return tx.serviceJob.findUnique({
        where: { id: serviceJob.id },
        include: {
          technician: true,
          customer: true,
          deviceType: true,
          brand: true,
          materials: {
            include: {
              supplier: true,
              product: true,
            },
          },
          order: {
            include: {
              customer: true,
              branch: true,
              items: true,
              payments: true,
            },
          },
        },
      });
    });
  }

  async assignTechnician(
    id: string,
    dto: AssignTechnicianDto,
    user?: JwtPayload,
  ) {
    const job = await this.findOne(id, user);

    // Recompute profit share if technician changed
    let technicianProfitShare = 0;
    if (dto.technicianId) {
      const technician = await this.prisma.staff.findUnique({
        where: { id: dto.technicianId },
      });
      if (technician) {
        const rawRate = Number(
          technician.profitSharePercentage ?? technician.commissionRate ?? 0,
        );
        const rate = rawRate > 0 ? rawRate : 50;
        const laborProfit = Math.max(
          0,
          Number(job.finalAmount) - Number(job.materialCost),
        );
        technicianProfitShare = (laborProfit * rate) / 100;
      }
    }

    return this.prisma.serviceJob.update({
      where: { id },
      data: {
        technicianId: dto.technicianId,
        technicianProfitShare,
      },
      include: {
        technician: true,
        order: true,
        materials: true,
      },
    });
  }

  async updateStatus(
    id: string,
    dto: UpdateServiceJobStatusDto,
    user?: JwtPayload,
  ) {
    const job = await this.findOne(id, user);

    const updatedJob = await this.prisma.serviceJob.update({
      where: { id },
      data: { status: dto.status },
      include: { technician: true, order: true },
    });

    if (dto.status === ServiceJobStatus.DELIVERED && job.orderId) {
      await this.prisma.order.update({
        where: { id: job.orderId },
        data: { status: OrderStatus.COMPLETED },
      });
    }

    return updatedJob;
  }

  async update(id: string, dto: UpdateServiceJobDto, user?: JwtPayload) {
    await this.findOne(id, user);

    return this.prisma.$transaction(async (tx) => {
      const job = await tx.serviceJob.findUnique({
        where: { id },
        include: { materials: true },
      });
      if (!job) throw new NotFoundException(`Service job "${id}" not found.`);

      const updateData: any = {};
      if (dto.status !== undefined) updateData.status = dto.status;
      if (dto.device !== undefined) updateData.device = dto.device;
      if (dto.issueDescription !== undefined)
        updateData.issueDescription = dto.issueDescription;
      if (dto.laborCost !== undefined) updateData.laborCost = dto.laborCost;
      if (dto.discount !== undefined) updateData.discount = dto.discount;
      if (dto.advancePayment !== undefined)
        updateData.paidAmount = dto.advancePayment;
      if (dto.dueAmount !== undefined) updateData.dueAmount = dto.dueAmount;
      if (dto.totalBill !== undefined) updateData.totalBill = dto.totalBill;
      if (dto.supplierId !== undefined) {
        updateData.supplierId =
          dto.supplierId && dto.supplierId !== 'NONE' ? dto.supplierId : null;
      }
      if (dto.supplierPaymentStatus !== undefined) {
        updateData.supplierPaymentStatus =
          dto.supplierPaymentStatus && dto.supplierPaymentStatus !== 'NONE'
            ? dto.supplierPaymentStatus
            : null;
      }

      let materialCost = Number(job.materialCost || 0);
      if (dto.materials !== undefined) {
        await tx.serviceJobMaterial.deleteMany({ where: { serviceJobId: id } });

        let newMaterialCost = 0;
        for (const mat of dto.materials) {
          if (!mat.partName?.trim()) continue;

          const rawSourceType = mat.sourceType || 'OWN_STOCK';
          const sourceType = Object.values(ServiceMaterialSourceType).includes(
            rawSourceType,
          )
            ? rawSourceType
            : ServiceMaterialSourceType.OWN_STOCK;

          if (
            sourceType === ServiceMaterialSourceType.SUPPLIER &&
            !mat.supplierId?.trim()
          ) {
            throw new BadRequestException(
              `Registered Supplier is required for part "${mat.partName.trim()}"`,
            );
          }
          if (
            sourceType === ServiceMaterialSourceType.OTHER &&
            !mat.sourcedFromName?.trim() &&
            !mat.sourceNote?.trim()
          ) {
            throw new BadRequestException(
              `Sourcing Notes are required for part "${mat.partName.trim()}"`,
            );
          }

          const cost = Number(mat.cost || 0);
          const qty = Number(mat.quantity || 1);
          const total = Number(mat.total || cost * qty);
          newMaterialCost += total;

          await tx.serviceJobMaterial.create({
            data: {
              serviceJobId: id,
              partName: mat.partName.trim(),
              productId: mat.productId || null,
              sourceType,
              supplierId:
                sourceType === ServiceMaterialSourceType.SUPPLIER
                  ? mat.supplierId?.trim() || null
                  : null,
              sourcedFromName:
                sourceType === ServiceMaterialSourceType.OTHER
                  ? mat.sourcedFromName?.trim() || null
                  : null,
              sourceNote:
                sourceType === ServiceMaterialSourceType.OTHER || mat.sourceNote
                  ? mat.sourceNote?.trim() || null
                  : null,
              cost,
              quantity: qty,
              total,
            },
          });
        }
        materialCost = newMaterialCost;
        updateData.materialCost = materialCost;
      }

      const currentLaborCost =
        dto.laborCost !== undefined ? dto.laborCost : Number(job.laborCost);
      const currentDiscount =
        dto.discount !== undefined ? dto.discount : Number(job.discount);
      const currentTotalBill =
        dto.totalBill !== undefined ? dto.totalBill : Number(job.totalBill);
      const currentFinalAmount = Math.max(
        0,
        currentTotalBill - currentDiscount,
      );

      updateData.finalAmount = currentFinalAmount;

      let technicianProfitShare = Number(job.technicianProfitShare || 0);
      if (
        job.technicianId &&
        (dto.laborCost !== undefined ||
          dto.materials !== undefined ||
          dto.totalBill !== undefined ||
          dto.discount !== undefined)
      ) {
        const technician = await tx.staff.findUnique({
          where: { id: job.technicianId },
        });
        if (technician) {
          const rawRate = Number(
            technician.profitSharePercentage ?? technician.commissionRate ?? 0,
          );
          const rate = rawRate > 0 ? rawRate : 50;
          const laborProfit = Math.max(
            0,
            currentFinalAmount - Number(materialCost),
          );
          technicianProfitShare = (laborProfit * rate) / 100;
          updateData.technicianProfitShare = technicianProfitShare;
        }
      }

      if (
        job.orderId &&
        (dto.totalBill !== undefined ||
          dto.discount !== undefined ||
          dto.advancePayment !== undefined ||
          dto.dueAmount !== undefined)
      ) {
        const paidAmount =
          dto.advancePayment !== undefined
            ? dto.advancePayment
            : Number(job.paidAmount);
        const dueAmount =
          dto.dueAmount !== undefined ? dto.dueAmount : Number(job.dueAmount);

        let paymentStatus: PaymentStatus = PaymentStatus.PENDING;
        if (dueAmount <= 0) paymentStatus = PaymentStatus.PAID;
        else if (paidAmount > 0) paymentStatus = PaymentStatus.DUE;

        await tx.order.update({
          where: { id: job.orderId },
          data: {
            subtotal: currentTotalBill,
            discountAmount: currentDiscount,
            totalAmount: currentFinalAmount,
            paidAmount,
            dueAmount,
            paymentStatus,
          },
        });
      }

      return tx.serviceJob.update({
        where: { id },
        data: updateData,
        include: {
          technician: true,
          order: true,
          materials: true,
          supplier: true,
        },
      });
    });
  }

  async remove(id: string, user?: JwtPayload) {
    const existing = await this.findOne(id, user);

    if (
      existing.status === ServiceJobStatus.READY_FOR_PICKUP ||
      existing.status === ServiceJobStatus.DELIVERED
    ) {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        message: `Cannot delete service job "${existing.invoiceNo || existing.id}". It is marked as ${existing.status}. Please cancel the service job instead.`,
      });
    }

    if (existing.orderId) {
      const paymentCount = await this.prisma.payment.count({
        where: { orderId: existing.orderId },
      });
      if (paymentCount > 0) {
        throw new ConflictException({
          statusCode: 409,
          error: 'Conflict',
          message: `Cannot delete service job "${existing.invoiceNo || existing.id}" because it has ${paymentCount} recorded payment(s).`,
        });
      }
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.serviceJobMaterial.deleteMany({ where: { serviceJobId: id } });
      if (existing.orderId) {
        await tx.serviceJob.delete({ where: { id } });
        await tx.orderItem.deleteMany({ where: { orderId: existing.orderId } });
        await tx.orderStatusHistory.deleteMany({ where: { orderId: existing.orderId } });
        await tx.order.delete({ where: { id: existing.orderId } });
      } else {
        await tx.serviceJob.delete({ where: { id } });
      }

      return { success: true, message: 'Service job deleted successfully' };
    });
  }
}
