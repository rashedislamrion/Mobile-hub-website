import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { slugify } from '../common/utils/slug.util';
import { Prisma, StaffStatus } from '@prisma/client';
import { resolveUploadedFile } from '../common/upload/multer.config';
import { storageService } from '../common/upload/storage.service';

@Injectable()
export class CategoryService {
  constructor(private prisma: PrismaService) {}

  async getTree() {
    const categories = await this.prisma.category.findMany({
      where: { status: StaffStatus.ACTIVE },
      include: {
        _count: {
          select: { products: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    const categoryMap = new Map<string, any>();
    categories.forEach((cat) => {
      categoryMap.set(cat.id, { ...cat, children: [] });
    });

    const tree: any[] = [];
    categories.forEach((cat) => {
      const node = categoryMap.get(cat.id);
      if (cat.parentId && categoryMap.has(cat.parentId)) {
        categoryMap.get(cat.parentId).children.push(node);
      } else {
        tree.push(node);
      }
    });

    return tree;
  }

  async findAll(parentId?: string) {
    const where: Prisma.CategoryWhereInput = {};
    if (parentId !== undefined) {
      where.parentId = parentId === 'null' || parentId === '' ? null : parentId;
    }

    return this.prisma.category.findMany({
      where,
      include: {
        parent: {
          select: { id: true, name: true, slug: true },
        },
        _count: {
          select: { products: true, children: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const category = await this.prisma.category.findFirst({
      where: {
        OR: [{ id }, { slug: id }],
      },
      include: {
        parent: true,
        children: true,
        _count: {
          select: { products: true },
        },
      },
    });

    if (!category) {
      throw new NotFoundException(`Category with ID or slug "${id}" not found`);
    }

    return category;
  }

  async create(dto: CreateCategoryDto, file?: Express.Multer.File) {
    let slug = dto.slug ? slugify(dto.slug) : slugify(dto.name);
    if (!slug) {
      slug = `category-${Date.now()}`;
    }

    const imagePath = file
      ? (await resolveUploadedFile(file, 'categories')) ||
        `/uploads/categories/${file.filename}`
      : dto.image || null;
    const parentId =
      dto.parentId && dto.parentId !== 'null' && dto.parentId !== ''
        ? dto.parentId
        : null;

    try {
      return await this.prisma.category.create({
        data: {
          name: dto.name,
          slug,
          parentId,
          icon: dto.icon || null,
          image: imagePath,
          altTag: dto.altTag || null,
          description: dto.description || null,
          isGadget: dto.isGadget !== undefined ? dto.isGadget : false,
          featured: dto.featured !== undefined ? dto.featured : false,
          metaTitle: dto.metaTitle || null,
          metaDescription: dto.metaDescription || null,
          status: dto.status || StaffStatus.ACTIVE,
        },
        include: {
          parent: true,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          `Category slug "${slug}" already exists. Please choose a different name or slug.`,
        );
      }
      throw error;
    }
  }

  async update(id: string, dto: UpdateCategoryDto, file?: Express.Multer.File) {
    await this.findOne(id);

    const data: Prisma.CategoryUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.slug !== undefined) data.slug = slugify(dto.slug);
    if (dto.icon !== undefined) data.icon = dto.icon;
    if (dto.altTag !== undefined) data.altTag = dto.altTag || null;
    if (dto.description !== undefined)
      data.description = dto.description || null;
    if (dto.isGadget !== undefined) data.isGadget = dto.isGadget;
    if (dto.featured !== undefined) data.featured = dto.featured;
    if (dto.metaTitle !== undefined) data.metaTitle = dto.metaTitle || null;
    if (dto.metaDescription !== undefined)
      data.metaDescription = dto.metaDescription || null;
    if (dto.status !== undefined) data.status = dto.status;

    if (file) {
      data.image =
        (await resolveUploadedFile(file, 'categories')) ||
        `/uploads/categories/${file.filename}`;
    } else if (dto.image !== undefined) {
      data.image = dto.image;
    }

    if (dto.parentId !== undefined) {
      if (
        dto.parentId === 'null' ||
        dto.parentId === '' ||
        dto.parentId === null
      ) {
        data.parent = { disconnect: true };
      } else {
        if (dto.parentId === id) {
          throw new ConflictException('A category cannot be its own parent.');
        }
        data.parent = { connect: { id: dto.parentId } };
      }
    }

    try {
      return await this.prisma.category.update({
        where: { id },
        data,
        include: {
          parent: true,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(`Category slug already exists.`);
      }
      throw error;
    }
  }

  async remove(id: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: {
        _count: {
          select: { children: true, products: true },
        },
      },
    });

    if (!category) {
      throw new NotFoundException(`Category with ID "${id}" not found`);
    }

    const blockers: string[] = [];
    if (category._count.children > 0) {
      blockers.push(`${category._count.children} subcategory/subcategories`);
    }
    if (category._count.products > 0) {
      blockers.push(`${category._count.products} linked product(s)`);
    }

    if (blockers.length > 0) {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        message: `Cannot delete category "${category.name}". It has ${blockers.join(' and ')}. Please reassign or delete them first, or deactivate the category.`,
        canDeactivate: true,
        blockers: {
          subcategories: category._count.children,
          products: category._count.products,
        },
      });
    }

    if (category.image) {
      await storageService.safeUnlink(category.image);
    }
    if (category.icon) {
      await storageService.safeUnlink(category.icon);
    }

    return this.prisma.category.delete({
      where: { id },
    });
  }

  async removeBulk(ids: string[]) {
    if (!ids || ids.length === 0) {
      return { count: 0 };
    }

    const categories = await this.prisma.category.findMany({
      where: { id: { in: ids } },
      include: {
        children: true,
        products: { select: { id: true } },
      },
    });

    if (categories.length === 0) {
      return { count: 0 };
    }

    const conflicts: string[] = [];
    categories.forEach((cat) => {
      const issues: string[] = [];
      const unselectedChildren = cat.children.filter(
        (ch) => !ids.includes(ch.id),
      );
      if (unselectedChildren.length > 0) {
        issues.push(
          `${unselectedChildren.length} child category(ies) not selected for deletion`,
        );
      }
      if (cat.products.length > 0) {
        issues.push(`${cat.products.length} linked product(s)`);
      }
      if (issues.length > 0) {
        conflicts.push(`"${cat.name}" has ${issues.join(' and ')}`);
      }
    });

    if (conflicts.length > 0) {
      throw new ConflictException(
        `Cannot delete selected categories: ${conflicts.join(', ')}. Please remove or reassign them first.`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.category.updateMany({
        where: { id: { in: ids } },
        data: { parentId: null },
      });
      const result = await tx.category.deleteMany({
        where: { id: { in: ids } },
      });
      return { count: result.count };
    });
  }
}
