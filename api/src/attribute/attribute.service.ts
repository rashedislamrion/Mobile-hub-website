import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAttributeDto } from './dto/create-attribute.dto';
import { UpdateAttributeDto } from './dto/update-attribute.dto';
import {
  CreateAttributeValueDto,
  UpdateAttributeValueDto,
} from './dto/attribute-value.dto';
import { Prisma, StaffStatus } from '@prisma/client';

@Injectable()
export class AttributeService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.attribute.findMany({
      include: {
        values: {
          orderBy: { value: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const attribute = await this.prisma.attribute.findUnique({
      where: { id },
      include: {
        values: {
          orderBy: { value: 'asc' },
        },
      },
    });

    if (!attribute) {
      throw new NotFoundException(`Attribute with ID "${id}" not found`);
    }

    return attribute;
  }

  async create(dto: CreateAttributeDto) {
    try {
      return await this.prisma.attribute.create({
        data: {
          name: dto.name,
          isOptional: dto.isOptional ?? false,
          status: dto.status || StaffStatus.ACTIVE,
          values: {
            create: (dto.values || []).map((val) => ({
              value: val,
              status: true,
            })),
          },
        },
        include: {
          values: true,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          `Attribute with name "${dto.name}" already exists.`,
        );
      }
      throw error;
    }
  }

  async update(id: string, dto: UpdateAttributeDto) {
    await this.findOne(id);

    return this.prisma.$transaction(async (tx) => {
      if (dto.values !== undefined) {
        await tx.attributeValue.deleteMany({
          where: { attributeId: id },
        });

        await tx.attributeValue.createMany({
          data: dto.values.map((val) => ({
            attributeId: id,
            value: val,
            status: true,
          })),
        });
      }

      const data: Prisma.AttributeUpdateInput = {};
      if (dto.name !== undefined) data.name = dto.name;
      if (dto.isOptional !== undefined) data.isOptional = dto.isOptional;
      if (dto.status !== undefined) data.status = dto.status;

      return tx.attribute.update({
        where: { id },
        data,
        include: {
          values: {
            orderBy: { value: 'asc' },
          },
        },
      });
    });
  }

  async remove(id: string) {
    const attr = await this.findOne(id);
    const values = await this.prisma.attributeValue.findMany({
      where: { attributeId: id },
      select: { value: true },
    });
    const valueStrings = values.map((v) => v.value);

    let variantUsageCount = 0;
    let specUsageCount = 0;

    if (valueStrings.length > 0) {
      const [vCount, sCount] = await Promise.all([
        this.prisma.productVariant.count({
          where: {
            OR: [
              { color: { in: valueStrings, mode: 'insensitive' } },
              { quality: { in: valueStrings, mode: 'insensitive' } },
            ],
          },
        }),
        this.prisma.productSpecification.count({
          where: {
            OR: [
              { label: { equals: attr.name, mode: 'insensitive' } },
              { value: { in: valueStrings, mode: 'insensitive' } },
            ],
          },
        }),
      ]);
      variantUsageCount = vCount;
      specUsageCount = sCount;
    }

    const totalUsage = variantUsageCount + specUsageCount;
    if (totalUsage > 0) {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        message: `Cannot delete attribute "${attr.name}". It is used by ${variantUsageCount} product variant(s) and ${specUsageCount} specification(s). Please deactivate it instead.`,
        canDeactivate: true,
        blockers: {
          variants: variantUsageCount,
          specifications: specUsageCount,
        },
      });
    }

    return this.prisma.attribute.delete({
      where: { id },
    });
  }

  // =========================================================================
  // Granular Attribute Value Methods
  // =========================================================================

  async findValues(attributeId: string) {
    await this.findOne(attributeId);

    return this.prisma.attributeValue.findMany({
      where: { attributeId },
      orderBy: { value: 'asc' },
    });
  }

  async createValue(attributeId: string, dto: CreateAttributeValueDto) {
    await this.findOne(attributeId);

    const existing = await this.prisma.attributeValue.findFirst({
      where: {
        attributeId,
        value: { equals: dto.value.trim(), mode: 'insensitive' },
      },
    });

    if (existing) {
      throw new ConflictException(
        `Value "${dto.value}" already exists for this attribute.`,
      );
    }

    return this.prisma.attributeValue.create({
      data: {
        attributeId,
        value: dto.value.trim(),
        status: true,
      },
    });
  }

  async updateValue(
    attributeId: string,
    valueId: string,
    dto: UpdateAttributeValueDto,
  ) {
    await this.findOne(attributeId);

    const attrValue = await this.prisma.attributeValue.findUnique({
      where: { id: valueId },
    });

    if (!attrValue || attrValue.attributeId !== attributeId) {
      throw new NotFoundException(
        `Attribute value with ID "${valueId}" not found for this attribute.`,
      );
    }

    if (
      dto.value &&
      dto.value.trim().toLowerCase() !== attrValue.value.toLowerCase()
    ) {
      const duplicate = await this.prisma.attributeValue.findFirst({
        where: {
          attributeId,
          value: { equals: dto.value.trim(), mode: 'insensitive' },
          id: { not: valueId },
        },
      });

      if (duplicate) {
        throw new ConflictException(
          `Value "${dto.value}" already exists for this attribute.`,
        );
      }
    }

    const data: Prisma.AttributeValueUpdateInput = {};
    if (dto.value !== undefined) data.value = dto.value.trim();
    if (dto.status !== undefined) data.status = dto.status;

    return this.prisma.attributeValue.update({
      where: { id: valueId },
      data,
    });
  }

  async removeValue(attributeId: string, valueId: string) {
    await this.findOne(attributeId);

    const attrValue = await this.prisma.attributeValue.findUnique({
      where: { id: valueId },
    });

    if (!attrValue || attrValue.attributeId !== attributeId) {
      throw new NotFoundException(
        `Attribute value with ID "${valueId}" not found for this attribute.`,
      );
    }

    // Check if any product variant is actively using this value
    const [variantUsageCount, specUsageCount] = await Promise.all([
      this.prisma.productVariant.count({
        where: {
          OR: [
            { color: { equals: attrValue.value, mode: 'insensitive' } },
            { quality: { equals: attrValue.value, mode: 'insensitive' } },
          ],
        },
      }),
      this.prisma.productSpecification.count({
        where: {
          value: { equals: attrValue.value, mode: 'insensitive' },
        },
      }),
    ]);

    const totalUsage = variantUsageCount + specUsageCount;
    if (totalUsage > 0) {
      throw new ConflictException(
        `Cannot delete attribute value "${attrValue.value}" because it is currently linked to ${totalUsage} product variant(s)/specification(s).`,
      );
    }

    return this.prisma.attributeValue.delete({
      where: { id: valueId },
    });
  }
}
