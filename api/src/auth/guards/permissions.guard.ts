import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import {
  PERMISSION_KEY,
  RequiredPermission,
} from '../decorators/require-permission.decorator';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { ModuleName } from '@prisma/client';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.get<RequiredPermission>(
      PERMISSION_KEY,
      context.getHandler(),
    );
    if (!required) return true; // no @RequirePermission decorator = public within auth

    const request = context.switchToHttp().getRequest();
    const user = request.user as JwtPayload; // set by JwtAuthGuard/JwtAccessStrategy

    // STEP 1: token already decoded by JwtAccessStrategy — user.roleId is the role
    if (!user || user.userType !== 'STAFF' || !user.roleId) {
      throw new ForbiddenException('Staff access required for this resource.');
    }

    // STEP 2: check RolePermission for this module+action
    const permission = await this.prisma.rolePermission.findUnique({
      where: {
        roleId_module_action: {
          roleId: user.roleId,
          module: required.module,
          action: required.action,
        },
      },
    });
    if (!permission?.allowed) {
      throw new ForbiddenException(
        `Your role does not have ${required.action} permission on ${required.module}.`,
      );
    }

    const role = await this.prisma.role.findUnique({
      where: { id: user.roleId },
    });

    // STEP 2.5: Restrict global-only modules (Business Settings, CMS, Third Party Config) to GLOBAL scope
    const GLOBAL_ONLY_MODULES: ModuleName[] = [
      ModuleName.BUSINESS_SETTINGS,
      ModuleName.CMS,
      ModuleName.THIRD_PARTY_CONFIG,
    ];
    if (
      GLOBAL_ONLY_MODULES.includes(required.module) &&
      role?.scope !== 'GLOBAL'
    ) {
      throw new ForbiddenException(
        'Access restricted: Only Global Administrators can access or modify system-wide settings.',
      );
    }
    // STEP 3: Branch scoping check for client-sent branch header/query
    const requestedBranch =
      (request.headers['x-branch-id'] as string) ||
      (request.query?.branch as string) ||
      (request.query?.branchId as string);

    if (
      requestedBranch &&
      requestedBranch !== 'ALL' &&
      role?.scope !== 'GLOBAL'
    ) {
      const isPrimary = user.branchId === requestedBranch;
      if (!isPrimary) {
        const staffAccess = await this.prisma.staffBranchAccess.findFirst({
          where: {
            staffId: user.sub,
            branchId: requestedBranch,
          },
        });
        if (!staffAccess) {
          throw new ForbiddenException(
            'You do not have access to the selected branch.',
          );
        }
      }
    }

    const BRANCH_SCOPED_MODULES: ModuleName[] = [
      ModuleName.ORDERS,
      ModuleName.PURCHASE,
      ModuleName.EXPENSE,
      ModuleName.SALES,
      ModuleName.SALES_RETURNS,
      ModuleName.EXCHANGES,
      ModuleName.STOCK_ADJUSTMENTS,
      ModuleName.REPORT,
      ModuleName.HRM,
    ];

    // Auto-propagate header x-branch-id to query.branch ONLY for branch-scoped modules
    if (
      BRANCH_SCOPED_MODULES.includes(required.module) &&
      request.headers['x-branch-id'] &&
      !request.query?.branch
    ) {
      if (!request.query) request.query = {};
      request.query.branch = request.headers['x-branch-id'];
    }

    if (role?.scope === 'OWN_BRANCH' && required.branchParam) {
      const targetBranchId =
        request.params?.[required.branchParam] ??
        request.body?.[required.branchParam] ??
        request.query?.[required.branchParam];
      if (targetBranchId && targetBranchId !== user.branchId) {
        // Check if role has explicit RoleBranchPermission with canAccess: true
        const branchPerm = await this.prisma.roleBranchPermission.findUnique({
          where: {
            roleId_branchId: {
              roleId: user.roleId,
              branchId: targetBranchId,
            },
          },
        });
        if (!branchPerm || !branchPerm.canAccess) {
          throw new ForbiddenException(
            'You can only access data belonging to your own branch or explicitly authorized branches.',
          );
        }
      }
    }
    // OWN_DATA scope (e.g. Customer Service seeing only tickets assigned to them)
    // should be enforced at the SERVICE layer via a query filter, not here — note
    // this clearly in a code comment so future modules know the pattern:
    // Guard = "can they call this endpoint at all + branch check".
    // Service layer = "which specific ROWS do they see" for OWN_DATA scope.

    // STEP 4: all checks passed
    return true;
  }
}
