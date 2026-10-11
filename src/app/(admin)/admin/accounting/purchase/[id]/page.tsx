"use client";

import { useEffect, useState, useCallback } from "react";
import { useAdminPage } from "@/contexts/AdminPageContext";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Printer, PackageCheck, CheckCircle, FileText } from "lucide-react";
import { downloadPrivateAsset } from "@/lib/private-asset";
import { StatusBadge } from "@/components/admin/DataTable";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { apiGet, apiPatch } from "@/lib/api-client";
import { Skeleton } from "@/components/ui/skeleton";

export default function PurchaseOrderViewPage() {
  const { setTitle, setBadge, setDateFilter } = useAdminPage();
  const params = useParams();
  const router = useRouter();

  const [po, setPo] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [receiveDialogOpen, setReceiveDialogOpen] = useState(false);
  const [receivedMap, setReceivedMap] = useState<Record<string, number>>({});
  const [isReceiving, setIsReceiving] = useState(false);

  useEffect(() => {
    setTitle("Purchase Order Details");
    setBadge("Accounting");
    setDateFilter(""); 
  }, [setTitle, setBadge, setDateFilter]);

  const loadData = useCallback(async () => {
    if (!params.id) return;
    try {
      setIsLoading(true);
      const res = await apiGet<any>(`/purchase-orders/${params.id}`);
      setPo(res);
      if (res?.poNumber) setTitle(`Purchase Order: ${res.poNumber}`);

      const map: Record<string, number> = {};
      (res?.items || []).forEach((item: any) => {
        const remaining = Math.max(0, item.quantityOrdered - item.quantityReceived);
        map[item.id] = remaining;
      });
      setReceivedMap(map);
    } catch (err: any) {
      toast.error(err.message || "Failed to load purchase order");
    } finally {
      setIsLoading(false);
    }
  }, [params.id, setTitle]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleReceive = async () => {
    try {
      setIsReceiving(true);
      const itemsPayload = Object.entries(receivedMap)
        .map(([itemId, qty]) => ({
          purchaseOrderItemId: itemId,
          quantityReceived: Number(qty),
        }))
        .filter((i) => i.quantityReceived > 0);

      if (itemsPayload.length === 0) {
        toast.error("Please enter a received quantity greater than 0");
        return;
      }

      await apiPatch(`/purchase-orders/${params.id}/receive`, {
        items: itemsPayload,
      });

      toast.success("Stock received and updated into inventory!");
      setReceiveDialogOpen(false);
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to receive items");
    } finally {
      setIsReceiving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <Skeleton className="h-48 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (!po) {
    return <div className="p-6 text-slate-500">Purchase order not found.</div>;
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      
      {/* Top action bar */}
      <div className="flex items-center justify-between">
        <button 
          onClick={() => router.back()}
          className="flex items-center gap-2 text-slate-600 hover:text-emerald-600 font-medium transition-colors text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Purchase Orders
        </button>
        <div className="flex gap-3">
          <button 
            onClick={() => window.print()}
            className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium rounded-lg transition-colors text-sm flex items-center gap-2 shadow-sm"
          >
            <Printer className="w-4 h-4" /> Print PO
          </button>
          {(po.status === "ORDERED" || po.status === "PARTIALLY_RECEIVED") && (
            <button 
              onClick={() => setReceiveDialogOpen(true)}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg transition-colors text-sm flex items-center gap-2 shadow-sm"
            >
              <PackageCheck className="w-4 h-4" /> Receive Items into Inventory
            </button>
          )}
        </div>
      </div>

      <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
        
        {/* Header Info */}
        <div className="flex justify-between items-start border-b border-slate-100 pb-8 mb-8">
          <div>
            <h1 className="text-3xl font-black text-slate-800 mb-2">{po.poNumber}</h1>
            <div className="flex items-center gap-3 mb-4">
              <StatusBadge status={po.status.replace("_", " ")} type={po.status === "RECEIVED" ? "success" : "warning"} />
              <span className="text-sm font-medium text-slate-500">{new Date(po.orderDate).toLocaleDateString("en-GB")}</span>
            </div>
            <p className="text-xs text-slate-400">Created by: {po.recordedBy?.name || "System"}</p>
          </div>
          <div className="text-right">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-1">Supplier</h3>
            <p className="text-lg font-semibold text-emerald-700">{po.supplier?.name}</p>
            <p className="text-sm text-slate-500 mt-1">Branch: {po.branch?.name || "Global / Headquarters"}</p>
          </div>
        </div>

        {/* Line Items Table */}
        <div className="mb-8 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-y border-slate-100 text-slate-600">
              <tr>
                <th className="px-4 py-3 font-semibold">Product Variant</th>
                <th className="px-4 py-3 font-semibold text-center w-28">Ordered</th>
                <th className="px-4 py-3 font-semibold text-center w-28">Received</th>
                <th className="px-4 py-3 font-semibold text-right w-32">Unit Cost</th>
                <th className="px-4 py-3 font-semibold text-right w-40">Line Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {po.items?.map((item: any) => (
                <tr key={item.id}>
                  <td className="px-4 py-4">
                    <p className="font-semibold text-slate-800">{item.variant?.product?.name || "Product"}</p>
                    <p className="text-xs text-slate-400 font-mono">SKU: {item.variant?.sku} • {item.variant?.color || "Standard"}</p>
                  </td>
                  <td className="px-4 py-4 text-center font-bold text-slate-700">{item.quantityOrdered}</td>
                  <td className="px-4 py-4 text-center">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${
                      item.quantityReceived >= item.quantityOrdered ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                    }`}>
                      {item.quantityReceived} / {item.quantityOrdered}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-right font-medium text-slate-700">৳{Number(item.unitCost).toLocaleString()}</td>
                  <td className="px-4 py-4 text-right font-bold text-slate-900">৳{Number(item.lineTotal).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Financial Calculation summary */}
        <div className="flex flex-col md:flex-row justify-between items-start pt-6 border-t border-slate-100 gap-6">
          <div className="max-w-md space-y-2">
            <h4 className="font-bold text-slate-800 text-sm">Notes & Instructions</h4>
            <p className="text-sm text-slate-500 bg-slate-50 p-4 rounded-xl border border-slate-100">
              {po.note || "No specific instructions recorded for this purchase order."}
            </p>
            {po.documentUrl && (
              <div className="mt-3">
                <button
                  type="button"
                  onClick={() =>
                    downloadPrivateAsset(
                      `/purchase-orders/${po.id}/document`,
                      `${po.poNumber}_document`,
                    )
                  }
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-emerald-700 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5" />
                  Download Attached Document
                </button>
              </div>
            )}
          </div>

          <div className="w-full md:w-80 space-y-3 text-sm">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal:</span>
              <span className="font-semibold text-slate-800">৳{Number(po.subtotal).toLocaleString()}</span>
            </div>
            {Number(po.taxAmount) > 0 && (
              <div className="flex justify-between text-slate-600">
                <span>Tax:</span>
                <span>+৳{Number(po.taxAmount).toLocaleString()}</span>
              </div>
            )}
            {Number(po.shippingCost) > 0 && (
              <div className="flex justify-between text-slate-600">
                <span>Shipping:</span>
                <span>+৳{Number(po.shippingCost).toLocaleString()}</span>
              </div>
            )}
            {Number(po.discount) > 0 && (
              <div className="flex justify-between text-slate-600">
                <span>Discount:</span>
                <span className="text-emerald-600">-৳{Number(po.discount).toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-bold text-slate-900 border-t border-slate-100 pt-2">
              <span>Grand Total:</span>
              <span className="text-emerald-700">৳{Number(po.grandTotal).toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm text-slate-600">
              <span>Amount Paid:</span>
              <span className="font-semibold text-emerald-600">৳{Number(po.amountPaid).toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm font-bold border-t border-slate-100 pt-2">
              <span>Due Balance:</span>
              <span className={Number(po.dueAmount) > 0 ? "text-rose-600" : "text-emerald-600"}>
                ৳{Number(po.dueAmount).toLocaleString()}
              </span>
            </div>
          </div>
        </div>

      </div>

      {/* Receive Items Dialog */}
      <Dialog open={receiveDialogOpen} onOpenChange={setReceiveDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PackageCheck className="w-5 h-5 text-emerald-600" /> Receive Shipment Items
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-sm text-slate-600">
              Specify quantity of items received for each SKU. Stock counts will immediately increase in inventory.
            </p>

            <div className="space-y-3">
              {po.items?.map((item: any) => {
                const remaining = Math.max(0, item.quantityOrdered - item.quantityReceived);
                return (
                  <div key={item.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-slate-800">{item.variant?.sku}</span>
                      <span className="text-slate-500">Ordered: {item.quantityOrdered} | Already: {item.quantityReceived}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-slate-600">Receiving Now:</span>
                      <Input
                        type="number"
                        min={0}
                        max={remaining}
                        value={receivedMap[item.id] || 0}
                        onChange={(e) =>
                          setReceivedMap({
                            ...receivedMap,
                            [item.id]: Number(e.target.value),
                          })
                        }
                        className="h-8 w-24 text-right"
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setReceiveDialogOpen(false)}
                className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-50 text-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReceive}
                disabled={isReceiving}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium disabled:opacity-50"
              >
                Confirm Inventory Update
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
