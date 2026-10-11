"use client";

import { useEffect, useState, useCallback } from "react";
import { useAdminPage } from "@/contexts/AdminPageContext";
import {
  Wrench,
  Plus,
  Search,
  RotateCcw,
  Edit,
  Trash2,
  Percent,
  CheckCircle2,
  Sparkles,
  Phone,
  Mail,
  Building2,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api-client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { AdminTableState } from "@/components/admin/AdminTableState";

interface TechnicianRecord {
  id: string;
  employeeId: string;
  name: string;
  email: string;
  phone: string;
  photo?: string | null;
  status: string;
  isTechnician: boolean;
  commissionRate: number | string;
  activeJobsCount: number;
  completedJobsCount: number;
  totalJobsCount: number;
  department?: { id: string; name: string } | null;
  role?: { id: string; name: string; scope: string } | null;
  branch?: { id: string; name: string; code: string } | null;
}

interface EligibleEmployee {
  id: string;
  employeeId: string;
  name: string;
  phone: string;
  email: string;
  photo?: string | null;
  department?: { id: string; name: string } | null;
  role?: { id: string; name: string } | null;
}

export default function TechniciansPage() {
  const { setTitle, setBadge, setDateFilter } = useAdminPage();

  const [data, setData] = useState<TechnicianRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  // Add Technician Modal state
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [eligibleEmployees, setEligibleEmployees] = useState<EligibleEmployee[]>([]);
  const [selectedEmpId, setSelectedEmpId] = useState("");
  const [addCommissionRate, setAddCommissionRate] = useState("5.0");
  const [isSubmittingAdd, setIsSubmittingAdd] = useState(false);

  // Edit Rate Modal state
  const [editRateTech, setEditRateTech] = useState<TechnicianRecord | null>(null);
  const [editCommissionRate, setEditCommissionRate] = useState("");
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  useEffect(() => {
    setTitle("Technicians");
    setBadge("HRM");
    setDateFilter("");
  }, [setTitle, setBadge, setDateFilter]);

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await apiGet<TechnicianRecord[]>("/employees/technicians");
      setData(Array.isArray(res) ? res : []);
    } catch (err: any) {
      setError(err.message || "Failed to load technicians");
      toast.error(err.message || "Failed to load technicians");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleOpenAddModal = async () => {
    try {
      const res = await apiGet<EligibleEmployee[]>("/employees/eligible-for-technician");
      setEligibleEmployees(Array.isArray(res) ? res : []);
      setSelectedEmpId("");
      setAddCommissionRate("5.0");
      setAddModalOpen(true);
    } catch (err: any) {
      toast.error(err.message || "Failed to load eligible employees");
    }
  };

  const handleCreateTechnician = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmpId) {
      toast.error("Please select an employee");
      return;
    }

    try {
      setIsSubmittingAdd(true);
      await apiPost(`/employees/${selectedEmpId}/make-technician`, {
        commissionRate: parseFloat(addCommissionRate) || 0,
      });
      toast.success("Employee successfully designated as Technician!");
      setAddModalOpen(false);
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to designate technician");
    } finally {
      setIsSubmittingAdd(false);
    }
  };

  const handleOpenEditRateModal = (tech: TechnicianRecord) => {
    setEditRateTech(tech);
    setEditCommissionRate(String(tech.commissionRate || 0));
  };

  const handleSaveEditRate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editRateTech) return;

    try {
      setIsSubmittingEdit(true);
      await apiPatch(`/employees/${editRateTech.id}/technician`, {
        commissionRate: parseFloat(editCommissionRate) || 0,
      });
      toast.success("Commission rate updated successfully");
      setEditRateTech(null);
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to update commission rate");
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  const handleRemoveTechnician = async (tech: TechnicianRecord) => {
    if (
      !confirm(
        `Are you sure you want to remove the Technician designation from ${tech.name}? Their employee profile will remain active.`,
      )
    ) {
      return;
    }

    try {
      await apiDelete(`/employees/${tech.id}/technician`);
      toast.success(`${tech.name} is no longer designated as a Technician`);
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to remove technician designation");
    }
  };

  const filteredData = data.filter((t) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase().trim();
    return (
      t.name.toLowerCase().includes(term) ||
      t.employeeId.toLowerCase().includes(term) ||
      t.phone.toLowerCase().includes(term) ||
      (t.department?.name || "").toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <Wrench className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            Technician Management
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Decoupled technician roster with individual commission rates & job performance tracking
          </p>
        </div>
        <button
          type="button"
          onClick={handleOpenAddModal}
          className="px-4 py-2 text-sm font-medium rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm flex items-center gap-2 transition-colors self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          Add Technician
        </button>
      </div>

      {/* Filter / Search Bar */}
      <div className="p-4 rounded-xl border border-border bg-card shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search technicians by name, ID, department..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full h-10 pl-9 pr-3 text-sm rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">{filteredData.length}</span> active technicians
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 border-b border-border text-xs uppercase text-muted-foreground font-semibold">
              <tr>
                <th className="p-4 font-semibold tracking-wider">ID</th>
                <th className="p-4 font-semibold tracking-wider">Technician</th>
                <th className="p-4 font-semibold tracking-wider">Department</th>
                <th className="p-4 font-semibold tracking-wider">Commission Rate</th>
                <th className="p-4 font-semibold tracking-wider">Job Performance</th>
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
                colSpan={7}
                loadingRows={5}
                emptyTitle="No records found"
                emptyDescription="No technicians found. Click Add Technician to designate team members."
                emptyActionLabel="Add Technician"
                onEmptyAction={handleOpenAddModal}
              >
                {filteredData.map((tech) => (
                  <tr key={tech.id} className="hover:bg-muted/30 transition-colors">
                    {/* ID */}
                    <td className="p-4 font-mono font-bold text-foreground">
                      {tech.employeeId}
                    </td>

                    {/* Technician Profile */}
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 font-bold flex items-center justify-center shrink-0 overflow-hidden text-sm border border-border">
                          {tech.photo ? (
                            <img
                              src={tech.photo}
                              alt={tech.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            tech.name
                              .split(" ")
                              .map((n) => n[0])
                              .slice(0, 2)
                              .join("")
                              .toUpperCase()
                          )}
                        </div>
                        <div className="space-y-0.5">
                          <p className="font-semibold text-foreground">{tech.name}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{tech.phone}</span>
                            <span>•</span>
                            <span>{tech.role?.name || "Staff"}</span>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Real Department */}
                    <td className="p-4">
                      <Badge variant="outline" className="text-xs bg-muted/40 font-normal">
                        {tech.department?.name || "General / None"}
                      </Badge>
                    </td>

                    {/* Commission Rate */}
                    <td className="p-4">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                        <Percent className="h-3 w-3" />
                        {Number(tech.commissionRate || 0).toFixed(2)}%
                      </span>
                    </td>

                    {/* Job Performance */}
                    <td className="p-4">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2 py-0.5 rounded text-xs bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-medium">
                          {tech.activeJobsCount} Active
                        </span>
                        <span className="px-2 py-0.5 rounded text-xs bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-medium">
                          {tech.completedJobsCount} Completed
                        </span>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="p-4 text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          tech.status === "ACTIVE"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            tech.status === "ACTIVE" ? "bg-emerald-500" : "bg-slate-400"
                          }`}
                        />
                        {tech.status === "ACTIVE" ? "Active" : "Inactive"}
                      </span>
                    </td>

                    {/* Action */}
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenEditRateModal(tech)}
                          title="Edit Commission Rate"
                          className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-emerald-600 transition-colors"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveTechnician(tech)}
                          title="Remove Technician Designation"
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

      {/* ========================================================================= */}
      {/* ADD TECHNICIAN MODAL */}
      {/* ========================================================================= */}
      <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-emerald-600" />
              Designate Employee as Technician
            </DialogTitle>
            <DialogDescription>
              Select an active employee to grant technician privileges and assign their commission rate.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateTechnician} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">
                Select Eligible Employee <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedEmpId}
                onChange={(e) => setSelectedEmpId(e.target.value)}
                required
                className="w-full h-10 px-3 py-2 text-sm rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">-- Choose Employee --</option>
                {eligibleEmployees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} ({emp.employeeId} • {emp.department?.name || "General"} • {emp.role?.name || "Staff"})
                  </option>
                ))}
              </select>
              {eligibleEmployees.length === 0 && (
                <p className="text-xs text-amber-600">
                  All active employees are already designated as technicians.
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">
                Commission Rate (%) <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  placeholder="e.g. 5.0"
                  value={addCommissionRate}
                  onChange={(e) => setAddCommissionRate(e.target.value)}
                  required
                  className="h-10 pl-3 pr-8 font-mono"
                />
                <Percent className="h-4 w-4 absolute right-2.5 top-3 text-muted-foreground" />
              </div>
              <p className="text-[11px] text-muted-foreground">
                Percentage paid on repair and service tickets closed by this technician.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
              <button
                type="button"
                onClick={() => setAddModalOpen(false)}
                className="px-4 py-2 text-sm font-medium border border-border rounded-lg bg-background hover:bg-muted text-foreground transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmittingAdd || !selectedEmpId}
                className="px-5 py-2 text-sm font-medium rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm flex items-center gap-2 transition-colors disabled:opacity-50"
              >
                {isSubmittingAdd ? (
                  <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                Confirm Designation
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* EDIT COMMISSION RATE MODAL */}
      {/* ========================================================================= */}
      {editRateTech && (
        <Dialog open={!!editRateTech} onOpenChange={() => setEditRateTech(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Edit className="h-5 w-5 text-emerald-600" />
                Edit Commission Rate
              </DialogTitle>
              <DialogDescription>
                Update repair ticket payout percentage for {editRateTech.name}.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSaveEditRate} className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">
                  Commission Rate (%) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    placeholder="e.g. 7.5"
                    value={editCommissionRate}
                    onChange={(e) => setEditCommissionRate(e.target.value)}
                    required
                    className="h-10 pl-3 pr-8 font-mono"
                  />
                  <Percent className="h-4 w-4 absolute right-2.5 top-3 text-muted-foreground" />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setEditRateTech(null)}
                  className="px-4 py-2 text-sm font-medium border border-border rounded-lg bg-background hover:bg-muted text-foreground transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingEdit}
                  className="px-5 py-2 text-sm font-medium rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm flex items-center gap-2 transition-colors disabled:opacity-50"
                >
                  {isSubmittingEdit ? (
                    <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  Save Changes
                </button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
