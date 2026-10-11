import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateBannerDto,
  UpdateBannerDto,
  ReorderBannersDto,
} from './dto/banner.dto';
import { Prisma, StaffStatus } from '@prisma/client';
import { storageService } from '../common/upload/storage.service';

@Injectable()
export class BannerService {
  constructor(private prisma: PrismaService) {}

  async findAll(query?: { status?: StaffStatus; search?: string }) {
    const where: Prisma.BannerWhereInput = {};
    if (query?.status) where.status = query.status;
    if (query?.search?.trim()) {
      where.title = { contains: query.search.trim(), mode: 'insensitive' };
    }

    return this.prisma.banner.findMany({
      where,
      orderBy: { sortOrder: 'asc' },
    });
  }

  async findActive() {
    const now = new Date();
    return this.prisma.banner.findMany({
      where: {
        status: StaffStatus.ACTIVE,
        AND: [
          { OR: [{ startDate: null }, { startDate: { lte: now } }] },
          { OR: [{ endDate: null }, { endDate: { gte: now } }] },
        ],
      },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async findOne(id: string) {
    const banner = await this.prisma.banner.findUnique({ where: { id } });
    if (!banner)
      throw new NotFoundException(`Banner with ID "${id}" not found.`);
    return banner;
  }

  async create(dto: CreateBannerDto) {
    return this.prisma.banner.create({
      data: {
        imageUrl: dto.imageUrl!,
        title: dto.title || null,
        linkUrl: dto.linkUrl || '#',
        sortOrder: dto.sortOrder !== undefined ? dto.sortOrder : 0,
        startDate: dto.startDate ? new Date(dto.startDate) : null,
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        status: dto.status || StaffStatus.ACTIVE,
      },
    });
  }

  async update(id: string, dto: UpdateBannerDto) {
    await this.findOne(id);
    return this.prisma.banner.update({
      where: { id },
      data: {
        imageUrl: dto.imageUrl,
        title: dto.title !== undefined ? dto.title || null : undefined,
        linkUrl: dto.linkUrl,
        sortOrder: dto.sortOrder,
        startDate:
          dto.startDate !== undefined
            ? dto.startDate
              ? new Date(dto.startDate)
              : null
            : undefined,
        endDate:
          dto.endDate !== undefined
            ? dto.endDate
              ? new Date(dto.endDate)
              : null
            : undefined,
        status: dto.status,
      },
    });
  }

  async reorder(dto: ReorderBannersDto) {
    return this.prisma.$transaction(
      dto.bannerIds.map((id, index) =>
        this.prisma.banner.update({
          where: { id },
          data: { sortOrder: index },
        }),
      ),
    );
  }

  async remove(id: string) {
    const banner = await this.findOne(id);
    if (banner.imageUrl) {
      await storageService.safeUnlink(banner.imageUrl);
    }
    return this.prisma.banner.delete({ where: { id } });
  }
}
