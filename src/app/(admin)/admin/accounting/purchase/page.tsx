"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useAdminPage } from "@/contexts/AdminPageContext";
import { useRouter } from "next/navigation";
import {
  Plus,
  Eye,
  RotateCcw,
  Search,
  Building2,
  Calendar,
  DollarSign,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
  MoreVertical,
  Layers,
  Package,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { apiGet, apiPost } from "@/lib/api-client";
import { AdminTableState } from "@/components/admin/AdminTableState";

interface PurchaseOrderItem {
  id: string;
  poNumber: string;
  invoiceNumber?: string | null;
  documentUrl?: string | null;
  internalNotes?: string | null;
  expectedDeliveryDate?: string | null;
  status: "DRAFT" | "ORDERED" | "PARTIALLY_RECEIVED" | "RECEIVED" | "CANCELLED";
  subtotal: number | string;
  discount: number | string;
  shippingCost: number | string;
  tax: number | string;
  grandTotal: number | string;
  amountPaid: number | string;
  advanceUsed: number | string;
  dueAmount: number | string;
  createdAt: string;
  supplier?: {
    id: string;
    name: string;
    phone: string;
    advanceBalance?: number | string;
  };
  branch?: {
    id: string;
    name: string;
    code: string;
  };
  items?: Array<{
    id: string;
    productId: string;
    variantId?: string | null;
    quantityOrdered: number;
    quantityReceived: number;
    unitCost: number | string;
    sellingPrice?: number | string | null;
    wholesalePrice?: number | string | null;
    offerPrice?: number | string | null;
    lineTotal: number | string;
    product?: { id: string; name: string };
    variant?: { id: string; sku: string; color?: string; quality?: string };
  }>;
  payments?: Array<{
    id: string;
    amount: number | string;
    method: string;
    walletType?: { id: string; name: string };
    recordedBy?: { id: string; name: string };
  }>;
}

export default function PurchaseOrdersPage() {
  const { setTitle, setBadge, setDateFilter } = useAdminPage();
  const router = useRouter();

  const [data, setData] = useState<PurchaseOrderItem[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Purchase Return Dialog State
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [selectedPoForReturn, setSelectedPoForReturn] = useState<PurchaseOrderItem | null>(null);
  const [returnItemsMap, setReturnItemsMap] = useState<Record<string, { qty: number; reason: string }>>({});
  const [isSubmittingReturn, setIsSubmittingReturn] = useState(false);

  useEffect(() => {
    setTitle("All Purchases");
    setBadge("Accounting");
    setDateFilter("");
  }, [setTitle, setBadge, setDateFilter]);

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const params: Record<string, any> = {
        page: currentPage,
        limit: 20,
      };

      if (searchQuery.trim()) params.search = searchQuery.trim();
      if (statusFilter !== "ALL") params.status = statusFilter;
      if (paymentStatusFilter !== "ALL") params.paymentStatus = paymentStatusFilter;
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;

      const res = await apiGet<{
        data: PurchaseOrderItem[];
        summary: any;
        meta: { total: number; page: number; limit: number; totalPages: number };
      }>("/purchase-orders", params);

      if (res?.data) {
        setData(res.data);
        if (res.meta) {
          setTotalCount(res.meta.total);
          setTotalPages(res.meta.totalPages || 1);
        }
        if (res.summary) {
          setSummary(res.summary);
        }
      }
    } catch (err: any) {
      setError(err.message || "Failed to load purchase orders");
      toast.error(err.message || "Failed to load purchase orders");
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, searchQuery, statusFilter, paymentStatusFilter, dateFrom, dateTo]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Open Return Modal
  const handleOpenReturnModal = (po: PurchaseOrderItem) => {
    setSelectedPoForReturn(po);
    const initialMap: Record<string, { qty: number; reason: string }> = {};
    (po.items || []).forEach((item) => {
      initialMap[item.id] = { qty: 0, reason: "" };
    });
    setReturnItemsMap(initialMap);
    setIsReturnModalOpen(true);
  };

  // Submit Purchase Return
  const handleSubmitReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPoForReturn) return;

    const returnPayload = Object.entries(returnItemsMap)
      .filter(([_, val]) => val.qty > 0)
      .map(([itemId, val]) => ({
        purchaseOrderItemId: itemId,
        quantityReturned: Number(val.qty),
        reason: val.reason.trim() || undefined,
      }));

    if (returnPayload.length === 0) {
      toast.error("Please enter a return quantity greater than 0 for at least one item");
      return;
    }

    try {
      setIsSubmittingReturn(true);
      await apiPost(`/purchase-orders/${selectedPoForReturn.id}/return`, {
        items: returnPayload,
      });

      toast.success("Purchase items returned successfully! Stock & balances adjusted.");
      setIsReturnModalOpen(false);
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to return purchase items");
    } finally {
      setIsSubmittingReturn(false);
    }
  };

  // Date Formatter
  const formatDateTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const datePart = d.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
      const timePart = d.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
      return { datePart, timePart };
    } catch {
      return { datePart: dateStr, timePart: "" };
    }
  };

  return (
    <div className="max-w-[1550px] mx-auto space-y-6 pb-20">
      {/* Top Header with KPI Summary */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">All Purchases</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Monitor inventory purchase intakes, supplier invoices, payment balances, and returns
          </p>
        </div>

        <Button
          onClick={() => router.push("/admin/accounting/purchase/create")}
          className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-600/20 font-semibold"
        >
          <Plus className="w-4 h-4 mr-1.5" /> + Add New Purchase
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">This Month Purchases</p>
            <p className="text-xl font-bold text-slate-900 mt-1">
              ৳{Number(summary?.thisMonthTotal || 0).toLocaleString()}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Paid</p>
            <p className="text-xl font-bold text-emerald-600 mt-1">
              ৳{Number(summary?.thisMonthPaid || 0).toLocaleString()}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Due</p>
            <p className="text-xl font-bold text-red-600 mt-1">
              ৳{Number(summary?.thisMonthUnpaid || 0).toLocaleString()}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center text-red-600">
            <AlertCircle className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Pending Intakes</p>
            <p className="text-xl font-bold text-blue-600 mt-1">
              {Number(summary?.pendingDeliveryCount || 0)} Orders
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
            <Clock className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* FILTER BAR */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search Memo, ID, Supplier Name..."
            className="pl-9 h-10 rounded-xl border-slate-200 text-xs"
          />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2.5 w-full md:w-auto overflow-x-auto">
          {/* Status Select */}
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="h-10 px-3 rounded-xl border border-slate-200 bg-white text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          >
            <option value="ALL">All Status</option>
            <option value="ORDERED">Ordered</option>
            <option value="PARTIALLY_RECEIVED">Partially Received</option>
            <option value="RECEIVED">Received</option>
            <option value="DRAFT">Draft</option>
            <option value="CANCELLED">Cancelled</option>
          </select>

          {/* Payment Status Select */}
          <select
            value={paymentStatusFilter}
            onChange={(e) => {
              setPaymentStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="h-10 px-3 rounded-xl border border-slate-200 bg-white text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          >
            <option value="ALL">All Payments</option>
            <option value="PAID">Paid</option>
            <option value="DUE">Due</option>
            <option value="PARTIAL">Partial</option>
          </select>

          {/* Date Filter */}
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              setCurrentPage(1);
            }}
            className="h-10 rounded-xl border-slate-200 text-xs w-36"
          />
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              setCurrentPage(1);
            }}
            className="h-10 rounded-xl border-slate-200 text-xs w-36"
          />

          {/* Reset Filters */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setSearchQuery("");
              setStatusFilter("ALL");
              setPaymentStatusFilter("ALL");
              setDateFrom("");
              setDateTo("");
              setCurrentPage(1);
            }}
            className="h-10 px-3 rounded-xl border-slate-200 text-xs text-slate-600"
          >
            Reset
          </Button>
        </div>
      </div>

      {/* TABLE */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/90 text-slate-700 uppercase tracking-wider font-semibold border-b border-slate-200">
                <th className="py-3.5 px-4">Date</th>
                <th className="py-3.5 px-4">Memo</th>
                <th className="py-3.5 px-4">Supplier</th>
                <th className="py-3.5 px-4 text-right">Total</th>
                <th className="py-3.5 px-4">Payments</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4">Branch</th>
                <th className="py-3.5 px-4 text-center w-16">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <AdminTableState
                isLoading={isLoading}
                error={error}
                isEmpty={data.length === 0}
                onRetry={loadData}
                colSpan={8}
                loadingRows={5}
                emptyTitle="No records found"
                emptyDescription="No purchase records found. Click '+ Add New Purchase' above to record your first supplier intake."
                emptyActionLabel="+ Add New Purchase"
                onEmptyAction={() => router.push("/admin/accounting/purchase/create")}
              >
                {data.map((po) => {
                  const { datePart, timePart } = formatDateTime(po.createdAt);
                  const total = Number(po.grandTotal || 0);
                  const paid = Number(po.amountPaid || 0);
                  const due = Number(po.dueAmount || 0);

                  // Derive payment badge
                  const paymentBadge =
                    po.status === "DRAFT"
                      ? { label: "UNCOMMITTED", bg: "bg-slate-100 text-slate-700 border-slate-200" }
                      : due <= 0
                      ? { label: "PAID", bg: "bg-emerald-100 text-emerald-800 border-emerald-200" }
                      : paid <= 0
                      ? { label: "UNPAID", bg: "bg-rose-100 text-rose-800 border-rose-200" }
                      : { label: "PARTIAL", bg: "bg-amber-100 text-amber-800 border-amber-200" };

                  // Fulfillment badge
                  const fulfillmentBadge =
                    po.status === "RECEIVED"
                      ? { label: "COMPLETED", bg: "bg-emerald-100 text-emerald-800 border-emerald-200" }
                      : po.status === "PARTIALLY_RECEIVED"
                      ? { label: "PARTIAL INTAKE", bg: "bg-amber-100 text-amber-800 border-amber-200" }
                      : po.status === "ORDERED"
                      ? { label: "ORDERED", bg: "bg-blue-100 text-blue-800 border-blue-200" }
                      : po.status === "DRAFT"
                      ? { label: "DRAFT", bg: "bg-slate-100 text-slate-700 border-slate-200" }
                      : { label: "CANCELLED", bg: "bg-red-100 text-red-800 border-red-200" };

                  return (
                    <tr key={po.id} className="hover:bg-slate-50/60 transition-colors">
                      {/* DATE */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-800">{datePart}</div>
                        <div className="text-[11px] text-slate-400">{timePart}</div>
                      </td>

                      {/* MEMO */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{po.poNumber}</div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          {po.invoiceNumber ? `Inv: ${po.invoiceNumber}` : "No Invoice"}
                        </div>
                      </td>

                      {/* SUPPLIER */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">{po.supplier?.name || "Unknown Supplier"}</div>
                        <div className="text-[11px] text-slate-500">{po.supplier?.phone || "-"}</div>
                      </td>

                      {/* TOTAL */}
                      <td className="py-3 px-4 text-right">
                        <span className="font-bold text-slate-900">৳{total.toLocaleString()}</span>
                      </td>

                      {/* PAYMENTS */}
                      <td className="py-3 px-4">
                        {po.status === "DRAFT" ? (
                          <span className="text-slate-400 font-medium">Draft (Not Paid)</span>
                        ) : due <= 0 ? (
                          <div className="text-emerald-700 font-semibold flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Completed: ৳{paid.toLocaleString()}
                          </div>
                        ) : paid <= 0 ? (
                          <div className="text-red-600 font-semibold flex items-center gap-1">
                            <AlertCircle className="w-3.5 h-3.5" />
                            Due: ৳{due.toLocaleString()}
                          </div>
                        ) : (
                          <div className="space-y-0.5 text-[11px]">
                            <div className="text-emerald-700 font-semibold">Paid: ৳{paid.toLocaleString()}</div>
                            <div className="text-red-600 font-semibold">Due: ৳{due.toLocaleString()}</div>
                          </div>
                        )}
                      </td>

                      {/* STATUS (TWO STACKED BADGES) */}
                      <td className="py-3 px-4 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${fulfillmentBadge.bg}`}
                          >
                            {fulfillmentBadge.label}
                          </span>
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold border ${paymentBadge.bg}`}
                          >
                            {paymentBadge.label}
                          </span>
                        </div>
                      </td>

                      {/* BRANCH */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{po.branch?.name || "Main Branch"}</span>
                        </div>
                        {po.branch?.code && (
                          <span className="text-[10px] font-mono text-slate-400 ml-5 block">
                            {po.branch.code}
                          </span>
                        )}
                      </td>

                      {/* ACTION */}
                      <td className="py-3 px-4 text-center">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors">
                              <MoreVertical className="w-4 h-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44 rounded-xl">
                            <DropdownMenuItem
                              onClick={() => router.push(`/admin/accounting/purchase/${po.id}`)}
                              className="text-xs cursor-pointer"
                            >
                              <Eye className="w-4 h-4 mr-2 text-slate-500" /> View Details
                            </DropdownMenuItem>

                            {po.status !== "CANCELLED" && po.status !== "DRAFT" && (
                              <DropdownMenuItem
                                onClick={() => handleOpenReturnModal(po)}
                                className="text-xs cursor-pointer text-amber-700 focus:text-amber-800 focus:bg-amber-50"
                              >
                                <RotateCcw className="w-4 h-4 mr-2 text-amber-600" /> Return Items
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })}
              </AdminTableState>
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div>
            {totalCount === 0
              ? "Showing 0 results"
              : `Showing ${(currentPage - 1) * 20 + 1} to ${Math.min(currentPage * 20, totalCount)} of ${totalCount.toLocaleString()} results`}
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="h-8 px-3 rounded-lg text-xs"
            >
              Previous
            </Button>
            <span className="px-3 font-semibold text-slate-800">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="h-8 px-3 rounded-lg text-xs"
            >
              Next
            </Button>
          </div>
        </div>
      </div>

      {/* MODAL: PURCHASE RETURN DIALOG */}
      <Dialog open={isReturnModalOpen} onOpenChange={setIsReturnModalOpen}>
        <DialogContent className="sm:max-w-2xl rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <RotateCcw className="w-5 h-5 text-amber-600" />
              Purchase Return — {selectedPoForReturn?.poNumber}
            </DialogTitle>
          </DialogHeader>

          {selectedPoForReturn && (
            <form onSubmit={handleSubmitReturn} className="space-y-4 pt-2">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs flex justify-between">
                <div>
                  <span className="text-slate-500">Supplier:</span>{" "}
                  <strong>{selectedPoForReturn.supplier?.name}</strong>
                </div>
                <div>
                  <span className="text-slate-500">PO Total:</span>{" "}
                  <strong>৳{Number(selectedPoForReturn.grandTotal).toLocaleString()}</strong>
                </div>
              </div>

              <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                {(selectedPoForReturn.items || []).map((item) => {
                  const maxAvail =
                    item.quantityReceived > 0 ? item.quantityReceived : item.quantityOrdered;
                  const itemCost = Number(item.unitCost);
                  const currentReturn = returnItemsMap[item.id] || { qty: 0, reason: "" };

                  return (
                    <div
                      key={item.id}
                      className="p-3.5 rounded-xl border border-slate-200/80 bg-white space-y-2 text-xs"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-bold text-slate-900">{item.product?.name}</p>
                          <p className="text-[11px] text-slate-500">
                            {item.variant?.sku || "Base"} {item.variant?.color ? `• ${item.variant.color}` : ""}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="text-[11px] text-slate-500">Unit Buying: </span>
                          <span className="font-semibold text-slate-900">৳{itemCost.toLocaleString()}</span>
                          <p className="text-[10px] text-slate-400">Available: {maxAvail} units</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 pt-1 border-t border-slate-100">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                            Return Quantity (Max {maxAvail})
                          </label>
                          <Input
                            type="number"
                            min={0}
                            max={maxAvail}
                            value={currentReturn.qty || ""}
                            placeholder="0"
                            onChange={(e) => {
                              const q = Math.min(maxAvail, Math.max(0, Number(e.target.value)));
                              setReturnItemsMap((prev) => ({
                                ...prev,
                                [item.id]: { ...prev[item.id], qty: q },
                              }));
                            }}
                            className="h-8 rounded-lg text-xs font-bold"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                            Reason for Return
                          </label>
                          <Input
                            value={currentReturn.reason}
                            placeholder="e.g. Defective / Mismatched"
                            onChange={(e) => {
                              const r = e.target.value;
                              setReturnItemsMap((prev) => ({
                                ...prev,
                                [item.id]: { ...prev[item.id], reason: r },
                              }));
                            }}
                            className="h-8 rounded-lg text-xs"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200/70 text-xs text-amber-900 flex items-center justify-between">
                <span>Total Estimated Return Credit:</span>
                <span className="text-sm font-bold text-amber-900">
                  ৳
                  {Object.entries(returnItemsMap)
                    .reduce((sum, [itemId, val]) => {
                      const itm = selectedPoForReturn.items?.find((i) => i.id === itemId);
                      return sum + val.qty * Number(itm?.unitCost || 0);
                    }, 0)
                    .toLocaleString()}
                </span>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsReturnModalOpen(false)}
                  className="rounded-xl text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmittingReturn}
                  className="rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold"
                >
                  Confirm Return
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
