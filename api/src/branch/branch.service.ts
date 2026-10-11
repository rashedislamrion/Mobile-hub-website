import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { Prisma, StaffStatus } from '@prisma/client';

@Injectable()
export class BranchService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.branch.findMany({
      include: {
        manager: {
          select: { id: true, name: true, email: true, phone: true },
        },
        _count: {
          select: { staff: true, orders: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findPublic() {
    return this.prisma.branch.findMany({
      where: {
        showInFooter: true,
        status: StaffStatus.ACTIVE,
      },
      select: {
        id: true,
        name: true,
        address: true,
        city: true,
        phone: true,
        email: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const branch = await this.prisma.branch.findUnique({
      where: { id },
      include: {
        manager: {
          select: { id: true, name: true, email: true, phone: true },
        },
        staff: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            role: true,
          },
        },
        _count: {
          select: { staff: true, orders: true },
        },
      },
    });

    if (!branch) {
      throw new NotFoundException(`Branch with ID "${id}" not found`);
    }

    return branch;
  }

  async create(dto: CreateBranchDto) {
    try {
      return await this.prisma.branch.create({
        data: {
          name: dto.name,
          code: dto.code.trim().toUpperCase(),
          type: dto.type,
          address: dto.address,
          city: dto.city,
          phone: dto.phone,
          altPhone: dto.altPhone || null,
          email: dto.email || null,
          managerId: dto.managerId || null,
          status: dto.status || StaffStatus.ACTIVE,
          operatingHours: dto.operatingHours || null,
          openingStockValue: dto.openingStockValue
            ? new Prisma.Decimal(dto.openingStockValue)
            : new Prisma.Decimal(0),
          taxRegNumber: dto.taxRegNumber || null,
          showInFooter:
            dto.showInFooter !== undefined ? dto.showInFooter : true,
        },
        include: {
          manager: {
            select: { id: true, name: true },
          },
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          `Branch code "${dto.code}" already exists.`,
        );
      }
      throw error;
    }
  }

  async update(id: string, dto: UpdateBranchDto) {
    const existing = await this.findOne(id);

    // If deactivating, ensure system does not become branchless
    if (dto.status === StaffStatus.INACTIVE && existing.status === StaffStatus.ACTIVE) {
      const activeCount = await this.prisma.branch.count({
        where: { status: StaffStatus.ACTIVE },
      });
      if (activeCount <= 1) {
        throw new ConflictException(
          'Cannot deactivate the only active branch in the system. At least one branch must remain active.',
        );
      }

      // If this branch is the online default, failover to earliest remaining active branch
      if (existing.isOnlineDefault) {
        const nextActive = await this.prisma.branch.findFirst({
          where: { id: { not: id }, status: StaffStatus.ACTIVE },
          orderBy: { createdAt: 'asc' },
        });
        if (nextActive) {
          await this.prisma.branch.update({
            where: { id: nextActive.id },
            data: { isOnlineDefault: true },
          });
        }
      }
    }

    const data: Prisma.BranchUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.code !== undefined) data.code = dto.code.trim().toUpperCase();
    if (dto.type !== undefined) data.type = dto.type;
    if (dto.address !== undefined) data.address = dto.address;
    if (dto.city !== undefined) data.city = dto.city;
    if (dto.phone !== undefined) data.phone = dto.phone;
    if (dto.altPhone !== undefined) data.altPhone = dto.altPhone || null;
    if (dto.email !== undefined) data.email = dto.email || null;
    if (dto.managerId !== undefined) {
      data.manager = dto.managerId
        ? { connect: { id: dto.managerId } }
        : { disconnect: true };
    }
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.operatingHours !== undefined)
      data.operatingHours = dto.operatingHours || null;
    if (dto.openingStockValue !== undefined) {
      data.openingStockValue = new Prisma.Decimal(dto.openingStockValue);
    }
    if (dto.taxRegNumber !== undefined)
      data.taxRegNumber = dto.taxRegNumber || null;
    if (dto.showInFooter !== undefined) data.showInFooter = dto.showInFooter;

    try {
      return await this.prisma.branch.update({
        where: { id },
        data,
        include: {
          manager: {
            select: { id: true, name: true },
          },
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(`Branch code already exists.`);
      }
      throw error;
    }
  }

  async remove(id: string) {
    const branch = await this.prisma.branch.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            staff: true,
            orders: true,
            purchaseOrders: true,
            expenses: true,
            serviceJobs: true,
            inventory: true,
            phoneUnits: true,
            stockAdjustments: true,
            wastedProducts: true,
            walletTransactions: true,
          },
        },
        staff: {
          select: {
            id: true,
            name: true,
            employeeId: true,
            role: { select: { name: true } },
          },
        },
      },
    });

    if (!branch) {
      throw new NotFoundException(`Branch with ID "${id}" not found`);
    }

    // Guard: The last active branch cannot be deleted
    if (branch.status === StaffStatus.ACTIVE) {
      const activeCount = await this.prisma.branch.count({
        where: { status: StaffStatus.ACTIVE },
      });
      if (activeCount <= 1) {
        throw new ConflictException(
          `Cannot delete branch "${branch.name}" because it is the only active branch in the system. At least one branch must remain active.`,
        );
      }
    }

    const blockers: string[] = [];
    const blockerCounts: Record<string, number> = {};

    if (branch._count.staff > 0) {
      blockers.push(`${branch._count.staff} assigned staff member(s)`);
      blockerCounts.staff = branch._count.staff;
    }
    if (branch._count.orders > 0) {
      blockers.push(`${branch._count.orders} order(s)`);
      blockerCounts.orders = branch._count.orders;
    }
    if (branch._count.purchaseOrders > 0) {
      blockers.push(`${branch._count.purchaseOrders} purchase order(s)`);
      blockerCounts.purchaseOrders = branch._count.purchaseOrders;
    }
    if (branch._count.expenses > 0) {
      blockers.push(`${branch._count.expenses} expense(s)`);
      blockerCounts.expenses = branch._count.expenses;
    }
    if (branch._count.serviceJobs > 0) {
      blockers.push(`${branch._count.serviceJobs} service job(s)`);
      blockerCounts.serviceJobs = branch._count.serviceJobs;
    }
    if (branch._count.phoneUnits > 0) {
      blockers.push(`${branch._count.phoneUnits} phone unit(s)`);
      blockerCounts.phoneUnits = branch._count.phoneUnits;
    }
    if (branch._count.inventory > 0) {
      blockers.push(`${branch._count.inventory} inventory record(s)`);
      blockerCounts.inventory = branch._count.inventory;
    }
    if (branch._count.stockAdjustments > 0) {
      blockers.push(`${branch._count.stockAdjustments} stock adjustment(s)`);
      blockerCounts.stockAdjustments = branch._count.stockAdjustments;
    }
    if (branch._count.wastedProducts > 0) {
      blockers.push(`${branch._count.wastedProducts} wasted product(s)`);
      blockerCounts.wastedProducts = branch._count.wastedProducts;
    }
    if (branch._count.walletTransactions > 0) {
      blockers.push(`${branch._count.walletTransactions} wallet transaction(s)`);
      blockerCounts.walletTransactions = branch._count.walletTransactions;
    }

    if (blockers.length > 0) {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        message: `Cannot delete branch "${branch.name}". It has dependent records: ${blockers.join(', ')}. Please deactivate the branch instead.`,
        canDeactivate: true,
        blockers: blockerCounts,
        assignedStaff: branch.staff.map((s) => ({
          id: s.id,
          name: s.name,
          employeeId: s.employeeId,
          role: s.role?.name || 'Staff',
        })),
      });
    }

    return this.prisma.branch.delete({
      where: { id },
    });
  }
}
