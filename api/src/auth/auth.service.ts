import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
  NotFoundException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { RegisterCustomerDto } from './dto/register-customer.dto';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { RefreshToken } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  // Brute-force rate limiting: 5 failed attempts locks out for 60 seconds
  private failedAttempts = new Map<
    string,
    { count: number; firstAttemptAt: number; lockedUntil?: number }
  >();

  private checkFailedAttempts(identifier: string) {
    const key = identifier.toLowerCase().trim();
    const record = this.failedAttempts.get(key);
    if (!record) return;

    const now = Date.now();
    if (record.lockedUntil && now < record.lockedUntil) {
      const remainingSeconds = Math.ceil((record.lockedUntil - now) / 1000);
      throw new HttpException(
        `Too many failed login attempts. Account temporarily locked out. Please try again in ${remainingSeconds}s.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (now - record.firstAttemptAt > 60000 && !record.lockedUntil) {
      this.failedAttempts.delete(key);
    }
  }

  private recordFailedAttempt(identifier: string) {
    const key = identifier.toLowerCase().trim();
    const now = Date.now();
    const record = this.failedAttempts.get(key) || {
      count: 0,
      firstAttemptAt: now,
    };

    if (
      now - record.firstAttemptAt > 60000 &&
      (!record.lockedUntil || now > record.lockedUntil)
    ) {
      record.count = 1;
      record.firstAttemptAt = now;
      delete record.lockedUntil;
    } else {
      record.count += 1;
    }

    if (record.count >= 5) {
      record.lockedUntil = now + 60000;
    }

    this.failedAttempts.set(key, record);
  }

  private clearFailedAttempts(identifier: string) {
    this.failedAttempts.delete(identifier.toLowerCase().trim());
  }

  async registerCustomer(dto: RegisterCustomerDto) {
    const existing = await this.prisma.customer.findFirst({
      where: { OR: [{ email: dto.email }, { phone: dto.phone }] },
    });
    if (existing) {
      throw new BadRequestException(
        'Customer already exists with this email or phone',
      );
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(dto.password, salt);
    const customer = await this.prisma.customer.create({
      data: {
        name: dto.name,
        email: dto.email,
        phone: dto.phone,
        passwordHash,
      },
    });

    const tokens = await this.generateTokens(customer.id, 'CUSTOMER');
    return {
      ...tokens,
      user: {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        userType: 'CUSTOMER',
      },
      customer: {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
      },
    };
  }

  async loginCustomer(dto: LoginDto) {
    const rawIdentifier = dto.emailOrPhone || dto.email;
    if (!rawIdentifier)
      throw new UnauthorizedException('Identifier is required');
    const identifier = rawIdentifier.trim();
    this.checkFailedAttempts(identifier);

    const altIdentifier = identifier.includes('@novamobile.test')
      ? identifier.replace('@novamobile.test', '@mobilehubbd.test')
      : identifier.includes('@mobilehubbd.test')
        ? identifier.replace('@mobilehubbd.test', '@novamobile.test')
        : identifier;

    const customer = await this.prisma.customer.findFirst({
      where: {
        OR: [
          { email: identifier },
          { email: altIdentifier },
          { phone: identifier },
        ],
      },
    });

    if (!customer) {
      this.recordFailedAttempt(identifier);
      throw new UnauthorizedException('Invalid credentials');
    }

    const isValid = await bcrypt.compare(dto.password, customer.passwordHash);
    if (!isValid) {
      this.recordFailedAttempt(identifier);
      throw new UnauthorizedException('Invalid credentials');
    }

    this.clearFailedAttempts(identifier);

    const tokens = await this.generateTokens(customer.id, 'CUSTOMER');
    return {
      ...tokens,
      user: {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        userType: 'CUSTOMER',
      },
      customer: {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
      },
    };
  }

  async loginStaff(dto: LoginDto) {
    const rawIdentifier = dto.email || dto.emailOrPhone;
    if (!rawIdentifier) throw new UnauthorizedException('Email is required');

    const identifier = rawIdentifier.trim();
    this.checkFailedAttempts(identifier);

    // Support both @mobilehubbd.test and @novamobile.test for seamless backward/forward compatibility
    const altIdentifier = identifier.includes('@novamobile.test')
      ? identifier.replace('@novamobile.test', '@mobilehubbd.test')
      : identifier.includes('@mobilehubbd.test')
        ? identifier.replace('@mobilehubbd.test', '@novamobile.test')
        : identifier;

    const staff = await this.prisma.staff.findFirst({
      where: {
        OR: [
          { email: identifier },
          { email: altIdentifier },
          { phone: identifier },
        ],
      },
      include: { role: true },
    });

    if (!staff) {
      this.recordFailedAttempt(identifier);
      throw new UnauthorizedException('Invalid credentials');
    }

    if (staff.status !== 'ACTIVE') {
      throw new ForbiddenException(
        'Account is inactive. Contact administrator.',
      );
    }

    const isValid = await bcrypt.compare(dto.password, staff.passwordHash);
    if (!isValid) {
      this.recordFailedAttempt(identifier);
      throw new UnauthorizedException('Invalid credentials');
    }

    this.clearFailedAttempts(identifier);

    if (!staff.adminPanelAccess) {
      throw new ForbiddenException(
        'Your account does not have access to the Admin Panel. Please contact your administrator.',
      );
    }

    const tokens = await this.generateTokens(
      staff.id,
      'STAFF',
      staff.roleId,
      staff.role?.name,
      staff.branchId,
    );
    return {
      ...tokens,
      user: {
        id: staff.id,
        name: staff.name,
        email: staff.email,
        phone: staff.phone,
        userType: 'STAFF',
        role: staff.role,
        branchId: staff.branchId,
      },
    };
  }

  async refreshTokens(refreshToken: string) {
    let decoded;
    try {
      decoded = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });
    } catch (e) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const allTokensForUser = await this.prisma.refreshToken.findMany({
      where: {
        OR: [{ staffId: decoded.sub }, { customerId: decoded.sub }],
        revoked: false,
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    let matchedToken: RefreshToken | null = null;
    for (const t of allTokensForUser) {
      if (await bcrypt.compare(refreshToken, t.tokenHash)) {
        matchedToken = t;
        break;
      }
    }

    if (!matchedToken || matchedToken.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    await this.prisma.refreshToken.update({
      where: { id: matchedToken.id },
      data: { revoked: true },
    });

    return this.generateTokens(
      decoded.sub,
      decoded.userType,
      decoded.roleId,
      decoded.roleName,
      decoded.branchId,
    );
  }

  async logout(refreshToken: string, userId: string) {
    const allTokensForUser = await this.prisma.refreshToken.findMany({
      where: {
        OR: [{ staffId: userId }, { customerId: userId }],
        revoked: false,
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    for (const t of allTokensForUser) {
      if (await bcrypt.compare(refreshToken, t.tokenHash)) {
        await this.prisma.refreshToken.update({
          where: { id: t.id },
          data: { revoked: true },
        });
        break;
      }
    }
    return { success: true };
  }

  async changePassword(
    userId: string,
    userType: 'STAFF' | 'CUSTOMER',
    dto: ChangePasswordDto,
  ) {
    if (userType === 'STAFF') {
      const user = await this.prisma.staff.findUnique({
        where: { id: userId },
      });
      if (!user) throw new NotFoundException('User not found');

      const isValid = await bcrypt.compare(
        dto.currentPassword,
        user.passwordHash,
      );
      if (!isValid) throw new BadRequestException('Incorrect current password');

      const passwordHash = await bcrypt.hash(dto.newPassword, 10);
      await this.prisma.staff.update({
        where: { id: userId },
        data: { passwordHash },
      });
    } else {
      const user = await this.prisma.customer.findUnique({
        where: { id: userId },
      });
      if (!user) throw new NotFoundException('User not found');

      const isValid = await bcrypt.compare(
        dto.currentPassword,
        user.passwordHash,
      );
      if (!isValid) throw new BadRequestException('Incorrect current password');

      const passwordHash = await bcrypt.hash(dto.newPassword, 10);
      await this.prisma.customer.update({
        where: { id: userId },
        data: { passwordHash },
      });
    }

    return { success: true };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    let userId: string;
    let userType: 'STAFF' | 'CUSTOMER';

    const staff = await this.prisma.staff.findUnique({
      where: { email: dto.email },
    });
    if (staff) {
      userId = staff.id;
      userType = 'STAFF';
    } else {
      const customer = await this.prisma.customer.findUnique({
        where: { email: dto.email },
      });
      if (customer) {
        userId = customer.id;
        userType = 'CUSTOMER';
      } else {
        return {
          success: true,
          message: 'If an account exists, a reset link will be sent.',
        };
      }
    }

    const { randomBytes } = await import('crypto');
    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = await bcrypt.hash(rawToken, 10);

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);

    const record = await this.prisma.passwordResetToken.create({
      data: {
        userId,
        userType,
        tokenHash,
        expiresAt,
      },
    });

    const resetToken = `${record.id}.${rawToken}`;

    return {
      success: true,
      resetToken,
    };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const parts = dto.token.split('.');
    if (parts.length !== 2) {
      throw new BadRequestException('Invalid token format');
    }
    const [tokenId, rawToken] = parts;

    const record = await this.prisma.passwordResetToken.findUnique({
      where: { id: tokenId },
    });

    if (!record || record.used || record.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const isValid = await bcrypt.compare(rawToken, record.tokenHash);
    if (!isValid) {
      throw new BadRequestException('Invalid reset token');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 10);

    if (record.userType === 'STAFF') {
      await this.prisma.staff.update({
        where: { id: record.userId },
        data: { passwordHash },
      });
    } else {
      await this.prisma.customer.update({
        where: { id: record.userId },
        data: { passwordHash },
      });
    }

    await this.prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { used: true },
    });

    return { success: true };
  }

  async getMe(userId: string, userType: 'STAFF' | 'CUSTOMER') {
    if (userType === 'STAFF') {
      const staff = await this.prisma.staff.findUnique({
        where: { id: userId },
        include: {
          role: {
            include: { permissions: true },
          },
          branch: true,
          branchAccess: {
            include: { branch: true },
          },
        },
      });
      if (staff) {
        delete (staff as any).passwordHash;
        const isGlobal = staff.role?.scope === 'GLOBAL';
        let allowedBranches: Array<{ id: string; name: string; code?: string | null }> = [];
        if (isGlobal) {
          const allActive = await this.prisma.branch.findMany({
            where: { status: 'ACTIVE' },
            select: { id: true, name: true, code: true },
            orderBy: { name: 'asc' },
          });
          allowedBranches = allActive;
        } else {
          const branchMap = new Map<string, { id: string; name: string; code?: string | null }>();
          if (staff.branch && staff.branch.status === 'ACTIVE') {
            branchMap.set(staff.branch.id, {
              id: staff.branch.id,
              name: staff.branch.name,
              code: staff.branch.code,
            });
          }
          if (staff.branchAccess) {
            for (const ba of staff.branchAccess) {
              if (ba.branch && ba.branch.status === 'ACTIVE') {
                branchMap.set(ba.branch.id, {
                  id: ba.branch.id,
                  name: ba.branch.name,
                  code: ba.branch.code,
                });
              }
            }
          }
          allowedBranches = Array.from(branchMap.values());
        }

        return {
          ...staff,
          isGlobal,
          allowedBranches,
          userType: 'STAFF',
        };
      }
      return null;
    } else {
      const customer = await this.prisma.customer.findUnique({
        where: { id: userId },
      });
      if (customer) {
        delete (customer as any).passwordHash;
        return { ...customer, userType: 'CUSTOMER' };
      }
      return null;
    }
  }

  private async generateTokens(
    userId: string,
    userType: 'STAFF' | 'CUSTOMER',
    roleId?: string,
    roleName?: string,
    branchId?: string | null,
  ) {
    const payload: JwtPayload = {
      sub: userId,
      userType,
      roleId,
      roleName,
      branchId,
    };

    const accessExpiry =
      userType === 'STAFF'
        ? this.configService.get('STAFF_JWT_ACCESS_EXPIRY') || '8h'
        : this.configService.get('JWT_ACCESS_EXPIRY') || '15m';

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
      expiresIn: accessExpiry,
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: this.configService.get('JWT_REFRESH_EXPIRY') || '7d',
    });

    const tokenHash = await bcrypt.hash(refreshToken, 10);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.prisma.refreshToken.create({
      data: {
        staffId: userType === 'STAFF' ? userId : null,
        customerId: userType === 'CUSTOMER' ? userId : null,
        tokenHash,
        expiresAt,
      },
    });

    return { accessToken, refreshToken };
  }
}
