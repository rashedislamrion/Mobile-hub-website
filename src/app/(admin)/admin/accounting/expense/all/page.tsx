"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useAdminPage } from "@/contexts/AdminPageContext";
import { DataTable, StatusBadge, ActionDropdown } from "@/components/admin/DataTable";
import { FilterBar } from "@/components/admin/FilterBar";
import { FilterConfig, StatusVariant, TableAction } from "@/types/table";
import { ColumnDef } from "@tanstack/react-table";
import { Plus, CheckCircle, Trash2, Receipt, FileText, AlertCircle, RefreshCw } from "lucide-react";
import { downloadPrivateAsset } from "@/lib/private-asset";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api-client";

interface ExpenseItem {
  id: string;
  referenceNo: string;
  amount: number | string;
  description: string;
  date: string;
  status: "PAID" | "PENDING";
  attachment?: string | null;
  category?: { id: string; name: string };
  branch?: { id: string; name: string; code: string } | null;
  walletType?: { id: string; name: string } | null;
  recordedBy?: { id: string; name: string };
}

export default function AllExpensesPage() {
  const { setTitle, setBadge, setDateFilter } = useAdminPage();
  const [data, setData] = useState<ExpenseItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState<Record<string, unknown>>({});

  const [categories, setCategories] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [wallets, setWallets] = useState<any[]>([]);

  // Dialog State
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    categoryId: "",
    branchId: "",
    amount: 0,
    walletTypeId: "",
    description: "",
    status: "PAID" as "PAID" | "PENDING",
    date: new Date().toISOString().split("T")[0],
  });

  // Mark Paid Dialog
  const [payModalExpense, setPayModalExpense] = useState<ExpenseItem | null>(null);
  const [payWalletId, setPayWalletId] = useState("");

  useEffect(() => {
    setTitle("All Expenses");
    setBadge("Accounting");
    setDateFilter(""); 
  }, [setTitle, setBadge, setDateFilter]);

  const [optionsErrors, setOptionsErrors] = useState<string | null>(null);
  const [isLoadingOptions, setIsLoadingOptions] = useState(false);

  const loadOptions = useCallback(async () => {
    try {
      setIsLoadingOptions(true);
      setOptionsErrors(null);
      const [catRes, branchRes, walletRes] = await Promise.all([
        apiGet<any[]>("/expense-categories"),
        apiGet<any[]>("/branches/public"),
        apiGet<any[]>("/wallet-types"),
      ]);
      if (Array.isArray(catRes)) setCategories(catRes);
      if (Array.isArray(branchRes)) setBranches(branchRes);
      if (Array.isArray(walletRes)) {
        setWallets(walletRes);
        if (walletRes.length > 0) {
          setFormData((prev) => ({ ...prev, walletTypeId: walletRes[0].id }));
          setPayWalletId(walletRes[0].id);
        }
      }
    } catch (err: any) {
      console.error("Failed to load expense options:", err);
      setOptionsErrors("Failed to load expense categories, branches or wallets. Please retry.");
      toast.error("Failed to load expense options.");
    } finally {
      setIsLoadingOptions(false);
    }
  }, []);

  useEffect(() => {
    loadOptions();
  }, [loadOptions]);

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const params: Record<string, any> = {};

      if (filters.category) params.category = filters.category;
      if (filters.branch) params.branch = filters.branch;
      if (filters.status) params.status = (filters.status as string).toUpperCase();
      if (searchQuery.trim()) params.search = searchQuery.trim();

      const res = await apiGet<{ data: ExpenseItem[] }>("/expenses", params);
      setData(res?.data || []);
    } catch (err: any) {
      toast.error(err.message || "Failed to load expenses");
    } finally {
      setIsLoading(false);
    }
  }, [filters, searchQuery]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSave = async () => {
    if (!formData.categoryId || !formData.amount || Number(formData.amount) <= 0 || !formData.description) {
      toast.error("Please fill in category, amount, and description");
      return;
    }

    try {
      await apiPost("/expenses", {
        categoryId: formData.categoryId,
        branchId: formData.branchId || undefined,
        amount: Number(formData.amount),
        walletTypeId: formData.status === "PAID" ? formData.walletTypeId : undefined,
        description: formData.description,
        status: formData.status,
        date: formData.date,
      });

      toast.success("Expense recorded successfully");
      setDialogOpen(false);
      setFormData({
        categoryId: "",
        branchId: "",
        amount: 0,
        walletTypeId: "",
        description: "",
        status: "PAID",
        date: new Date().toISOString().split("T")[0],
      });
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to save expense");
    }
  };

  const handleMarkPaid = async () => {
    if (!payModalExpense) return;
    try {
      await apiPatch(`/expenses/${payModalExpense.id}/mark-paid`, {
        walletTypeId: payWalletId || undefined,
      });
      toast.success("Expense marked as PAID");
      setPayModalExpense(null);
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to mark expense as paid");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiDelete(`/expenses/${id}`);
      toast.success("Expense record removed");
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete expense");
    }
  };

  const filterConfigs: FilterConfig[] = useMemo(() => [
    {
      type: "select",
      label: "Category",
      key: "category",
      options: categories.map((c) => ({ label: c.name, value: c.id })),
    },
    {
      type: "select",
      label: "Branch",
      key: "branch",
      options: branches.map((b) => ({ label: b.name, value: b.id })),
    },
    {
      type: "select",
      label: "Status",
      key: "status",
      options: [
        { label: "Paid", value: "PAID" },
        { label: "Pending", value: "PENDING" },
      ],
    },
  ], [categories, branches]);

  const createActions = (): TableAction[] => [
    {
      label: "Download Attachment",
      icon: <FileText className="w-4 h-4 text-slate-600" />,
      onClick: (row) => {
        if (!row.attachment) {
          toast.info("No attachment file uploaded for this expense.");
          return;
        }
        downloadPrivateAsset(
          `/expenses/${row.id}/attachment`,
          `${row.referenceNo}_attachment`,
        );
      },
    },
    {
      label: "Mark as Paid",
      icon: <CheckCircle className="w-4 h-4 text-emerald-600" />,
      onClick: (row) => setPayModalExpense(row),
    },
    {
      label: "Delete",
      icon: <Trash2 className="w-4 h-4 text-red-500" />,
      variant: "destructive",
      onClick: (row) => handleDelete(row.id),
    },
  ];

  const getStatusVariant = (status: string): StatusVariant => {
    switch (status) {
      case "PAID": return "success";
      case "PENDING": return "warning";
      default: return "default";
    }
  };

  const columns: ColumnDef<ExpenseItem>[] = [
    {
      accessorKey: "referenceNo",
      header: "Ref No",
      cell: ({ row }) => (
        <span className="font-mono font-bold text-slate-800 text-xs">
          {row.original.referenceNo}
        </span>
      ),
    },
    {
      accessorKey: "date",
      header: "Date",
      cell: ({ row }) => (
        <span className="text-slate-600 text-sm whitespace-nowrap">
          {new Date(row.original.date).toLocaleDateString("en-GB")}
        </span>
      ),
    },
    {
      accessorKey: "category",
      header: "Category",
      cell: ({ row }) => (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-700">
          {row.original.category?.name || "Uncategorized"}
        </span>
      ),
    },
    {
      accessorKey: "description",
      header: "Description",
      cell: ({ row }) => (
        <div>
          <p className="font-medium text-slate-800 text-sm">{row.original.description}</p>
          <p className="text-xs text-slate-400">
            {row.original.branch?.name || "Global"} • By {row.original.recordedBy?.name || "System"}
          </p>
        </div>
      ),
    },
    {
      accessorKey: "walletType",
      header: "Paid Via",
      cell: ({ row }) => (
        <span className="text-slate-600 text-xs font-medium">
          {row.original.walletType?.name || <span className="text-slate-400 italic">Unpaid</span>}
        </span>
      ),
    },
    {
      accessorKey: "amount",
      header: "Amount",
      cell: ({ row }) => (
        <span className="font-bold text-slate-900 text-base">
          ৳{Number(row.original.amount).toLocaleString()}
        </span>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <StatusBadge 
          status={row.original.status} 
          type={getStatusVariant(row.original.status)} 
        />
      ),
    },
    {
      id: "actions",
      header: "Action",
      cell: ({ row }) => (
        <div className="flex justify-end">
          <ActionDropdown actions={createActions()} rowData={row.original} />
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200">
        <div>
          <h2 className="text-lg font-bold text-slate-800">All Expenses</h2>
          <p className="text-xs text-slate-500">Record, filter, and track store and headquarters disbursements</p>
        </div>
        <button
          onClick={() => setDialogOpen(true)}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" /> Record Expense
        </button>
      </div>

      {optionsErrors && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 flex items-center justify-between text-rose-800 text-xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{optionsErrors}</span>
          </div>
          <button
            type="button"
            onClick={loadOptions}
            disabled={isLoadingOptions}
            className="flex items-center gap-1 px-3 py-1 bg-white border border-rose-200 text-rose-700 rounded-md font-medium hover:bg-rose-50 transition-colors"
          >
            <RefreshCw className={`w-3 h-3 ${isLoadingOptions ? "animate-spin" : ""}`} /> Retry
          </button>
        </div>
      )}

      <FilterBar 
        searchPlaceholder="Search by reference, description..."
        filters={filterConfigs}
        onSearchChange={(val) => setSearchQuery(val)}
        onFilterChange={(key, val) => setFilters((prev) => ({ ...prev, [key]: val }))}
        onReset={() => {
          setSearchQuery("");
          setFilters({});
        }}
      />

      <DataTable 
        columns={columns} 
        data={data} 
        pageSize={10}
      />

      {/* Record Expense Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>Record New Expense</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1.5">Expense Date *</label>
                <Input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1.5">Category *</label>
                <SearchableSelect
                  options={categories.map((c) => ({
                    value: c.id,
                    label: c.name,
                  }))}
                  value={formData.categoryId}
                  onChange={(val) => setFormData({ ...formData, categoryId: val })}
                  placeholder="Select Category..."
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1.5">Amount (৳) *</label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={formData.amount || ""}
                  onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value) })}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1.5">Branch</label>
                <SearchableSelect
                  options={[
                    { value: "", label: "Global / Headquarters" },
                    ...branches.map((b) => ({ value: b.id, label: b.name })),
                  ]}
                  value={formData.branchId}
                  onChange={(val) => setFormData({ ...formData, branchId: val })}
                  placeholder="Select Branch..."
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1.5">Payment Status *</label>
              <div className="grid grid-cols-2 gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, status: "PAID" })}
                  className={`py-2 px-3 rounded-lg text-sm font-semibold border flex items-center justify-center gap-2 transition-colors ${
                    formData.status === "PAID"
                      ? "bg-emerald-50 border-emerald-500 text-emerald-700"
                      : "border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  Paid
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, status: "PENDING" })}
                  className={`py-2 px-3 rounded-lg text-sm font-semibold border flex items-center justify-center gap-2 transition-colors ${
                    formData.status === "PENDING"
                      ? "bg-amber-50 border-amber-500 text-amber-700"
                      : "border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  Pending
                </button>
              </div>

              {formData.status === "PAID" && (
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1.5">Disburse From Wallet *</label>
                  <SearchableSelect
                    options={wallets.map((w) => ({
                      value: w.id,
                      label: w.name,
                      secondary: `Balance: ৳${Number(w.currentBalance).toLocaleString()}`,
                    }))}
                    value={formData.walletTypeId}
                    onChange={(val) => setFormData({ ...formData, walletTypeId: val })}
                    placeholder="Select Wallet..."
                    required
                  />
                </div>
              )}
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1.5">Description / Purpose *</label>
              <Textarea
                placeholder="Details of the expenditure..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDialogOpen(false)}
                className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-50 text-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium"
              >
                Save Expense
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Mark Paid Dialog */}
      <Dialog open={Boolean(payModalExpense)} onOpenChange={(open) => !open && setPayModalExpense(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Settle Pending Expense</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-sm text-slate-600">
              Disburse <strong className="text-slate-900">৳{Number(payModalExpense?.amount).toLocaleString()}</strong> for <strong className="text-slate-900">{payModalExpense?.description}</strong>.
            </p>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1.5">Disburse From Wallet</label>
              <SearchableSelect
                options={wallets.map((w) => ({
                  value: w.id,
                  label: w.name,
                  secondary: `Balance: ৳${Number(w.currentBalance).toLocaleString()}`,
                }))}
                value={payWalletId}
                onChange={(val) => setPayWalletId(val)}
                placeholder="Select Wallet..."
                required
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setPayModalExpense(null)}
                className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleMarkPaid}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium"
              >
                Confirm Settlement
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
