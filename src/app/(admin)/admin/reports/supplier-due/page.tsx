"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useAdminPage } from "@/contexts/AdminPageContext";
import {
  Building2,
  AlertCircle,
  TrendingDown,
  Eye,
  Banknote,
  Users2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { apiGet } from "@/lib/api-client";
import { useRouter } from "next/navigation";
import { ReportKpiCard } from "@/components/admin/ReportKpiCard";
import { ReportFilterBar } from "@/components/admin/ReportFilterBar";
import { Badge } from "@/components/ui/badge";
import { exportToCsv } from "@/lib/export-utils";

interface SupplierDueItem {
  id: string;
  supplierName: string;
  companyName?: string;
  contactPerson: string | null;
  phone: string;
  email: string | null;
  totalOrders: number;
  totalPurchases: number;
  totalPaid: number;
  totalDue: number;
  lastPurchaseDate: string | null;
}

export default function SupplierDueReport() {
  const { setTitle, setBadge } = useAdminPage();
  const [data, setData] = useState<SupplierDueItem[]>([]);
  const [summary, setSummary] = useState({
    totalDue: 0,
    suppliersWithDueCount: 0,
    highDueCount: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDueRange, setSelectedDueRange] = useState("all");
  const [selectedSort, setSelectedSort] = useState("high-due");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;
  const router = useRouter();

  useEffect(() => {
    setTitle("Supplier Due Report");
    setBadge("Reports");
  }, [setTitle, setBadge]);

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const params: Record<string, any> = {};
      if (selectedDueRange !== "all") params.dueRange = selectedDueRange;
      if (searchTerm.trim()) params.search = searchTerm.trim();

      const res = await apiGet<{
        supplierDues: SupplierDueItem[];
        summary: { totalDue: number; suppliersWithDueCount: number; highDueCount: number };
      }>("/reports/supplier-due", params);

      setData(res?.supplierDues || []);
      if (res?.summary) setSummary(res.summary);
    } catch (err: any) {
      toast.error(err.message || "Failed to load supplier due report");
    } finally {
      setIsLoading(false);
    }
  }, [selectedDueRange, searchTerm]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleReset = () => {
    setSearchTerm("");
    setSelectedDueRange("all");
    setSelectedSort("high-due");
    setCurrentPage(1);
  };

  const handleExport = () => {
    const headers = [
      "Supplier Name",
      "Company",
      "Phone",
      "Email",
      "Purchase Orders Count",
      "Total Purchases (BDT)",
      "Total Paid (BDT)",
      "Outstanding Due (BDT)",
      "Last Purchase Date",
    ];

    const rows = sortedData.map((row) => [
      row.supplierName,
      row.companyName || "N/A",
      row.phone,
      row.email || "N/A",
      row.totalOrders,
      row.totalPurchases,
      row.totalPaid,
      row.totalDue,
      row.lastPurchaseDate ? new Date(row.lastPurchaseDate).toLocaleDateString("en-GB") : "N/A",
    ]);

    exportToCsv("supplier-due-report", headers, rows);
  };

  // Sorting
  const sortedData = useMemo(() => {
    const copy = [...data];
    if (selectedSort === "high-due") {
      copy.sort((a, b) => b.totalDue - a.totalDue);
    } else if (selectedSort === "low-due") {
      copy.sort((a, b) => a.totalDue - b.totalDue);
    } else if (selectedSort === "purchases") {
      copy.sort((a, b) => b.totalPurchases - a.totalPurchases);
    }
    return copy;
  }, [data, selectedSort]);

  // Pagination Slice
  const totalPages = Math.max(1, Math.ceil(sortedData.length / pageSize));
  const paginatedData = sortedData.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <Building2 className="h-6 w-6 text-red-600 dark:text-red-400" />
            Supplier Due Report
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Accounts payable, vendor credit balances, purchase obligations, and payment disbursement
          </p>
        </div>
      </div>

      {/* Top 3 KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <ReportKpiCard
          label="Total Accounts Payable"
          value={`৳${Number(summary.totalDue).toLocaleString()}`}
          icon={AlertCircle}
          colorTint="red"
        />
        <ReportKpiCard
          label="Active Creditors (Suppliers)"
          value={summary.suppliersWithDueCount}
          icon={Users2}
          colorTint="amber"
        />
        <ReportKpiCard
          label="High Due Vendors (> ৳50,000)"
          value={summary.highDueCount}
          icon={TrendingDown}
          colorTint="rose"
        />
      </div>

      {/* Filter Bar */}
      <ReportFilterBar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Search Supplier, Company, Phone..."
        secondarySelect={{
          placeholder: "All Due Amounts",
          options: [
            { label: "৳0 - ৳50,000", value: "0-50000" },
            { label: "৳50,001 - ৳200,000", value: "50000-200000" },
            { label: "৳200,000+", value: "200000+" },
          ],
          value: selectedDueRange,
          onChange: setSelectedDueRange,
        }}
        sortOptions={[
          { label: "High Due to Low", value: "high-due" },
          { label: "Low Due to High", value: "low-due" },
          { label: "Most Purchases", value: "purchases" },
        ]}
        selectedSort={selectedSort}
        onSortChange={setSelectedSort}
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
                <th className="p-4 font-semibold tracking-wider">Supplier & Company</th>
                <th className="p-4 font-semibold tracking-wider text-center">POs Count</th>
                <th className="p-4 font-semibold tracking-wider text-right">Total Purchased</th>
                <th className="p-4 font-semibold tracking-wider text-right">Paid So Far</th>
                <th className="p-4 font-semibold tracking-wider text-right">Outstanding Due</th>
                <th className="p-4 font-semibold tracking-wider">Last Purchase</th>
                <th className="p-4 font-semibold tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-foreground">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    <div className="flex items-center justify-center gap-2">
                      <div className="h-5 w-5 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                      <span>Loading supplier payables ledger...</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    No supplier dues found matching the filter criteria.
                  </td>
                </tr>
              ) : (
                paginatedData.map((row) => (
                  <tr key={row.id} className="hover:bg-muted/30 transition-colors">
                    {/* Supplier Info */}
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold text-xs border border-emerald-100 dark:border-emerald-900/30 shrink-0">
                          {row.supplierName.charAt(0).toUpperCase()}
                        </div>
                        <div className="space-y-0.5">
                          <p className="font-semibold text-xs text-foreground leading-tight">
                            {row.companyName || row.supplierName}
                          </p>
                          <p className="text-[11px] font-mono text-muted-foreground">
                            {row.supplierName} • {row.phone}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* POs Count */}
                    <td className="p-4 text-center font-mono font-semibold text-xs text-foreground">
                      {row.totalOrders}
                    </td>

                    {/* Total Purchased */}
                    <td className="p-4 text-right font-mono text-muted-foreground text-xs whitespace-nowrap">
                      ৳{Number(row.totalPurchases).toLocaleString()}
                    </td>

                    {/* Total Paid */}
                    <td className="p-4 text-right font-mono text-emerald-600 dark:text-emerald-400 font-semibold whitespace-nowrap text-xs">
                      ৳{Number(row.totalPaid).toLocaleString()}
                    </td>

                    {/* Total Due */}
                    <td className="p-4 text-right font-mono font-bold text-red-600 dark:text-red-400 whitespace-nowrap text-sm">
                      ৳{Number(row.totalDue).toLocaleString()}
                    </td>

                    {/* Last Purchase Date */}
                    <td className="p-4 text-xs text-muted-foreground whitespace-nowrap font-mono">
                      {row.lastPurchaseDate ? new Date(row.lastPurchaseDate).toLocaleDateString("en-GB") : "N/A"}
                    </td>

                    {/* Actions */}
                    <td className="p-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => router.push(`/admin/purchases?supplierId=${row.id}`)}
                          className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1 transition-colors shadow-xs"
                          title="Disburse Payment"
                        >
                          <Banknote className="h-3.5 w-3.5" />
                          <span>Pay Vendor</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => router.push(`/admin/suppliers/${row.id}`)}
                          className="p-1.5 rounded-lg border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                          title="View Profile"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {/* Table Footer Summary Row */}
            {!isLoading && data.length > 0 && (
              <tfoot className="bg-muted/40 border-t border-border font-semibold text-xs text-foreground">
                <tr>
                  <td colSpan={4} className="p-4 text-muted-foreground">
                    Total Supplier Payables ({sortedData.length} Vendors):
                  </td>
                  <td className="p-4 text-right font-mono text-red-600 dark:text-red-400 font-bold text-sm">
                    ৳{Number(summary.totalDue).toLocaleString()}
                  </td>
                  <td colSpan={2} className="p-4 text-center text-muted-foreground">
                    Active Creditors: {summary.suppliersWithDueCount}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="p-4 border-t border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-muted-foreground">
          <div>
            {sortedData.length === 0
              ? "Showing 0 vendors"
              : `Showing ${(currentPage - 1) * pageSize + 1} to ${Math.min(currentPage * pageSize, sortedData.length)} of ${sortedData.length.toLocaleString()} vendors`}
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
