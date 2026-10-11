import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBlogDto, UpdateBlogDto } from './dto/blog.dto';
import { ContentStatus, Prisma } from '@prisma/client';
import { storageService } from '../common/upload/storage.service';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

@Injectable()
export class BlogService {
  constructor(private prisma: PrismaService) {}

  async findPublished(query?: {
    tag?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, Number(query?.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(query?.limit) || 10));
    const skip = (page - 1) * limit;

    const where: Prisma.BlogWhereInput = {
      status: ContentStatus.PUBLISHED,
    };

    if (query?.tag) {
      where.categoryTags = { has: query.tag };
    }

    if (query?.search?.trim()) {
      where.OR = [
        { title: { contains: query.search.trim(), mode: 'insensitive' } },
        { excerpt: { contains: query.search.trim(), mode: 'insensitive' } },
      ];
    }

    const [total, data] = await Promise.all([
      this.prisma.blog.count({ where }),
      this.prisma.blog.findMany({
        where,
        include: {
          author: { select: { id: true, name: true } },
        },
        orderBy: { publishedAt: 'desc' },
        skip,
        take: limit,
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

  async findBySlug(slug: string) {
    const blog = await this.prisma.blog.findFirst({
      where: {
        slug,
        status: ContentStatus.PUBLISHED,
      },
      include: {
        author: { select: { id: true, name: true } },
      },
    });

    if (!blog)
      throw new NotFoundException(`Blog post with slug "${slug}" not found.`);

    // Increment view count
    await this.prisma.blog.update({
      where: { id: blog.id },
      data: { views: { increment: 1 } },
    });

    return { ...blog, views: blog.views + 1 };
  }

  async findAdminAll(query?: {
    status?: ContentStatus;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, Number(query?.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query?.limit) || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.BlogWhereInput = {};
    if (query?.status) where.status = query.status;
    if (query?.search?.trim()) {
      where.OR = [
        { title: { contains: query.search.trim(), mode: 'insensitive' } },
        { excerpt: { contains: query.search.trim(), mode: 'insensitive' } },
      ];
    }

    const [total, data] = await Promise.all([
      this.prisma.blog.count({ where }),
      this.prisma.blog.findMany({
        where,
        include: {
          author: { select: { id: true, name: true } },
          category: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
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

  async findAllCategories() {
    return this.prisma.blogCategory.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { blogs: true } },
      },
    });
  }

  async createCategory(name: string) {
    const trimmed = (name || '').trim();
    if (!trimmed) {
      throw new ConflictException('Category name cannot be empty');
    }
    const existing = await this.prisma.blogCategory.findUnique({
      where: { name: trimmed },
    });
    if (existing) {
      return existing;
    }
    return this.prisma.blogCategory.create({
      data: { name: trimmed },
    });
  }

  async findOne(id: string) {
    const blog = await this.prisma.blog.findUnique({
      where: { id },
      include: {
        author: { select: { id: true, name: true } },
        category: { select: { id: true, name: true } },
      },
    });
    if (!blog) throw new NotFoundException(`Blog with ID "${id}" not found.`);
    return blog;
  }

  async create(dto: CreateBlogDto, staffId?: string) {
    const baseSlug = dto.slug ? slugify(dto.slug) : slugify(dto.title);
    let finalSlug = baseSlug;
    let count = 1;
    while (await this.prisma.blog.findUnique({ where: { slug: finalSlug } })) {
      finalSlug = `${baseSlug}-${count}`;
      count++;
    }

    const excerpt =
      dto.excerpt ||
      (dto.content
        ? dto.content.replace(/<[^>]*>?/gm, '').slice(0, 160)
        : null);

    return this.prisma.blog.create({
      data: {
        title: dto.title,
        slug: finalSlug,
        excerpt,
        content: dto.content,
        featuredImage:
          dto.featuredImage || dto.coverImage || dto.thumbnailUrl || null,
        authorId: dto.authorId || staffId || null,
        categoryId: dto.categoryId || null,
        tags: dto.tags || dto.categoryTags || [],
        status: dto.status || ContentStatus.DRAFT,
        publishedAt:
          dto.status === ContentStatus.PUBLISHED
            ? dto.publishedAt
              ? new Date(dto.publishedAt)
              : new Date()
            : dto.publishedAt
              ? new Date(dto.publishedAt)
              : null,
        metaTitle: dto.metaTitle || null,
        metaDescription: dto.metaDescription || null,
        metaKeywords: dto.metaKeywords || null,
        categoryTags: dto.tags || dto.categoryTags || [],
      },
      include: {
        author: { select: { id: true, name: true } },
        category: { select: { id: true, name: true } },
      },
    });
  }

  async update(id: string, dto: UpdateBlogDto) {
    const blog = await this.findOne(id);

    let finalSlug: string | undefined = undefined;
    if (dto.slug && dto.slug !== blog.slug) {
      finalSlug = slugify(dto.slug);
      const existing = await this.prisma.blog.findFirst({
        where: { slug: finalSlug, NOT: { id } },
      });
      if (existing)
        throw new ConflictException(`Slug "${finalSlug}" is already taken.`);
    }

    const tags = dto.tags !== undefined ? dto.tags : dto.categoryTags;

    return this.prisma.blog.update({
      where: { id },
      data: {
        title: dto.title,
        slug: finalSlug,
        excerpt: dto.excerpt,
        content: dto.content,
        featuredImage: dto.featuredImage,
        authorId: dto.authorId,
        categoryId: dto.categoryId !== undefined ? dto.categoryId : undefined,
        tags: tags !== undefined ? tags : undefined,
        status: dto.status,
        publishedAt:
          dto.status === ContentStatus.PUBLISHED && !blog.publishedAt
            ? new Date()
            : dto.publishedAt
              ? new Date(dto.publishedAt)
              : undefined,
        metaTitle: dto.metaTitle,
        metaDescription: dto.metaDescription,
        metaKeywords: dto.metaKeywords,
        categoryTags: tags !== undefined ? tags : undefined,
      },
      include: {
        author: { select: { id: true, name: true } },
        category: { select: { id: true, name: true } },
      },
    });
  }

  async remove(id: string) {
    const blog = await this.findOne(id);
    if (blog.featuredImage) {
      await storageService.safeUnlink(blog.featuredImage);
    }
    return this.prisma.blog.delete({ where: { id } });
  }
}
