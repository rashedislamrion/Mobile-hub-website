"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useAdminPage } from "@/contexts/AdminPageContext";
import {
  Users,
  AlertCircle,
  TrendingDown,
  Eye,
  CheckCircle,
  Banknote,
  DollarSign,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { apiGet } from "@/lib/api-client";
import { useRouter } from "next/navigation";
import { ReportKpiCard } from "@/components/admin/ReportKpiCard";
import { ReportFilterBar } from "@/components/admin/ReportFilterBar";
import { PaymentSettlementDialog } from "@/components/admin/PaymentSettlementDialog";
import { Badge } from "@/components/ui/badge";
import { exportToCsv } from "@/lib/export-utils";

interface CustomerDueItem {
  id: string;
  customerName: string;
  phone: string;
  email: string;
  totalOrders: number;
  totalSpent: number;
  totalDue: number;
  lastOrderDate: string;
  branch: string;
  source?: string;
}

export default function CustomerDueReport() {
  const { setTitle, setBadge } = useAdminPage();
  const [data, setData] = useState<CustomerDueItem[]>([]);
  const [summary, setSummary] = useState({
    totalDue: 0,
    customersWithDueCount: 0,
    highDueCount: 0,
  });
  const [branches, setBranches] = useState<Array<{ id: string; name: string }>>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedBranch, setSelectedBranch] = useState("all");
  const [selectedDueRange, setSelectedDueRange] = useState("all");
  const [selectedSort, setSelectedSort] = useState("high-due");

  // Payment Settlement Dialog State
  const [selectedCustomerForPayment, setSelectedCustomerForPayment] = useState<CustomerDueItem | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;
  const router = useRouter();

  useEffect(() => {
    setTitle("Customer Due Report");
    setBadge("Reports");
  }, [setTitle, setBadge]);

  useEffect(() => {
    apiGet<any[]>("/branches")
      .then((res) => {
        if (Array.isArray(res)) setBranches(res);
      })
      .catch(() => {});
  }, []);

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const params: Record<string, any> = {};

      if (selectedBranch !== "all") params.branch = selectedBranch;
      if (selectedDueRange !== "all") params.dueRange = selectedDueRange;
      if (searchTerm.trim()) params.search = searchTerm.trim();

      const res = await apiGet<{
        customerDues: CustomerDueItem[];
        summary: { totalDue: number; customersWithDueCount: number; highDueCount: number };
      }>("/reports/customer-due", params);

      setData(res?.customerDues || []);
      if (res?.summary) setSummary(res.summary);
    } catch (err: any) {
      toast.error(err.message || "Failed to load customer due report");
    } finally {
      setIsLoading(false);
    }
  }, [selectedBranch, selectedDueRange, searchTerm]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleReset = () => {
    setSearchTerm("");
    setSelectedBranch("all");
    setSelectedDueRange("all");
    setSelectedSort("high-due");
    setCurrentPage(1);
  };

  const handleExport = () => {
    const headers = [
      "Customer Name",
      "Phone",
      "Email",
      "Branch",
      "Total Orders",
      "Total Spent (BDT)",
      "Outstanding Due (BDT)",
      "Last Order Date",
      "Source",
    ];

    const rows = sortedData.map((row) => [
      row.customerName,
      row.phone,
      row.email,
      row.branch,
      row.totalOrders,
      row.totalSpent,
      row.totalDue,
      row.lastOrderDate ? new Date(row.lastOrderDate).toLocaleDateString("en-GB") : "N/A",
      row.source || "POS",
    ]);

    exportToCsv("customer-due-report", headers, rows);
  };

  // Sorting
  const sortedData = useMemo(() => {
    const copy = [...data];
    if (selectedSort === "high-due") {
      copy.sort((a, b) => b.totalDue - a.totalDue);
    } else if (selectedSort === "low-due") {
      copy.sort((a, b) => a.totalDue - b.totalDue);
    } else if (selectedSort === "orders") {
      copy.sort((a, b) => b.totalOrders - a.totalOrders);
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
            <Users className="h-6 w-6 text-red-600 dark:text-red-400" />
            Customer Due Report
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Accounts receivable, outstanding customer balances, reminders, and payment settlement
          </p>
        </div>
      </div>

      {/* Top 3 KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <ReportKpiCard
          label="Total Outstanding Receivables"
          value={`৳${Number(summary.totalDue).toLocaleString()}`}
          icon={AlertCircle}
          colorTint="red"
        />
        <ReportKpiCard
          label="Customers with Due"
          value={summary.customersWithDueCount}
          icon={Users}
          colorTint="amber"
        />
        <ReportKpiCard
          label="High Due Accounts (> ৳5,000)"
          value={summary.highDueCount}
          icon={TrendingDown}
          colorTint="rose"
        />
      </div>

      {/* Filter Bar */}
      <ReportFilterBar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Search Customer Name, Phone, Email..."
        branches={branches}
        selectedBranch={selectedBranch}
        onBranchChange={setSelectedBranch}
        secondarySelect={{
          placeholder: "All Due Amounts",
          options: [
            { label: "৳0 - ৳1,000", value: "0-1000" },
            { label: "৳1,001 - ৳5,000", value: "1000-5000" },
            { label: "৳5,000+", value: "5000+" },
          ],
          value: selectedDueRange,
          onChange: setSelectedDueRange,
        }}
        sortOptions={[
          { label: "High Due to Low", value: "high-due" },
          { label: "Low Due to High", value: "low-due" },
          { label: "Most Orders", value: "orders" },
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
                <th className="p-4 font-semibold tracking-wider">Customer</th>
                <th className="p-4 font-semibold tracking-wider">Outlet / Branch</th>
                <th className="p-4 font-semibold tracking-wider text-center">Orders</th>
                <th className="p-4 font-semibold tracking-wider text-right">Total Spent</th>
                <th className="p-4 font-semibold tracking-wider text-right">Outstanding Due</th>
                <th className="p-4 font-semibold tracking-wider">Source</th>
                <th className="p-4 font-semibold tracking-wider">Last Order</th>
                <th className="p-4 font-semibold tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-foreground">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-muted-foreground">
                    <div className="flex items-center justify-center gap-2">
                      <div className="h-5 w-5 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                      <span>Loading customer receivables ledger...</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-muted-foreground">
                    No customer dues found matching the filter criteria.
                  </td>
                </tr>
              ) : (
                paginatedData.map((row) => (
                  <tr key={row.id} className="hover:bg-muted/30 transition-colors">
                    {/* Customer Info */}
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-xs text-foreground shrink-0">
                          {row.customerName.charAt(0).toUpperCase()}
                        </div>
                        <div className="space-y-0.5">
                          <p className="font-semibold text-xs text-foreground leading-tight">
                            {row.customerName}
                          </p>
                          <p className="text-[11px] font-mono text-muted-foreground">
                            {row.phone}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Branch */}
                    <td className="p-4 text-xs text-muted-foreground whitespace-nowrap">
                      {row.branch}
                    </td>

                    {/* Total Orders */}
                    <td className="p-4 text-center font-mono font-semibold text-xs text-foreground">
                      {row.totalOrders}
                    </td>

                    {/* Total Spent */}
                    <td className="p-4 text-right font-mono text-muted-foreground text-xs whitespace-nowrap">
                      ৳{Number(row.totalSpent).toLocaleString()}
                    </td>

                    {/* Total Due */}
                    <td className="p-4 text-right font-mono font-bold text-red-600 dark:text-red-400 whitespace-nowrap text-sm">
                      ৳{Number(row.totalDue).toLocaleString()}
                    </td>

                    {/* Source */}
                    <td className="p-4">
                      <Badge variant="outline" className="text-[10px] bg-muted/20 uppercase">
                        {row.source || "POS"}
                      </Badge>
                    </td>

                    {/* Last Order Date */}
                    <td className="p-4 text-xs text-muted-foreground whitespace-nowrap font-mono">
                      {row.lastOrderDate ? new Date(row.lastOrderDate).toLocaleDateString("en-GB") : "N/A"}
                    </td>

                    {/* Actions */}
                    <td className="p-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedCustomerForPayment(row)}
                          className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1 transition-colors shadow-xs"
                          title="Record Payment"
                        >
                          <Banknote className="h-3.5 w-3.5" />
                          <span>Pay</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => toast.success(`Payment reminder sent to ${row.customerName}`)}
                          className="p-1.5 rounded-lg border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                          title="Send Reminder"
                        >
                          <CheckCircle className="h-4 w-4 text-blue-600" />
                        </button>
                        <button
                          type="button"
                          onClick={() => router.push(`/admin/customers/${row.id}`)}
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
                    Total Receivables ({sortedData.length} Customers):
                  </td>
                  <td className="p-4 text-right font-mono text-red-600 dark:text-red-400 font-bold text-sm">
                    ৳{Number(summary.totalDue).toLocaleString()}
                  </td>
                  <td colSpan={3} className="p-4 text-center text-muted-foreground">
                    High Due Count: {summary.highDueCount} Accounts
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
              ? "Showing 0 accounts"
              : `Showing ${(currentPage - 1) * pageSize + 1} to ${Math.min(currentPage * pageSize, sortedData.length)} of ${sortedData.length.toLocaleString()} accounts`}
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

      {/* Payment Settlement Dialog */}
      {selectedCustomerForPayment && (
        <PaymentSettlementDialog
          customer={selectedCustomerForPayment}
          onClose={() => setSelectedCustomerForPayment(null)}
          onSuccess={() => {
            setSelectedCustomerForPayment(null);
            loadData();
          }}
        />
      )}
    </div>
  );
}
