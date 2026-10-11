import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoleDto, UpdateRolePermissionsDto } from './dto/role.dto';
import { ModuleName, PermissionAction, PermissionScope } from '@prisma/client';

@Injectable()
export class RoleService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    const roles = await this.prisma.role.findMany({
      orderBy: { isSystem: 'desc' },
      include: {
        _count: {
          select: { staff: true },
        },
        permissions: {
          where: { allowed: true },
          select: { id: true },
        },
      },
    });

    return roles.map((r) => {
      const { permissions, ...rest } = r;
      return {
        ...rest,
        permissionCount: permissions.length,
      };
    });
  }

  async findOne(id: string) {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: {
        _count: { select: { staff: true } },
      },
    });
    if (!role) throw new NotFoundException(`Role with ID "${id}" not found.`);
    return role;
  }

  async getRolePermissions(roleId: string) {
    const role = await this.findOne(roleId);

    const existingPermissions = await this.prisma.rolePermission.findMany({
      where: { roleId },
    });

    const permMap = new Map<string, boolean>();
    for (const p of existingPermissions) {
      permMap.set(`${p.module}_${p.action}`, p.allowed);
    }

    // Build the complete matrix for all ModuleName x PermissionAction
    const allModules = Object.values(ModuleName);
    const allActions = Object.values(PermissionAction);

    const matrix: Array<{
      module: ModuleName;
      action: PermissionAction;
      allowed: boolean;
    }> = [];

    for (const module of allModules) {
      for (const action of allActions) {
        const key = `${module}_${action}`;
        const allowed = permMap.has(key) ? permMap.get(key)! : false;
        matrix.push({ module, action, allowed });
      }
    }

    return {
      role: {
        id: role.id,
        name: role.name,
        description: role.description,
        scope: role.scope,
        isSystem: role.isSystem,
      },
      permissions: matrix,
    };
  }

  async updateRolePermissions(roleId: string, dto: UpdateRolePermissionsDto) {
    await this.findOne(roleId);

    return this.prisma.$transaction(async (tx) => {
      if (dto.scope) {
        await tx.role.update({
          where: { id: roleId },
          data: { scope: dto.scope },
        });
      }

      const upsertPromises = dto.permissions.map((p) =>
        tx.rolePermission.upsert({
          where: {
            roleId_module_action: {
              roleId,
              module: p.module,
              action: p.action,
            },
          },
          update: { allowed: p.allowed },
          create: {
            roleId,
            module: p.module,
            action: p.action,
            allowed: p.allowed,
          },
        }),
      );

      await Promise.all(upsertPromises);

      return {
        success: true,
        message: 'Permissions and scope updated successfully.',
      };
    });
  }

  async create(dto: CreateRoleDto) {
    const existing = await this.prisma.role.findUnique({
      where: { name: dto.name },
    });
    if (existing) {
      throw new ConflictException(
        `Role with name "${dto.name}" already exists.`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const role = await tx.role.create({
        data: {
          name: dto.name,
          description: dto.description || null,
          scope: dto.scope || PermissionScope.GLOBAL,
          isSystem: false,
        },
      });

      if (dto.cloneFromRoleId) {
        const sourcePerms = await tx.rolePermission.findMany({
          where: { roleId: dto.cloneFromRoleId },
        });

        if (sourcePerms.length > 0) {
          await tx.rolePermission.createMany({
            data: sourcePerms.map((p) => ({
              roleId: role.id,
              module: p.module,
              action: p.action,
              allowed: p.allowed,
            })),
          });
        }
      }

      return role;
    });
  }

  async remove(id: string) {
    const role = await this.findOne(id);
    if (role.isSystem) {
      throw new ConflictException('System roles cannot be deleted.');
    }
    if (role._count.staff > 0) {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        message: `Cannot delete role "${role.name}". It has ${role._count.staff} assigned employee(s). Please reassign them before deleting.`,
        blockers: { staff: role._count.staff },
      });
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({ where: { roleId: id } });
      await tx.roleBranchPermission.deleteMany({ where: { roleId: id } });
      return tx.role.delete({ where: { id } });
    });
  }

  async getRoleBranchPermissions(roleId: string) {
    await this.findOne(roleId);

    const [branches, existingRoleBranchPerms] = await Promise.all([
      this.prisma.branch.findMany({
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          code: true,
          type: true,
          address: true,
          city: true,
        },
      }),
      this.prisma.roleBranchPermission.findMany({
        where: { roleId },
      }),
    ]);

    const accessMap = new Map<string, boolean>();
    for (const p of existingRoleBranchPerms) {
      accessMap.set(p.branchId, p.canAccess);
    }

    return branches.map((b) => ({
      branchId: b.id,
      branchName: b.name,
      branchCode: b.code,
      branchType: b.type,
      branchAddress: b.address,
      branchCity: b.city,
      canAccess: accessMap.get(b.id) ?? false,
    }));
  }

  async updateRoleBranchPermissions(
    roleId: string,
    dto: { branchPermissions: Array<{ branchId: string; canAccess: boolean }> },
  ) {
    await this.findOne(roleId);

    return this.prisma.$transaction(async (tx) => {
      const upsertPromises = dto.branchPermissions.map((bp) =>
        tx.roleBranchPermission.upsert({
          where: {
            roleId_branchId: {
              roleId,
              branchId: bp.branchId,
            },
          },
          update: { canAccess: bp.canAccess },
          create: {
            roleId,
            branchId: bp.branchId,
            canAccess: bp.canAccess,
          },
        }),
      );

      await Promise.all(upsertPromises);

      return {
        success: true,
        message: 'Branch permissions updated successfully.',
      };
    });
  }
}
