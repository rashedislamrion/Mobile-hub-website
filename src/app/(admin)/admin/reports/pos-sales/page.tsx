"use client";

import { useEffect, useState, useCallback } from "react";
import { useAdminPage } from "@/contexts/AdminPageContext";
import {
  ShoppingBag,
  DollarSign,
  TrendingUp,
  AlertCircle,
  Truck,
  Stethoscope,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { apiGet } from "@/lib/api-client";
import { ReportKpiCard } from "@/components/admin/ReportKpiCard";
import { ReportFilterBar } from "@/components/admin/ReportFilterBar";
import { Badge } from "@/components/ui/badge";
import { exportToCsv } from "@/lib/export-utils";

interface PosSalesRecord {
  id: string;
  orderCode: string;
  createdAt: string;
  branch: string;
  customer: {
    id: string;
    name: string;
    phone: string;
  };
  itemsSummary: string;
  totalQty: number;
  subTotal: number;
  discountAmount: number;
  totalAmount: number;
  paidAmount: number;
  dueAmount: number;
  paymentStatus: string;
  payments: string;
  staff: string;
}

export default function PosSalesReportPage() {
  const { setTitle, setBadge } = useAdminPage();

  const [data, setData] = useState<PosSalesRecord[]>([]);
  const [summary, setSummary] = useState({
    totalSales: 0,
    netSales: 0,
    totalUnpaid: 0,
    courierSales: 0,
    diagnosingTotal: 0,
    returnedTotal: 0,
  });
  const [branches, setBranches] = useState<Array<{ id: string; name: string }>>([]);
  const [staffList, setStaffList] = useState<Array<{ id: string; name: string }>>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedBranch, setSelectedBranch] = useState("all");
  const [selectedStaff, setSelectedStaff] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  useEffect(() => {
    setTitle("POS Sales Report");
    setBadge("Reports");
  }, [setTitle, setBadge]);

  useEffect(() => {
    Promise.all([
      apiGet<any[]>("/branches").catch(() => []),
      apiGet<{ data: any[] } | any[]>("/employees").catch(() => []),
    ]).then(([branchesRes, staffRes]) => {
      if (Array.isArray(branchesRes)) setBranches(branchesRes);
      const list = Array.isArray(staffRes) ? staffRes : (staffRes as any)?.data || [];
      setStaffList(list);
    });
  }, []);

  const loadReport = useCallback(async () => {
    try {
      setIsLoading(true);
      const params: Record<string, any> = {};
      if (selectedBranch !== "all") params.branch = selectedBranch;
      if (selectedStaff !== "all") params.staffId = selectedStaff;
      if (selectedStatus !== "all") params.status = selectedStatus;
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;
      if (searchTerm.trim()) params.search = searchTerm.trim();

      const res = await apiGet<{
        summary: typeof summary;
        data: PosSalesRecord[];
      }>("/reports/pos-sales", params);

      setData(res?.data || []);
      if (res?.summary) setSummary(res.summary);
    } catch (err: any) {
      toast.error(err.message || "Failed to load POS sales report");
    } finally {
      setIsLoading(false);
    }
  }, [selectedBranch, selectedStaff, selectedStatus, dateFrom, dateTo, searchTerm]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const handleReset = () => {
    setSearchTerm("");
    setSelectedBranch("all");
    setSelectedStaff("all");
    setSelectedStatus("all");
    setDateFrom("");
    setDateTo("");
    setCurrentPage(1);
  };

  const handleExport = () => {
    const headers = [
      "Invoice / Memo",
      "Date",
      "Branch",
      "Customer Name",
      "Customer Phone",
      "Items Summary",
      "Total Qty",
      "Sub Total (BDT)",
      "Discount (BDT)",
      "Grand Total (BDT)",
      "Paid (BDT)",
      "Due (BDT)",
      "Payment Status",
      "Cashier / Staff",
    ];

    const rows = data.map((row) => [
      row.orderCode,
      new Date(row.createdAt).toLocaleString("en-GB"),
      row.branch,
      row.customer.name,
      row.customer.phone,
      row.itemsSummary,
      row.totalQty,
      row.subTotal,
      row.discountAmount,
      row.totalAmount,
      row.paidAmount,
      row.dueAmount,
      row.paymentStatus,
      row.staff,
    ]);

    exportToCsv("pos-sales-report", headers, rows);
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
            <ShoppingBag className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            POS Sales Report
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            In-store counter sales, retail memos, collection summaries, and cashier performance
          </p>
        </div>
      </div>

      {/* Top 6 KPI Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <ReportKpiCard
          label="Total Sales"
          value={`৳${Number(summary.totalSales).toLocaleString()}`}
          icon={DollarSign}
          colorTint="emerald"
        />
        <ReportKpiCard
          label="Net Sales"
          value={`৳${Number(summary.netSales).toLocaleString()}`}
          icon={TrendingUp}
          colorTint="blue"
        />
        <ReportKpiCard
          label="Total Unpaid"
          value={`৳${Number(summary.totalUnpaid).toLocaleString()}`}
          icon={AlertCircle}
          colorTint="red"
        />
        <ReportKpiCard
          label="Courier Sales"
          value={`৳${Number(summary.courierSales).toLocaleString()}`}
          icon={Truck}
          colorTint="purple"
        />
        <ReportKpiCard
          label="Diagnosing"
          value={`৳${Number(summary.diagnosingTotal).toLocaleString()}`}
          icon={Stethoscope}
          colorTint="amber"
        />
        <ReportKpiCard
          label="Returned / Refund"
          value={`৳${Number(summary.returnedTotal).toLocaleString()}`}
          icon={RotateCcw}
          colorTint="rose"
        />
      </div>

      {/* Filter Bar */}
      <ReportFilterBar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Search Memo No, Customer, Phone..."
        branches={branches}
        selectedBranch={selectedBranch}
        onBranchChange={setSelectedBranch}
        secondarySelect={{
          placeholder: "All Staff / Cashiers",
          options: staffList.map((s) => ({ label: s.name, value: s.id })),
          value: selectedStaff,
          onChange: setSelectedStaff,
        }}
        statusOptions={[
          { label: "Completed", value: "COMPLETED" },
          { label: "Delivered", value: "DELIVERED" },
          { label: "Pending Payment", value: "PENDING" },
          { label: "Returned", value: "RETURNED" },
        ]}
        selectedStatus={selectedStatus}
        onStatusChange={setSelectedStatus}
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
                <th className="p-4 font-semibold tracking-wider">Invoice / Memo</th>
                <th className="p-4 font-semibold tracking-wider">Date & Time</th>
                <th className="p-4 font-semibold tracking-wider">Customer</th>
                <th className="p-4 font-semibold tracking-wider">Items Summary</th>
                <th className="p-4 font-semibold tracking-wider text-center">Qty</th>
                <th className="p-4 font-semibold tracking-wider text-right">Subtotal</th>
                <th className="p-4 font-semibold tracking-wider text-right">Discount</th>
                <th className="p-4 font-semibold tracking-wider text-right">Total</th>
                <th className="p-4 font-semibold tracking-wider text-right">Paid</th>
                <th className="p-4 font-semibold tracking-wider text-right">Due</th>
                <th className="p-4 font-semibold tracking-wider text-center">Status</th>
                <th className="p-4 font-semibold tracking-wider">Cashier</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-foreground">
              {isLoading ? (
                <tr>
                  <td colSpan={12} className="p-8 text-center text-muted-foreground">
                    <div className="flex items-center justify-center gap-2">
                      <div className="h-5 w-5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                      <span>Loading POS sales data...</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={12} className="p-8 text-center text-muted-foreground">
                    No in-store POS sales found matching the filter criteria.
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
                      {/* Memo Code */}
                      <td className="p-4">
                        <div className="space-y-0.5">
                          <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-xs">
                            {row.orderCode}
                          </span>
                          <p className="text-[11px] text-muted-foreground">{row.branch}</p>
                        </div>
                      </td>

                      {/* Date */}
                      <td className="p-4 text-xs font-mono text-muted-foreground whitespace-nowrap">
                        {formattedDate}
                      </td>

                      {/* Customer */}
                      <td className="p-4">
                        <div className="space-y-0.5">
                          <p className="font-semibold text-xs text-foreground">{row.customer.name}</p>
                          <p className="text-[11px] font-mono text-muted-foreground">{row.customer.phone}</p>
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
                        {row.totalQty}
                      </td>

                      {/* Subtotal */}
                      <td className="p-4 text-right font-mono text-muted-foreground text-xs whitespace-nowrap">
                        ৳{Number(row.subTotal).toLocaleString()}
                      </td>

                      {/* Discount */}
                      <td className="p-4 text-right font-mono text-amber-600 dark:text-amber-400 text-xs whitespace-nowrap">
                        {Number(row.discountAmount) > 0 ? `৳${Number(row.discountAmount).toLocaleString()}` : "—"}
                      </td>

                      {/* Total */}
                      <td className="p-4 text-right font-mono font-bold text-foreground whitespace-nowrap">
                        ৳{Number(row.totalAmount).toLocaleString()}
                      </td>

                      {/* Paid */}
                      <td className="p-4 text-right font-mono text-emerald-600 dark:text-emerald-400 font-semibold whitespace-nowrap">
                        ৳{Number(row.paidAmount).toLocaleString()}
                      </td>

                      {/* Due */}
                      <td className="p-4 text-right font-mono font-semibold whitespace-nowrap">
                        {Number(row.dueAmount) > 0 ? (
                          <span className="text-red-600 dark:text-red-400">
                            ৳{Number(row.dueAmount).toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">৳0</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="p-4 text-center">
                        <Badge
                          variant="outline"
                          className={`text-[10px] uppercase ${
                            row.paymentStatus === "PAID"
                              ? "border-emerald-300 text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40"
                              : "border-red-300 text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/40"
                          }`}
                        >
                          {row.paymentStatus}
                        </Badge>
                      </td>

                      {/* Staff */}
                      <td className="p-4 text-xs font-medium text-muted-foreground whitespace-nowrap">
                        {row.staff}
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
                  <td colSpan={7} className="p-4 text-muted-foreground">
                    POS Sales Totals ({data.length} Transactions):
                  </td>
                  <td className="p-4 text-right font-mono text-foreground font-bold">
                    ৳{Number(summary.totalSales).toLocaleString()}
                  </td>
                  <td className="p-4 text-right font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                    ৳{Number(summary.netSales).toLocaleString()}
                  </td>
                  <td className="p-4 text-right font-mono text-red-600 dark:text-red-400 font-bold">
                    ৳{Number(summary.totalUnpaid).toLocaleString()}
                  </td>
                  <td colSpan={2} className="p-4 text-center text-muted-foreground">
                    Counter Ready
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
              ? "Showing 0 records"
              : `Showing ${(currentPage - 1) * pageSize + 1} to ${Math.min(currentPage * pageSize, data.length)} of ${data.length.toLocaleString()} records`}
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
