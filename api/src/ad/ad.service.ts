import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAdDto, UpdateAdDto, TrackAdDto } from './dto/ad.dto';
import { AdPlacement, Prisma, PromoAdStatus } from '@prisma/client';
import { storageService } from '../common/upload/storage.service';

@Injectable()
export class AdService {
  constructor(private prisma: PrismaService) {}

  async findAll(query?: {
    placement?: AdPlacement;
    status?: PromoAdStatus;
    search?: string;
  }) {
    const where: Prisma.AdWhereInput = {};
    if (query?.placement) where.placement = query.placement;
    if (query?.status) where.status = query.status;
    if (query?.search?.trim()) {
      where.title = { contains: query.search.trim(), mode: 'insensitive' };
    }

    return this.prisma.ad.findMany({
      where,
      orderBy: { startDate: 'desc' },
    });
  }

  async findActive(placement?: AdPlacement) {
    const now = new Date();
    const where: Prisma.AdWhereInput = {
      status: PromoAdStatus.ACTIVE,
      isFeatured: true,
      AND: [
        { OR: [{ startDate: null }, { startDate: { lte: now } }] },
        { OR: [{ endDate: null }, { endDate: { gte: now } }] },
      ],
    };

    if (placement) {
      where.placement = placement;
    }

    return this.prisma.ad.findMany({
      where,
      take: 2,
      orderBy: { startDate: 'desc' },
    });
  }

  async findOne(id: string) {
    const ad = await this.prisma.ad.findUnique({ where: { id } });
    if (!ad) throw new NotFoundException(`Ad with ID "${id}" not found.`);
    return ad;
  }

  async create(dto: CreateAdDto) {
    const isFeatured = Boolean(dto.isFeatured);
    const status = dto.status || PromoAdStatus.ACTIVE;

    if (isFeatured && status === PromoAdStatus.ACTIVE) {
      const activeFeaturedCount = await this.prisma.ad.count({
        where: {
          isFeatured: true,
          status: PromoAdStatus.ACTIVE,
        },
      });
      if (activeFeaturedCount >= 2) {
        throw new BadRequestException(
          'Maximum 2 featured ads allowed on homepage. Please unfeature another ad first.',
        );
      }
    }

    const imageUrl = dto.imageUrl || dto.thumbnailUrl || '';
    if (!imageUrl) {
      throw new BadRequestException('Thumbnail image is required.');
    }

    return this.prisma.ad.create({
      data: {
        imageUrl,
        title: dto.title,
        description: dto.description || null,
        placement: dto.placement || AdPlacement.HOMEPAGE_SIDEBAR,
        linkUrl: dto.linkUrl || '#',
        mobileThumbnailUrl: dto.mobileThumbnailUrl || null,
        isFeatured,
        startDate: dto.startDate ? new Date(dto.startDate) : null,
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        status,
      },
    });
  }

  async update(id: string, dto: UpdateAdDto) {
    const existing = await this.findOne(id);
    const willBeFeatured =
      dto.isFeatured !== undefined
        ? Boolean(dto.isFeatured)
        : existing.isFeatured;
    const willBeActive =
      dto.status !== undefined
        ? dto.status === PromoAdStatus.ACTIVE
        : existing.status === PromoAdStatus.ACTIVE;

    if (willBeFeatured && willBeActive) {
      const otherActiveFeaturedCount = await this.prisma.ad.count({
        where: {
          id: { not: id },
          isFeatured: true,
          status: PromoAdStatus.ACTIVE,
        },
      });
      if (otherActiveFeaturedCount >= 2) {
        throw new BadRequestException(
          'Maximum 2 featured ads allowed on homepage. Please unfeature another ad first.',
        );
      }
    }

    const imageUrl =
      dto.imageUrl !== undefined
        ? dto.imageUrl
        : dto.thumbnailUrl !== undefined
          ? dto.thumbnailUrl
          : undefined;

    return this.prisma.ad.update({
      where: { id },
      data: {
        imageUrl,
        title: dto.title,
        description:
          dto.description !== undefined ? dto.description || null : undefined,
        placement: dto.placement,
        linkUrl: dto.linkUrl,
        mobileThumbnailUrl:
          dto.mobileThumbnailUrl !== undefined
            ? dto.mobileThumbnailUrl || null
            : undefined,
        isFeatured:
          dto.isFeatured !== undefined ? Boolean(dto.isFeatured) : undefined,
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

  async track(id: string, dto: TrackAdDto) {
    const ad = await this.findOne(id);
    return this.prisma.ad.update({
      where: { id },
      data: {
        impressions: dto.type === 'impression' ? ad.impressions + 1 : undefined,
        clicks: dto.type === 'click' ? ad.clicks + 1 : undefined,
      },
    });
  }

  async remove(id: string) {
    const ad = await this.findOne(id);
    if (ad.imageUrl) {
      await storageService.safeUnlink(ad.imageUrl);
    }
    if (ad.mobileThumbnailUrl) {
      await storageService.safeUnlink(ad.mobileThumbnailUrl);
    }
    return this.prisma.ad.delete({ where: { id } });
  }
}
