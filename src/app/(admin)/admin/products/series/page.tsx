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
  Layers,
  Building2,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AdminTableState } from "@/components/admin/AdminTableState";

interface BrandOption {
  id: string;
  name: string;
  status?: string;
}

interface SeriesItem {
  id: string;
  name: string;
  brandId: string;
  status: "ACTIVE" | "INACTIVE";
  brand?: {
    id: string;
    name: string;
  };
  _count?: {
    products: number;
  };
}

export default function SeriesPage() {
  const { setTitle, setBadge, setDateFilter } = useAdminPage();

  const [seriesList, setSeriesList] = useState<SeriesItem[]>([]);
  const [brands, setBrands] = useState<BrandOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBrandFilter, setSelectedBrandFilter] = useState("ALL");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSeries, setEditingSeries] = useState<SeriesItem | null>(null);
  const [formBrandId, setFormBrandId] = useState("");
  const [formName, setFormName] = useState("");
  const [formStatus, setFormStatus] = useState<"ACTIVE" | "INACTIVE">("ACTIVE");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setTitle("Series");
    setBadge("Products");
    setDateFilter("");
  }, [setTitle, setBadge, setDateFilter]);

  // Load Data
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [seriesRes, brandsRes] = await Promise.all([
        apiGet<SeriesItem[]>("/series"),
        apiGet<BrandOption[]>("/brands"),
      ]);
      setSeriesList(Array.isArray(seriesRes) ? seriesRes : []);
      setBrands(Array.isArray(brandsRes) ? brandsRes : []);
    } catch (err: any) {
      setError(err.message || "Failed to load series catalog");
      toast.error(err.message || "Failed to load series catalog");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filtered List
  const filteredSeries = useMemo(() => {
    return seriesList.filter((item) => {
      const matchesSearch =
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.brand?.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesBrand =
        selectedBrandFilter === "ALL" || item.brandId === selectedBrandFilter;
      return matchesSearch && matchesBrand;
    });
  }, [seriesList, searchQuery, selectedBrandFilter]);

  // Open Create Dialog
  const handleOpenCreate = () => {
    setEditingSeries(null);
    setFormBrandId(brands[0]?.id || "");
    setFormName("");
    setFormStatus("ACTIVE");
    setIsModalOpen(true);
  };

  // Open Edit Dialog
  const handleOpenEdit = (series: SeriesItem) => {
    setEditingSeries(series);
    setFormBrandId(series.brandId);
    setFormName(series.name);
    setFormStatus(series.status || "ACTIVE");
    setIsModalOpen(true);
  };

  // Instant Switch Toggle
  const handleToggleStatus = async (series: SeriesItem) => {
    const nextStatus = series.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    // Optimistic UI update
    setSeriesList((prev) =>
      prev.map((s) => (s.id === series.id ? { ...s, status: nextStatus } : s)),
    );

    try {
      await apiPatch(`/series/${series.id}`, { status: nextStatus });
      toast.success(
        `Series "${series.name}" is now ${nextStatus === "ACTIVE" ? "Active" : "Inactive"}.`,
      );
    } catch (err: any) {
      // Rollback
      setSeriesList((prev) =>
        prev.map((s) => (s.id === series.id ? { ...s, status: series.status } : s)),
      );
      toast.error(err.message || "Failed to update series status");
    }
  };

  // Submit Create / Edit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formBrandId) {
      toast.error("Please select a brand");
      return;
    }
    if (!formName.trim()) {
      toast.error("Please enter series name");
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingSeries) {
        const updated = await apiPatch<SeriesItem>(`/series/${editingSeries.id}`, {
          name: formName.trim(),
          brandId: formBrandId,
          status: formStatus,
        });
        toast.success(`Series "${updated.name}" updated successfully!`);
      } else {
        const created = await apiPost<SeriesItem>("/series", {
          name: formName.trim(),
          brandId: formBrandId,
          status: formStatus,
        });
        toast.success(`Series "${created.name}" created successfully!`);
      }
      setIsModalOpen(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to save series");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete
  const handleDelete = async (series: SeriesItem) => {
    if (!confirm(`Are you sure you want to delete series "${series.name}"?`)) return;

    try {
      await apiDelete(`/series/${series.id}`);
      toast.success(`Series "${series.name}" deleted successfully.`);
      setSeriesList((prev) => prev.filter((s) => s.id !== series.id));
    } catch (err: any) {
      toast.error(err.message || "Failed to delete series");
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Series Management</h1>
            <p className="text-xs text-slate-500">
              Manage product model series grouped under brand portfolios
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
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Search series by name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-slate-50/50 border-slate-200 rounded-xl text-sm"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">
            Filter Brand:
          </Label>
          <Select value={selectedBrandFilter} onValueChange={setSelectedBrandFilter}>
            <SelectTrigger className="w-full sm:w-48 bg-slate-50 border-slate-200 rounded-xl text-sm font-medium">
              <SelectValue placeholder="All Brands" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="ALL">All Brands ({brands.length})</SelectItem>
              {brands.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Series Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600 font-bold text-xs uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-3.5 px-4 w-16 text-center">SL</th>
                <th className="py-3.5 px-4">Brand</th>
                <th className="py-3.5 px-4">Series Name</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <AdminTableState
                isLoading={isLoading}
                error={error}
                isEmpty={filteredSeries.length === 0}
                onRetry={fetchData}
                colSpan={5}
                loadingRows={5}
                emptyTitle="No series found"
                emptyDescription="Try modifying your search or create a new series."
                emptyActionLabel="Create Series"
                onEmptyAction={handleOpenCreate}
              >
                {filteredSeries.map((series, idx) => (
                  <tr
                    key={series.id}
                    className="hover:bg-slate-50/70 transition-colors duration-150"
                  >
                    <td className="py-3.5 px-4 text-center font-mono text-xs text-slate-500 font-bold">
                      {idx + 1}
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-slate-400" />
                        <span className="font-semibold text-slate-800">
                          {series.brand?.name || "Unassigned"}
                        </span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      {series.name}
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Switch
                          checked={series.status === "ACTIVE"}
                          onCheckedChange={() => handleToggleStatus(series)}
                          className="data-[state=checked]:bg-emerald-600"
                        />
                        <span
                          className={`text-xs font-semibold ${
                            series.status === "ACTIVE"
                              ? "text-emerald-700"
                              : "text-slate-400"
                          }`}
                        >
                          {series.status === "ACTIVE" ? "Active" : "Inactive"}
                        </span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenEdit(series)}
                          title="Edit Series"
                          className="p-2 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(series)}
                          title="Delete Series"
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
              {editingSeries ? "Edit Series" : "Create Series"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">
                Select Brand <span className="text-rose-500">*</span>
              </Label>
              <Select value={formBrandId} onValueChange={setFormBrandId}>
                <SelectTrigger className="w-full bg-slate-50 border-slate-200 rounded-xl text-sm font-medium">
                  <SelectValue placeholder="Choose a Brand" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {brands.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">
                Name <span className="text-rose-500">*</span>
              </Label>
              <Input
                placeholder="e.g. Galaxy S Series, iPhone Pro..."
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
                  Enable or disable this series across catalogs
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
                ) : editingSeries ? (
                  "Update Series"
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
