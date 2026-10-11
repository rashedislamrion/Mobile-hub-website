import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreatePurchaseOrderDto,
  ReceivePurchaseOrderDto,
  ReturnPurchaseOrderDto,
} from './dto/purchase-order.dto';
import {
  Prisma,
  PurchaseOrderStatus,
  StockAdjustmentType,
  WalletTxnType,
} from '@prisma/client';
import { Response } from 'express';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { BranchScopeService } from '../common/branch/branch-scope.service';
import {
  resolvePrivateFilePath,
  streamLocalFile,
} from '../common/upload/private-file.helper';
import { storageService } from '../common/upload/storage.service';
import { resolveUploadedFile } from '../common/upload/multer.config';

@Injectable()
export class PurchaseOrderService {
  constructor(
    private prisma: PrismaService,
    private branchScopeService: BranchScopeService,
  ) {}

  async findAll(
    query?: {
      branch?: string;
      supplier?: string;
      status?: PurchaseOrderStatus;
      paymentStatus?: string;
      dateFrom?: string;
      dateTo?: string;
      search?: string;
      page?: number;
      limit?: number;
    },
    user?: JwtPayload,
  ) {
    const page = Math.max(1, Number(query?.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query?.limit) || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.PurchaseOrderWhereInput = {};

    const branchFilter = await this.branchScopeService.getBranchFilter(
      user,
      query?.branch,
    );
    if (branchFilter !== undefined) {
      where.branchId = branchFilter;
    }

    if (query?.supplier) where.supplierId = query.supplier;
    if (query?.status) where.status = query.status;

    if (query?.paymentStatus) {
      const ps = query.paymentStatus.toUpperCase();
      if (ps === 'PAID') {
        where.dueAmount = { lte: 0 };
        where.status = { not: PurchaseOrderStatus.DRAFT };
      } else if (ps === 'DUE') {
        where.dueAmount = { gt: 0 };
        where.amountPaid = { equals: 0 };
      } else if (ps === 'PARTIAL') {
        where.dueAmount = { gt: 0 };
        where.amountPaid = { gt: 0 };
      }
    }

    if (query?.dateFrom || query?.dateTo) {
      where.createdAt = {};
      if (query.dateFrom) where.createdAt.gte = new Date(query.dateFrom);
      if (query.dateTo) {
        const to = new Date(query.dateTo);
        to.setHours(23, 59, 59, 999);
        where.createdAt.lte = to;
      }
    }

    if (query?.search?.trim()) {
      const term = query.search.trim();
      where.OR = [
        { poNumber: { contains: term, mode: 'insensitive' } },
        { invoiceNumber: { contains: term, mode: 'insensitive' } },
        { supplier: { name: { contains: term, mode: 'insensitive' } } },
        { supplier: { phone: { contains: term, mode: 'insensitive' } } },
      ];
    }

    const now = new Date();
    const startOfMonth = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
    );

    const [total, data, thisMonthOrders, pendingDeliveryCount] =
      await Promise.all([
        this.prisma.purchaseOrder.count({ where }),
        this.prisma.purchaseOrder.findMany({
          where,
          include: {
            branch: { select: { id: true, name: true, code: true } },
            supplier: {
              select: {
                id: true,
                name: true,
                phone: true,
                advanceBalance: true,
              },
            },
            items: {
              include: {
                product: { select: { id: true, name: true, images: true } },
                variant: {
                  select: { id: true, sku: true, color: true, quality: true },
                },
              },
            },
            payments: {
              include: {
                walletType: { select: { id: true, name: true } },
                recordedBy: { select: { id: true, name: true } },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        this.prisma.purchaseOrder.findMany({
          where: {
            createdAt: { gte: startOfMonth },
            status: { not: PurchaseOrderStatus.CANCELLED },
            ...(branchFilter !== undefined ? { branchId: branchFilter } : {}),
          },
          select: { grandTotal: true, amountPaid: true, dueAmount: true },
        }),
        this.prisma.purchaseOrder.count({
          where: {
            status: {
              in: [
                PurchaseOrderStatus.ORDERED,
                PurchaseOrderStatus.PARTIALLY_RECEIVED,
              ],
            },
            ...(branchFilter !== undefined ? { branchId: branchFilter } : {}),
          },
        }),
      ]);

    let thisMonthTotal = 0;
    let thisMonthPaid = 0;
    let thisMonthUnpaid = 0;

    for (const po of thisMonthOrders) {
      thisMonthTotal += Number(po.grandTotal);
      thisMonthPaid += Number(po.amountPaid);
      thisMonthUnpaid += Number(po.dueAmount);
    }

    const mappedData = data.map((po) => {
      const due = Number(po.dueAmount || 0);
      const paid = Number(po.amountPaid || 0);
      let paymentStatus: 'PAID' | 'PARTIAL' | 'UNPAID';
      if (po.status === PurchaseOrderStatus.DRAFT) {
        paymentStatus = 'UNPAID';
      } else if (due <= 0) {
        paymentStatus = 'PAID';
      } else if (paid > 0) {
        paymentStatus = 'PARTIAL';
      } else {
        paymentStatus = 'UNPAID';
      }

      return {
        ...po,
        paymentStatus,
      };
    });

    return {
      data: mappedData,
      summary: {
        thisMonthTotal,
        thisMonthPaid,
        thisMonthUnpaid,
        pendingDeliveryCount,
      },
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string, user?: JwtPayload) {
    const po = await this.prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        branch: true,
        supplier: true,
        items: {
          include: {
            product: { select: { id: true, name: true, images: true } },
            variant: true,
          },
        },
        phoneUnits: true,
        payments: {
          include: {
            walletType: { select: { id: true, name: true } },
            recordedBy: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!po) throw new NotFoundException(`Purchase Order "${id}" not found.`);
    if (user) {
      await this.branchScopeService.validateBranchAccess(user, po.branchId);
    }
    return po;
  }

  async create(dto: CreatePurchaseOrderDto, user: JwtPayload) {
    const recordedById = user.sub;
    const supplier = await this.prisma.supplier.findUnique({
      where: { id: dto.supplierId },
    });
    if (!supplier) throw new NotFoundException('Supplier not found.');

    const branchId = await this.branchScopeService.determineCreateBranchId(
      user,
      dto.branchId,
    );

    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException(
        'Purchase order must contain at least one item.',
      );
    }

    const discount = Number(dto.discount || 0);
    const shippingCost = Number(dto.shippingCost || 0);
    const tax = Number(dto.tax || 0);
    const advanceUsed = Number(dto.advanceUsed || 0);

    let subtotal = 0;
    const itemsData = await Promise.all(
      dto.items.map(async (item) => {
        let productId = item.productId;
        if (!productId && item.variantId) {
          const variant = await this.prisma.productVariant.findUnique({
            where: { id: item.variantId },
            select: { productId: true },
          });
          productId = variant?.productId || '';
        }
        if (!productId) {
          const fallbackProduct = await this.prisma.product.findFirst();
          productId = fallbackProduct?.id || '';
        }

        let variantId = item.variantId || null;
        if (!variantId && productId) {
          const firstVar = await this.prisma.productVariant.findFirst({
            where: { productId },
          });
          if (firstVar) {
            variantId = firstVar.id;
          }
        }

        const lineTotal = Number(item.quantityOrdered) * Number(item.unitCost);
        subtotal += lineTotal;
        return {
          productId,
          variantId,
          quantityOrdered: item.quantityOrdered,
          unitCost: item.unitCost,
          sellingPrice:
            item.sellingPrice !== undefined ? item.sellingPrice : null,
          wholesalePrice:
            item.wholesalePrice !== undefined ? item.wholesalePrice : null,
          offerPrice: item.offerPrice !== undefined ? item.offerPrice : null,
          lineTotal,
        };
      }),
    );

    const grandTotal = Math.max(0, subtotal - discount + shippingCost + tax);

    // Normalize wallet payments
    const walletPayments: Array<{ walletTypeId: string; amount: number }> = [];
    if (
      dto.walletPayments &&
      Array.isArray(dto.walletPayments) &&
      dto.walletPayments.length > 0
    ) {
      for (const wp of dto.walletPayments) {
        if (wp.walletTypeId && Number(wp.amount) > 0) {
          walletPayments.push({
            walletTypeId: wp.walletTypeId,
            amount: Number(wp.amount),
          });
        }
      }
    } else if (dto.walletTypeId && Number(dto.amountPaid) > 0) {
      walletPayments.push({
        walletTypeId: dto.walletTypeId,
        amount: Number(dto.amountPaid),
      });
    }

    const totalWalletAmount = walletPayments.reduce(
      (sum, wp) => sum + wp.amount,
      0,
    );
    const totalAmountPaid = totalWalletAmount + advanceUsed;

    // Validate Advance balance
    if (advanceUsed > 0) {
      const availableAdvance = Number(supplier.advanceBalance || 0);
      if (advanceUsed > availableAdvance) {
        throw new BadRequestException(
          `Requested advance usage (৳${advanceUsed.toLocaleString()}) exceeds available supplier advance balance (৳${availableAdvance.toLocaleString()}).`,
        );
      }
    }

    // Gather and validate all phone units for IMEI uniqueness across the entire system
    const allPhoneUnitsToCreate: Array<{
      variantId?: string | null;
      productId?: string | null;
      imei1: string;
      imei2?: string | null;
      serialNumber?: string | null;
      condition?: string | null;
      buyingPrice: number;
      sellingPrice: number;
      warrantyType?: string | null;
      warrantyPeriod?: string | null;
      warrantyStartDate?: string | null;
      warrantyEndDate?: string | null;
    }> = [];

    const seenImeisInRequest = new Set<string>();

    for (const item of dto.items) {
      if (
        item.phoneUnits &&
        Array.isArray(item.phoneUnits) &&
        item.phoneUnits.length > 0
      ) {
        for (const pu of item.phoneUnits) {
          const imei1 = (pu.imei1 || '').trim();
          const imei2 = (pu.imei2 || '').trim();
          if (!imei1) {
            throw new BadRequestException(
              'IMEI 1 is required for all phone units.',
            );
          }

          if (seenImeisInRequest.has(imei1)) {
            throw new ConflictException(
              `Duplicate IMEI "${imei1}" found within the submitted purchase order items.`,
            );
          }
          seenImeisInRequest.add(imei1);

          if (imei2) {
            if (seenImeisInRequest.has(imei2)) {
              throw new ConflictException(
                `Duplicate IMEI "${imei2}" found within the submitted purchase order items.`,
              );
            }
            seenImeisInRequest.add(imei2);
          }

          // Check against database across all existing phone units
          const existing = await this.prisma.phoneUnit.findFirst({
            where: {
              OR: [
                { imei1 },
                { imei2: imei1 },
                ...(imei2 ? [{ imei1: imei2 }, { imei2 }] : []),
              ],
            },
          });

          if (existing) {
            throw new ConflictException(
              `IMEI "${imei1}" already exists in the system (Status: ${existing.status}). Two phones cannot share an IMEI.`,
            );
          }

          allPhoneUnitsToCreate.push({
            variantId: item.variantId || null,
            productId: item.productId || null,
            imei1,
            imei2: imei2 || null,
            serialNumber: pu.serialNumber?.trim() || null,
            condition: pu.condition || null,
            buyingPrice:
              pu.buyingPrice !== undefined
                ? Number(pu.buyingPrice)
                : Number(item.unitCost),
            sellingPrice:
              pu.sellingPrice !== undefined
                ? Number(pu.sellingPrice)
                : Number(item.sellingPrice || 0),
            warrantyType: pu.warrantyType || null,
            warrantyPeriod: pu.warrantyPeriod || null,
            warrantyStartDate: pu.warrantyStartDate || null,
            warrantyEndDate: pu.warrantyEndDate || null,
          });
        }
      }
    }

    const dueAmount = Math.max(0, grandTotal - totalAmountPaid);
    const poNumber = `PO-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
    const isDraft = dto.status === PurchaseOrderStatus.DRAFT;

    return this.prisma.$transaction(async (tx) => {
      const createdPayments: any[] = [];
      const createdWalletTxns: any[] = [];

      // If NOT a draft, process financial movements
      if (!isDraft) {
        // Process each wallet payment
        for (let i = 0; i < walletPayments.length; i++) {
          const wp = walletPayments[i];
          const wallet = await tx.walletType.findUnique({
            where: { id: wp.walletTypeId },
          });
          if (!wallet) {
            throw new NotFoundException(
              `Payment wallet "${wp.walletTypeId}" not found.`,
            );
          }

          const currentBal = Number(wallet.currentBalance);
          if (currentBal < wp.amount) {
            throw new BadRequestException(
              `Insufficient balance in wallet "${wallet.name}". Required: ৳${wp.amount.toLocaleString()}, Available: ৳${currentBal.toLocaleString()}.`,
            );
          }

          const newBal = currentBal - wp.amount;
          await tx.walletType.update({
            where: { id: wp.walletTypeId },
            data: { currentBalance: newBal },
          });

          const payRef = `SPAY-${Date.now()}-${i + 1}`;
          const walletTxn = await tx.walletTransaction.create({
            data: {
              walletTypeId: wp.walletTypeId,
              type: WalletTxnType.WITHDRAWAL,
              amount: wp.amount,
              referenceNo: `TXN-${payRef}`,
              note: `Payment for PO ${poNumber} (Wallet: ${wallet.name})`,
              recordedById,
              balanceAfter: newBal,
            },
          });
          createdWalletTxns.push(walletTxn);
        }

        // Deduct advance balance from supplier if used
        if (advanceUsed > 0) {
          const newAdvanceBal = Number(supplier.advanceBalance) - advanceUsed;
          await tx.supplier.update({
            where: { id: dto.supplierId },
            data: { advanceBalance: newAdvanceBal },
          });
        }
      }

      // Create Purchase Order
      const po = await tx.purchaseOrder.create({
        data: {
          poNumber,
          invoiceNumber: dto.invoiceNumber || null,
          documentUrl: dto.documentUrl || null,
          internalNotes: dto.internalNotes || dto.note || null,
          branchId,
          supplierId: dto.supplierId,
          expectedDeliveryDate: dto.expectedDeliveryDate
            ? new Date(dto.expectedDeliveryDate)
            : null,
          status: dto.status || PurchaseOrderStatus.ORDERED,
          subtotal,
          discount,
          shippingCost,
          tax,
          grandTotal,
          amountPaid: isDraft ? 0 : totalAmountPaid,
          advanceUsed: isDraft ? 0 : advanceUsed,
          dueAmount: isDraft ? grandTotal : dueAmount,
          items: {
            create: itemsData,
          },
        },
        include: {
          items: true,
          supplier: true,
          branch: true,
        },
      });

      // Create PhoneUnit records if any were supplied in this purchase
      if (allPhoneUnitsToCreate.length > 0) {
        for (const pu of allPhoneUnitsToCreate) {
          let resolvedVariantId = pu.variantId;
          if (!resolvedVariantId) {
            const matchedItem =
              po.items.find((i) => i.productId === pu.productId) || po.items[0];
            resolvedVariantId = matchedItem?.variantId || null;
          }

          if (resolvedVariantId) {
            await tx.phoneUnit.create({
              data: {
                productVariantId: resolvedVariantId,
                branchId,
                imei1: pu.imei1,
                imei2: pu.imei2,
                serialNumber: pu.serialNumber,
                status: 'IN_STOCK',
                buyingPrice: pu.buyingPrice || 0,
                sellingPrice: pu.sellingPrice || 0,
                purchaseId: po.id,
                warrantyType: pu.warrantyType,
                warrantyPeriod: pu.warrantyPeriod,
                warrantyStartDate: pu.warrantyStartDate
                  ? new Date(pu.warrantyStartDate)
                  : new Date(),
                warrantyEndDate: pu.warrantyEndDate
                  ? new Date(pu.warrantyEndDate)
                  : null,
              },
            });

            // Increment variant stock for each phone unit if not already receiving below
            if (
              dto.status !== PurchaseOrderStatus.RECEIVED &&
              (dto.status as any) !== 'COMPLETED'
            ) {
              await tx.productVariant.update({
                where: { id: resolvedVariantId },
                data: { stock: { increment: 1 } },
              });
            }
          }
        }
      }

      // Create SupplierPayment records if not draft
      if (!isDraft && walletPayments.length > 0) {
        for (let i = 0; i < walletPayments.length; i++) {
          const wp = walletPayments[i];
          const sp = await tx.supplierPayment.create({
            data: {
              referenceNo: `SPAY-${po.poNumber}-${i + 1}`,
              supplierId: dto.supplierId,
              amount: wp.amount,
              method: 'WALLET',
              walletTypeId: wp.walletTypeId,
              purchaseOrderId: po.id,
              note:
                dto.internalNotes ||
                dto.note ||
                `Payment on PO creation (${i + 1}/${walletPayments.length})`,
              recordedById,
            },
          });
          createdPayments.push(sp);
        }
      }

      // If NOT a draft, increase supplier totalDue by unpaid dueAmount
      if (!isDraft && dueAmount > 0) {
        const currentSupplierDue = Number(supplier.totalDue);
        await tx.supplier.update({
          where: { id: dto.supplierId },
          data: { totalDue: currentSupplierDue + dueAmount },
        });
      }

      // If status is RECEIVED or COMPLETED, intake stock into branch inventory immediately
      if (
        !isDraft &&
        (dto.status === PurchaseOrderStatus.RECEIVED ||
          (dto.status as any) === 'COMPLETED')
      ) {
        for (const item of po.items) {
          await tx.purchaseOrderItem.update({
            where: { id: item.id },
            data: { quantityReceived: item.quantityOrdered },
          });

          if (item.variantId) {
            await tx.branchInventory.upsert({
              where: {
                branchId_productVariantId: {
                  branchId,
                  productVariantId: item.variantId,
                },
              },
              create: {
                branchId,
                productVariantId: item.variantId,
                quantity: Number(item.quantityOrdered),
              },
              update: {
                quantity: { increment: Number(item.quantityOrdered) },
              },
            });

            const variantUpdateData: Prisma.ProductVariantUpdateInput = {
              stock: { increment: Number(item.quantityOrdered) },
            };
            if (item.sellingPrice !== null && item.sellingPrice !== undefined) {
              variantUpdateData.price = item.sellingPrice;
            }
            if (
              item.wholesalePrice !== null &&
              item.wholesalePrice !== undefined
            ) {
              variantUpdateData.wholesalePrice = item.wholesalePrice;
            }
            if (item.unitCost !== null && item.unitCost !== undefined) {
              variantUpdateData.buyingPrice = item.unitCost;
            }

            await tx.productVariant.update({
              where: { id: item.variantId },
              data: variantUpdateData,
            });
          }
        }
      }

      return {
        ...po,
        purchaseOrder: po,
        supplierPayments: createdPayments,
        walletTransactions: createdWalletTxns,
      };
    });
  }

  async complete(id: string, user?: JwtPayload | string) {
    const userPayload = typeof user === 'object' ? user : undefined;
    const po = await this.findOne(id, userPayload);
    const recordedById = typeof user === 'string' ? user : user?.sub || 'system';
    if (po.status === PurchaseOrderStatus.RECEIVED) {
      return po;
    }

    const unreceivedItems = po.items
      .map((i) => ({
        purchaseOrderItemId: i.id,
        variantId: i.variantId || undefined,
        quantityReceived: Math.max(
          0,
          Number(i.quantityOrdered) - Number(i.quantityReceived),
        ),
      }))
      .filter((i) => i.quantityReceived > 0);

    if (unreceivedItems.length > 0) {
      await this.receiveItems(id, { items: unreceivedItems }, userPayload);
    }

    return this.findOne(id, userPayload);
  }

  async receiveItems(id: string, dto: ReceivePurchaseOrderDto, user?: JwtPayload) {
    const po = await this.findOne(id, user);

    if (po.status === PurchaseOrderStatus.CANCELLED) {
      throw new BadRequestException(
        'Cannot receive items on a cancelled purchase order.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      for (const receivedItem of dto.items) {
        const poItem = po.items.find(
          (i) =>
            i.id === receivedItem.purchaseOrderItemId ||
            (receivedItem.variantId && i.variantId === receivedItem.variantId),
        );
        if (!poItem) {
          throw new NotFoundException(
            `Purchase order item "${receivedItem.purchaseOrderItemId || receivedItem.variantId}" not found in this order.`,
          );
        }

        const newReceivedQty =
          Number(poItem.quantityReceived) +
          Number(receivedItem.quantityReceived);

        await tx.purchaseOrderItem.update({
          where: { id: poItem.id },
          data: { quantityReceived: newReceivedQty },
        });

        // Increase product variant stock and sync pricing if specified
        if (poItem.variantId) {
          await tx.branchInventory.upsert({
            where: {
              branchId_productVariantId: {
                branchId: po.branchId,
                productVariantId: poItem.variantId,
              },
            },
            create: {
              branchId: po.branchId,
              productVariantId: poItem.variantId,
              quantity: Number(receivedItem.quantityReceived),
            },
            update: {
              quantity: { increment: Number(receivedItem.quantityReceived) },
            },
          });

          const variantUpdateData: Prisma.ProductVariantUpdateInput = {
            stock: { increment: Number(receivedItem.quantityReceived) },
          };

          if (
            poItem.sellingPrice !== null &&
            poItem.sellingPrice !== undefined
          ) {
            variantUpdateData.price = poItem.sellingPrice;
          }
          if (
            poItem.wholesalePrice !== null &&
            poItem.wholesalePrice !== undefined
          ) {
            variantUpdateData.wholesalePrice = poItem.wholesalePrice;
          }
          if (poItem.unitCost !== null && poItem.unitCost !== undefined) {
            variantUpdateData.buyingPrice = poItem.unitCost;
          }

          await tx.productVariant.update({
            where: { id: poItem.variantId },
            data: variantUpdateData,
          });
        }

        // Sync Product offer price (salePrice) if offerPrice is present on line item
        if (
          poItem.offerPrice !== null &&
          poItem.offerPrice !== undefined &&
          poItem.productId
        ) {
          await tx.product.update({
            where: { id: poItem.productId },
            data: { salePrice: poItem.offerPrice },
          });
        }
      }

      // Re-evaluate PO status
      const updatedPoItems = await tx.purchaseOrderItem.findMany({
        where: { purchaseOrderId: id },
      });

      const allFullyReceived = updatedPoItems.every(
        (i) => i.quantityReceived >= i.quantityOrdered,
      );
      const someReceived = updatedPoItems.some((i) => i.quantityReceived > 0);

      const nextStatus = allFullyReceived
        ? PurchaseOrderStatus.RECEIVED
        : someReceived
          ? PurchaseOrderStatus.PARTIALLY_RECEIVED
          : po.status;

      return tx.purchaseOrder.update({
        where: { id },
        data: { status: nextStatus },
        include: {
          items: {
            include: {
              product: true,
              variant: true,
            },
          },
          supplier: true,
          branch: true,
        },
      });
    });
  }

  async returnItems(
    id: string,
    dto: ReturnPurchaseOrderDto,
    user?: JwtPayload | string,
  ) {
    const userPayload = typeof user === 'object' ? user : undefined;
    const po = await this.findOne(id, userPayload);
    const staffId = typeof user === 'string' ? user : user?.sub || 'system';

    if (
      po.status === PurchaseOrderStatus.CANCELLED ||
      po.status === PurchaseOrderStatus.DRAFT
    ) {
      throw new BadRequestException(
        `Cannot return items on a ${po.status} purchase order.`,
      );
    }

    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException(
        'At least one item must be selected for return.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      let totalReturnedValue = 0;
      const returnNotes: string[] = [];

      for (const retItem of dto.items) {
        const poItem = po.items.find(
          (i) => i.id === retItem.purchaseOrderItemId,
        );
        if (!poItem) {
          throw new NotFoundException(
            `Purchase order item "${retItem.purchaseOrderItemId}" not found in this order.`,
          );
        }

        const maxAvailable =
          poItem.quantityReceived > 0
            ? poItem.quantityReceived
            : poItem.quantityOrdered;
        if (retItem.quantityReturned > maxAvailable) {
          throw new BadRequestException(
            `Cannot return ${retItem.quantityReturned} units of "${poItem.product?.name}". Max received/ordered is ${maxAvailable}.`,
          );
        }

        const lineCost = Number(poItem.unitCost);
        const itemReturnValue = retItem.quantityReturned * lineCost;
        totalReturnedValue += itemReturnValue;

        // Decrease stock on product variant if received
        if (poItem.variantId) {
          const currentVariant = await tx.productVariant.findUnique({
            where: { id: poItem.variantId },
            select: { stock: true },
          });
          const stockBefore = currentVariant?.stock ?? 0;
          if (stockBefore < retItem.quantityReturned) {
            throw new BadRequestException(
              `Insufficient stock available to return "${poItem.product?.name || 'item'}". Current stock: ${stockBefore}, requested return: ${retItem.quantityReturned}.`,
            );
          }
          const stockAfter = stockBefore - retItem.quantityReturned;

          await tx.productVariant.update({
            where: { id: poItem.variantId },
            data: { stock: stockAfter },
          });

          // Create a StockAdjustment record for audit trace
          const refNo = `SA-RET-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
          await tx.stockAdjustment.create({
            data: {
              referenceNo: refNo,
              branchId: po.branchId,
              productId: poItem.productId,
              variantId: poItem.variantId,
              type: StockAdjustmentType.DECREASE,
              quantityChange: -retItem.quantityReturned,
              stockBefore,
              stockAfter,
              reason: `Purchase Return: ${retItem.reason || 'Returned to supplier'} (PO: ${po.poNumber})`,
              adjustedById: staffId,
            },
          });
        }

        // Adjust quantityReceived / quantityOrdered on item
        await tx.purchaseOrderItem.update({
          where: { id: poItem.id },
          data: {
            quantityOrdered: Math.max(
              0,
              poItem.quantityOrdered - retItem.quantityReturned,
            ),
            quantityReceived: Math.max(
              0,
              poItem.quantityReceived - retItem.quantityReturned,
            ),
            lineTotal: Math.max(0, Number(poItem.lineTotal) - itemReturnValue),
          },
        });

        returnNotes.push(
          `Returned ${retItem.quantityReturned}x ${poItem.product?.name} (৳${itemReturnValue}) [Reason: ${retItem.reason || 'N/A'}]`,
        );
      }

      // Accounting Adjustments
      const currentGrandTotal = Number(po.grandTotal);
      const newGrandTotal = Math.max(0, currentGrandTotal - totalReturnedValue);
      const currentAmountPaid = Number(po.amountPaid);
      let newAmountPaid = currentAmountPaid;
      let creditRefund = 0;

      // If grand total becomes less than what was paid, credit difference to supplier advance balance
      if (newGrandTotal < currentAmountPaid) {
        creditRefund = currentAmountPaid - newGrandTotal;
        newAmountPaid = newGrandTotal;

        const currentSupplierAdvance = Number(po.supplier.advanceBalance || 0);
        await tx.supplier.update({
          where: { id: po.supplierId },
          data: { advanceBalance: currentSupplierAdvance + creditRefund },
        });
      }

      const newDueAmount = Math.max(0, newGrandTotal - newAmountPaid);
      const dueReduction = Number(po.dueAmount) - newDueAmount;

      if (dueReduction > 0) {
        const currentSupplierDue = Number(po.supplier.totalDue || 0);
        await tx.supplier.update({
          where: { id: po.supplierId },
          data: { totalDue: Math.max(0, currentSupplierDue - dueReduction) },
        });
      }

      const updatedNotes = [
        po.internalNotes,
        `[RETURN ${new Date().toISOString()} by staff ${staffId}]: ${returnNotes.join('; ')} (Total Returned: ৳${totalReturnedValue}, Advance Credit: ৳${creditRefund})`,
      ]
        .filter(Boolean)
        .join('\n');

      return tx.purchaseOrder.update({
        where: { id },
        data: {
          grandTotal: newGrandTotal,
          subtotal: Math.max(0, Number(po.subtotal) - totalReturnedValue),
          amountPaid: newAmountPaid,
          dueAmount: newDueAmount,
          internalNotes: updatedNotes,
        },
        include: {
          items: {
            include: {
              product: true,
              variant: true,
            },
          },
          supplier: true,
          branch: true,
        },
      });
    });
  }

  async attachDocument(id: string, file: Express.Multer.File, user?: JwtPayload) {
    const po = await this.findOne(id, user);
    const documentUrl =
      (await resolveUploadedFile(file, 'purchase-documents')) ||
      `/uploads/purchase-documents/${file.filename}`;

    return this.prisma.purchaseOrder.update({
      where: { id: po.id },
      data: { documentUrl },
    });
  }

  async streamDocument(id: string, user: JwtPayload, res: Response) {
    const po = await this.prisma.purchaseOrder.findUnique({
      where: { id },
      select: { id: true, branchId: true, documentUrl: true },
    });

    if (!po) {
      throw new NotFoundException(`Purchase Order "${id}" not found.`);
    }

    await this.branchScopeService.validateBranchAccess(user, po.branchId);

    if (!po.documentUrl) {
      throw new NotFoundException('No document attached to this purchase order.');
    }

    const resolved = resolvePrivateFilePath('purchase-documents', po.documentUrl);
    if (!resolved) {
      throw new NotFoundException('Document file not found on disk.');
    }

    streamLocalFile(resolved, res);
  }

  async cancel(id: string, user?: JwtPayload) {
    const po = await this.findOne(id, user);

    if (
      po.status !== PurchaseOrderStatus.DRAFT &&
      po.status !== PurchaseOrderStatus.ORDERED
    ) {
      throw new BadRequestException(
        `Cannot cancel purchase order in "${po.status}" status. Only DRAFT or ORDERED purchase orders can be cancelled.`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      // Revert supplier due amount if ordered
      const dueAmount = Number(po.dueAmount);
      if (dueAmount > 0 && po.status !== PurchaseOrderStatus.DRAFT) {
        const supplier = await tx.supplier.findUnique({
          where: { id: po.supplierId },
        });
        if (supplier) {
          const newSupplierDue = Math.max(
            0,
            Number(supplier.totalDue) - dueAmount,
          );
          await tx.supplier.update({
            where: { id: po.supplierId },
            data: { totalDue: newSupplierDue },
          });
        }
      }

      return tx.purchaseOrder.update({
        where: { id },
        data: { status: PurchaseOrderStatus.CANCELLED },
        include: {
          items: true,
          supplier: true,
          branch: true,
        },
      });
    });
  }

  async remove(id: string, user: JwtPayload) {
    const po = await this.findOne(id, user);

    if (po.status !== PurchaseOrderStatus.DRAFT) {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        message: `Cannot delete purchase order "${po.poNumber}" with status "${po.status}". Only DRAFT purchase orders can be deleted. Please cancel or return items instead.`,
        canDeactivate: false,
      });
    }

    if (po.payments && po.payments.length > 0) {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        message: `Cannot delete purchase order "${po.poNumber}" because it has ${po.payments.length} linked supplier payment(s).`,
        canDeactivate: false,
      });
    }

    const hasReceivedItems = po.items.some((i: any) => i.quantityReceived > 0);
    if (hasReceivedItems) {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        message: `Cannot delete purchase order "${po.poNumber}" because items have already been received into stock.`,
        canDeactivate: false,
      });
    }

    if (po.documentUrl) {
      await storageService.safeUnlink(po.documentUrl);
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: id } });
      return tx.purchaseOrder.delete({ where: { id } });
    });
  }
}
