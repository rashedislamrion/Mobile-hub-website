import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { Prisma } from '@prisma/client';

export interface UserBranchScope {
  isGlobal: boolean;
  allowedBranchIds: string[];
  primaryBranchId?: string | null;
}

@Injectable()
export class BranchScopeService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resolves the branch scope for the authenticated user.
   * Super Admins (role scope GLOBAL) have global access.
   * Branch staff have access to primary branch + every StaffBranchAccess record.
   */
  async resolveScope(user?: JwtPayload | null): Promise<UserBranchScope> {
    if (!user || user.userType !== 'STAFF' || !user.sub) {
      return { isGlobal: false, allowedBranchIds: [] };
    }

    const staff = await this.prisma.staff.findUnique({
      where: { id: user.sub },
      include: {
        role: true,
        branchAccess: true,
      },
    });

    if (!staff) {
      return { isGlobal: false, allowedBranchIds: [] };
    }

    if (staff.role?.scope === 'GLOBAL') {
      return {
        isGlobal: true,
        allowedBranchIds: [],
        primaryBranchId: staff.branchId,
      };
    }

    const branchSet = new Set<string>();
    if (staff.branchId) {
      branchSet.add(staff.branchId);
    }
    if (staff.branchAccess && Array.isArray(staff.branchAccess)) {
      for (const access of staff.branchAccess) {
        if (access.branchId) {
          branchSet.add(access.branchId);
        }
      }
    }

    return {
      isGlobal: false,
      allowedBranchIds: Array.from(branchSet),
      primaryBranchId: staff.branchId,
    };
  }

  /**
   * Resolves the Prisma branch filter for list queries.
   * Handles requested selection, enforces allowed branches, and defaults non-global
   * users without selection to ALL allowed branches (not first branch).
   */
  async getBranchFilter(
    user?: JwtPayload | null,
    requestedBranchId?: string | null,
  ): Promise<Prisma.StringFilter | string | undefined> {
    const scope = await this.resolveScope(user);

    if (scope.isGlobal) {
      if (requestedBranchId && requestedBranchId !== 'ALL') {
        return requestedBranchId;
      }
      return undefined;
    }

    if (requestedBranchId && requestedBranchId !== 'ALL') {
      if (!scope.allowedBranchIds.includes(requestedBranchId)) {
        throw new ForbiddenException(
          'You do not have access to the selected branch.',
        );
      }
      return requestedBranchId;
    }

    // Non-global with no branch selection: scope to ALL allowed branches
    if (scope.allowedBranchIds.length === 0) {
      return { in: [] };
    }
    if (scope.allowedBranchIds.length === 1) {
      return scope.allowedBranchIds[0];
    }
    return { in: scope.allowedBranchIds };
  }

  /**
   * Validates access to an existing branch-scoped record by ID.
   * Throws 404 to prevent IDOR leaks if unauthorized or if legacy row has null branchId.
   */
  async validateBranchAccess(
    user?: JwtPayload | null,
    recordBranchId?: string | null,
  ): Promise<void> {
    if (!user) return;
    const scope = await this.resolveScope(user);
    if (scope.isGlobal) return;

    if (!recordBranchId) {
      // D6: Legacy rows that stay null are visible only to GLOBAL-scope roles
      throw new NotFoundException('Record not found.');
    }

    if (!scope.allowedBranchIds.includes(recordBranchId)) {
      throw new NotFoundException('Record not found.');
    }
  }

  /**
   * Validates and returns the branchId to stamp on new record creation.
   * Non-global users with single branch auto-stamp; multiple branches must select one.
   * Removes all arbitrary branch.findFirst() fallbacks.
   */
  async determineCreateBranchId(
    user?: JwtPayload | null,
    requestedBranchId?: string | null,
  ): Promise<string> {
    const scope = await this.resolveScope(user);

    if (scope.isGlobal) {
      if (requestedBranchId && requestedBranchId !== 'ALL') {
        const branch = await this.prisma.branch.findUnique({
          where: { id: requestedBranchId },
        });
        if (!branch) {
          throw new BadRequestException('Selected branch does not exist.');
        }
        return branch.id;
      }

      if (scope.primaryBranchId) {
        return scope.primaryBranchId;
      }

      const defaultBranch = await this.prisma.branch.findFirst({
        where: { status: 'ACTIVE' },
        orderBy: { createdAt: 'asc' },
      });
      if (!defaultBranch) {
        throw new BadRequestException('No active branch found in system.');
      }
      return defaultBranch.id;
    }

    if (requestedBranchId && requestedBranchId !== 'ALL') {
      if (!scope.allowedBranchIds.includes(requestedBranchId)) {
        throw new ForbiddenException(
          'You cannot create records for a branch you do not have access to.',
        );
      }
      return requestedBranchId;
    }

    if (scope.allowedBranchIds.length === 1) {
      return scope.allowedBranchIds[0];
    }
    if (scope.allowedBranchIds.length > 1) {
      throw new BadRequestException(
        'Please select a branch to create this record in.',
      );
    }

    throw new ForbiddenException('You are not assigned to any branch.');
  }
}
