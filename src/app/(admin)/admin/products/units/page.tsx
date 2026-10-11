"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useAdminPage } from "@/contexts/AdminPageContext";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api-client";
import { toast } from "sonner";
import {
  Search,
  Plus,
  Edit2,
  Trash2,
  Scale,
  Loader2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { AdminTableState } from "@/components/admin/AdminTableState";

interface UnitItem {
  id: string;
  name: string;
  shortCode: string;
  status: "ACTIVE" | "INACTIVE";
  _count?: {
    products: number;
  };
}

export default function UnitsPage() {
  const { setTitle, setBadge, setDateFilter } = useAdminPage();

  const [units, setUnits] = useState<UnitItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<UnitItem | null>(null);
  const [formName, setFormName] = useState("");
  const [formStatus, setFormStatus] = useState<"ACTIVE" | "INACTIVE">("ACTIVE");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setTitle("Units");
    setBadge("Products");
    setDateFilter("");
  }, [setTitle, setBadge, setDateFilter]);

  // Fetch Units
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiGet<UnitItem[]>("/units");
      setUnits(Array.isArray(res) ? res : []);
    } catch (err: any) {
      setError(err.message || "Failed to load units");
      toast.error(err.message || "Failed to load units");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filtered
  const filteredUnits = useMemo(() => {
    return units.filter((u) =>
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.shortCode.toLowerCase().includes(searchQuery.toLowerCase()),
    );
  }, [units, searchQuery]);

  // Open Create Modal
  const handleOpenCreate = () => {
    setEditingUnit(null);
    setFormName("");
    setFormStatus("ACTIVE");
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (unit: UnitItem) => {
    setEditingUnit(unit);
    setFormName(unit.name);
    setFormStatus(unit.status || "ACTIVE");
    setIsModalOpen(true);
  };

  // Instant Toggle Status
  const handleToggleStatus = async (unit: UnitItem) => {
    const nextStatus = unit.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    // Optimistic
    setUnits((prev) =>
      prev.map((u) => (u.id === unit.id ? { ...u, status: nextStatus } : u)),
    );

    try {
      await apiPatch(`/units/${unit.id}`, { status: nextStatus });
      toast.success(
        `Unit "${unit.name}" is now ${nextStatus === "ACTIVE" ? "Active" : "Inactive"}.`,
      );
    } catch (err: any) {
      // Rollback
      setUnits((prev) =>
        prev.map((u) => (u.id === unit.id ? { ...u, status: unit.status } : u)),
      );
      toast.error(err.message || "Failed to update unit status");
    }
  };

  // Submit Create / Edit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      toast.error("Please enter a unit name");
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingUnit) {
        const updated = await apiPatch<UnitItem>(`/units/${editingUnit.id}`, {
          name: formName.trim(),
          status: formStatus,
        });
        toast.success(`Unit "${updated.name}" updated successfully!`);
      } else {
        const created = await apiPost<UnitItem>("/units", {
          name: formName.trim(),
          status: formStatus,
        });
        toast.success(`Unit "${created.name}" created successfully!`);
      }
      setIsModalOpen(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to save unit");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete
  const handleDelete = async (unit: UnitItem) => {
    if (!confirm(`Are you sure you want to delete unit "${unit.name}"?`)) return;

    try {
      await apiDelete(`/units/${unit.id}`);
      toast.success(`Unit "${unit.name}" deleted successfully.`);
      setUnits((prev) => prev.filter((u) => u.id !== unit.id));
    } catch (err: any) {
      toast.error(err.message || "Failed to delete unit");
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
            <Scale className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Unit Management</h1>
            <p className="text-xs text-slate-500">
              Manage measurement units used across catalog products and inventory
            </p>
          </div>
        </div>

        <Button
          onClick={handleOpenCreate}
          className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 font-medium px-4 py-2 rounded-xl shadow-sm hover:shadow transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Create New</span>
        </Button>
      </div>

      {/* Filter / Search Bar */}
      <div className="flex items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Search units..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-slate-50/50 border-slate-200 rounded-xl text-sm"
          />
        </div>
      </div>

      {/* Units Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600 font-bold text-xs uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-3.5 px-4 w-16 text-center">SL</th>
                <th className="py-3.5 px-4">Name</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <AdminTableState
                isLoading={isLoading}
                error={error}
                isEmpty={filteredUnits.length === 0}
                onRetry={fetchData}
                colSpan={4}
                loadingRows={5}
                emptyTitle="No units found"
                emptyDescription="Try modifying your search or create a new unit."
                emptyActionLabel="Create Unit"
                onEmptyAction={handleOpenCreate}
              >
                {filteredUnits.map((unit, idx) => (
                  <tr
                    key={unit.id}
                    className="hover:bg-slate-50/70 transition-colors duration-150"
                  >
                    <td className="py-3.5 px-4 text-center font-mono text-xs text-slate-500 font-bold">
                      {idx + 1}
                    </td>

                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      {unit.name}
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Switch
                          checked={unit.status === "ACTIVE"}
                          onCheckedChange={() => handleToggleStatus(unit)}
                          className="data-[state=checked]:bg-emerald-600"
                        />
                        <span
                          className={`text-xs font-semibold ${
                            unit.status === "ACTIVE"
                              ? "text-emerald-700"
                              : "text-slate-400"
                          }`}
                        >
                          {unit.status === "ACTIVE" ? "Active" : "Inactive"}
                        </span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenEdit(unit)}
                          title="Edit Unit"
                          className="p-2 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(unit)}
                          title="Delete Unit"
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
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

      {/* Create / Edit Dialog */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-md bg-white rounded-2xl p-6 shadow-xl border border-slate-200">
          <DialogHeader className="border-b border-slate-100 pb-3">
            <DialogTitle className="text-lg font-bold text-slate-900">
              {editingUnit ? "Edit Unit" : "Create New Unit"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">
                Name <span className="text-rose-500">*</span>
              </Label>
              <Input
                placeholder="e.g. Piece, Box, Kilogram, Meter..."
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                className="bg-slate-50 border-slate-200 rounded-xl text-sm"
                required
              />
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div>
                <Label className="text-xs font-bold text-slate-800">
                  Status
                </Label>
                <p className="text-xs text-slate-500">
                  Enable or disable this unit in product forms
                </p>
              </div>
              <Switch
                checked={formStatus === "ACTIVE"}
                onCheckedChange={(c) => setFormStatus(c ? "ACTIVE" : "INACTIVE")}
                className="data-[state=checked]:bg-emerald-600"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsModalOpen(false)}
                className="rounded-xl px-4 text-slate-600"
              >
                Close
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl px-5 font-semibold"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : editingUnit ? (
                  "Update Unit"
                ) : (
                  "Submit"
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

