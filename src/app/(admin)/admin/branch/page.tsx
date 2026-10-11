"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useAdminPage } from "@/contexts/AdminPageContext";
import { useAuth } from "@/context/AuthContext";
import {
  ExternalLink,
  Edit2,
  Trash2,
  Plus,
  Search,
  Building2,
  MapPin,
  Phone,
  AlertTriangle,
  Users,
  ShieldAlert,
  PowerOff,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiGet, apiPatch, apiDelete } from "@/lib/api-client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export interface BranchRow {
  id: string;
  name: string;
  code: string;
  type?: string;
  address: string;
  city?: string;
  phone: string;
  altPhone?: string | null;
  email?: string | null;
  status: "ACTIVE" | "INACTIVE";
}

export default function BranchListPage() {
  const { setTitle, setBadge, setDateFilter, selectBranch } = useAdminPage();
  const router = useRouter();

  const { user } = useAuth();
  const isSuperAdmin = Boolean(
    user?.isGlobal ||
    user?.role?.name?.toLowerCase().includes("admin") ||
    user?.role?.scope === "GLOBAL"
  );

  const [branches, setBranches] = useState<BranchRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const [activeSearch, setActiveSearch] = useState("");

  // Edit Modal State
  const [editingBranch, setEditingBranch] = useState<BranchRow | null>(null);
  const [editName, setEditName] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  // Delete & Deactivate Modal State
  const [deletingBranch, setDeletingBranch] = useState<BranchRow | null>(null);
  const [deleteBlockers, setDeleteBlockers] = useState<{
    message: string;
    blockers?: Record<string, number>;
    assignedStaff?: Array<{ id: string; name: string; employeeId?: string; role?: string }>;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeactivating, setIsDeactivating] = useState(false);

  const fetchBranches = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await apiGet<BranchRow[]>("/branches");
      setBranches(data || []);
    } catch (err: any) {
      toast.error(err.message || "Failed to load branches");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    setTitle("Branch List");
    setBadge("Branches");
    setDateFilter("");
    fetchBranches();
  }, [setTitle, setBadge, setDateFilter, fetchBranches]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setActiveSearch(searchInput.trim());
  };

  const filteredBranches = useMemo(() => {
    if (!activeSearch) return branches;
    const q = activeSearch.toLowerCase();
    return branches.filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        b.address?.toLowerCase().includes(q) ||
        b.phone?.toLowerCase().includes(q) ||
        b.code?.toLowerCase().includes(q)
    );
  }, [branches, activeSearch]);

  const handleOpenEdit = (branch: BranchRow) => {
    setEditingBranch(branch);
    setEditName(branch.name || "");
    setEditAddress(branch.address || "");
    setEditPhone(branch.phone || "");
  };

  const handleUpdateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBranch) return;
    if (!editName.trim()) {
      toast.error("Branch name is required");
      return;
    }
    if (!editAddress.trim()) {
      toast.error("Location / Address is required");
      return;
    }

    try {
      setIsUpdating(true);
      const updated = await apiPatch<BranchRow>(`/branches/${editingBranch.id}`, {
        name: editName.trim(),
        address: editAddress.trim(),
        phone: editPhone.trim() || undefined,
      });

      toast.success(`Branch "${updated.name}" updated successfully!`);
      setEditingBranch(null);
      fetchBranches();
    } catch (err: any) {
      toast.error(err.message || "Failed to update branch");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSwitchToBranch = (branch: BranchRow) => {
    selectBranch(branch.id, branch.name);
    toast.success(`Switched active context to ${branch.name}`);
    router.push("/admin");
  };

  const handleOpenDelete = (branch: BranchRow) => {
    if (!isSuperAdmin) {
      toast.error("Only Super Admin can delete or deactivate branches.");
      return;
    }
    setDeletingBranch(branch);
    setDeleteBlockers(null);
  };

  const handleConfirmDelete = async () => {
    if (!deletingBranch) return;
    try {
      setIsDeleting(true);
      await apiDelete(`/branches/${deletingBranch.id}`);
      toast.success(`Branch "${deletingBranch.name}" deleted successfully.`);
      setDeletingBranch(null);
      setDeleteBlockers(null);
      fetchBranches();
    } catch (err: any) {
      if (err.status === 409 || err.data?.statusCode === 409 || err.data?.blockers) {
        setDeleteBlockers({
          message: err.message || err.data?.message || "Cannot delete branch with active dependents.",
          blockers: err.data?.blockers || {},
          assignedStaff: err.data?.assignedStaff || [],
        });
      } else {
        toast.error(err.message || "Failed to delete branch");
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeactivate = async (branchToDeact?: BranchRow) => {
    const target = branchToDeact || deletingBranch;
    if (!target) return;
    try {
      setIsDeactivating(true);
      const newStatus = target.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
      await apiPatch(`/branches/${target.id}`, { status: newStatus });
      toast.success(
        `Branch "${target.name}" ${newStatus === "ACTIVE" ? "activated" : "deactivated"} successfully.`
      );
      setDeletingBranch(null);
      setDeleteBlockers(null);
      fetchBranches();
    } catch (err: any) {
      toast.error(err.message || "Failed to update branch status");
    } finally {
      setIsDeactivating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Title and Add Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Branch List</h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage outlets, warehouses and switch branch views across your organization.
          </p>
        </div>
        <Link href="/admin/branch/create">
          <Button className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-sm gap-2">
            <Plus className="w-4 h-4" />
            <span>Add Branch</span>
          </Button>
        </Link>
      </div>

      {/* Search Bar matching Reference */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm">
        <form onSubmit={handleSearch} className="flex gap-2 max-w-md">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Search Branch..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-9 bg-slate-50 border-slate-200 rounded-xl text-sm"
            />
          </div>
          <Button
            type="submit"
            className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl px-5"
          >
            Search
          </Button>
          {activeSearch && (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setSearchInput("");
                setActiveSearch("");
              }}
              className="rounded-xl border-slate-200 text-slate-600"
            >
              Reset
            </Button>
          )}
        </form>
      </div>

      {/* DataTable Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50/80 border-b border-slate-200 text-xs font-semibold text-slate-700 uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4 w-16 text-center">SL</th>
                <th className="py-3.5 px-4">NAME</th>
                <th className="py-3.5 px-4">LOCATION</th>
                <th className="py-3.5 px-4">CONTACT NUMBER</th>
                <th className="py-3.5 px-4 text-center">STATUS</th>
                <th className="py-3.5 px-4 text-center w-36">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-normal">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <Building2 className="w-8 h-8 animate-pulse mx-auto mb-2 text-emerald-500" />
                    <p className="text-sm">Loading branches...</p>
                  </td>
                </tr>
              ) : filteredBranches.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <Building2 className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="text-sm font-medium text-slate-600">No branches found</p>
                    <p className="text-xs text-slate-400 mt-1">Try another search or add a new branch</p>
                  </td>
                </tr>
              ) : (
                filteredBranches.map((branch, idx) => (
                  <tr key={branch.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-4 text-center text-xs font-medium text-slate-400">
                      {idx + 1}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900">{branch.name}</span>
                        {branch.code && (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">
                            {branch.code}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                        <span className="truncate max-w-xs">{branch.address || "--"}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 font-mono text-xs">
                      {branch.phone ? (
                        <div className="flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5 text-slate-400" />
                          <span>{branch.phone}</span>
                        </div>
                      ) : (
                        "--"
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${
                          branch.status === "ACTIVE"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-slate-100 text-slate-600 border border-slate-200"
                        }`}
                      >
                        {branch.status === "ACTIVE" ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center justify-center gap-1">
                        {/* External Link shortcut to switch dashboard view */}
                        {branch.status === "ACTIVE" && (
                          <button
                            type="button"
                            onClick={() => handleSwitchToBranch(branch)}
                            title="Switch to branch dashboard"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </button>
                        )}

                        {/* Quick Edit modal */}
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(branch)}
                          title="Quick Edit Branch"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>

                        {/* Delete or Deactivate branch */}
                        <button
                          type="button"
                          onClick={() => handleOpenDelete(branch)}
                          title="Delete / Deactivate Branch"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick Edit Dialog */}
      <Dialog open={!!editingBranch} onOpenChange={(open) => !open && setEditingBranch(null)}>
        <DialogContent className="sm:max-w-md bg-white rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900">
              Update Branch
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdateBranch} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">
                Name <span className="text-red-500">*</span>
              </Label>
              <Input
                placeholder="e.g. Eastern Plaza Outlet"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                required
                className="bg-slate-50 border-slate-200 rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">
                Location <span className="text-red-500">*</span>
              </Label>
              <Input
                placeholder="e.g. Shop 42, Level 5, Eastern Plaza, Dhaka"
                value={editAddress}
                onChange={(e) => setEditAddress(e.target.value)}
                required
                className="bg-slate-50 border-slate-200 rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Contact Number</Label>
              <Input
                placeholder="e.g. 01711223344"
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                className="bg-slate-50 border-slate-200 rounded-xl font-mono text-sm"
              />
            </div>

            <DialogFooter className="pt-3 gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditingBranch(null)}
                className="rounded-xl border-slate-200"
              >
                Close
              </Button>
              <Button
                type="submit"
                disabled={isUpdating}
                className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl"
              >
                {isUpdating ? "Updating..." : "Update"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete & Deactivate Dialog */}
      <Dialog
        open={!!deletingBranch}
        onOpenChange={(open) => {
          if (!open) {
            setDeletingBranch(null);
            setDeleteBlockers(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-lg bg-white rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-rose-600" />
              <span>Delete Branch</span>
            </DialogTitle>
          </DialogHeader>

          {deletingBranch && (
            <div className="space-y-4 py-2">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold text-slate-900">{deletingBranch.name}</h4>
                    <p className="text-xs text-slate-500 font-mono mt-0.5">{deletingBranch.code || "NO-CODE"}</p>
                  </div>
                  <span
                    className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                      deletingBranch.status === "ACTIVE"
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-slate-200 text-slate-700"
                    }`}
                  >
                    {deletingBranch.status}
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-2 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  <span>{deletingBranch.address}</span>
                </p>
              </div>

              {deleteBlockers ? (
                <div className="space-y-3">
                  <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl">
                    <div className="flex gap-2">
                      <ShieldAlert className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
                      <div className="text-xs text-rose-800 space-y-1">
                        <p className="font-semibold text-rose-900">Deletion Blocked</p>
                        <p>{deleteBlockers.message}</p>
                      </div>
                    </div>
                  </div>

                  {deleteBlockers.assignedStaff && deleteBlockers.assignedStaff.length > 0 && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-amber-900 flex items-center gap-1.5">
                          <Users className="w-4 h-4 text-amber-700" />
                          Assigned Staff ({deleteBlockers.assignedStaff.length})
                        </span>
                        <Link
                          href="/admin/hrm/employees"
                          className="text-[11px] text-amber-800 hover:text-amber-900 font-medium underline flex items-center gap-1"
                        >
                          Reassign in Staff List <ExternalLink className="w-3 h-3" />
                        </Link>
                      </div>
                      <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                        {deleteBlockers.assignedStaff.map((staff) => (
                          <div
                            key={staff.id}
                            className="flex items-center justify-between bg-white/80 p-2 rounded-lg text-xs"
                          >
                            <span className="font-medium text-slate-800">{staff.name}</span>
                            <span className="text-slate-500 font-mono text-[10px]">
                              {staff.employeeId || staff.role}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 space-y-1">
                    <p className="font-semibold">Recommended Alternative</p>
                    <p className="text-blue-800">
                      Deactivating this branch will immediately hide it from pickers, the branch switcher, the storefront, and the footer, while safely retaining all historical records and financial reports.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2 text-sm text-slate-600">
                  <p>
                    Are you sure you want to delete branch <strong className="text-slate-900">"{deletingBranch.name}"</strong>?
                  </p>
                  <p className="text-xs text-slate-500">
                    If this branch has historical records (staff, orders, purchases, expenses), the system will prevent deletion and offer deactivation instead.
                  </p>
                </div>
              )}

              <DialogFooter className="pt-3 gap-2 sm:gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setDeletingBranch(null);
                    setDeleteBlockers(null);
                  }}
                  className="rounded-xl border-slate-200"
                >
                  Cancel
                </Button>

                {deleteBlockers ? (
                  <Button
                    type="button"
                    disabled={isDeactivating}
                    onClick={() => handleDeactivate()}
                    className="bg-amber-600 hover:bg-amber-700 text-white rounded-xl gap-1.5"
                  >
                    <PowerOff className="w-4 h-4" />
                    <span>{isDeactivating ? "Deactivating..." : "Deactivate Branch Instead"}</span>
                  </Button>
                ) : (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={isDeactivating}
                      onClick={() => handleDeactivate()}
                      className="rounded-xl border-amber-300 text-amber-800 hover:bg-amber-50"
                    >
                      {deletingBranch.status === "ACTIVE" ? "Deactivate Only" : "Activate Branch"}
                    </Button>
                    <Button
                      type="button"
                      disabled={isDeleting}
                      onClick={handleConfirmDelete}
                      className="bg-rose-600 hover:bg-rose-700 text-white rounded-xl"
                    >
                      {isDeleting ? "Deleting..." : "Permanently Delete"}
                    </Button>
                  </>
                )}
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
