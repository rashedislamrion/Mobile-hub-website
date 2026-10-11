"use client";

import { useEffect, useState, useCallback } from "react";
import { useAdminPage } from "@/contexts/AdminPageContext";
import {
  ArrowDownLeft,
  ArrowUpRight,
  DollarSign,
  ChevronLeft,
  ChevronRight,
  Wallet,
  Tag,
  CreditCard,
} from "lucide-react";
import { toast } from "sonner";
import { apiGet } from "@/lib/api-client";
import { ReportKpiCard } from "@/components/admin/ReportKpiCard";
import { ReportFilterBar } from "@/components/admin/ReportFilterBar";
import { Badge } from "@/components/ui/badge";
import { exportToCsv } from "@/lib/export-utils";

interface TransactionRecord {
  id: string;
  referenceNo: string;
  date: string;
  createdAt: string;
  branch: string;
  type: "DEPOSIT" | "WITHDRAWAL";
  payType: string;
  source: string;
  wallet: {
    id: string;
    name: string;
    kind: string;
  };
  amount: number;
  balanceAfter: number;
  recordedBy: string;
  note: string;
}

interface TypeBreakdown {
  type: string;
  amount: number;
}

export default function TransactionsReportPage() {
  const { setTitle, setBadge } = useAdminPage();

  const [data, setData] = useState<TransactionRecord[]>([]);
  const [summary, setSummary] = useState({
    totalInflow: 0,
    totalOutflow: 0,
    netFlow: 0,
  });
  const [typeBreakdown, setTypeBreakdown] = useState<TypeBreakdown[]>([]);
  const [walletTypes, setWalletTypes] = useState<Array<{ id: string; name: string }>>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedWallet, setSelectedWallet] = useState("all");
  const [selectedType, setSelectedType] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  useEffect(() => {
    setTitle("Transactions Report");
    setBadge("Reports");
  }, [setTitle, setBadge]);

  useEffect(() => {
    apiGet<any[]>("/wallets")
      .then((walletsRes) => {
        if (Array.isArray(walletsRes)) setWalletTypes(walletsRes);
      })
      .catch(() => {});
  }, []);

  const loadReport = useCallback(async () => {
    try {
      setIsLoading(true);
      const params: Record<string, any> = {};
      if (selectedWallet !== "all") params.walletTypeId = selectedWallet;
      if (selectedType !== "all") params.type = selectedType;
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;
      if (searchTerm.trim()) params.search = searchTerm.trim();

      const res = await apiGet<{
        summary: typeof summary;
        typeBreakdown: TypeBreakdown[];
        data: TransactionRecord[];
      }>("/reports/transactions", params);

      setData(res?.data || []);
      if (res?.summary) setSummary(res.summary);
      if (Array.isArray(res?.typeBreakdown)) setTypeBreakdown(res.typeBreakdown);
    } catch (err: any) {
      toast.error(err.message || "Failed to load transactions report");
    } finally {
      setIsLoading(false);
    }
  }, [selectedWallet, selectedType, dateFrom, dateTo, searchTerm]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const handleReset = () => {
    setSearchTerm("");
    setSelectedWallet("all");
    setSelectedType("all");
    setDateFrom("");
    setDateTo("");
    setCurrentPage(1);
  };

  const handleExport = () => {
    const headers = [
      "Reference No",
      "Date & Time",
      "Branch",
      "Wallet / Account",
      "Transaction Type",
      "Source / Pay Type",
      "Amount (BDT)",
      "Balance After (BDT)",
      "Notes / Particulars",
      "Recorded By",
    ];

    const rows = data.map((row) => [
      row.referenceNo,
      new Date(row.createdAt).toLocaleString("en-GB"),
      row.branch,
      row.wallet.name,
      row.type,
      row.source,
      row.type === "DEPOSIT" ? `+${row.amount}` : `-${row.amount}`,
      row.balanceAfter,
      row.note,
      row.recordedBy,
    ]);

    exportToCsv("transactions-report", headers, rows);
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
            <CreditCard className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            Transactions Report
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Wallet cash flows, bank deposits, expenditure withdrawals, and real-time running balances
          </p>
        </div>
      </div>

      {/* Top 3 KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <ReportKpiCard
          label="Total Inflow (Collections)"
          value={`+৳${Number(summary.totalInflow).toLocaleString()}`}
          icon={ArrowDownLeft}
          colorTint="emerald"
        />
        <ReportKpiCard
          label="Total Outflow (Disbursements)"
          value={`-৳${Number(summary.totalOutflow).toLocaleString()}`}
          icon={ArrowUpRight}
          colorTint="rose"
        />
        <ReportKpiCard
          label="Net Flow Balance"
          value={`৳${Number(summary.netFlow).toLocaleString()}`}
          icon={DollarSign}
          colorTint="blue"
        />
      </div>

      {/* Type Breakdown Pills */}
      {typeBreakdown.length > 0 && (
        <div className="p-4 rounded-xl border border-border bg-card shadow-xs space-y-2.5">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Tag className="h-3.5 w-3.5 text-primary" />
            Transaction Inflow / Outflow Distribution
          </p>
          <div className="flex flex-wrap gap-2">
            {typeBreakdown.map((item, idx) => (
              <div
                key={idx}
                className="px-3 py-1.5 rounded-lg border border-border bg-muted/40 text-xs flex items-center gap-2 hover:bg-muted transition-colors"
              >
                <span className="text-muted-foreground font-medium">{item.type}:</span>
                <span className="font-mono font-bold text-foreground">
                  ৳{Number(item.amount).toLocaleString()}
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
        searchPlaceholder="Search Reference No, Note, Particulars..."
        secondarySelect={{
          placeholder: "All Wallets / Payment Accounts",
          options: walletTypes.map((w) => ({ label: w.name, value: w.id })),
          value: selectedWallet,
          onChange: setSelectedWallet,
        }}
        statusOptions={[
          { label: "Deposit / Inflow", value: "DEPOSIT" },
          { label: "Withdrawal / Outflow", value: "WITHDRAWAL" },
        ]}
        selectedStatus={selectedType}
        onStatusChange={setSelectedType}
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
                <th className="p-4 font-semibold tracking-wider">Wallet / Account</th>
                <th className="p-4 font-semibold tracking-wider text-center">Type</th>
                <th className="p-4 font-semibold tracking-wider">Source / Category</th>
                <th className="p-4 font-semibold tracking-wider text-right">Amount</th>
                <th className="p-4 font-semibold tracking-wider text-right">Running Balance</th>
                <th className="p-4 font-semibold tracking-wider">Particulars / Note</th>
                <th className="p-4 font-semibold tracking-wider">Recorded By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-foreground">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-muted-foreground">
                    <div className="flex items-center justify-center gap-2">
                      <div className="h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                      <span>Loading wallet transaction statements...</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-muted-foreground">
                    No wallet transactions found matching the filter criteria.
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
                  const isInflow = row.type === "DEPOSIT";

                  return (
                    <tr key={row.id} className="hover:bg-muted/30 transition-colors">
                      {/* Ref No */}
                      <td className="p-4">
                        <div className="space-y-0.5">
                          <span className="font-mono font-bold text-blue-600 dark:text-blue-400 text-xs">
                            {row.referenceNo}
                          </span>
                          <p className="text-[11px] text-muted-foreground">{row.branch}</p>
                        </div>
                      </td>

                      {/* Date */}
                      <td className="p-4 text-xs font-mono text-muted-foreground whitespace-nowrap">
                        {formattedDate}
                      </td>

                      {/* Wallet */}
                      <td className="p-4">
                        <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                          <Wallet className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>{row.wallet.name}</span>
                        </div>
                      </td>

                      {/* Type Badge */}
                      <td className="p-4 text-center">
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-semibold uppercase ${
                            isInflow
                              ? "border-emerald-300 text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40"
                              : "border-rose-300 text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40"
                          }`}
                        >
                          {isInflow ? "INFLOW" : "OUTFLOW"}
                        </Badge>
                      </td>

                      {/* Source */}
                      <td className="p-4 text-xs font-medium text-foreground whitespace-nowrap">
                        {row.source}
                      </td>

                      {/* Amount */}
                      <td className="p-4 text-right font-mono font-bold whitespace-nowrap">
                        <span
                          className={
                            isInflow
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-rose-600 dark:text-rose-400"
                          }
                        >
                          {isInflow ? "+" : "-"}৳{Number(row.amount).toLocaleString()}
                        </span>
                      </td>

                      {/* Running Balance */}
                      <td className="p-4 text-right font-mono font-bold text-foreground whitespace-nowrap text-xs">
                        ৳{Number(row.balanceAfter).toLocaleString()}
                      </td>

                      {/* Note */}
                      <td className="p-4 text-xs max-w-xs text-muted-foreground truncate" title={row.note}>
                        {row.note || "Standard transaction entry"}
                      </td>

                      {/* Recorded By */}
                      <td className="p-4 text-xs font-medium text-muted-foreground whitespace-nowrap">
                        {row.recordedBy}
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
                    Filtered Flow Summary ({data.length} Transactions):
                  </td>
                  <td className="p-4 text-right font-mono text-blue-600 dark:text-blue-400 font-bold">
                    Net: ৳{Number(summary.netFlow).toLocaleString()}
                  </td>
                  <td colSpan={3} className="p-4 text-muted-foreground">
                    Inflow: +৳{Number(summary.totalInflow).toLocaleString()} | Outflow: -৳
                    {Number(summary.totalOutflow).toLocaleString()}
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
              ? "Showing 0 transactions"
              : `Showing ${(currentPage - 1) * pageSize + 1} to ${Math.min(currentPage * pageSize, data.length)} of ${data.length.toLocaleString()} transactions`}
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
