"use client";

import { useEffect, useState, useCallback } from "react";
import { useAdminPage } from "@/contexts/AdminPageContext";
import {
  Globe,
  ShoppingBag,
  CheckCircle2,
  Clock,
  DollarSign,
  ChevronLeft,
  ChevronRight,
  Package,
} from "lucide-react";
import { toast } from "sonner";
import { apiGet } from "@/lib/api-client";
import { ReportKpiCard } from "@/components/admin/ReportKpiCard";
import { ReportFilterBar } from "@/components/admin/ReportFilterBar";
import { Badge } from "@/components/ui/badge";
import { exportToCsv } from "@/lib/export-utils";

interface WebsiteSalesRecord {
  id: string;
  orderCode: string;
  orderDate: string;
  createdAt: string;
  branch: string;
  customer: {
    id: string;
    name: string;
    phone: string;
    email: string;
  };
  items: Array<{
    id: string;
    productName: string;
    variant: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }>;
  itemsSummary: string;
  totalAmount: number;
  paidAmount: number;
  dueAmount: number;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
}

export default function WebsiteSalesReportPage() {
  const { setTitle, setBadge } = useAdminPage();

  const [data, setData] = useState<WebsiteSalesRecord[]>([]);
  const [summary, setSummary] = useState({
    totalOrders: 0,
    completedTotal: 0,
    pendingTotal: 0,
    netTotal: 0,
    totalSales: 0,
  });
  const [branches, setBranches] = useState<Array<{ id: string; name: string }>>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedBranch, setSelectedBranch] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  useEffect(() => {
    setTitle("Website Sales Report");
    setBadge("Reports");
  }, [setTitle, setBadge]);

  useEffect(() => {
    apiGet<any[]>("/branches")
      .then((res) => {
        if (Array.isArray(res)) setBranches(res);
      })
      .catch(() => {});
  }, []);

  const loadReport = useCallback(async () => {
    try {
      setIsLoading(true);
      const params: Record<string, any> = {};
      if (selectedBranch !== "all") params.branch = selectedBranch;
      if (selectedStatus !== "all") params.status = selectedStatus;
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;
      if (searchTerm.trim()) params.search = searchTerm.trim();

      const res = await apiGet<{
        summary: typeof summary;
        data: WebsiteSalesRecord[];
      }>("/reports/website-sales", params);

      setData(res?.data || []);
      if (res?.summary) setSummary(res.summary);
    } catch (err: any) {
      toast.error(err.message || "Failed to load website sales report");
    } finally {
      setIsLoading(false);
    }
  }, [selectedBranch, selectedStatus, dateFrom, dateTo, searchTerm]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const handleReset = () => {
    setSearchTerm("");
    setSelectedBranch("all");
    setSelectedStatus("all");
    setDateFrom("");
    setDateTo("");
    setCurrentPage(1);
  };

  const handleExport = () => {
    const headers = [
      "Order Date",
      "Order Code",
      "Branch",
      "Customer Name",
      "Customer Phone",
      "Items Summary",
      "Total Amount (BDT)",
      "Paid Amount (BDT)",
      "Due Amount (BDT)",
      "Order Status",
      "Payment Status",
      "Payment Method",
    ];

    const rows = data.map((row) => [
      new Date(row.createdAt).toLocaleString("en-GB"),
      row.orderCode,
      row.branch,
      row.customer.name,
      row.customer.phone,
      row.itemsSummary,
      row.totalAmount,
      row.paidAmount,
      row.dueAmount,
      row.status,
      row.paymentStatus,
      row.paymentMethod,
    ]);

    exportToCsv("website-sales-report", headers, rows);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "DELIVERED":
      case "COMPLETED":
        return <Badge className="bg-emerald-500 text-white text-[11px]">{status}</Badge>;
      case "PENDING":
        return <Badge className="bg-amber-500 text-white text-[11px]">{status}</Badge>;
      case "CONFIRMED":
      case "PROCESSING":
        return <Badge className="bg-blue-500 text-white text-[11px]">{status}</Badge>;
      case "CANCELLED":
      case "RETURNED":
        return <Badge className="bg-red-500 text-white text-[11px]">{status}</Badge>;
      default:
        return <Badge variant="outline" className="text-[11px]">{status}</Badge>;
    }
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
            <Globe className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            Website Sales Report
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Online storefront order analytics, payment collections, and delivery status breakdown
          </p>
        </div>
      </div>

      {/* Top KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <ReportKpiCard
          label="Total Online Orders"
          value={summary.totalOrders}
          icon={ShoppingBag}
          colorTint="blue"
        />
        <ReportKpiCard
          label="Completed Orders"
          value={`৳${Number(summary.completedTotal).toLocaleString()}`}
          icon={CheckCircle2}
          colorTint="emerald"
        />
        <ReportKpiCard
          label="Pending / In-Transit"
          value={`৳${Number(summary.pendingTotal).toLocaleString()}`}
          icon={Clock}
          colorTint="amber"
        />
        <ReportKpiCard
          label="Net Web Revenue"
          value={`৳${Number(summary.netTotal).toLocaleString()}`}
          icon={DollarSign}
          colorTint="purple"
        />
      </div>

      {/* Filter Bar */}
      <ReportFilterBar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Search Order Code, Customer, Phone..."
        branches={branches}
        selectedBranch={selectedBranch}
        onBranchChange={setSelectedBranch}
        statusOptions={[
          { label: "Completed / Delivered", value: "DELIVERED" },
          { label: "Confirmed", value: "CONFIRMED" },
          { label: "Pending", value: "PENDING" },
          { label: "Parcel Booked", value: "PARCEL_BOOKED" },
          { label: "Cancelled", value: "CANCELLED" },
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
                <th className="p-4 font-semibold tracking-wider">Date & Time</th>
                <th className="p-4 font-semibold tracking-wider">Order ID</th>
                <th className="p-4 font-semibold tracking-wider">Customer</th>
                <th className="p-4 font-semibold tracking-wider">Items Summary</th>
                <th className="p-4 font-semibold tracking-wider text-right">Total</th>
                <th className="p-4 font-semibold tracking-wider text-right">Paid</th>
                <th className="p-4 font-semibold tracking-wider text-right">Due</th>
                <th className="p-4 font-semibold tracking-wider text-center">Status</th>
                <th className="p-4 font-semibold tracking-wider text-center">Payment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-foreground">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-muted-foreground">
                    <div className="flex items-center justify-center gap-2">
                      <div className="h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                      <span>Loading website sales data...</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-muted-foreground">
                    No online orders found matching the filter criteria.
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
                      {/* Date */}
                      <td className="p-4 text-xs font-mono text-muted-foreground whitespace-nowrap">
                        {formattedDate}
                      </td>

                      {/* Order Code */}
                      <td className="p-4">
                        <div className="space-y-0.5">
                          <span className="font-mono font-bold text-blue-600 dark:text-blue-400 text-xs">
                            {row.orderCode}
                          </span>
                          <p className="text-[11px] text-muted-foreground">{row.branch}</p>
                        </div>
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

                      {/* Order Status */}
                      <td className="p-4 text-center">
                        {getStatusBadge(row.status)}
                      </td>

                      {/* Payment Status */}
                      <td className="p-4 text-center">
                        <Badge
                          variant="outline"
                          className={`text-[10px] uppercase ${
                            row.paymentStatus === "PAID"
                              ? "border-emerald-300 text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40"
                              : "border-amber-300 text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40"
                          }`}
                        >
                          {row.paymentStatus}
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
                  <td colSpan={4} className="p-4 text-muted-foreground">
                    Summary Totals (All Filtered Results):
                  </td>
                  <td className="p-4 text-right font-mono text-foreground font-bold">
                    ৳{Number(summary.totalSales).toLocaleString()}
                  </td>
                  <td className="p-4 text-right font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                    ৳{Number(summary.completedTotal).toLocaleString()}
                  </td>
                  <td className="p-4 text-right font-mono text-red-600 dark:text-red-400 font-bold">
                    ৳{Number(summary.pendingTotal).toLocaleString()}
                  </td>
                  <td colSpan={2} className="p-4 text-center text-muted-foreground">
                    {data.length} Total Orders
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
              ? "Showing 0 results"
              : `Showing ${(currentPage - 1) * pageSize + 1} to ${Math.min(currentPage * pageSize, data.length)} of ${data.length.toLocaleString()} results`}
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
