import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  UpdateBusinessSettingsDto,
  UpdateBusinessSetupDto,
  UpdateVerificationDto,
} from './dto/business-settings.dto';
import { OFFICIAL_CONTACT } from '../common/constants/contact';

const defaultSettings = {
  general: {
    companyName: 'MobileHubBD',
    websiteName: 'MobileHubBD',
    websiteTitle: 'MobileHubBD - Smartphone Parts & Repair Shop',
    email: OFFICIAL_CONTACT.email,
    emailAddress: OFFICIAL_CONTACT.email,
    phone: OFFICIAL_CONTACT.phone.display,
    mobileNumber: OFFICIAL_CONTACT.phone.display,
    address: OFFICIAL_CONTACT.address.en,
    timeZone: 'UTC/GMT +06:00 - Asia/Dhaka',
    currency: 'BDT',
    defaultCurrency: 'BDT',
    currencyPosition: 'LEFT',
    businessModel: 'SINGLE_STORE',
    showDownloadAppNav: true,
    googlePlayStoreLink: 'https://play.google.com/store',
    appleStoreLink: 'https://apple.com/app-store',
    showAdminFooter: true,
    hotlineNumber: OFFICIAL_CONTACT.phone.display,
    footerText:
      "Bangladesh's leading destination for original spare parts and repair services.",
    paymentMethodsSetup: {
      codEnabled: true,
      onlinePaymentEnabled: true,
    },
  },
  branding: {
    primaryColor: '#10B981',
    logoUrl: '/images/logo.png',
    logoRatio4x1Url: '/images/logo.png',
    faviconUrl: '/favicon.ico',
    appLogoUrl: '',
    splashLogoUrl: '',
    footerLogoRatio4x1Url: '',
    footerQrCodeUrl: '',
  },
  currencyTax: {
    currencyCode: 'BDT',
    currencySymbol: '৳',
    symbolPosition: 'LEFT',
    taxPercentage: 0,
  },
  orderSettings: {
    allowGuestCheckout: true,
    freeDeliveryThreshold: 5000,
    standardDeliveryCharge: 60,
    expressDeliveryCharge: 120,
    minOrderAmount: 100,
  },
  notifications: {
    orderConfirmationEmail: true,
    orderStatusSms: true,
    promotionalPush: true,
  },
  verification: {
    customerRegistrationOtpVerify: false,
    mustVerifyOnOrderPlacement: false,
    registerOtpMethod: 'PHONE',
    forgetPasswordOtpMethod: 'PHONE',
    registrationPhoneRequired: true,
    phoneMinLength: 11,
    phoneMaxLength: 11,
  },
};

@Injectable()
export class BusinessSettingsService {
  constructor(private prisma: PrismaService) {}

  async getSettings() {
    let settings = await this.prisma.businessSetting.findFirst();
    if (!settings) {
      settings = await this.prisma.businessSetting.create({
        data: {
          general: defaultSettings.general,
          branding: defaultSettings.branding,
          currencyTax: defaultSettings.currencyTax,
          orderSettings: defaultSettings.orderSettings,
          notifications: defaultSettings.notifications,
          verification: defaultSettings.verification,
        },
      });
    }

    const general = {
      ...defaultSettings.general,
      ...(settings.general as any),
    };
    const branding = {
      ...defaultSettings.branding,
      ...(settings.branding as any),
    };
    const currencyTax = {
      ...defaultSettings.currencyTax,
      ...(settings.currencyTax as any),
    };
    const orderSettings = {
      ...defaultSettings.orderSettings,
      ...(settings.orderSettings as any),
    };
    const notifications = {
      ...defaultSettings.notifications,
      ...(settings.notifications as any),
    };
    const verification = {
      ...defaultSettings.verification,
      ...(settings.verification as any),
    };

    return {
      ...settings,
      general,
      branding,
      currencyTax,
      orderSettings,
      notifications,
      verification,
    };
  }

  async updateSettings(dto: UpdateBusinessSettingsDto) {
    const existing = await this.getSettings();

    const currentGeneral = { ...existing.general, ...(dto.general || {}) };
    const currentBranding = { ...existing.branding, ...(dto.branding || {}) };
    const currentCurrencyTax = {
      ...existing.currencyTax,
      ...(dto.currencyTax || {}),
    };
    const currentOrderSettings = {
      ...existing.orderSettings,
      ...(dto.orderSettings || {}),
    };
    const currentNotifications = {
      ...existing.notifications,
      ...(dto.notifications || {}),
    };
    const currentVerification = {
      ...existing.verification,
      ...(dto.verification || {}),
    };

    if (dto.removeFields && Array.isArray(dto.removeFields)) {
      for (const field of dto.removeFields) {
        if (field in currentBranding) {
          currentBranding[field] = null;
        }
        if (field in currentGeneral) {
          currentGeneral[field] = null;
        }
      }
    }

    // Synchronize currencyPosition if provided
    if (dto.general?.currencyPosition) {
      currentCurrencyTax.symbolPosition = dto.general.currencyPosition;
    }

    return this.prisma.businessSetting.update({
      where: { id: existing.id },
      data: {
        general: currentGeneral,
        branding: currentBranding,
        currencyTax: currentCurrencyTax,
        orderSettings: currentOrderSettings,
        notifications: currentNotifications,
        verification: currentVerification,
      },
    });
  }

  async getSetup() {
    const settings = await this.getSettings();
    const general = settings.general;
    const currencyTax = settings.currencyTax;

    return {
      companyName: general.companyName || OFFICIAL_CONTACT.storeName,
      companyEmail:
        general.emailAddress || general.email || OFFICIAL_CONTACT.email,
      companyPhone: general.mobileNumber || general.phone || OFFICIAL_CONTACT.phone.display,
      businessModel: general.businessModel || 'SINGLE_STORE',
      currencyPosition:
        general.currencyPosition || currencyTax.symbolPosition || 'LEFT',
      timeZone: general.timeZone || 'UTC/GMT +06:00 - Asia/Dhaka',
      paymentMethodsSetup: general.paymentMethodsSetup || {
        codEnabled: true,
        onlinePaymentEnabled: true,
      },
    };
  }

  async updateSetup(dto: UpdateBusinessSetupDto) {
    const existing = await this.getSettings();
    const general = { ...existing.general };
    const currencyTax = { ...existing.currencyTax };

    if (dto.companyName !== undefined) general.companyName = dto.companyName;
    if (dto.companyEmail !== undefined) {
      general.email = dto.companyEmail;
      general.emailAddress = dto.companyEmail;
    }
    if (dto.companyPhone !== undefined) {
      general.phone = dto.companyPhone;
      general.mobileNumber = dto.companyPhone;
    }
    if (dto.businessModel !== undefined)
      general.businessModel = dto.businessModel;
    if (dto.currencyPosition !== undefined) {
      general.currencyPosition = dto.currencyPosition;
      currencyTax.symbolPosition = dto.currencyPosition;
    }
    if (dto.timeZone !== undefined) general.timeZone = dto.timeZone;
    if (dto.paymentMethodsSetup !== undefined) {
      general.paymentMethodsSetup = {
        ...general.paymentMethodsSetup,
        ...dto.paymentMethodsSetup,
      };
    }

    await this.prisma.businessSetting.update({
      where: { id: existing.id },
      data: {
        general,
        currencyTax,
      },
    });

    return this.getSetup();
  }

  async getVerification() {
    const settings = await this.getSettings();
    return settings.verification;
  }

  async updateVerification(dto: UpdateVerificationDto) {
    const existing = await this.getSettings();
    const verification = {
      ...existing.verification,
      ...dto,
    };

    const updated = await this.prisma.businessSetting.update({
      where: { id: existing.id },
      data: {
        verification,
      },
    });

    return updated.verification;
  }
}
