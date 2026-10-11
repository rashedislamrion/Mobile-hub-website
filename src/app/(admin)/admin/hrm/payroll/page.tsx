"use client";

import { useEffect, useState, useCallback } from "react";
import { useAdminPage } from "@/contexts/AdminPageContext";
import {
  Wallet,
  Plus,
  Search,
  RotateCcw,
  CreditCard,
  Calculator,
  User,
  Building2,
  Calendar,
  CheckCircle2,
  AlertCircle,
  FileText,
  DollarSign,
  ArrowDownRight,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPost, apiPatch } from "@/lib/api-client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { AddSalaryPayrollModal } from "@/components/admin/hrm/AddSalaryPayrollModal";
import { AdminTableState } from "@/components/admin/AdminTableState";

interface StaffPaymentRecord {
  id: string;
  referenceNo: string;
  type: string; // WITHDRAWAL
  payType: "SALARY" | "ALLOWANCE" | "BONUS" | "OTHER" | null;
  amount: number | string;
  note: string | null;
  salaryMonth: string;
  createdAt: string;
  balanceAfter?: number | string;
  walletType?: {
    id: string;
    name: string;
    kind: string;
    branch?: { id: string; name: string } | null;
  } | null;
  staff?: {
    id: string;
    name: string;
    employeeId: string;
    phone: string;
    photo?: string | null;
    department?: { id: string; name: string } | null;
    role?: { id: string; name: string } | null;
    branch?: { id: string; name: string } | null;
  } | null;
  recordedBy?: {
    id: string;
    name: string;
    employeeId?: string;
  } | null;
}

interface WalletOption {
  id: string;
  name: string;
  kind: string;
  currentBalance: number | string;
}

interface StaffOption {
  id: string;
  name: string;
  employeeId: string;
  phone: string;
  department?: { id: string; name: string } | null;
  basicSalary?: number | string;
  allowances?: any;
}

export default function PayrollPage() {
  const { setTitle, setBadge, setDateFilter } = useAdminPage();

  const [data, setData] = useState<StaffPaymentRecord[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedWalletId, setSelectedWalletId] = useState("all");
  const [selectedPayType, setSelectedPayType] = useState("all");
  const [selectedMonth, setSelectedMonth] = useState("");

  const [wallets, setWallets] = useState<WalletOption[]>([]);
  const [staffList, setStaffList] = useState<StaffOption[]>([]);

  // Add Salary / Payroll Modal State
  const [addPaymentModalOpen, setAddPaymentModalOpen] = useState(false);
  const [payWalletTypeId, setPayWalletTypeId] = useState("");

  // Run Payroll Modal State
  const [runPayrollModalOpen, setRunPayrollModalOpen] = useState(false);
  const [runMonth, setRunMonth] = useState(new Date().toISOString().slice(0, 7));
  const [isSubmittingRun, setIsSubmittingRun] = useState(false);
  const [runResults, setRunResults] = useState<any | null>(null);

  useEffect(() => {
    setTitle("Payroll & Salary Ledger");
    setBadge("HRM");
    setDateFilter("");
  }, [setTitle, setBadge, setDateFilter]);

  useEffect(() => {
    Promise.all([
      apiGet<any[]>("/wallet-types"),
      apiGet<{ data: StaffOption[] }>("/employees?limit=100"),
    ])
      .then(([walletRes, staffRes]) => {
        if (Array.isArray(walletRes)) {
          setWallets(walletRes);
          if (walletRes.length > 0) setPayWalletTypeId(walletRes[0].id);
        }
        if (staffRes?.data) {
          setStaffList(staffRes.data);
        }
      })
      .catch(() => {});
  }, []);

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const params: Record<string, any> = {
        page: currentPage,
        limit: 15,
      };

      if (selectedWalletId !== "all") params.walletTypeId = selectedWalletId;
      if (selectedPayType !== "all") params.payType = selectedPayType;
      if (selectedMonth) params.month = selectedMonth;
      if (searchTerm.trim()) params.search = searchTerm.trim();

      const res = await apiGet<{
        data: StaffPaymentRecord[];
        meta?: { total: number; totalPages: number };
      }>("/wallet-transactions/staff-payments", params);

      setData(res?.data || []);
      setTotalCount(res?.meta?.total || (res?.data || []).length);
      setTotalPages(res?.meta?.totalPages || 1);
    } catch (err: any) {
      setError(err.message || "Failed to load payment ledger");
      toast.error(err.message || "Failed to load payment ledger");
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, selectedWalletId, selectedPayType, selectedMonth, searchTerm]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    loadData();
  };

  const handleResetFilters = () => {
    setSearchTerm("");
    setSelectedWalletId("all");
    setSelectedPayType("all");
    setSelectedMonth("");
    setCurrentPage(1);
  };

  const handleRunMonthlyPayroll = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmittingRun(true);
      const res = await apiPost<any>("/payroll/run", {
        month: runMonth,
      });
      setRunResults(res);
      toast.success(res.message || "Payroll generated successfully!");
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to generate monthly payroll");
    } finally {
      setIsSubmittingRun(false);
    }
  };

  const handleDisbursePayrollRecord = async (payrollId: string) => {
    if (!payWalletTypeId) {
      toast.error("Please select a disbursement wallet");
      return;
    }
    try {
      await apiPatch(`/payroll/${payrollId}/mark-paid`, {
        walletTypeId: payWalletTypeId,
      });
      toast.success("Salary disbursed and recorded in ledger!");
      // Update local runResults if present
      if (runResults?.records) {
        setRunResults({
          ...runResults,
          records: runResults.records.map((r: any) =>
            r.id === payrollId ? { ...r, status: "PAID" } : r,
          ),
        });
      }
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to disburse salary");
    }
  };

  const formatSalaryMonth = (mStr?: string) => {
    if (!mStr) return "N/A";
    const [y, m] = mStr.split("-").map(Number);
    if (!y || !m) return mStr;
    const date = new Date(Date.UTC(y, m - 1, 1));
    return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
  };

  const getPayTypeBadge = (type: string | null) => {
    switch (type) {
      case "SALARY":
        return (
          <Badge className="bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200">
            SALARY
          </Badge>
        );
      case "ALLOWANCE":
        return (
          <Badge className="bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200">
            ALLOWANCE
          </Badge>
        );
      case "BONUS":
        return (
          <Badge className="bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200">
            BONUS
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-muted-foreground">
            {type || "PAYMENT"}
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <Wallet className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            Payroll & Payment Ledger
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Live payment dispatches, salary disbursements, and ad-hoc staff compensation logs
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setRunResults(null);
              setRunPayrollModalOpen(true);
            }}
            className="px-4 py-2 text-sm font-medium border border-border rounded-lg bg-background hover:bg-muted text-foreground transition-colors flex items-center gap-2"
          >
            <Calculator className="h-4 w-4 text-emerald-600" />
            Run Monthly Payroll
          </button>

          <button
            type="button"
            onClick={() => setAddPaymentModalOpen(true)}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm flex items-center gap-2 transition-colors"
          >
            <Plus className="h-4 w-4" />
            + New Payroll
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="p-4 rounded-xl border border-border bg-card shadow-xs space-y-3">
        <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
          {/* Search */}
          <div className="relative sm:col-span-2 md:col-span-2">
            <Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search staff, reference no, notes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-10 pl-9 pr-3 text-sm rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* Wallet Filter */}
          <div>
            <select
              value={selectedWalletId}
              onChange={(e) => {
                setSelectedWalletId(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full h-10 px-3 py-2 text-sm rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="all">All Wallets</option>
              {wallets.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} (৳{Number(w.currentBalance).toLocaleString()})
                </option>
              ))}
            </select>
          </div>

          {/* Type Filter */}
          <div>
            <select
              value={selectedPayType}
              onChange={(e) => {
                setSelectedPayType(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full h-10 px-3 py-2 text-sm rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="all">All Payment Types</option>
              <option value="SALARY">Salary</option>
              <option value="ALLOWANCE">Allowance</option>
              <option value="BONUS">Bonus</option>
              <option value="OTHER">Other</option>
            </select>
          </div>

          {/* Month Filter & Reset */}
          <div className="flex items-center gap-2">
            <Input
              type="month"
              value={selectedMonth}
              onChange={(e) => {
                setSelectedMonth(e.target.value);
                setCurrentPage(1);
              }}
              className="h-10 text-xs"
            />

            <button
              type="button"
              onClick={handleResetFilters}
              title="Reset Filters"
              className="h-10 px-3 flex items-center justify-center rounded-lg border border-border bg-background hover:bg-muted text-muted-foreground transition-colors shrink-0"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>
        </form>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 border-b border-border text-xs uppercase text-muted-foreground font-semibold">
              <tr>
                <th className="p-4 font-semibold tracking-wider">Date</th>
                <th className="p-4 font-semibold tracking-wider">Employee</th>
                <th className="p-4 font-semibold tracking-wider">Salary Month</th>
                <th className="p-4 font-semibold tracking-wider">Wallet Account</th>
                <th className="p-4 font-semibold tracking-wider">Amount</th>
                <th className="p-4 font-semibold tracking-wider text-center">Type</th>
                <th className="p-4 font-semibold tracking-wider">Note / Ref</th>
                <th className="p-4 font-semibold tracking-wider text-right">Recorded By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-foreground">
              <AdminTableState
                isLoading={isLoading}
                error={error}
                isEmpty={data.length === 0}
                onRetry={loadData}
                colSpan={8}
                loadingRows={5}
                emptyTitle="No records found"
                emptyDescription="No payment records found. Use Add Payment or Run Monthly Payroll to disburse payments."
                emptyActionLabel="Add Payment"
                onEmptyAction={() => setAddPaymentModalOpen(true)}
              >
                {data.map((txn) => {
                  const formattedDate = new Date(txn.createdAt).toLocaleDateString("en-GB", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  });

                  return (
                    <tr key={txn.id} className="hover:bg-muted/30 transition-colors">
                      {/* Date */}
                      <td className="p-4 text-xs font-mono text-muted-foreground whitespace-nowrap">
                        {formattedDate}
                      </td>

                      {/* Employee */}
                      <td className="p-4">
                        {txn.staff ? (
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 font-bold flex items-center justify-center shrink-0 overflow-hidden text-xs border border-border">
                              {txn.staff.photo ? (
                                <img
                                  src={txn.staff.photo}
                                  alt={txn.staff.name}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                txn.staff.name
                                  .split(" ")
                                  .map((n) => n[0])
                                  .slice(0, 2)
                                  .join("")
                                  .toUpperCase()
                              )}
                            </div>
                            <div className="space-y-0.5">
                              <p className="font-semibold text-foreground text-xs leading-tight">
                                {txn.staff.name}
                              </p>
                              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-mono">
                                <span>{txn.staff.employeeId}</span>
                                {txn.staff.department?.name && (
                                  <>
                                    <span>•</span>
                                    <span>{txn.staff.department.name}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">Direct / System</span>
                        )}
                      </td>

                      {/* Salary Month */}
                      <td className="p-4 text-xs font-medium text-foreground whitespace-nowrap">
                        {formatSalaryMonth(txn.salaryMonth)}
                      </td>

                      {/* Wallet */}
                      <td className="p-4">
                        <div className="space-y-0.5">
                          <p className="text-xs font-semibold text-foreground">
                            {txn.walletType?.name || "General Cash"}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {txn.walletType?.kind}
                          </p>
                        </div>
                      </td>

                      {/* Amount */}
                      <td className="p-4 font-mono font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                        ৳{Number(txn.amount).toLocaleString()}
                      </td>

                      {/* Type */}
                      <td className="p-4 text-center">
                        {getPayTypeBadge(txn.payType)}
                      </td>

                      {/* Note & Ref */}
                      <td className="p-4 text-xs max-w-xs">
                        <div className="space-y-0.5">
                          <p className="font-mono text-[11px] text-muted-foreground font-medium">
                            {txn.referenceNo}
                          </p>
                          {txn.note && (
                            <p className="text-foreground truncate text-[11px]">{txn.note}</p>
                          )}
                        </div>
                      </td>

                      {/* Recorded By */}
                      <td className="p-4 text-right text-xs text-muted-foreground whitespace-nowrap">
                        {txn.recordedBy?.name || "Admin"}
                      </td>
                    </tr>
                  );
                })}
              </AdminTableState>
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="p-4 border-t border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-muted-foreground">
          <div>
            {totalCount === 0
              ? "Showing 0 ledger entries"
              : `Showing ${(currentPage - 1) * 15 + 1} to ${Math.min(currentPage * 15, totalCount)} of ${totalCount.toLocaleString()} ledger entries`}
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

      {/* ========================================================================= */}
      {/* ADD SALARY / PAYROLL MODAL (Unified Salary, Bonus, Allowance, Deduction)  */}
      {/* ========================================================================= */}
      <AddSalaryPayrollModal
        open={addPaymentModalOpen}
        onOpenChange={setAddPaymentModalOpen}
        staffList={staffList}
        wallets={wallets}
        onSuccess={loadData}
      />

      {/* ========================================================================= */}
      {/* RUN MONTHLY PAYROLL MODAL */}
      {/* ========================================================================= */}
      <Dialog open={runPayrollModalOpen} onOpenChange={setRunPayrollModalOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5 text-emerald-600" />
              Monthly Payroll Generation & Disbursement
            </DialogTitle>
            <DialogDescription>
              Generate salary sheets for all active employees for the designated month.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <form onSubmit={handleRunMonthlyPayroll} className="flex items-end gap-3 p-4 rounded-xl bg-muted/30 border border-border">
              <div className="flex-1 space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">
                  Select Payroll Month
                </label>
                <Input
                  type="month"
                  value={runMonth}
                  onChange={(e) => setRunMonth(e.target.value)}
                  required
                  className="h-10 bg-background"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmittingRun}
                className="px-5 h-10 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold flex items-center gap-2 transition disabled:opacity-50"
              >
                {isSubmittingRun ? (
                  <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                Generate Payroll
              </button>
            </form>

            {runResults && (
              <div className="space-y-3 pt-2">
                <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-200">
                  <p className="font-semibold">{runResults.message}</p>
                  <p className="mt-0.5 text-muted-foreground">
                    Created: {runResults.createdCount} | Previously generated: {runResults.skippedCount}
                  </p>
                </div>

                {runResults.records && runResults.records.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Generated Payslips Ready for Disbursement:
                    </h4>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {runResults.records.map((rec: any) => (
                        <div
                          key={rec.id}
                          className="flex items-center justify-between p-3 rounded-lg border border-border bg-card text-xs"
                        >
                          <div>
                            <p className="font-semibold text-foreground">
                              {rec.staff?.name} ({rec.staff?.employeeId})
                            </p>
                            <p className="text-muted-foreground">
                              Basic: ৳{Number(rec.basicSalary).toLocaleString()} • Net:{" "}
                              <strong className="text-foreground">
                                ৳{Number(rec.netSalary).toLocaleString()}
                              </strong>
                            </p>
                          </div>

                          <div>
                            {rec.status === "PAID" ? (
                              <Badge className="bg-emerald-600 text-white text-[10px]">
                                PAID
                              </Badge>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleDisbursePayrollRecord(rec.id)}
                                className="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-[11px] flex items-center gap-1 transition shadow-2xs"
                              >
                                <CreditCard className="h-3 w-3" />
                                Disburse
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
