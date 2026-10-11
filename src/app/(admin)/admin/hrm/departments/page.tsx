"use client";

import { useEffect, useState, useCallback } from "react";
import { useAdminPage } from "@/contexts/AdminPageContext";
import {
  Building2,
  Plus,
  Search,
  Edit,
  Trash2,
  Users,
  CheckCircle2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api-client";
import { Badge } from "@/components/ui/badge";
import { AdminTableState } from "@/components/admin/AdminTableState";

interface DepartmentRecord {
  id: string;
  name: string;
  headId: string | null;
  status: string;
  head?: { id: string; name: string; email: string; phone: string } | null;
  _count?: { staff: number };
}

export default function DepartmentsPage() {
  const { setTitle, setBadge, setDateFilter } = useAdminPage();
  const [data, setData] = useState<DepartmentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<DepartmentRecord | null>(null);

  // Modal form state
  const [nameInput, setNameInput] = useState("");
  const [statusInput, setStatusInput] = useState<"ACTIVE" | "INACTIVE">("ACTIVE");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setTitle("Departments");
    setBadge("HRM");
    setDateFilter("");
  }, [setTitle, setBadge, setDateFilter]);

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const params: Record<string, any> = {};
      if (searchQuery.trim()) params.search = searchQuery.trim();

      const res = await apiGet<DepartmentRecord[]>("/departments", params);
      setData(Array.isArray(res) ? res : []);
    } catch (err: any) {
      setError(err.message || "Failed to load departments");
      toast.error(err.message || "Failed to load departments");
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleOpenDialog = (dept?: DepartmentRecord) => {
    if (dept) {
      setEditingDept(dept);
      setNameInput(dept.name);
      setStatusInput(dept.status === "INACTIVE" ? "INACTIVE" : "ACTIVE");
    } else {
      setEditingDept(null);
      setNameInput("");
      setStatusInput("ACTIVE");
    }
    setIsDialogOpen(true);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameInput.trim()) {
      toast.error("Department name is required");
      return;
    }

    try {
      setIsSubmitting(true);
      const payload = {
        name: nameInput.trim(),
        status: statusInput,
      };

      if (editingDept) {
        await apiPatch(`/departments/${editingDept.id}`, payload);
        toast.success("Department updated successfully");
      } else {
        await apiPost("/departments", payload);
        toast.success("Department created successfully");
      }

      setIsDialogOpen(false);
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to save department");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (dept: DepartmentRecord) => {
    if (
      !confirm(
        `Are you sure you want to delete department "${dept.name}"? This action cannot be undone.`,
      )
    ) {
      return;
    }

    try {
      await apiDelete(`/departments/${dept.id}`);
      toast.success("Department deleted successfully");
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete department");
    }
  };

  const filteredData = data.filter((d) =>
    !searchQuery.trim()
      ? true
      : d.name.toLowerCase().includes(searchQuery.toLowerCase().trim()),
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <Building2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            Departments
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage organizational divisions, operational units, and staff grouping
          </p>
        </div>
        <button
          type="button"
          onClick={() => handleOpenDialog()}
          className="px-4 py-2 text-sm font-medium rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm flex items-center gap-2 transition-colors self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          Create New Department
        </button>
      </div>

      {/* Filter / Search Bar */}
      <div className="p-4 rounded-xl border border-border bg-card shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search departments..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-10 pl-9 pr-3 text-sm rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="text-xs text-muted-foreground">
          Total <span className="font-semibold text-foreground">{filteredData.length}</span> departments
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 border-b border-border text-xs uppercase text-muted-foreground font-semibold">
              <tr>
                <th className="p-4 w-16 text-center font-semibold">SL</th>
                <th className="p-4 font-semibold tracking-wider">Department Name</th>
                <th className="p-4 font-semibold tracking-wider">Total Staff</th>
                <th className="p-4 font-semibold tracking-wider text-center">Status</th>
                <th className="p-4 font-semibold tracking-wider text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-foreground">
              <AdminTableState
                isLoading={isLoading}
                error={error}
                isEmpty={filteredData.length === 0}
                onRetry={loadData}
                colSpan={5}
                loadingRows={5}
                emptyTitle="No departments found"
                emptyDescription="No departments match your search."
                emptyActionLabel="Add Department"
                onEmptyAction={() => handleOpenDialog()}
              >
                {filteredData.map((dept, index) => (
                  <tr key={dept.id} className="hover:bg-muted/30 transition-colors">
                    <td className="p-4 text-center font-mono text-xs text-muted-foreground">
                      #{index + 1}
                    </td>

                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-sm border border-emerald-200 dark:border-emerald-800">
                          {dept.name.charAt(0)}
                        </div>
                        <span className="font-semibold text-foreground">{dept.name}</span>
                      </div>
                    </td>

                    <td className="p-4">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span>{dept._count?.staff || 0} employees</span>
                      </div>
                    </td>

                    <td className="p-4 text-center">
                      <Badge
                        variant="secondary"
                        className={
                          dept.status === "ACTIVE"
                            ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200"
                            : "bg-muted text-muted-foreground"
                        }
                      >
                        {dept.status === "ACTIVE" ? "Active" : "Inactive"}
                      </Badge>
                    </td>

                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenDialog(dept)}
                          title="Edit Department"
                          className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-emerald-600 transition-colors"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(dept)}
                          title="Delete Department"
                          className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-red-600 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </AdminTableState>
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE / EDIT DIALOG */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-emerald-600" />
              {editingDept ? "Edit Department" : "Create New Department"}
            </DialogTitle>
            <DialogDescription>
              Enter the department name and operational status.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={onSubmit} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">
                Department Name <span className="text-red-500">*</span>
              </label>
              <Input
                placeholder="e.g. Sales, Hardware Repair, Logistics"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                required
                className="h-10"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">
                Status
              </label>
              <select
                value={statusInput}
                onChange={(e) => setStatusInput(e.target.value as any)}
                className="w-full h-10 px-3 py-2 text-sm rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
              <button
                type="button"
                onClick={() => setIsDialogOpen(false)}
                className="px-4 py-2 text-sm font-medium border border-border rounded-lg bg-background hover:bg-muted text-foreground transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !nameInput.trim()}
                className="px-5 py-2 text-sm font-medium rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm flex items-center gap-2 transition-colors disabled:opacity-50"
              >
                {isSubmitting ? (
                  <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                {editingDept ? "Save Changes" : "Create Department"}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
