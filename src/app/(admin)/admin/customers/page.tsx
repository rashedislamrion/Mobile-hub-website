"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
  Plus, 
  Search, 
  RotateCcw, 
  MoreVertical, 
  Eye, 
  Edit, 
  Trash2, 
  ChevronLeft, 
  ChevronRight,
  UserCheck,
  AlertTriangle,
  Loader2
} from "lucide-react";
import { apiGet, apiDelete } from "@/lib/api-client";
import { CustomerAvatar } from "@/components/admin/CustomerAvatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { AccessDenied } from "@/components/admin/AccessDenied";

interface Customer {
  id: string;
  name: string;
  email: string | null;
  phone: string;
  photo: string | null;
  profileImageUrl: string | null;
  source: string | null;
  status: string;
  createdAt: string;
  _count?: {
    orders: number;
  };
}

interface CustomersResponse {
  data: Customer[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const CUSTOMER_SOURCES = [
  { value: "all", label: "All Customer Sources" },
  { value: "Walk-In", label: "Walk-In" },
  { value: "Website", label: "Website" },
  { value: "Facebook", label: "Facebook" },
  { value: "Instagram", label: "Instagram" },
  { value: "Referral", label: "Referral" },
  { value: "Other", label: "Other" },
];

export default function AllCustomersPage() {
  const router = useRouter();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const limit = 20;
  const [totalPages, setTotalPages] = useState(1);

  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isForbidden, setIsForbidden] = useState(false);

  // Delete modal state
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const fetchCustomers = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });
      if (search.trim()) params.append("search", search.trim());
      if (sourceFilter && sourceFilter !== "all") params.append("source", sourceFilter);

      const res = await apiGet<CustomersResponse>(`/customers?${params.toString()}`);
      setCustomers(res.data || []);
      setTotal(res.total || 0);
      setTotalPages(res.totalPages || 1);
    } catch (err: any) {
      if (err.status === 403 || err.message?.includes("Forbidden") || err.message?.includes("restricted")) {
        setIsForbidden(true);
      } else {
        toast.error(err.message || "Failed to load customers.");
      }
    } finally {
      setIsLoading(false);
    }
  }, [page, search, sourceFilter]);

  if (isForbidden) {
    return (
      <AccessDenied
        moduleName="Customers"
        message="Access restricted: Your assigned staff role does not have permission to view customer records."
      />
    );
  }

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const handleReset = () => {
    setSearchInput("");
    setSearch("");
    setSourceFilter("all");
    setPage(1);
  };

  const handleDeleteConfirm = async () => {
    if (!customerToDelete) return;
    setIsDeleting(true);
    try {
      await apiDelete(`/customers/${customerToDelete.id}`);
      toast.success(`Customer "${customerToDelete.name}" deleted successfully.`);
      setCustomerToDelete(null);
      fetchCustomers();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete customer.");
    } finally {
      setIsDeleting(false);
    }
  };

  const renderPaginationButtons = () => {
    const buttons = [];
    const maxVisible = 7;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        buttons.push(i);
      }
    } else {
      buttons.push(1);
      if (page > 3) buttons.push("...");

      const start = Math.max(2, page - 1);
      const end = Math.min(totalPages - 1, page + 1);

      for (let i = start; i <= end; i++) {
        buttons.push(i);
      }

      if (page < totalPages - 2) buttons.push("...");
      buttons.push(totalPages);
    }

    return buttons.map((p, idx) => {
      if (p === "...") {
        return (
          <span key={`ellipsis-${idx}`} className="px-2 py-1 text-sm text-slate-400">
            …
          </span>
        );
      }
      const pageNum = Number(p);
      const isActive = pageNum === page;
      return (
        <button
          key={`page-${pageNum}`}
          onClick={() => setPage(pageNum)}
          className={`min-w-[34px] h-[34px] text-sm font-medium rounded-md transition-colors flex items-center justify-center ${
            isActive
              ? "bg-emerald-600 text-white font-semibold shadow-sm"
              : "text-slate-700 hover:bg-slate-100 border border-slate-200"
          }`}
        >
          {pageNum}
        </button>
      );
    });
  };

  const startIndex = total === 0 ? 0 : (page - 1) * limit + 1;
  const endIndex = Math.min(page * limit, total);

  return (
    <div className="space-y-6">
      {/* Top Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">All Customers</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Manage customer accounts, purchase histories, and balances
          </p>
        </div>
        <Link href="/admin/customers/create">
          <Button className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 shadow-sm font-medium">
            <Plus className="w-4 h-4" />
            Create New
          </Button>
        </Link>
      </div>

      {/* Filter Row */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
        <div className="flex flex-col md:flex-row items-center gap-3">
          {/* Search Input */}
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              type="text"
              placeholder="Search by name, email, phone..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-9 bg-slate-50 border-slate-200 focus:bg-white text-sm"
            />
          </div>

          {/* Customer Source Dropdown */}
          <div className="w-full md:w-64">
            <select
              value={sourceFilter}
              onChange={(e) => {
                setSourceFilter(e.target.value);
                setPage(1);
              }}
              className="w-full h-10 px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-md text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
            >
              {CUSTOMER_SOURCES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          {/* Reset Button */}
          <Button
            type="button"
            variant="outline"
            onClick={handleReset}
            className="w-full md:w-auto text-slate-600 hover:text-slate-900 border-slate-200 gap-1.5"
          >
            <RotateCcw className="w-4 h-4" />
            Reset
          </Button>
        </div>
      </div>

      {/* Customers Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto min-h-[380px]">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4 w-16 text-center">SL.</th>
                <th className="py-3.5 px-4">CUSTOMER</th>
                <th className="py-3.5 px-4">EMAIL</th>
                <th className="py-3.5 px-4">CUSTOMER SOURCE</th>
                <th className="py-3.5 px-4 w-20 text-center">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
                      <span className="text-sm">Loading customers...</span>
                    </div>
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <UserCheck className="w-10 h-10 text-slate-300" />
                      <span className="text-base font-medium text-slate-700">No customers found</span>
                      <span className="text-xs text-slate-400">
                        Try adjusting your search criteria or create a new customer.
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
                customers.map((c, index) => {
                  const sl = (page - 1) * limit + index + 1;
                  return (
                    <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* SL. */}
                      <td className="py-3.5 px-4 text-center font-medium text-slate-500">
                        {sl}
                      </td>

                      {/* CUSTOMER (Avatar + bold name + phone below) */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <CustomerAvatar
                            photo={c.profileImageUrl || c.photo}
                            name={c.name}
                            size="md"
                          />
                          <div className="flex flex-col">
                            <Link
                              href={`/admin/customers/${c.id}`}
                              className="font-bold text-slate-900 hover:text-emerald-600 transition-colors leading-tight"
                            >
                              {c.name}
                            </Link>
                            <span className="text-xs text-slate-500 font-mono mt-0.5">
                              {c.phone}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* EMAIL */}
                      <td className="py-3.5 px-4 text-slate-600">
                        {c.email || <span className="text-slate-400">--</span>}
                      </td>

                      {/* CUSTOMER SOURCE */}
                      <td className="py-3.5 px-4">
                        {c.source ? (
                          <Badge
                            variant="secondary"
                            className="bg-slate-100 text-slate-700 font-medium text-xs px-2.5 py-0.5"
                          >
                            {c.source}
                          </Badge>
                        ) : null}
                      </td>

                      {/* ACTION (3-dot kebab menu) */}
                      <td className="py-3.5 px-4 text-center">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-36">
                            <DropdownMenuItem
                              onClick={() => router.push(`/admin/customers/${c.id}`)}
                              className="gap-2 cursor-pointer"
                            >
                              <Eye className="w-4 h-4 text-slate-500" />
                              <span>View</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => router.push(`/admin/customers/${c.id}/edit`)}
                              className="gap-2 cursor-pointer"
                            >
                              <Edit className="w-4 h-4 text-slate-500" />
                              <span>Edit</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => setCustomerToDelete(c)}
                              className="gap-2 text-rose-600 focus:text-rose-600 cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4 text-rose-600" />
                              <span>Delete</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer with Pagination */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4 border-t border-slate-200 bg-slate-50/50">
          <p className="text-xs text-slate-500">
            {total === 0 ? (
              "Showing 0 results"
            ) : (
              <>
                Showing <strong className="text-slate-700">{startIndex}</strong> to{" "}
                <strong className="text-slate-700">{endIndex}</strong> of{" "}
                <strong className="text-slate-700">{total}</strong> results
              </>
            )}
          </p>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-1.5 rounded-md border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title="Previous Page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {renderPaginationButtons()}

            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="p-1.5 rounded-md border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title="Next Page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={Boolean(customerToDelete)} onOpenChange={(open) => !open && setCustomerToDelete(null)}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mb-3">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <DialogTitle className="text-lg font-bold text-slate-900">
              Delete Customer Account?
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-600">
              Are you sure you want to delete customer{" "}
              <strong className="text-slate-800">{customerToDelete?.name}</strong> (
              {customerToDelete?.phone})? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0 mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCustomerToDelete(null)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="bg-rose-600 hover:bg-rose-700"
            >
              {isDeleting ? "Deleting..." : "Delete Customer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
