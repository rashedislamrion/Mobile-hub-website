import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateFooterColumnItemDto,
  ReorderFooterColumnItemsDto,
  UpdateFooterColumnItemDto,
  UpdateFooterSettingsDto,
} from './dto/footer-settings.dto';
import { OFFICIAL_CONTACT } from '../common/constants/contact';

const DEFAULT_COLUMNS = [
  {
    key: 'support',
    title: 'Support',
    sortOrder: 0,
    items: [
      {
        sourceType: 'CUSTOM',
        navigationLabel: 'Dedicated Support',
        url: '/contact',
        extraData: {
          availableTime: OFFICIAL_CONTACT.openingHours.hours,
          phone: OFFICIAL_CONTACT.phone.display,
        },
      },
      {
        sourceType: 'CUSTOM',
        navigationLabel: 'Support Tickets',
        url: '/account/support',
        extraData: {},
      },
      {
        sourceType: 'CUSTOM',
        navigationLabel: 'Track Your Order',
        url: '/account/orders',
        extraData: {},
      },
    ],
  },
  {
    key: 'about_us',
    title: 'About Us',
    sortOrder: 1,
    items: [
      {
        sourceType: 'PAGE',
        navigationLabel: 'About Us',
        url: '/about',
        extraData: {},
      },
      {
        sourceType: 'CUSTOM',
        navigationLabel: 'News & Articles',
        url: '/blog',
        extraData: {},
      },
      {
        sourceType: 'CUSTOM',
        navigationLabel: 'Contact Us',
        url: '/contact',
        extraData: {},
      },
    ],
  },
  {
    key: 'quick_links',
    title: 'Quick Links',
    sortOrder: 2,
    items: [
      {
        sourceType: 'CUSTOM',
        navigationLabel: 'All Products',
        url: '/category/all',
        extraData: {},
      },
      {
        sourceType: 'PAGE',
        navigationLabel: 'Terms of Service',
        url: '/terms',
        extraData: {},
      },
      {
        sourceType: 'PAGE',
        navigationLabel: 'Privacy Policy',
        url: '/privacy',
        extraData: {},
      },
    ],
  },
  {
    key: 'branches',
    title: 'Our Outlets',
    sortOrder: 3,
    items: [
      {
        sourceType: 'BRANCH',
        navigationLabel: 'Eastern Plaza (Flagship)',
        url: '/contact',
        extraData: {
          name: 'Eastern Plaza (Flagship)',
          location: OFFICIAL_CONTACT.address.en,
          phone: OFFICIAL_CONTACT.phone.display,
        },
      },
    ],
  },
];

@Injectable()
export class FooterSettingsService implements OnModuleInit {
  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    await this.seedFooterColumns();
  }

  async seedFooterColumns() {
    const count = await this.prisma.footerColumn.count();
    if (count === 0) {
      for (const col of DEFAULT_COLUMNS) {
        const createdCol = await this.prisma.footerColumn.create({
          data: {
            key: col.key,
            title: col.title,
            sortOrder: col.sortOrder,
          },
        });

        for (let i = 0; i < col.items.length; i++) {
          const item = col.items[i];
          await this.prisma.footerColumnItem.create({
            data: {
              footerColumnId: createdCol.id,
              sourceType: item.sourceType,
              navigationLabel: item.navigationLabel,
              url: item.url,
              extraData: item.extraData,
              sortOrder: i,
              isActive: true,
            },
          });
        }
      }
    }
  }

  async getSettings() {
    let settings = await this.prisma.footerSettings.findFirst();
    if (!settings) {
      settings = await this.prisma.footerSettings.create({
        data: {
          supportPhone: OFFICIAL_CONTACT.phone.display,
          supportEmail: OFFICIAL_CONTACT.email,
          liveChatLink: `https://wa.me/${OFFICIAL_CONTACT.phone.whatsappNumber}`,
          faqLink: '/faq',
          copyrightText: '© 2026 MobileHubBD. All rights reserved.',
        },
      });
    }
    return settings;
  }

  async updateSettings(dto: UpdateFooterSettingsDto) {
    const existing = await this.prisma.footerSettings.findFirst();
    if (existing) {
      return this.prisma.footerSettings.update({
        where: { id: existing.id },
        data: {
          supportPhone: dto.supportPhone,
          supportEmail: dto.supportEmail,
          liveChatLink: dto.liveChatLink || null,
          faqLink: dto.faqLink || null,
          copyrightText: dto.copyrightText,
        },
      });
    }

    return this.prisma.footerSettings.create({
      data: {
        supportPhone: dto.supportPhone,
        supportEmail: dto.supportEmail,
        liveChatLink: dto.liveChatLink || null,
        faqLink: dto.faqLink || null,
        copyrightText: dto.copyrightText,
      },
    });
  }

  // ============================= FOOTER BUILDER =============================

  async getBuilderData() {
    await this.seedFooterColumns();

    const [structureMenus, pages, columns, disabledItems] = await Promise.all([
      this.prisma.menuStructureItem.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
      }),
      this.prisma.page.findMany({
        select: { id: true, title: true, slug: true },
        orderBy: { title: 'asc' },
      }),
      this.prisma.footerColumn.findMany({
        include: {
          items: {
            where: { isActive: true },
            orderBy: { sortOrder: 'asc' },
          },
        },
        orderBy: { sortOrder: 'asc' },
      }),
      this.prisma.footerColumnItem.findMany({
        where: { isActive: false },
        include: {
          footerColumn: {
            select: { key: true, title: true },
          },
        },
        orderBy: { updatedAt: 'desc' },
      }),
    ]);

    const availableMenus = structureMenus.map((m) => ({
      id: m.id,
      name: m.navigationLabel,
      url: m.urlSlug,
      sourceType: 'MENU',
    }));

    const availablePages = pages.map((p) => ({
      id: p.id,
      name: p.title,
      url: `/pages/${p.slug}`,
      sourceType: 'PAGE',
    }));

    return {
      availableMenus,
      availablePages,
      columns,
      disabledItems,
    };
  }

  async getPublicFooter() {
    await this.seedFooterColumns();

    const columns = await this.prisma.footerColumn.findMany({
      include: {
        items: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: { sortOrder: 'asc' },
    });

    const settings = await this.getSettings();

    return {
      columns,
      settings,
    };
  }

  async addItem(columnKey: string, dto: CreateFooterColumnItemDto) {
    let column = await this.prisma.footerColumn.findUnique({
      where: { key: columnKey },
    });
    if (!column) {
      column = await this.prisma.footerColumn.create({
        data: {
          key: columnKey,
          title: columnKey.replace('_', ' ').toUpperCase(),
          sortOrder: 10,
        },
      });
    }

    const lastItem = await this.prisma.footerColumnItem.findFirst({
      where: { footerColumnId: column.id },
      orderBy: { sortOrder: 'desc' },
    });
    const nextSortOrder = (lastItem?.sortOrder ?? -1) + 1;

    let extraData = dto.extraData || {};
    let navigationLabel = dto.navigationLabel;
    const url = dto.url || '#';

    if (dto.sourceType === 'BRANCH' && dto.sourceId) {
      const branch = await this.prisma.branch.findUnique({
        where: { id: dto.sourceId },
      });
      if (branch) {
        navigationLabel = navigationLabel || branch.name;
        extraData = {
          name: branch.name,
          location: branch.address || branch.city || '',
          phone: branch.phone || '',
          ...extraData,
        };
      }
    }

    return this.prisma.footerColumnItem.create({
      data: {
        footerColumnId: column.id,
        sourceType: dto.sourceType,
        sourceId: dto.sourceId || null,
        navigationLabel,
        url,
        extraData,
        sortOrder: nextSortOrder,
        isActive: true,
      },
    });
  }

  async updateItem(
    columnKey: string,
    id: string,
    dto: UpdateFooterColumnItemDto,
  ) {
    const item = await this.prisma.footerColumnItem.findUnique({
      where: { id },
    });
    if (!item) throw new NotFoundException(`FooterColumnItem ${id} not found`);

    return this.prisma.footerColumnItem.update({
      where: { id },
      data: {
        ...(dto.navigationLabel !== undefined
          ? { navigationLabel: dto.navigationLabel }
          : {}),
        ...(dto.url !== undefined ? { url: dto.url } : {}),
        ...(dto.extraData !== undefined ? { extraData: dto.extraData } : {}),
      },
    });
  }

  async disableItem(id: string) {
    const item = await this.prisma.footerColumnItem.findUnique({
      where: { id },
    });
    if (!item) throw new NotFoundException(`FooterColumnItem ${id} not found`);

    return this.prisma.footerColumnItem.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async enableItem(id: string) {
    const item = await this.prisma.footerColumnItem.findUnique({
      where: { id },
    });
    if (!item) throw new NotFoundException(`FooterColumnItem ${id} not found`);

    return this.prisma.footerColumnItem.update({
      where: { id },
      data: { isActive: true },
    });
  }

  async deleteItem(id: string) {
    const item = await this.prisma.footerColumnItem.findUnique({
      where: { id },
    });
    if (!item) throw new NotFoundException(`FooterColumnItem ${id} not found`);

    return this.prisma.footerColumnItem.delete({ where: { id } });
  }

  async reorderColumnItems(dto: ReorderFooterColumnItemsDto) {
    return this.prisma.$transaction(
      dto.orderedItemIds.map((id, index) =>
        this.prisma.footerColumnItem.update({
          where: { id },
          data: { sortOrder: index },
        }),
      ),
    );
  }
}
