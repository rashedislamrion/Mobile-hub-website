"use client";

import { useEffect, useState, useCallback } from "react";
import { useAdminPage } from "@/contexts/AdminPageContext";
import {
  Receipt,
  TrendingDown,
  Users,
  ChevronLeft,
  ChevronRight,
  Wallet,
  Tag,
} from "lucide-react";
import { toast } from "sonner";
import { apiGet } from "@/lib/api-client";
import { ReportKpiCard } from "@/components/admin/ReportKpiCard";
import { ReportFilterBar } from "@/components/admin/ReportFilterBar";
import { Badge } from "@/components/ui/badge";
import { exportToCsv } from "@/lib/export-utils";

interface ExpenseRecord {
  id: string;
  referenceNo: string;
  date: string;
  createdAt: string;
  branch: string;
  category: string;
  wallet: string;
  amount: number;
  notes: string;
  description: string;
  recordedBy: string;
  status: string;
}

interface CategoryBreakdown {
  id: string;
  name: string;
  amount: number;
}

export default function ExpenseReportPage() {
  const { setTitle, setBadge } = useAdminPage();

  const [data, setData] = useState<ExpenseRecord[]>([]);
  const [summary, setSummary] = useState({
    total: 0,
    totalExpenses: 0,
    totalPayroll: 0,
  });
  const [categoryBreakdown, setCategoryBreakdown] = useState<CategoryBreakdown[]>([]);
  const [branches, setBranches] = useState<Array<{ id: string; name: string }>>([]);
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [walletTypes, setWalletTypes] = useState<Array<{ id: string; name: string }>>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedBranch, setSelectedBranch] = useState("all");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedWallet, setSelectedWallet] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  useEffect(() => {
    setTitle("Expense Report");
    setBadge("Reports");
  }, [setTitle, setBadge]);

  useEffect(() => {
    Promise.all([
      apiGet<any[]>("/branches").catch(() => []),
      apiGet<any[]>("/expense-categories").catch(() => []),
      apiGet<any[]>("/wallets").catch(() => []),
    ]).then(([branchesRes, catRes, walletsRes]) => {
      if (Array.isArray(branchesRes)) setBranches(branchesRes);
      if (Array.isArray(catRes)) setCategories(catRes);
      if (Array.isArray(walletsRes)) setWalletTypes(walletsRes);
    });
  }, []);

  const loadReport = useCallback(async () => {
    try {
      setIsLoading(true);
      const params: Record<string, any> = {};
      if (selectedBranch !== "all") params.branch = selectedBranch;
      if (selectedCategory !== "all") params.categoryId = selectedCategory;
      if (selectedWallet !== "all") params.walletTypeId = selectedWallet;
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;
      if (searchTerm.trim()) params.search = searchTerm.trim();

      const res = await apiGet<{
        summary: typeof summary;
        categoryBreakdown: CategoryBreakdown[];
        data: ExpenseRecord[];
      }>("/reports/expense", params);

      setData(res?.data || []);
      if (res?.summary) setSummary(res.summary);
      if (Array.isArray(res?.categoryBreakdown)) setCategoryBreakdown(res.categoryBreakdown);
    } catch (err: any) {
      toast.error(err.message || "Failed to load expense report");
    } finally {
      setIsLoading(false);
    }
  }, [selectedBranch, selectedCategory, selectedWallet, dateFrom, dateTo, searchTerm]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const handleReset = () => {
    setSearchTerm("");
    setSelectedBranch("all");
    setSelectedCategory("all");
    setSelectedWallet("all");
    setDateFrom("");
    setDateTo("");
    setCurrentPage(1);
  };

  const handleExport = () => {
    const headers = [
      "Reference No",
      "Date",
      "Branch",
      "Category",
      "Payment Wallet",
      "Amount (BDT)",
      "Description / Notes",
      "Recorded By",
      "Status",
    ];

    const rows = data.map((row) => [
      row.referenceNo,
      new Date(row.createdAt).toLocaleString("en-GB"),
      row.branch,
      row.category,
      row.wallet,
      row.amount,
      row.description,
      row.recordedBy,
      row.status,
    ]);

    exportToCsv("expense-report", headers, rows);
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
            <Receipt className="h-6 w-6 text-rose-600 dark:text-rose-400" />
            Expense Report
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Operational expenses, payroll disbursements, utility costs, and category breakdown
          </p>
        </div>
      </div>

      {/* Top 3 KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <ReportKpiCard
          label="Total Expenditure Outflow"
          value={`৳${Number(summary.total).toLocaleString()}`}
          icon={Receipt}
          colorTint="rose"
        />
        <ReportKpiCard
          label="Operating Expenses"
          value={`৳${Number(summary.totalExpenses).toLocaleString()}`}
          icon={TrendingDown}
          colorTint="amber"
        />
        <ReportKpiCard
          label="Staff Payroll Disbursed"
          value={`৳${Number(summary.totalPayroll).toLocaleString()}`}
          icon={Users}
          colorTint="purple"
        />
      </div>

      {/* Category Breakdown Pills */}
      {categoryBreakdown.length > 0 && (
        <div className="p-4 rounded-xl border border-border bg-card shadow-xs space-y-2.5">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Tag className="h-3.5 w-3.5 text-primary" />
            Expense Breakdown by Category
          </p>
          <div className="flex flex-wrap gap-2">
            {categoryBreakdown.map((cat) => (
              <div
                key={cat.id}
                className="px-3 py-1.5 rounded-lg border border-border bg-muted/40 text-xs flex items-center gap-2 hover:bg-muted transition-colors"
              >
                <span className="text-muted-foreground font-medium">{cat.name}:</span>
                <span className="font-mono font-bold text-foreground">
                  ৳{Number(cat.amount).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <ReportFilterBar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Search Reference No, Description, Notes..."
        branches={branches}
        selectedBranch={selectedBranch}
        onBranchChange={setSelectedBranch}
        secondarySelect={{
          placeholder: "All Categories",
          options: categories.map((c) => ({ label: c.name, value: c.id })),
          value: selectedCategory,
          onChange: setSelectedCategory,
        }}
        thirdSelect={{
          placeholder: "All Wallets / Payment Accounts",
          options: walletTypes.map((w) => ({ label: w.name, value: w.id })),
          value: selectedWallet,
          onChange: setSelectedWallet,
        }}
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
                <th className="p-4 font-semibold tracking-wider">Reference No</th>
                <th className="p-4 font-semibold tracking-wider">Date & Time</th>
                <th className="p-4 font-semibold tracking-wider">Category</th>
                <th className="p-4 font-semibold tracking-wider">Wallet / Account</th>
                <th className="p-4 font-semibold tracking-wider">Description / Note</th>
                <th className="p-4 font-semibold tracking-wider text-right">Amount</th>
                <th className="p-4 font-semibold tracking-wider">Recorded By</th>
                <th className="p-4 font-semibold tracking-wider text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-foreground">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-muted-foreground">
                    <div className="flex items-center justify-center gap-2">
                      <div className="h-5 w-5 border-2 border-rose-600 border-t-transparent rounded-full animate-spin" />
                      <span>Loading expense ledger records...</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-muted-foreground">
                    No expense entries found matching the filter criteria.
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
                      {/* Ref No */}
                      <td className="p-4">
                        <div className="space-y-0.5">
                          <span className="font-mono font-bold text-rose-600 dark:text-rose-400 text-xs">
                            {row.referenceNo}
                          </span>
                          <p className="text-[11px] text-muted-foreground">{row.branch}</p>
                        </div>
                      </td>

                      {/* Date */}
                      <td className="p-4 text-xs font-mono text-muted-foreground whitespace-nowrap">
                        {formattedDate}
                      </td>

                      {/* Category */}
                      <td className="p-4">
                        <Badge variant="outline" className="text-xs bg-muted/30 font-medium">
                          {row.category}
                        </Badge>
                      </td>

                      {/* Wallet */}
                      <td className="p-4 text-xs font-medium text-foreground whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Wallet className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>{row.wallet}</span>
                        </div>
                      </td>

                      {/* Description */}
                      <td className="p-4 text-xs max-w-xs text-muted-foreground truncate" title={row.description}>
                        {row.description || "General operational expense"}
                      </td>

                      {/* Amount */}
                      <td className="p-4 text-right font-mono font-bold text-rose-600 dark:text-rose-400 whitespace-nowrap">
                        ৳{Number(row.amount).toLocaleString()}
                      </td>

                      {/* Recorded By */}
                      <td className="p-4 text-xs font-medium text-muted-foreground whitespace-nowrap">
                        {row.recordedBy}
                      </td>

                      {/* Status */}
                      <td className="p-4 text-center">
                        <Badge
                          variant="outline"
                          className="text-[10px] uppercase border-emerald-300 text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40"
                        >
                          {row.status || "PAID"}
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
                    Total Filtered Outflow ({data.length} Expenses):
                  </td>
                  <td className="p-4 text-right font-mono text-rose-600 dark:text-rose-400 font-bold">
                    ৳{Number(summary.totalExpenses).toLocaleString()}
                  </td>
                  <td colSpan={2} className="p-4 text-center text-muted-foreground">
                    Verified Outflow
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
              ? "Showing 0 entries"
              : `Showing ${(currentPage - 1) * pageSize + 1} to ${Math.min(currentPage * pageSize, data.length)} of ${data.length.toLocaleString()} entries`}
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
