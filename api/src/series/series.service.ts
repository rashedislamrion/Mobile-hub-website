import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSeriesDto } from './dto/create-series.dto';
import { UpdateSeriesDto } from './dto/update-series.dto';

@Injectable()
export class SeriesService {
  constructor(private prisma: PrismaService) {}

  async findAll(brandId?: string) {
    return this.prisma.series.findMany({
      where: brandId ? { brandId } : {},
      include: {
        brand: {
          select: { id: true, name: true },
        },
        _count: {
          select: { products: true },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const series = await this.prisma.series.findUnique({
      where: { id },
      include: {
        brand: true,
        _count: {
          select: { products: true },
        },
      },
    });

    if (!series) {
      throw new NotFoundException(`Series with ID "${id}" not found`);
    }

    return series;
  }

  async create(dto: CreateSeriesDto) {
    const brand = await this.prisma.brand.findUnique({
      where: { id: dto.brandId },
    });
    if (!brand) {
      throw new NotFoundException(`Brand with ID "${dto.brandId}" not found`);
    }

    return this.prisma.series.create({
      data: {
        name: dto.name,
        brandId: dto.brandId,
        status: dto.status || 'ACTIVE',
      },
      include: {
        brand: true,
      },
    });
  }

  async update(id: string, dto: UpdateSeriesDto) {
    await this.findOne(id);

    if (dto.brandId) {
      const brand = await this.prisma.brand.findUnique({
        where: { id: dto.brandId },
      });
      if (!brand) {
        throw new NotFoundException(`Brand with ID "${dto.brandId}" not found`);
      }
    }

    return this.prisma.series.update({
      where: { id },
      data: dto,
      include: {
        brand: true,
      },
    });
  }

  async remove(id: string) {
    const series = await this.prisma.series.findUnique({
      where: { id },
      include: {
        _count: { select: { products: true } },
      },
    });

    if (!series) {
      throw new NotFoundException(`Series with ID "${id}" not found`);
    }

    if (series._count.products > 0) {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        message: `Cannot delete series "${series.name}". It is linked to ${series._count.products} product(s). Please reassign or delete them first, or deactivate the series.`,
        canDeactivate: true,
        blockers: { products: series._count.products },
      });
    }

    return this.prisma.series.delete({
      where: { id },
    });
  }
}
