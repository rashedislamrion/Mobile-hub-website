"use client";

import { useEffect, useState, useCallback } from "react";
import { useAdminPage } from "@/contexts/AdminPageContext";
import {
  ShoppingCart,
  CheckCircle2,
  AlertCircle,
  Package,
  RotateCcw,
  Truck,
  ChevronLeft,
  ChevronRight,
  Building2,
} from "lucide-react";
import { toast } from "sonner";
import { apiGet } from "@/lib/api-client";
import { ReportKpiCard } from "@/components/admin/ReportKpiCard";
import { ReportFilterBar } from "@/components/admin/ReportFilterBar";
import { Badge } from "@/components/ui/badge";
import { exportToCsv } from "@/lib/export-utils";

interface PurchaseRecord {
  id: string;
  memo: string;
  invoiceNumber: string;
  date: string;
  createdAt: string;
  branch: string;
  supplier: {
    id: string;
    name: string;
    phone: string;
    companyName: string;
  };
  itemsSummary: string;
  qty: number;
  total: number;
  paid: number;
  due: number;
  paymentStatus: string;
  status: string;
  staff: string;
}

export default function PurchaseReportPage() {
  const { setTitle, setBadge } = useAdminPage();

  const [data, setData] = useState<PurchaseRecord[]>([]);
  const [summary, setSummary] = useState({
    totalPurchase: 0,
    totalPaid: 0,
    totalUnpaid: 0,
    totalPurchaseQty: 0,
    totalReturned: 0,
    returnQty: 0,
  });
  const [branches, setBranches] = useState<Array<{ id: string; name: string }>>([]);
  const [suppliers, setSuppliers] = useState<Array<{ id: string; name: string; companyName?: string }>>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedBranch, setSelectedBranch] = useState("all");
  const [selectedSupplier, setSelectedSupplier] = useState("all");
  const [selectedPaymentStatus, setSelectedPaymentStatus] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  useEffect(() => {
    setTitle("Purchase Report");
    setBadge("Reports");
  }, [setTitle, setBadge]);

  useEffect(() => {
    Promise.all([
      apiGet<any[]>("/branches").catch(() => []),
      apiGet<any[]>("/suppliers").catch(() => []),
    ]).then(([branchesRes, supRes]) => {
      if (Array.isArray(branchesRes)) setBranches(branchesRes);
      if (Array.isArray(supRes)) setSuppliers(supRes);
    });
  }, []);

  const loadReport = useCallback(async () => {
    try {
      setIsLoading(true);
      const params: Record<string, any> = {};
      if (selectedBranch !== "all") params.branch = selectedBranch;
      if (selectedSupplier !== "all") params.supplierId = selectedSupplier;
      if (selectedPaymentStatus !== "all") params.paymentStatus = selectedPaymentStatus;
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;
      if (searchTerm.trim()) params.search = searchTerm.trim();

      const res = await apiGet<{
        summary: typeof summary;
        data: PurchaseRecord[];
      }>("/reports/purchase", params);

      setData(res?.data || []);
      if (res?.summary) setSummary(res.summary);
    } catch (err: any) {
      toast.error(err.message || "Failed to load purchase report");
    } finally {
      setIsLoading(false);
    }
  }, [selectedBranch, selectedSupplier, selectedPaymentStatus, dateFrom, dateTo, searchTerm]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const handleReset = () => {
    setSearchTerm("");
    setSelectedBranch("all");
    setSelectedSupplier("all");
    setSelectedPaymentStatus("all");
    setDateFrom("");
    setDateTo("");
    setCurrentPage(1);
  };

  const handleExport = () => {
    const headers = [
      "PO Memo",
      "Invoice Number",
      "Date",
      "Branch",
      "Supplier Name",
      "Company",
      "Items Summary",
      "Quantity",
      "Total (BDT)",
      "Paid (BDT)",
      "Due (BDT)",
      "Payment Status",
      "Status",
    ];

    const rows = data.map((row) => [
      row.memo,
      row.invoiceNumber,
      new Date(row.createdAt).toLocaleString("en-GB"),
      row.branch,
      row.supplier.name,
      row.supplier.companyName,
      row.itemsSummary,
      row.qty,
      row.total,
      row.paid,
      row.due,
      row.paymentStatus,
      row.status,
    ]);

    exportToCsv("purchase-report", headers, rows);
  };

  // Pagination Slice
  const totalPages = Math.max(1, Math.ceil(data.length / pageSize));
  const paginatedData = data.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <ShoppingCart className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            Purchase Report
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Vendor procurement orders, supplier payables, inventory receipts, and stock returns
          </p>
        </div>
      </div>

      {/* Top 6 KPI Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <ReportKpiCard
          label="Total Purchase"
          value={`৳${Number(summary.totalPurchase).toLocaleString()}`}
          icon={ShoppingCart}
          colorTint="blue"
        />
        <ReportKpiCard
          label="Total Paid"
          value={`৳${Number(summary.totalPaid).toLocaleString()}`}
          icon={CheckCircle2}
          colorTint="emerald"
        />
        <ReportKpiCard
          label="Total Unpaid"
          value={`৳${Number(summary.totalUnpaid).toLocaleString()}`}
          icon={AlertCircle}
          colorTint="red"
        />
        <ReportKpiCard
          label="Purchase Qty"
          value={summary.totalPurchaseQty}
          icon={Package}
          colorTint="purple"
        />
        <ReportKpiCard
          label="Total Returned"
          value={`৳${Number(summary.totalReturned).toLocaleString()}`}
          icon={RotateCcw}
          colorTint="rose"
        />
        <ReportKpiCard
          label="Return Qty"
          value={summary.returnQty}
          icon={Truck}
          colorTint="amber"
        />
      </div>

      {/* Filter Bar */}
      <ReportFilterBar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Search PO Memo, Supplier, Phone..."
        branches={branches}
        selectedBranch={selectedBranch}
        onBranchChange={setSelectedBranch}
        secondarySelect={{
          placeholder: "All Suppliers",
          options: suppliers.map((s) => ({
            label: s.companyName ? `${s.name} (${s.companyName})` : s.name,
            value: s.id,
          })),
          value: selectedSupplier,
          onChange: setSelectedSupplier,
        }}
        statusOptions={[
          { label: "Fully Paid", value: "PAID" },
          { label: "Partial Paid", value: "PARTIAL" },
          { label: "Payment Due", value: "DUE" },
        ]}
        selectedStatus={selectedPaymentStatus}
        onStatusChange={setSelectedPaymentStatus}
        dateFrom={dateFrom}
        onDateFromChange={setDateFrom}
        dateTo={dateTo}
        onDateToChange={setDateTo}
        onReset={handleReset}
        onExport={handleExport}
        exportLabel="Export Excel"
      />

      {/* Table Card */}
      <div className="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 border-b border-border text-xs uppercase text-muted-foreground font-semibold">
              <tr>
                <th className="p-4 font-semibold tracking-wider">PO Memo</th>
                <th className="p-4 font-semibold tracking-wider">Date & Time</th>
                <th className="p-4 font-semibold tracking-wider">Supplier & Company</th>
                <th className="p-4 font-semibold tracking-wider">Items Summary</th>
                <th className="p-4 font-semibold tracking-wider text-center">Qty</th>
                <th className="p-4 font-semibold tracking-wider text-right">Grand Total</th>
                <th className="p-4 font-semibold tracking-wider text-right">Paid</th>
                <th className="p-4 font-semibold tracking-wider text-right">Due</th>
                <th className="p-4 font-semibold tracking-wider text-center">Payment</th>
                <th className="p-4 font-semibold tracking-wider text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-foreground">
              {isLoading ? (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-muted-foreground">
                    <div className="flex items-center justify-center gap-2">
                      <div className="h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                      <span>Loading purchase procurement orders...</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-muted-foreground">
                    No purchase procurement orders found matching the filter criteria.
                  </td>
                </tr>
              ) : (
                paginatedData.map((row) => {
                  const formattedDate = new Date(row.createdAt).toLocaleDateString("en-GB", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  });

                  return (
                    <tr key={row.id} className="hover:bg-muted/30 transition-colors">
                      {/* PO Memo */}
                      <td className="p-4">
                        <div className="space-y-0.5">
                          <span className="font-mono font-bold text-blue-600 dark:text-blue-400 text-xs">
                            {row.memo}
                          </span>
                          <p className="text-[11px] text-muted-foreground">{row.branch}</p>
                        </div>
                      </td>

                      {/* Date */}
                      <td className="p-4 text-xs font-mono text-muted-foreground whitespace-nowrap">
                        {formattedDate}
                      </td>

                      {/* Supplier */}
                      <td className="p-4">
                        <div className="space-y-0.5">
                          <p className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                            <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                            {row.supplier.companyName || row.supplier.name}
                          </p>
                          <p className="text-[11px] text-muted-foreground font-mono">
                            {row.supplier.name} • {row.supplier.phone}
                          </p>
                        </div>
                      </td>

                      {/* Items */}
                      <td className="p-4 text-xs max-w-xs">
                        <p className="truncate text-foreground" title={row.itemsSummary}>
                          {row.itemsSummary}
                        </p>
                      </td>

                      {/* Qty */}
                      <td className="p-4 text-center font-mono font-semibold text-xs text-foreground">
                        {row.qty}
                      </td>

                      {/* Grand Total */}
                      <td className="p-4 text-right font-mono font-bold text-foreground whitespace-nowrap">
                        ৳{Number(row.total).toLocaleString()}
                      </td>

                      {/* Paid */}
                      <td className="p-4 text-right font-mono text-emerald-600 dark:text-emerald-400 font-semibold whitespace-nowrap">
                        ৳{Number(row.paid).toLocaleString()}
                      </td>

                      {/* Due */}
                      <td className="p-4 text-right font-mono font-semibold whitespace-nowrap">
                        {Number(row.due) > 0 ? (
                          <span className="text-red-600 dark:text-red-400">
                            ৳{Number(row.due).toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">৳0</span>
                        )}
                      </td>

                      {/* Payment Status */}
                      <td className="p-4 text-center">
                        <Badge
                          variant="outline"
                          className={`text-[10px] uppercase ${
                            row.paymentStatus === "PAID"
                              ? "border-emerald-300 text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40"
                              : row.paymentStatus === "PARTIAL"
                              ? "border-amber-300 text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40"
                              : "border-red-300 text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/40"
                          }`}
                        >
                          {row.paymentStatus}
                        </Badge>
                      </td>

                      {/* Status */}
                      <td className="p-4 text-center">
                        <Badge variant="outline" className="text-[10px] uppercase">
                          {row.status}
                        </Badge>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {/* Table Footer Summary Row */}
            {!isLoading && data.length > 0 && (
              <tfoot className="bg-muted/40 border-t border-border font-semibold text-xs text-foreground">
                <tr>
                  <td colSpan={5} className="p-4 text-muted-foreground">
                    Purchase Procurement Totals ({data.length} Orders):
                  </td>
                  <td className="p-4 text-right font-mono text-foreground font-bold">
                    ৳{Number(summary.totalPurchase).toLocaleString()}
                  </td>
                  <td className="p-4 text-right font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                    ৳{Number(summary.totalPaid).toLocaleString()}
                  </td>
                  <td className="p-4 text-right font-mono text-red-600 dark:text-red-400 font-bold">
                    ৳{Number(summary.totalUnpaid).toLocaleString()}
                  </td>
                  <td colSpan={2} className="p-4 text-center text-muted-foreground">
                    Total Qty: {summary.totalPurchaseQty}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="p-4 border-t border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-muted-foreground">
          <div>
            {data.length === 0
              ? "Showing 0 purchase orders"
              : `Showing ${(currentPage - 1) * pageSize + 1} to ${Math.min(currentPage * pageSize, data.length)} of ${data.length.toLocaleString()} purchase orders`}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={currentPage <= 1 || isLoading}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="p-1.5 rounded-md border border-border bg-background hover:bg-muted text-foreground disabled:opacity-40 transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="font-medium text-foreground">
              Page {currentPage} of {totalPages}
            </span>
            <button
              type="button"
              disabled={currentPage >= totalPages || isLoading}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="p-1.5 rounded-md border border-border bg-background hover:bg-muted text-foreground disabled:opacity-40 transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
