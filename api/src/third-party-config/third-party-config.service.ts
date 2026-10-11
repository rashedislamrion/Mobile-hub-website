import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  UpdateFirebaseConfigDto,
  UpdateMailConfigDto,
  UpdatePaymentGatewayDto,
  UpdateRecaptchaConfigDto,
  UpdateSmsConfigDto,
} from './dto/third-party-config.dto';
import { PaymentGatewayName } from '@prisma/client';
import { OFFICIAL_CONTACT } from '../common/constants/contact';

function maskString(val?: string | null): string {
  if (!val) return '';
  if (val.length <= 4) return '****';
  return '*'.repeat(val.length - 4) + val.slice(-4);
}

function maskCredentials(creds: any): any {
  if (!creds || typeof creds !== 'object') return creds;
  const masked: Record<string, any> = {};
  for (const [key, val] of Object.entries(creds)) {
    if (typeof val === 'string') {
      const lower = key.toLowerCase();
      if (
        lower.includes('secret') ||
        lower.includes('password') ||
        lower.includes('key') ||
        lower.includes('token')
      ) {
        masked[key] = maskString(val);
      } else {
        masked[key] = val;
      }
    } else {
      masked[key] = val;
    }
  }
  return masked;
}

@Injectable()
export class ThirdPartyConfigService {
  constructor(private prisma: PrismaService) {}

  // ==================== PAYMENT GATEWAYS ====================

  async getPublicPaymentGateways() {
    const list = await this.prisma.paymentGatewayConfig.findMany({
      where: { isActive: true },
      select: {
        gateway: true,
        isActive: true,
        title: true,
        logoUrl: true,
      },
    });

    // Ensure COD is always present in list if not in DB
    const hasCod = list.some((g) => g.gateway === PaymentGatewayName.COD);
    if (!hasCod) {
      list.push({
        gateway: PaymentGatewayName.COD,
        isActive: true,
        title: 'Cash on Delivery',
        logoUrl: null,
      });
    }

    return list;
  }

  async getPaymentGateways() {
    const defaultGateways: {
      gateway: PaymentGatewayName;
      title: string;
      mode: string;
      credentials: Record<string, any>;
      isActive: boolean;
    }[] = [
      {
        gateway: PaymentGatewayName.BKASH,
        title: 'bKash Direct Checkout',
        mode: 'Sandbox',
        credentials: {
          appKey: '',
          appSecretKey: '',
          username: '',
          password: '',
        },
        isActive: false,
      },
      {
        gateway: PaymentGatewayName.SSLCOMMERZ,
        title: 'SSLCommerz Payment Gateway',
        mode: 'Sandbox',
        credentials: {
          storeId: '',
          storePassword: '',
          currency: 'BDT',
        },
        isActive: false,
      },
      {
        gateway: PaymentGatewayName.COD,
        title: 'Cash on Delivery',
        mode: 'Live',
        credentials: {
          extraCharge: 0,
          maxAmount: 50000,
        },
        isActive: true,
      },
    ];

    const current = await this.prisma.paymentGatewayConfig.findMany();
    const map = new Map(current.map((g) => [g.gateway, g]));

    // Seed any missing defaults
    for (const def of defaultGateways) {
      if (!map.has(def.gateway)) {
        const created = await this.prisma.paymentGatewayConfig.create({
          data: {
            gateway: def.gateway,
            title: def.title,
            mode: def.mode,
            credentials: def.credentials,
            isActive: def.isActive,
          },
        });
        map.set(def.gateway, created);
      }
    }

    return Array.from(map.values()).map((config) => ({
      ...config,
      credentials: maskCredentials(config.credentials),
    }));
  }

  async getRawGatewayConfig(gateway: PaymentGatewayName) {
    let config = await this.prisma.paymentGatewayConfig.findUnique({
      where: { gateway },
    });
    if (!config && gateway === PaymentGatewayName.COD) {
      config = await this.prisma.paymentGatewayConfig.create({
        data: {
          gateway: PaymentGatewayName.COD,
          title: 'Cash on Delivery',
          mode: 'Live',
          credentials: { extraCharge: 0, maxAmount: 50000 },
          isActive: true,
        },
      });
    }
    return config;
  }

  async updatePaymentGateway(
    gateway: PaymentGatewayName,
    dto: UpdatePaymentGatewayDto,
  ) {
    const existing = await this.prisma.paymentGatewayConfig.findUnique({
      where: { gateway },
    });

    const existingCreds =
      existing &&
      typeof existing.credentials === 'object' &&
      existing.credentials !== null
        ? (existing.credentials as Record<string, any>)
        : {};

    const updatedCreds = { ...existingCreds };
    if (dto.credentials) {
      for (const [key, val] of Object.entries(dto.credentials)) {
        // If value was masked (contains asterisks), preserve existing value
        if (typeof val === 'string' && val.includes('****')) {
          continue;
        }
        updatedCreds[key] = val;
      }
    }

    return this.prisma.paymentGatewayConfig.upsert({
      where: { gateway },
      update: {
        isActive:
          dto.isActive !== undefined ? dto.isActive : existing?.isActive,
        mode: dto.mode !== undefined ? dto.mode : existing?.mode,
        title: dto.title !== undefined ? dto.title : existing?.title,
        logoUrl: dto.logoUrl !== undefined ? dto.logoUrl : existing?.logoUrl,
        credentials: updatedCreds,
        extraConfig:
          dto.extraConfig !== undefined ? (dto.extraConfig as any) : undefined,
      },
      create: {
        gateway,
        isActive: dto.isActive !== undefined ? dto.isActive : false,
        mode: dto.mode || 'Sandbox',
        title: dto.title || gateway,
        logoUrl: dto.logoUrl || null,
        credentials: updatedCreds,
        extraConfig: (dto.extraConfig as any) || undefined,
      },
    });
  }

  // ==================== SMS CONFIG ====================

  async getSmsConfig() {
    let config = await this.prisma.smsConfig.findFirst();
    if (!config) {
      config = await this.prisma.smsConfig.create({
        data: {
          isActive: false,
          provider: 'Twilio',
          apiKey: '',
          senderId: 'mobilehubbd',
          apiSecret: '',
        },
      });
    }
    return {
      ...config,
      apiKey: maskString(config.apiKey),
      apiSecret: maskString(config.apiSecret),
    };
  }

  async updateSmsConfig(dto: UpdateSmsConfigDto) {
    const existing = await this.prisma.smsConfig.findFirst();
    const apiKey =
      dto.apiKey && !dto.apiKey.includes('****')
        ? dto.apiKey
        : existing?.apiKey || null;
    const apiSecret =
      dto.apiSecret && !dto.apiSecret.includes('****')
        ? dto.apiSecret
        : existing?.apiSecret || null;

    if (existing) {
      return this.prisma.smsConfig.update({
        where: { id: existing.id },
        data: {
          isActive:
            dto.isActive !== undefined ? dto.isActive : existing.isActive,
          provider:
            dto.provider !== undefined ? dto.provider : existing.provider,
          apiKey,
          senderId:
            dto.senderId !== undefined ? dto.senderId : existing.senderId,
          apiSecret,
        },
      });
    }

    return this.prisma.smsConfig.create({
      data: {
        isActive: dto.isActive || false,
        provider: dto.provider || 'Twilio',
        apiKey,
        senderId: dto.senderId || 'mobilehubbd',
        apiSecret,
      },
    });
  }

  // ==================== MAIL CONFIG ====================

  async getMailConfig() {
    let config = await this.prisma.mailConfig.findFirst();
    if (!config) {
      config = await this.prisma.mailConfig.create({
        data: {
          isActive: false,
          driver: 'SMTP',
          host: 'smtp.gmail.com',
          port: 587,
          username: '',
          password: '',
          encryption: 'tls',
          fromName: OFFICIAL_CONTACT.storeName,
          fromEmail: OFFICIAL_CONTACT.email,
        },
      });
    }
    return {
      ...config,
      password: maskString(config.password),
    };
  }

  async updateMailConfig(dto: UpdateMailConfigDto) {
    const existing = await this.prisma.mailConfig.findFirst();
    const password =
      dto.password && !dto.password.includes('****')
        ? dto.password
        : existing?.password || null;

    if (existing) {
      return this.prisma.mailConfig.update({
        where: { id: existing.id },
        data: {
          isActive:
            dto.isActive !== undefined ? dto.isActive : existing.isActive,
          driver: dto.driver !== undefined ? dto.driver : existing.driver,
          host: dto.host !== undefined ? dto.host : existing.host,
          port: dto.port !== undefined ? dto.port : existing.port,
          username:
            dto.username !== undefined ? dto.username : existing.username,
          password,
          encryption:
            dto.encryption !== undefined ? dto.encryption : existing.encryption,
          fromName:
            dto.fromName !== undefined ? dto.fromName : existing.fromName,
          fromEmail:
            dto.fromEmail !== undefined ? dto.fromEmail : existing.fromEmail,
        },
      });
    }

    return this.prisma.mailConfig.create({
      data: {
        isActive: dto.isActive || false,
        driver: dto.driver || 'SMTP',
        host: dto.host || 'smtp.gmail.com',
        port: dto.port || 587,
        username: dto.username || null,
        password,
        encryption: dto.encryption || 'tls',
        fromName: dto.fromName || OFFICIAL_CONTACT.storeName,
        fromEmail: dto.fromEmail || OFFICIAL_CONTACT.email,
      },
    });
  }

  // ==================== FIREBASE CONFIG ====================

  async getFirebaseConfig() {
    let config = await this.prisma.firebaseConfig.findFirst();
    if (!config) {
      config = await this.prisma.firebaseConfig.create({
        data: {
          isActive: false,
          projectId: '',
          serverKey: '',
          senderId: '',
        },
      });
    }
    return {
      ...config,
      serverKey: maskString(config.serverKey),
    };
  }

  async updateFirebaseConfig(dto: UpdateFirebaseConfigDto) {
    const existing = await this.prisma.firebaseConfig.findFirst();
    const serverKey =
      dto.serverKey && !dto.serverKey.includes('****')
        ? dto.serverKey
        : existing?.serverKey || null;

    if (existing) {
      return this.prisma.firebaseConfig.update({
        where: { id: existing.id },
        data: {
          isActive:
            dto.isActive !== undefined ? dto.isActive : existing.isActive,
          projectId:
            dto.projectId !== undefined ? dto.projectId : existing.projectId,
          serverKey,
          senderId:
            dto.senderId !== undefined ? dto.senderId : existing.senderId,
          configFileUrl:
            dto.configFileUrl !== undefined
              ? dto.configFileUrl
              : existing.configFileUrl,
        },
      });
    }

    return this.prisma.firebaseConfig.create({
      data: {
        isActive: dto.isActive || false,
        projectId: dto.projectId || null,
        serverKey,
        senderId: dto.senderId || null,
        configFileUrl: dto.configFileUrl || null,
      },
    });
  }

  // ==================== RECAPTCHA CONFIG ====================

  async getRecaptchaConfig() {
    let config = await this.prisma.recaptchaConfig.findFirst();
    if (!config) {
      config = await this.prisma.recaptchaConfig.create({
        data: {
          isActive: false,
          version: 'v2',
          siteKey: '',
          secretKey: '',
        },
      });
    }
    return {
      ...config,
      secretKey: maskString(config.secretKey),
    };
  }

  async updateRecaptchaConfig(dto: UpdateRecaptchaConfigDto) {
    const existing = await this.prisma.recaptchaConfig.findFirst();
    const secretKey =
      dto.secretKey && !dto.secretKey.includes('****')
        ? dto.secretKey
        : existing?.secretKey || null;

    if (existing) {
      return this.prisma.recaptchaConfig.update({
        where: { id: existing.id },
        data: {
          isActive:
            dto.isActive !== undefined ? dto.isActive : existing.isActive,
          version: dto.version !== undefined ? dto.version : existing.version,
          minScoreThreshold:
            dto.minScoreThreshold !== undefined
              ? dto.minScoreThreshold
              : existing.minScoreThreshold,
          siteKey: dto.siteKey !== undefined ? dto.siteKey : existing.siteKey,
          secretKey,
        },
      });
    }

    return this.prisma.recaptchaConfig.create({
      data: {
        isActive: dto.isActive || false,
        version: dto.version || 'v2',
        minScoreThreshold: dto.minScoreThreshold || null,
        siteKey: dto.siteKey || null,
        secretKey,
      },
    });
  }
}
