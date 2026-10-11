import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateCustomerDto,
  UpdateCustomerDto,
  CustomerQueryDto,
  ReceivePaymentDto,
  CustomerAddressDto,
} from './dto/customer.dto';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { CustomerActivityType, Prisma } from '@prisma/client';

@Injectable()
export class CustomerService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: CustomerQueryDto) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.CustomerWhereInput = {};

    if (query.search && query.search.trim()) {
      const search = query.search.trim();
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (
      query.source &&
      query.source.trim() &&
      query.source.toLowerCase() !== 'all'
    ) {
      where.source = { equals: query.source.trim(), mode: 'insensitive' };
    }

    const [total, data] = await Promise.all([
      this.prisma.customer.count({ where }),
      this.prisma.customer.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          photo: true,
          profileImageUrl: true,
          source: true,
          walletBalance: true,
          status: true,
          createdAt: true,
          _count: {
            select: { orders: true },
          },
        },
      }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async create(dto: CreateCustomerDto) {
    const phoneClean = dto.phone.trim();
    const existingPhone = await this.prisma.customer.findUnique({
      where: { phone: phoneClean },
    });
    if (existingPhone) {
      throw new ConflictException(
        `A customer with phone number ${phoneClean} already exists.`,
      );
    }

    let emailClean: string | null = null;
    if (dto.email && dto.email.trim()) {
      emailClean = dto.email.trim().toLowerCase();
      const existingEmail = await this.prisma.customer.findUnique({
        where: { email: emailClean },
      });
      if (existingEmail) {
        throw new ConflictException(
          `A customer with email ${emailClean} already exists.`,
        );
      }
    }

    // Password handling: if provided, validate match and hash; otherwise generate secure random password
    let rawPassword = dto.password?.trim();
    if (!rawPassword) {
      rawPassword = `Nova@${crypto.randomBytes(4).toString('hex')}!`;
    } else if (
      dto.confirmPassword &&
      rawPassword !== dto.confirmPassword.trim()
    ) {
      throw new BadRequestException(
        'Password and Confirm Password do not match.',
      );
    }

    const passwordHash = await bcrypt.hash(rawPassword, 10);
    const profileImage = dto.profileImageUrl || null;

    const customer = await this.prisma.customer.create({
      data: {
        name: dto.name.trim(),
        phone: phoneClean,
        email: emailClean,
        passwordHash,
        photo: profileImage,
        profileImageUrl: profileImage,
        source: dto.source?.trim() || 'Walk-In',
        walletBalance:
          dto.walletBalance !== undefined
            ? new Prisma.Decimal(dto.walletBalance)
            : new Prisma.Decimal(0),
      },
    });

    // Log REGISTERED activity
    await this.prisma.customerActivity.create({
      data: {
        customerId: customer.id,
        type: CustomerActivityType.REGISTERED,
        description: `Customer account registered via ${customer.source}`,
      },
    });

    return customer;
  }

  async findOne(id: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      include: {
        addresses: {
          orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
        },
        orders: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            orderCode: true,
            createdAt: true,
            totalAmount: true,
          },
        },
        _count: {
          select: {
            orders: true,
            payments: true,
          },
        },
      },
    });

    if (!customer) {
      throw new NotFoundException(`Customer with ID "${id}" not found.`);
    }

    const primaryAddress =
      customer.addresses.find((a) => a.isDefault) ||
      customer.addresses[0] ||
      null;
    const lastOrder = customer.orders[0] || null;

    return {
      id: customer.id,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      photo: customer.profileImageUrl || customer.photo,
      profileImageUrl: customer.profileImageUrl || customer.photo,
      source: customer.source || 'Walk-In',
      walletBalance: Number(customer.walletBalance || 0),
      status: customer.status,
      memberSince: customer.createdAt,
      lastOrder: lastOrder ? lastOrder.createdAt : null,
      lastOrderCode: lastOrder ? lastOrder.orderCode : null,
      primaryAddress: primaryAddress ? primaryAddress.fullAddress : null,
      addresses: customer.addresses,
      orderCount: customer._count.orders,
      paymentCount: customer._count.payments,
      createdAt: customer.createdAt,
      updatedAt: customer.updatedAt,
    };
  }

  async update(id: string, dto: UpdateCustomerDto) {
    const existing = await this.prisma.customer.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Customer with ID "${id}" not found.`);
    }

    const updateData: Prisma.CustomerUpdateInput = {};

    if (dto.name !== undefined) updateData.name = dto.name.trim();

    if (dto.phone !== undefined && dto.phone.trim() !== existing.phone) {
      const phoneClean = dto.phone.trim();
      const conflict = await this.prisma.customer.findUnique({
        where: { phone: phoneClean },
      });
      if (conflict && conflict.id !== id) {
        throw new ConflictException(
          `Phone number ${phoneClean} is already registered to another customer.`,
        );
      }
      updateData.phone = phoneClean;
    }

    if (dto.email !== undefined) {
      const emailClean = dto.email ? dto.email.trim().toLowerCase() : null;
      if (emailClean && emailClean !== existing.email) {
        const conflict = await this.prisma.customer.findUnique({
          where: { email: emailClean },
        });
        if (conflict && conflict.id !== id) {
          throw new ConflictException(
            `Email ${emailClean} is already registered to another customer.`,
          );
        }
      }
      updateData.email = emailClean;
    }

    if (dto.source !== undefined) updateData.source = dto.source.trim();

    if (dto.profileImageUrl !== undefined) {
      updateData.profileImageUrl = dto.profileImageUrl;
      updateData.photo = dto.profileImageUrl;
    }

    let passwordChanged = false;
    if (dto.password && dto.password.trim()) {
      updateData.passwordHash = await bcrypt.hash(dto.password.trim(), 10);
      passwordChanged = true;
    }

    const updated = await this.prisma.customer.update({
      where: { id },
      data: updateData,
    });

    if (passwordChanged) {
      await this.prisma.customerActivity.create({
        data: {
          customerId: id,
          type: CustomerActivityType.PASSWORD_CHANGED,
          description: 'Customer password updated by administrator',
        },
      });
    }

    await this.prisma.customerActivity.create({
      data: {
        customerId: id,
        type: CustomerActivityType.PROFILE_UPDATED,
        description: 'Customer profile details updated',
      },
    });

    return updated;
  }

  async delete(id: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      include: {
        _count: {
          select: { orders: true, serviceJobs: true },
        },
      },
    });

    if (!customer) {
      throw new NotFoundException(`Customer with ID "${id}" not found.`);
    }

    const blockers: string[] = [];
    if (customer._count.orders > 0) {
      blockers.push(`${customer._count.orders} order(s)`);
    }
    if (customer._count.serviceJobs > 0) {
      blockers.push(`${customer._count.serviceJobs} service job(s)`);
    }

    if (blockers.length > 0) {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        message: `Cannot delete customer "${customer.name}". It has ${blockers.join(' and ')}. Please set status to INACTIVE instead.`,
        canDeactivate: true,
        blockers: {
          orders: customer._count.orders,
          serviceJobs: customer._count.serviceJobs,
        },
      });
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.customerActivity.deleteMany({ where: { customerId: id } });
      await tx.address.deleteMany({ where: { customerId: id } });
      return tx.customer.delete({ where: { id } });
    });
  }

  async getSummary(
    id: string,
    range: string = 'lifetime',
    from?: string,
    to?: string,
  ) {
    const customer = await this.prisma.customer.findUnique({ where: { id } });
    if (!customer) {
      throw new NotFoundException(`Customer with ID "${id}" not found.`);
    }

    // Build date filter
    let dateFilter: Prisma.DateTimeFilter | undefined;
    const now = new Date();

    if (range === 'today') {
      const startOfDay = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
      );
      dateFilter = { gte: startOfDay };
    } else if (range === 'week') {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      const startOfWeek = new Date(now.setDate(diff));
      startOfWeek.setHours(0, 0, 0, 0);
      dateFilter = { gte: startOfWeek };
    } else if (range === 'month') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      dateFilter = { gte: startOfMonth };
    } else if (range === 'custom' && (from || to)) {
      dateFilter = {};
      if (from) dateFilter.gte = new Date(from);
      if (to) {
        const toDate = new Date(to);
        toDate.setHours(23, 59, 59, 999);
        dateFilter.lte = toDate;
      }
    }

    const orderWhere: Prisma.OrderWhereInput = {
      customerId: id,
      ...(dateFilter ? { createdAt: dateFilter } : {}),
    };

    const orders = await this.prisma.order.findMany({
      where: orderWhere,
      include: {
        items: true,
        salesReturn: {
          include: {
            items: true,
          },
        },
      },
    });

    let totalSpent = 0;
    let totalPaid = 0;
    const totalOrders = orders.length;
    let purchasedQty = 0;
    let cancelledOrders = 0;
    let discountedOrders = 0;
    let discountAmount = 0;
    let returnedOrders = 0;
    let returnAmount = 0;
    let returnQty = 0;

    for (const ord of orders) {
      const orderTotal = Number(ord.totalAmount || 0);
      const orderPaid = Number(ord.paidAmount || 0);
      const orderDiscount = Number(ord.discountAmount || 0);

      totalSpent += orderTotal;
      totalPaid += orderPaid;

      if (ord.status === 'CANCELLED') {
        cancelledOrders++;
      }

      if (orderDiscount > 0) {
        discountedOrders++;
        discountAmount += orderDiscount;
      }

      for (const itm of ord.items) {
        purchasedQty += itm.quantity || 0;
      }

      if (ord.salesReturn) {
        returnedOrders++;
        returnAmount += Number(ord.salesReturn.refundAmount || 0);
        if (ord.salesReturn.items) {
          for (const retItm of ord.salesReturn.items) {
            returnQty += retItm.quantity || 0;
          }
        }
      }
    }

    const unpaidBalance = Math.max(0, totalSpent - totalPaid);
    const advanceMoney = Number(customer.walletBalance || 0);

    return {
      totalSpent,
      totalPaid,
      unpaidBalance,
      advanceMoney,
      returnAmount,
      totalOrders,
      purchasedQty,
      returnQty,
      cancelledOrders,
      discountedOrders,
      discountAmount,
      returnedOrders,
    };
  }

  async getOrders(id: string, statusType?: 'active' | 'history') {
    const where: Prisma.OrderWhereInput = { customerId: id };

    if (statusType === 'active') {
      where.status = {
        in: ['PENDING', 'CONFIRMED', 'PARCEL_BOOKED', 'DIAGNOSING'],
      };
    }

    const orders = await this.prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        branch: {
          select: { name: true, code: true },
        },
        items: {
          include: {
            product: { select: { name: true, images: { take: 1 } } },
          },
        },
      },
    });

    return orders.map((o) => ({
      id: o.id,
      orderCode: o.orderCode,
      createdAt: o.createdAt,
      status: o.status,
      paymentStatus: o.paymentStatus,
      paymentMethod: o.paymentMethod,
      totalAmount: Number(o.totalAmount),
      paidAmount: Number(o.paidAmount),
      dueAmount: Number(o.dueAmount),
      branchName: o.branch?.name,
      itemCount: o.items.reduce((sum, item) => sum + item.quantity, 0),
      itemsSummary: o.items
        .map((i) => `${i.productNameSnapshot} (x${i.quantity})`)
        .join(', '),
    }));
  }

  async getPayments(id: string, page: number = 1, limit: number = 10) {
    const pageNum = Number(page) || 1;
    const limitNum = Number(limit) || 10;
    const skip = (pageNum - 1) * limitNum;

    const [total, payments] = await Promise.all([
      this.prisma.payment.count({ where: { customerId: id } }),
      this.prisma.payment.findMany({
        where: { customerId: id },
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
        include: {
          order: {
            select: {
              id: true,
              orderCode: true,
              items: {
                select: { productNameSnapshot: true },
                take: 2,
              },
            },
          },
        },
      }),
    ]);

    const data = payments.map((p) => {
      const itemNames = p.order?.items
        ?.map((i) => i.productNameSnapshot)
        .join(', ');
      return {
        id: p.id,
        createdAt: p.createdAt,
        orderId: p.order?.orderCode || p.orderId || null,
        items: itemNames || '—',
        paymentMethod: p.paymentMethod,
        paymentChannel: p.paymentChannel || p.paymentMethod,
        amount: Number(p.amount),
        discount: Number(p.discount || 0),
        note: p.note || '—',
      };
    });

    return {
      data,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum) || 1,
    };
  }

  async receivePayment(id: string, dto: ReceivePaymentDto) {
    const customer = await this.prisma.customer.findUnique({ where: { id } });
    if (!customer) {
      throw new NotFoundException(`Customer with ID "${id}" not found.`);
    }

    const amount = Number(dto.amount);
    const discount = Number(dto.discount || 0);

    let linkedOrderCode: string | null = null;

    if (dto.orderId) {
      const order = await this.prisma.order.findUnique({
        where: { id: dto.orderId },
      });
      if (order) {
        linkedOrderCode = order.orderCode;
        const currentPaid = Number(order.paidAmount || 0);
        const orderTotal = Number(order.totalAmount || 0);
        const newPaid = currentPaid + amount;
        const newDue = Math.max(0, orderTotal - newPaid);

        await this.prisma.order.update({
          where: { id: dto.orderId },
          data: {
            paidAmount: newPaid,
            dueAmount: newDue,
            paymentStatus: newDue === 0 ? 'PAID' : 'PENDING',
          },
        });
      }
    }

    const payment = await this.prisma.payment.create({
      data: {
        customerId: id,
        orderId: dto.orderId || null,
        amount: new Prisma.Decimal(amount),
        discount: new Prisma.Decimal(discount),
        paymentMethod: dto.paymentMethod,
        paymentChannel: dto.paymentChannel || dto.paymentMethod,
        note: dto.note || null,
      },
    });

    // Log PAYMENT_RECEIVED activity
    const desc = linkedOrderCode
      ? `Payment of ৳${amount.toLocaleString()} received for Order #${linkedOrderCode} via ${dto.paymentMethod}`
      : `Payment of ৳${amount.toLocaleString()} received via ${dto.paymentMethod}`;

    await this.prisma.customerActivity.create({
      data: {
        customerId: id,
        type: CustomerActivityType.PAYMENT_RECEIVED,
        description: desc,
        metadata: {
          paymentId: payment.id,
          amount,
          discount,
          paymentMethod: dto.paymentMethod,
          orderId: dto.orderId || null,
        },
      },
    });

    return payment;
  }

  async getActivities(id: string, page: number = 1, limit: number = 20) {
    const pageNum = Number(page) || 1;
    const limitNum = Number(limit) || 20;
    const skip = (pageNum - 1) * limitNum;

    const [total, activities] = await Promise.all([
      this.prisma.customerActivity.count({ where: { customerId: id } }),
      this.prisma.customerActivity.findMany({
        where: { customerId: id },
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    // If no activities logged yet (e.g. legacy customer), backfill from orders and customer creation
    if (total === 0) {
      const customer = await this.prisma.customer.findUnique({
        where: { id },
        include: {
          orders: {
            orderBy: { createdAt: 'desc' },
            take: 10,
          },
        },
      });

      if (customer) {
        const reconstructed: Array<{
          id: string;
          type: string;
          description: string;
          createdAt: Date;
        }> = [];

        for (const ord of customer.orders) {
          reconstructed.push({
            id: `ord-${ord.id}`,
            type: 'ORDER_PLACED',
            description: `Order #${ord.orderCode} placed (৳${Number(ord.totalAmount).toLocaleString()})`,
            createdAt: ord.createdAt,
          });
        }

        reconstructed.push({
          id: `reg-${customer.id}`,
          type: 'REGISTERED',
          description: `Customer account registered via ${customer.source || 'Walk-In'}`,
          createdAt: customer.createdAt,
        });

        return {
          data: reconstructed,
          total: reconstructed.length,
          page: 1,
          limit: limitNum,
          totalPages: 1,
        };
      }
    }

    return {
      data: activities,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum) || 1,
    };
  }

  async getAddresses(customerId: string) {
    return this.prisma.address.findMany({
      where: { customerId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async createAddress(customerId: string, dto: CustomerAddressDto) {
    if (dto.isDefault) {
      await this.prisma.address.updateMany({
        where: { customerId },
        data: { isDefault: false },
      });
    }

    const address = await this.prisma.address.create({
      data: {
        customerId,
        fullName: dto.fullName.trim(),
        phone: dto.phone.trim(),
        email: dto.email ? dto.email.trim() : null,
        fullAddress: dto.fullAddress.trim(),
        label: dto.label?.trim() || null,
        tag: dto.tag || 'HOME',
        isDefault: Boolean(dto.isDefault),
      },
    });

    await this.prisma.customerActivity.create({
      data: {
        customerId,
        type: CustomerActivityType.ADDRESS_UPDATED,
        description: `New shipping address added: ${address.fullAddress}`,
      },
    });

    return address;
  }

  async updateAddress(
    customerId: string,
    addressId: string,
    dto: Partial<CustomerAddressDto>,
  ) {
    const existing = await this.prisma.address.findFirst({
      where: { id: addressId, customerId },
    });
    if (!existing) {
      throw new NotFoundException(
        `Address with ID "${addressId}" not found for customer.`,
      );
    }

    if (dto.isDefault) {
      await this.prisma.address.updateMany({
        where: { customerId },
        data: { isDefault: false },
      });
    }

    const updated = await this.prisma.address.update({
      where: { id: addressId },
      data: {
        fullName: dto.fullName !== undefined ? dto.fullName.trim() : undefined,
        phone: dto.phone !== undefined ? dto.phone.trim() : undefined,
        email:
          dto.email !== undefined
            ? dto.email
              ? dto.email.trim()
              : null
            : undefined,
        fullAddress:
          dto.fullAddress !== undefined ? dto.fullAddress.trim() : undefined,
        label:
          dto.label !== undefined
            ? dto.label
              ? dto.label.trim()
              : null
            : undefined,
        tag: dto.tag !== undefined ? dto.tag : undefined,
        isDefault:
          dto.isDefault !== undefined ? Boolean(dto.isDefault) : undefined,
      },
    });

    await this.prisma.customerActivity.create({
      data: {
        customerId,
        type: CustomerActivityType.ADDRESS_UPDATED,
        description: `Shipping address updated: ${updated.fullAddress}`,
      },
    });

    return updated;
  }

  async deleteAddress(customerId: string, addressId: string) {
    const existing = await this.prisma.address.findFirst({
      where: { id: addressId, customerId },
    });
    if (!existing) {
      throw new NotFoundException(
        `Address with ID "${addressId}" not found for customer.`,
      );
    }

    return this.prisma.address.delete({ where: { id: addressId } });
  }
}
