import React from "react";
import {
  Smartphone,
  Wrench,
  Headphones,
  Watch,
  MapPin,
  Phone,
  Globe,
} from "lucide-react";
import { numberToWords } from "@/lib/number-to-words";
import { OFFICIAL_CONTACT } from "@/config/contact";

export interface PosInvoiceReceiptProps {
  order: any;
  shopSettings?: any;
}

export function PosInvoiceReceipt({ order, shopSettings }: PosInvoiceReceiptProps) {
  if (!order) return null;

  // Dynamic Store & Branch Information
  const shopName =
    order.branch?.name
      ? `MOBILE HUB BD (${order.branch.name.toUpperCase()})`
      : shopSettings?.companyName || OFFICIAL_CONTACT.storeName;

  const shopAddress =
    order.branch?.address ||
    shopSettings?.address ||
    shopSettings?.companyAddress ||
    OFFICIAL_CONTACT.address.en;

  const shopPhone =
    order.branch?.phone ||
    shopSettings?.phone ||
    shopSettings?.companyPhone ||
    OFFICIAL_CONTACT.phone.display;

  const shopWebsite =
    shopSettings?.website ||
    shopSettings?.siteUrl ||
    OFFICIAL_CONTACT.website;

  // Customer Information
  const customerName =
    order.customer?.name ||
    order.customerName ||
    order.serviceJob?.customerName ||
    "Walk-in Customer";

  const customerPhone =
    order.customer?.phone ||
    order.customerPhone ||
    order.serviceJob?.customerPhone ||
    "";

  const customerAddress =
    order.customer?.address ||
    order.shippingAddress?.fullAddress ||
    (typeof order.shippingAddress === "string" ? order.shippingAddress : "") ||
    "";

  const customerNid =
    order.customer?.nid ||
    order.customer?.passportNo ||
    order.nid ||
    "";

  // Format Date (e.g. 29-09-2026)
  const formattedDate = new Date(order.createdAt || Date.now()).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  // ---------------------------------------------------------------------------
  // TEMPLATE SELECTION:
  // Template A ("Mobile Device Sale"): Order contains at least one PhoneUnit / IMEI item
  // Template B ("Normal Purchase"): Order contains ONLY non-phone accessories/parts
  // Mixed-Cart: Defaults to Template A for legal IMEI warranty compliance
  // ---------------------------------------------------------------------------
  const isMobileDeviceOrder = Boolean(
    order.items?.some((item: any) => {
      const hasPhoneUnits = Array.isArray(item.phoneUnits) && item.phoneUnits.length > 0;
      return (
        hasPhoneUnits ||
        Boolean(item.phoneUnit) ||
        Boolean(item.phoneUnitId) ||
        Boolean(item.isPhone) ||
        Boolean(item.product?.isPhone)
      );
    })
  );

  // Display Item Check for Template B "WITHOUT DISPLAY GUARANTEE" Warning
  const hasDisplayItem = Boolean(
    order.items?.some((item: any) => {
      const name = (item.productNameSnapshot || item.product?.name || "").toLowerCase();
      const cat = (item.categoryName || item.product?.category?.name || item.categorySlug || "").toLowerCase();
      const qual = (item.variant?.quality || "").toLowerCase();
      return (
        name.includes("display") ||
        name.includes("screen") ||
        name.includes("lcd") ||
        name.includes("oled") ||
        name.includes("touch") ||
        cat.includes("display") ||
        cat.includes("screen") ||
        cat.includes("lcd") ||
        cat.includes("oled") ||
        qual.includes("display")
      );
    })
  );

  // Phone items & IMEI details for Template A
  const phoneItems = order.items?.filter((item: any) => {
    const hasPhoneUnits = Array.isArray(item.phoneUnits) && item.phoneUnits.length > 0;
    return (
      hasPhoneUnits ||
      Boolean(item.phoneUnit) ||
      Boolean(item.phoneUnitId) ||
      Boolean(item.isPhone) ||
      Boolean(item.product?.isPhone)
    );
  }) || [];

  const nonPhoneItems = order.items?.filter((item: any) => !phoneItems.includes(item)) || [];

  // Primary Sold Phone Unit Details
  const primaryPhoneItem = phoneItems[0];
  const primaryPhoneUnit = primaryPhoneItem?.phoneUnits?.[0] || primaryPhoneItem?.phoneUnit;
  const rawImei1 = primaryPhoneUnit?.imei1 || primaryPhoneItem?.imei1 || "";
  const rawImei2 = primaryPhoneUnit?.imei2 || primaryPhoneItem?.imei2 || "";
  const primaryImeiDigits = rawImei1.replace(/\D/g, "").slice(0, 15).split("");
  const secondaryImeiDigits = rawImei2.replace(/\D/g, "").slice(0, 15).split("");

  // Old Device / Trade-in Information (Exchange)
  const exchangeRecord = order.exchange || order.oldDevice;
  const oldImeiRaw = exchangeRecord?.oldOrderItem?.phoneUnit?.imei1 || exchangeRecord?.imei || "";
  const oldImeiDigits = oldImeiRaw.replace(/\D/g, "").slice(0, 15).split("");
  const oldDeviceNid = exchangeRecord?.nid || exchangeRecord?.passportNo || "";
  const oldDeviceDescription = exchangeRecord?.oldOrderItem?.productNameSnapshot || exchangeRecord?.model || "";
  const oldDeviceCredit = Number(exchangeRecord?.priceDifference || exchangeRecord?.tradeInValue || 0);

  // Amount In Words
  const totalInWords = numberToWords(order.totalAmount || 0);

  return (
    <div
      id="printable-receipt"
      className="w-[210mm] min-w-[210mm] min-h-[297mm] bg-white text-slate-900 font-sans relative shadow-xl print:shadow-none print:m-0 print:border-none p-8 sm:p-10 flex flex-col justify-between shrink-0"
      style={{
        width: "210mm",
        minHeight: "297mm",
        boxSizing: "border-box",
        WebkitPrintColorAdjust: "exact",
        printColorAdjust: "exact",
      }}
    >
      {/* Top-Right Diagonal Decorative Polygon */}
      <div className="absolute top-0 right-0 w-[24mm] h-[24mm] pointer-events-none overflow-hidden z-0 print:block">
        <svg viewBox="0 0 100 100" className="w-full h-full">
          <polygon points="25,0 100,0 100,75" fill="#15803d" />
          <polygon points="10,0 25,0 100,75 100,90" fill="#facc15" />
        </svg>
      </div>

      {/* Bottom-Left Diagonal Decorative Polygon */}
      <div className="absolute bottom-0 left-0 w-[24mm] h-[24mm] pointer-events-none overflow-hidden z-0 print:block">
        <svg viewBox="0 0 100 100" className="w-full h-full">
          <polygon points="0,25 0,100 75,100" fill="#15803d" />
          <polygon points="0,10 0,25 75,100 90,100" fill="#facc15" />
        </svg>
      </div>

      {/* ======================================================================= */}
      {/* COMMON HEADER BLOCK                                                     */}
      {/* ======================================================================= */}
      <div className="relative z-10">
        <div className="flex items-start justify-between gap-4">
          {/* Left Brand Identity */}
          <div className="flex items-center gap-3">
            <div className="w-16 h-16 rounded-full border-2 border-emerald-600 overflow-hidden flex items-center justify-center bg-white shrink-0 shadow-sm -mt-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                id="invoice-store-logo"
                src="/images/logo-icon.jpeg"
                alt="Mobile Hub BD"
                width={64}
                height={64}
                crossOrigin="anonymous"
                className="w-full h-full object-cover scale-105"
                loading="eager"
              />
            </div>
            <div>
              <h1 className="text-[28px] font-black text-slate-900 tracking-tight leading-none uppercase">
                MOBILE HUB BD
              </h1>
              <div className="flex items-center gap-1.5 text-[9px] font-black text-slate-800 mt-1 uppercase tracking-tight">
                <span className="flex items-center gap-0.5"><Smartphone className="w-2.5 h-2.5 text-emerald-700" /> PHONE</span>
                <span className="text-slate-400">|</span>
                <span className="flex items-center gap-0.5"><Wrench className="w-2.5 h-2.5 text-emerald-700" /> SERVICE</span>
                <span className="text-slate-400">|</span>
                <span className="flex items-center gap-0.5"><Headphones className="w-2.5 h-2.5 text-emerald-700" /> ACCESSORIES</span>
                <span className="text-slate-400">|</span>
                <span className="flex items-center gap-0.5"><Watch className="w-2.5 h-2.5 text-emerald-700" /> GADGET</span>
              </div>
            </div>
          </div>

          {/* Right Outlet Details - Constrained to prevent collision with top-right 24mm diagonal ribbon */}
          <div className="text-right text-[11px] text-slate-700 space-y-0.5 max-w-[220px] relative z-20 pr-4">
            <div className="flex items-start justify-end gap-1.5 font-medium leading-tight">
              <MapPin className="w-3.5 h-3.5 text-emerald-700 shrink-0 mt-0.5" />
              <span className="line-clamp-2">{shopAddress}</span>
            </div>
            <div className="flex items-center justify-end gap-1.5 font-bold">
              <Phone className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
              <span className="font-mono">{shopPhone}</span>
            </div>
            <div className="flex items-center justify-end gap-1.5 font-medium">
              <Globe className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
              <span className="font-mono text-[10px] text-slate-800 truncate">{shopWebsite}</span>
            </div>
          </div>
        </div>

        {/* Horizontal Divider Bar with Centered Green CASH MEMO Badge in Normal Document Flow */}
        <div className="flex items-center gap-2 my-2.5">
          <div className="flex-1 border-t-2 border-slate-900" />
          <div className="shrink-0 bg-[#15803d] text-white text-xs font-black px-6 h-7 flex items-center justify-center rounded-full tracking-wider uppercase shadow-sm leading-none">
            CASH MEMO
          </div>
          <div className="flex-1 border-t-2 border-slate-900" />
        </div>

        {/* Customer & Invoice Dotted Metadata Grid */}
        <div className="space-y-2 text-xs text-slate-900 pt-0.5">
          <div className="flex items-end justify-between gap-6">
            <div className="flex items-end gap-1.5 flex-1 min-w-0">
              <span className="font-bold text-slate-900 shrink-0 leading-none pb-0.5">Sl.&nbsp;No.&nbsp;:</span>
              <span className="font-mono font-bold text-slate-900 px-1 leading-none shrink-0 pb-0.5">
                {order.orderCode}
              </span>
              <div className="flex-1 min-w-4 border-b border-dotted border-slate-700 mb-0.5" />
            </div>
            <div className="flex items-end gap-1.5 w-52 shrink-0">
              <span className="font-bold text-slate-900 shrink-0 leading-none pb-0.5">Date&nbsp;:</span>
              <span className="font-semibold text-slate-900 px-1 leading-none shrink-0 pb-0.5">
                {formattedDate}
              </span>
              <div className="flex-1 min-w-4 border-b border-dotted border-slate-700 mb-0.5" />
            </div>
          </div>

          <div className="flex items-end justify-between gap-6">
            <div className="flex items-end gap-1.5 flex-1 min-w-0">
              <span className="font-bold text-slate-900 shrink-0 leading-none pb-0.5">Customer&nbsp;Name&nbsp;:</span>
              <span className="font-bold text-slate-900 px-1 leading-none shrink-0 pb-0.5 truncate max-w-[280px]">
                {customerName}
              </span>
              <div className="flex-1 min-w-4 border-b border-dotted border-slate-700 mb-0.5" />
            </div>
            <div className="flex items-end gap-1.5 w-64 shrink-0">
              <span className="font-bold text-slate-900 shrink-0 leading-none pb-0.5">Contact&nbsp;No.&nbsp;:</span>
              <span className="font-mono font-bold text-slate-900 px-1 leading-none shrink-0 pb-0.5">
                {customerPhone}
              </span>
              <div className="flex-1 min-w-4 border-b border-dotted border-slate-700 mb-0.5" />
            </div>
          </div>

          <div className="flex items-end gap-1.5 w-full">
            <span className="font-bold text-slate-900 shrink-0 leading-none pb-0.5">Address&nbsp;:</span>
            <span className="text-slate-800 px-1 leading-none shrink-0 pb-0.5 truncate max-w-[650px]">
              {customerAddress}
            </span>
            <div className="flex-1 min-w-4 border-b border-dotted border-slate-700 mb-0.5" />
          </div>
        </div>
      </div>

      {/* ======================================================================= */}
      {/* BODY: TEMPLATE A vs TEMPLATE B                                          */}
      {/* ======================================================================= */}

      {isMobileDeviceOrder ? (
        /* --------------------------------------------------------------------- */
        /* TEMPLATE A: MOBILE DEVICE SALE (New/Old Device Info & IMEI Boxes)    */
        /* --------------------------------------------------------------------- */
        <div className="mt-3 relative z-10 flex flex-col flex-1 justify-between">
          <div className="border border-slate-900 relative overflow-hidden bg-white">
            {/* Watermark in Table Center */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none opacity-[0.04] select-none z-0">
              <div className="w-48 h-48 rounded-full border-4 border-emerald-800 flex items-center justify-center p-3">
                <span className="font-black text-6xl text-emerald-900">MH</span>
              </div>
              <span className="font-black text-xl text-emerald-900 tracking-widest mt-2 uppercase">
                MOBILE HUB BD
              </span>
            </div>

            {/* Table Header */}
            <div className="grid grid-cols-12 bg-[#15803d] text-white font-extrabold text-xs tracking-wider uppercase border-b border-slate-900 relative z-10">
              <div className="col-span-9 py-1.5 px-3 text-left">DESCRIPTION</div>
              <div className="col-span-3 py-1.5 px-3 text-right">Amount</div>
            </div>

            {/* New Device Info Block */}
            <div className="grid grid-cols-12 relative z-10 border-b border-slate-900 min-h-[140px]">
              <div className="col-span-9 p-3 flex flex-col justify-between border-r border-slate-900">
                <div>
                  <div className="font-bold italic text-slate-900 text-xs mb-1.5">New Device info.</div>
                  {phoneItems.map((item: any, idx: number) => {
                    const pu = item.phoneUnits?.[0] || item.phoneUnit;
                    return (
                      <div key={idx} className="mb-2">
                        <div className="font-extrabold text-slate-900 text-xs">
                          {item.productNameSnapshot || item.product?.name || "Mobile Device"}
                        </div>
                        <div className="text-[11px] text-slate-600 mt-0.5">
                          {item.variant?.color ? `Color: ${item.variant.color}` : ""}
                          {item.variant?.quality ? ` • Quality: ${item.variant.quality}` : ""}
                          {pu?.condition || item.condition ? ` • Condition: ${pu?.condition || item.condition}` : ""}
                          {pu?.serialNumber ? ` • Serial: ${pu.serialNumber}` : ""}
                        </div>
                        {(pu?.warrantyType || item.warrantyType) && (
                          <div className="text-[11px] text-emerald-800 font-semibold mt-0.5">
                            Warranty: {pu?.warrantyType || item.warrantyType}{" "}
                            {pu?.warrantyPeriod || item.warrantyPeriod ? `(${pu?.warrantyPeriod || item.warrantyPeriod})` : ""}
                            {(pu?.warrantyEndDate || item.warrantyEndDate) && (
                              <span className="text-slate-500 font-normal">
                                {" "}• Exp: {new Date(pu?.warrantyEndDate || item.warrantyEndDate).toLocaleDateString("en-GB")}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Display any bundled accessories in mixed-cart */}
                  {nonPhoneItems.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-slate-200 text-[11px] text-slate-700">
                      <span className="font-bold text-slate-900">Bundled Items: </span>
                      {nonPhoneItems.map((npi: any, idx: number) => (
                        <span key={idx}>
                          {npi.productNameSnapshot || npi.product?.name} (Qty: {npi.quantity})
                          {idx < nonPhoneItems.length - 1 ? ", " : ""}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* IMEI 1 and IMEI 2 Boxed Digits */}
                <div className="space-y-1.5 mt-3 pt-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-slate-900 w-12 shrink-0">IMEI :</span>
                    <div className="flex border border-slate-900 bg-white">
                      {Array.from({ length: 15 }).map((_, idx) => (
                        <div
                          key={idx}
                          className="w-[18px] h-5 border-r border-slate-900 last:border-r-0 flex items-center justify-center font-mono font-bold text-[11px] text-slate-900"
                        >
                          {primaryImeiDigits[idx] || ""}
                        </div>
                      ))}
                    </div>
                  </div>

                  {rawImei2 && (
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-slate-900 w-12 shrink-0">IMEI 2:</span>
                      <div className="flex border border-slate-900 bg-white">
                        {Array.from({ length: 15 }).map((_, idx) => (
                          <div
                            key={idx}
                            className="w-[18px] h-5 border-r border-slate-900 last:border-r-0 flex items-center justify-center font-mono font-bold text-[11px] text-slate-900"
                          >
                            {secondaryImeiDigits[idx] || ""}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex items-end gap-1.5 text-xs pt-1">
                    <span className="font-bold text-slate-900 shrink-0 leading-none pb-0.5">NID/PP&nbsp;No.&nbsp;:</span>
                    {customerNid ? (
                      <span className="font-mono text-slate-900 px-1 leading-none shrink-0 pb-0.5">
                        {customerNid}
                      </span>
                    ) : null}
                    <div className="flex-1 min-w-4 border-b border-dotted border-slate-700 mb-0.5" />
                  </div>
                </div>
              </div>

              <div className="col-span-3 p-3 text-right font-extrabold text-sm text-slate-900">
                ৳{Number(order.subtotal || order.totalAmount || 0).toLocaleString()}
              </div>
            </div>

            {/* Old Device Info Block (Exchange/Trade-in) */}
            <div className="grid grid-cols-12 relative z-10 min-h-[110px]">
              <div className="col-span-9 p-3 flex flex-col justify-between border-r border-slate-900">
                <div>
                  <div className="font-bold italic text-slate-900 text-xs">Old Device info.</div>
                  <div className="flex items-end gap-1.5 text-xs mt-1">
                    <span className="font-semibold italic text-slate-800 shrink-0 leading-none pb-0.5">Passport/NID&nbsp;no.&nbsp;:</span>
                    {oldDeviceNid ? (
                      <span className="font-mono text-slate-900 px-1 leading-none shrink-0 pb-0.5">
                        {oldDeviceNid}
                      </span>
                    ) : null}
                    <div className="flex-1 min-w-4 border-b border-dotted border-slate-700 mb-0.5" />
                  </div>
                  {oldDeviceDescription && (
                    <div className="text-[11px] text-slate-700 mt-1 font-medium">
                      {oldDeviceDescription}
                    </div>
                  )}
                </div>

                {/* Old IMEI 15-Box Row */}
                <div className="flex items-center gap-2 mt-2">
                  <span className="font-bold text-xs text-slate-900 w-12 shrink-0">IMEI :</span>
                  <div className="flex border border-slate-900 bg-white">
                    {Array.from({ length: 15 }).map((_, idx) => (
                      <div
                        key={idx}
                        className="w-[18px] h-5 border-r border-slate-900 last:border-r-0 flex items-center justify-center font-mono font-bold text-[11px] text-slate-900"
                      >
                        {oldImeiDigits[idx] || ""}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="col-span-3 p-3 text-right font-extrabold text-sm text-slate-900">
                {oldDeviceCredit > 0 ? `-৳${Number(oldDeviceCredit).toLocaleString()}` : ""}
              </div>
            </div>

            {/* In Word & Financial Totals Table */}
            <div className="grid grid-cols-12 border-t border-slate-900 relative z-10 bg-white">
              <div className="col-span-8 p-3 flex items-center gap-1.5 border-r border-slate-900">
                <span className="font-bold text-xs text-slate-900 shrink-0">In Word :</span>
                <span className="font-semibold text-xs text-slate-800 italic leading-snug">
                  {totalInWords}
                </span>
              </div>

              <div className="col-span-4 divide-y divide-slate-900">
                <div className="grid grid-cols-2 text-xs">
                  <div className="p-1.5 font-bold text-slate-900 border-r border-slate-900 flex items-center">
                    Total Amount
                  </div>
                  <div className="p-1.5 font-extrabold text-slate-900 bg-[#fef08a] text-right flex items-center justify-end">
                    ৳{Number(order.totalAmount || 0).toLocaleString()}
                  </div>
                </div>
                <div className="grid grid-cols-2 text-xs">
                  <div className="p-1.5 font-bold text-slate-900 border-r border-slate-900 flex items-center">
                    Paid Amount
                  </div>
                  <div className="p-1.5 font-extrabold text-slate-900 bg-[#fef08a] text-right flex items-center justify-end">
                    ৳{Number(order.paidAmount || 0).toLocaleString()}
                  </div>
                </div>
                <div className="grid grid-cols-2 text-xs">
                  <div className="p-1.5 font-bold text-slate-900 border-r border-slate-900 flex items-center">
                    Due Amount
                  </div>
                  <div className="p-1.5 font-extrabold text-slate-900 bg-[#fef08a] text-right flex items-center justify-end">
                    ৳{Number(order.dueAmount || 0).toLocaleString()}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Template A Footer Disclaimers, Tagline & Signatures */}
          <div className="mt-auto pt-6 space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-[10px] text-slate-800 font-medium leading-tight">
                <div>Replacement/Warranty/Guarantee is not applicable for Display</div>
                <div>Service Warranty (Conditionally)</div>
              </div>
              <div className="text-base font-black text-[#15803d] tracking-widest uppercase">
                BUY • SELL • EXCHANGE
              </div>
            </div>

            <div className="flex justify-between items-end pt-9 px-4">
              <div className="text-center">
                <div className="w-40 border-t border-slate-800 mb-1" />
                <div className="text-xs font-bold text-slate-900 whitespace-nowrap">Customer&nbsp;Signature</div>
              </div>
              <div className="text-center pb-1">
                <span className="text-red-600 font-bold text-xs uppercase tracking-wider whitespace-nowrap">
                  WITHOUT&nbsp;DISPLAY&nbsp;GUARANTEE
                </span>
              </div>
              <div className="text-center">
                <div className="w-40 border-t border-slate-800 mb-1" />
                <div className="text-xs font-bold text-slate-900 whitespace-nowrap">Authorise&nbsp;Signature</div>
              </div>
            </div>

            <div className="text-[11px] font-bold text-slate-900 pt-1">
              N.B&nbsp;:&nbsp;For exchange or re-sell please pre-service keep the cash memo.
            </div>
          </div>
        </div>
      ) : (
        /* --------------------------------------------------------------------- */
        /* TEMPLATE B: NORMAL PURCHASE (Parts & Accessories Itemized Table)     */
        /* --------------------------------------------------------------------- */
        <div className="mt-3 relative z-10 flex flex-col flex-1 justify-between">
          <div className="border border-slate-900 relative overflow-hidden bg-white">
            {/* Watermark in Table Center */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none opacity-[0.04] select-none z-0">
              <div className="w-48 h-48 rounded-full border-4 border-emerald-800 flex items-center justify-center p-3">
                <span className="font-black text-6xl text-emerald-900">MH</span>
              </div>
              <span className="font-black text-xl text-emerald-900 tracking-widest mt-2 uppercase">
                MOBILE HUB BD
              </span>
            </div>

            {/* 5-Column Itemized Table */}
            <table className="w-full text-xs border-collapse relative z-10">
              <thead className="bg-[#15803d] text-white font-extrabold tracking-wider uppercase border-b border-slate-900">
                <tr>
                  <th className="py-1.5 px-2 text-center w-12 border-r border-slate-900">SL.</th>
                  <th className="py-1.5 px-3 text-left border-r border-slate-900">DESCRIPTION</th>
                  <th className="py-1.5 px-2 text-center w-14 border-r border-slate-900">QTY.</th>
                  <th className="py-1.5 px-3 text-right w-24 border-r border-slate-900">UNIT PRICE</th>
                  <th className="py-1.5 px-3 text-right w-28">AMOUNT (BDT)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900">
                {order.items?.map((item: any, idx: number) => (
                  <tr key={item.id || idx}>
                    <td className="py-2 px-2 text-center font-bold text-slate-900 border-r border-slate-900">
                      {idx + 1}
                    </td>
                    <td className="py-2 px-3 text-left border-r border-slate-900">
                      <div className="font-bold text-slate-900">
                        {item.productNameSnapshot || item.product?.name || "Item"}
                      </div>
                      {item.variant && (
                        <div className="text-[11px] text-slate-600 mt-0.5">
                          {item.variant.color ? `Color: ${item.variant.color}` : ""}
                          {item.variant.quality ? ` • Quality: ${item.variant.quality}` : ""}
                        </div>
                      )}
                    </td>
                    <td className="py-2 px-2 text-center font-bold text-slate-900 border-r border-slate-900">
                      {item.quantity}
                    </td>
                    <td className="py-2 px-3 text-right font-medium text-slate-800 border-r border-slate-900">
                      {Number(item.unitPrice).toLocaleString()}
                    </td>
                    <td className="py-2 px-3 text-right font-extrabold text-slate-900">
                      {Number(item.lineTotal || item.quantity * item.unitPrice).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Bottom Section: Remarks / Notes Box + Financials */}
            <div className="grid grid-cols-12 border-t border-slate-900 relative z-10 bg-white">
              {/* Left Remarks Box */}
              <div className="col-span-7 border-r border-slate-900 flex flex-col justify-between bg-white">
                <div className="bg-[#15803d] text-white text-[11px] font-extrabold px-3 py-1 uppercase tracking-wider border-b border-slate-900">
                  Remarks / Notes :
                </div>
                <div className="p-4 flex items-center justify-center flex-1 min-h-[70px]">
                  {hasDisplayItem ? (
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-rose-600 flex items-center justify-center shrink-0 shadow-sm">
                        <span className="text-white font-black text-xl leading-none">!</span>
                      </div>
                      <div className="font-black text-sm tracking-wide whitespace-nowrap">
                        <span className="text-slate-900">WITHOUT&nbsp;DISPLAY&nbsp;</span>
                        <span className="text-rose-600">GUARANTEE</span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-slate-600 font-medium italic">
                      Quality checked & verified. Warranty as per company policy.
                    </div>
                  )}
                </div>
              </div>

              {/* Right Totals Box */}
              <div className="col-span-5 divide-y divide-slate-900">
                <div className="grid grid-cols-2 text-xs">
                  <div className="p-1.5 font-bold text-slate-900 border-r border-slate-900 flex items-center">
                    Total Amount
                  </div>
                  <div className="p-1.5 font-extrabold text-slate-900 bg-[#fef08a] text-right flex items-center justify-end">
                    ৳{Number(order.totalAmount || 0).toLocaleString()}
                  </div>
                </div>
                <div className="grid grid-cols-2 text-xs">
                  <div className="p-1.5 font-bold text-slate-900 border-r border-slate-900 flex items-center">
                    Paid Amount
                  </div>
                  <div className="p-1.5 font-extrabold text-slate-900 bg-[#fef08a] text-right flex items-center justify-end">
                    ৳{Number(order.paidAmount || 0).toLocaleString()}
                  </div>
                </div>
                <div className="grid grid-cols-2 text-xs">
                  <div className="p-1.5 font-bold text-slate-900 border-r border-slate-900 flex items-center">
                    Due Amount
                  </div>
                  <div className="p-1.5 font-extrabold text-slate-900 bg-[#fef08a] text-right flex items-center justify-end">
                    ৳{Number(order.dueAmount || 0).toLocaleString()}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Template B Footer Disclaimers & Signatures */}
          <div className="mt-auto pt-8 space-y-3">
            <div className="text-xs font-bold text-slate-900">
              N.B&nbsp;:&nbsp;Sold products are not returnable.&nbsp;Warranty is as per company policy.
            </div>

            <div className="flex justify-between items-end pt-9 px-4">
              <div className="text-center">
                <div className="w-40 border-t border-slate-800 mb-1" />
                <div className="text-xs font-bold text-slate-900 whitespace-nowrap">Customer&nbsp;Signature</div>
              </div>
              <div className="text-center pb-1">
                <span className="text-red-600 font-bold text-xs uppercase tracking-wider whitespace-nowrap">
                  WITHOUT&nbsp;DISPLAY&nbsp;GUARANTEE
                </span>
              </div>
              <div className="text-center">
                <div className="w-40 border-t border-slate-800 mb-1" />
                <div className="text-xs font-bold text-slate-900 whitespace-nowrap">Authorise&nbsp;Signature</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
