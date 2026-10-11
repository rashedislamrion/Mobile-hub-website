"use client";

import { useEffect, useState, useCallback } from "react";
import { useAdminPage } from "@/contexts/AdminPageContext";
import {
  User,
  Plus,
  Search,
  RotateCcw,
  Edit,
  Trash2,
  Key,
  Eye,
  Building2,
  Phone,
  Mail,
  Shield,
  Sparkles,
  CheckCircle2,
  XCircle,
  MoreVertical,
  Check,
  Copy,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { apiGet, apiPatch, apiDelete } from "@/lib/api-client";
import { downloadPrivateAsset, PrivateImage } from "@/lib/private-asset";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { AdminTableState } from "@/components/admin/AdminTableState";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface EmployeeRecord {
  id: string;
  employeeId: string;
  name: string;
  email: string;
  phone: string;
  address?: string | null;
  photo?: string | null;
  birthCertificateUrl?: string | null;
  gender?: string | null;
  dob?: string | null;
  nidNumber?: string | null;
  status: string;
  access?: string; // "Admin" | "Branch Only"
  adminPanelAccess?: boolean;
  isTechnician?: boolean;
  commissionRate?: number | string;
  bonusLimit?: number | string;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  emergencyContactRelationship?: string | null;
  employmentType: string;
  joiningDate: string;
  basicSalary?: number | string;
  department?: { id: string; name: string } | null;
  role?: { id: string; name: string; scope: string } | null;
  branch?: { id: string; name: string; code: string } | null;
  branchAccess?: Array<{
    id: string;
    branchId: string;
    branch: { id: string; name: string; code: string };
  }>;
}

export default function EmployeesPage() {
  const { setTitle, setBadge, setDateFilter } = useAdminPage();
  const router = useRouter();

  const [data, setData] = useState<EmployeeRecord[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDept, setSelectedDept] = useState("all");
  const [selectedRole, setSelectedRole] = useState("all");
  const [selectedBranch, setSelectedBranch] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");

  const [departments, setDepartments] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);

  // Selection for bulk actions
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Modals
  const [detailsModalEmployee, setDetailsModalEmployee] = useState<EmployeeRecord | null>(null);
  const [resetModalInfo, setResetModalInfo] = useState<{ name: string; tempPass: string } | null>(null);
  const [hasCopiedPass, setHasCopiedPass] = useState(false);

  useEffect(() => {
    setTitle("Employees");
    setBadge("HRM");
    setDateFilter("");
  }, [setTitle, setBadge, setDateFilter]);

  useEffect(() => {
    Promise.all([
      apiGet<any[]>("/departments"),
      apiGet<any[]>("/roles"),
      apiGet<any[]>("/branches"),
    ])
      .then(([deptRes, roleRes, branchRes]) => {
        setDepartments(Array.isArray(deptRes) ? deptRes : []);
        setRoles(Array.isArray(roleRes) ? roleRes : []);
        setBranches(Array.isArray(branchRes) ? branchRes : []);
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
      if (selectedDept !== "all") params.department = selectedDept;
      if (selectedRole !== "all") params.role = selectedRole;
      if (selectedBranch !== "all") params.branch = selectedBranch;
      if (selectedStatus !== "all") params.status = selectedStatus;
      if (searchTerm.trim()) params.search = searchTerm.trim();

      const res = await apiGet<{ data: EmployeeRecord[]; meta?: { total: number; totalPages: number } }>(
        "/employees",
        params,
      );
      setData(res?.data || []);
      setTotalCount(res?.meta?.total || (res?.data || []).length);
      setTotalPages(res?.meta?.totalPages || 1);
    } catch (err: any) {
      setError(err.message || "Failed to load employees");
      toast.error(err.message || "Failed to load employees");
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, selectedDept, selectedRole, selectedBranch, selectedStatus, searchTerm]);

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
    setSelectedDept("all");
    setSelectedRole("all");
    setSelectedBranch("all");
    setSelectedStatus("all");
    setCurrentPage(1);
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === data.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(data.map((e) => e.id));
    }
  };

  const toggleSelectOne = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((item) => item !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleBulkStatusChange = async (newStatus: "ACTIVE" | "INACTIVE") => {
    if (selectedIds.length === 0) return;
    try {
      await Promise.all(
        selectedIds.map((id) =>
          apiPatch(`/employees/${id}/status`, { status: newStatus }),
        ),
      );
      toast.success(`Updated status for ${selectedIds.length} employees to ${newStatus}`);
      setSelectedIds([]);
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Bulk update failed");
    }
  };

  const handleToggleStatus = async (emp: EmployeeRecord) => {
    const nextStatus = emp.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    try {
      await apiPatch(`/employees/${emp.id}/status`, { status: nextStatus });
      toast.success(`${emp.name} is now ${nextStatus}`);
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to update status");
    }
  };

  const handleResetPassword = async (emp: EmployeeRecord) => {
    try {
      const res = await apiPatch<{ message: string; tempPassword: string }>(
        `/employees/${emp.id}/reset-password`,
        {},
      );
      setResetModalInfo({ name: emp.name, tempPass: res.tempPassword });
      setHasCopiedPass(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to reset password");
    }
  };

  const handleDeleteEmployee = async (emp: EmployeeRecord) => {
    if (!confirm(`Are you sure you want to delete ${emp.name}? This cannot be undone.`)) {
      return;
    }
    try {
      await apiDelete(`/employees/${emp.id}`);
      toast.success(`${emp.name} deleted successfully`);
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete employee");
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setHasCopiedPass(true);
    toast.success("Temporary password copied to clipboard");
    setTimeout(() => setHasCopiedPass(false), 2500);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <User className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            Employees Management
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Total {totalCount} registered team members across branches
          </p>
        </div>
        <div className="flex items-center gap-3">
          {selectedIds.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-muted hover:bg-muted/80 text-foreground border border-border flex items-center gap-1.5 transition-colors">
                  <span>Bulk Actions ({selectedIds.length})</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  onClick={() => handleBulkStatusChange("ACTIVE")}
                  className="text-emerald-600 cursor-pointer"
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Mark as Active
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleBulkStatusChange("INACTIVE")}
                  className="text-red-600 cursor-pointer"
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Mark as Inactive
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          <Link
            href="/admin/hrm/employees/create"
            className="px-4 py-2 text-sm font-medium rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm flex items-center gap-2 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add Employee
          </Link>
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
              placeholder="Search by name, ID, phone, email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-10 pl-9 pr-3 text-sm rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* Department */}
          <div>
            <select
              value={selectedDept}
              onChange={(e) => {
                setSelectedDept(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full h-10 px-3 py-2 text-sm rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="all">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          {/* Role */}
          <div>
            <select
              value={selectedRole}
              onChange={(e) => {
                setSelectedRole(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full h-10 px-3 py-2 text-sm rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="all">All Roles</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>

          {/* Status & Reset */}
          <div className="flex items-center gap-2">
            <select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full h-10 px-3 py-2 text-sm rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="all">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>

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
                <th className="p-4 w-10">
                  <Checkbox
                    checked={data.length > 0 && selectedIds.length === data.length}
                    onCheckedChange={toggleSelectAll}
                    aria-label="Select all"
                  />
                </th>
                <th className="p-4 font-semibold tracking-wider">Employee</th>
                <th className="p-4 font-semibold tracking-wider">Contact & Address</th>
                <th className="p-4 font-semibold tracking-wider">Dept & Role</th>
                <th className="p-4 font-semibold tracking-wider">Access</th>
                <th className="p-4 font-semibold tracking-wider text-center">Status</th>
                <th className="p-4 font-semibold tracking-wider text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-foreground">
              <AdminTableState
                isLoading={isLoading}
                error={error}
                isEmpty={data.length === 0}
                onRetry={loadData}
                colSpan={7}
                loadingRows={5}
                emptyTitle="No records found"
                emptyDescription="No employees found matching the current search & filters."
                emptyActionLabel="Add Employee"
                onEmptyAction={() => router.push("/admin/hrm/employees/create")}
              >
                {data.map((emp) => {
                  const isSelected = selectedIds.includes(emp.id);
                  const accessLabel = emp.access || (emp.role?.scope === "GLOBAL" ? "Admin" : "Branch Only");
                  const isAdmin = accessLabel === "Admin";

                  return (
                    <tr
                      key={emp.id}
                      className={`hover:bg-muted/30 transition-colors ${
                        isSelected ? "bg-emerald-50/30 dark:bg-emerald-950/20" : ""
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="p-4">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleSelectOne(emp.id)}
                          aria-label={`Select ${emp.name}`}
                        />
                      </td>

                      {/* Employee Info */}
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="relative h-10 w-10 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 font-bold flex items-center justify-center shrink-0 overflow-hidden text-sm border border-border">
                            {emp.photo ? (
                              <PrivateImage
                                endpointOrPath={`/employees/${emp.id}/document/photo`}
                                alt={emp.name}
                                className="h-full w-full object-cover"
                                fallback={
                                  emp.name
                                    .split(" ")
                                    .map((n) => n[0])
                                    .slice(0, 2)
                                    .join("")
                                    .toUpperCase()
                                }
                              />
                            ) : (
                              emp.name
                                .split(" ")
                                .map((n) => n[0])
                                .slice(0, 2)
                                .join("")
                                .toUpperCase()
                            )}
                          </div>
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-foreground">{emp.name}</span>
                              <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium">
                                {emp.employeeId}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Mail className="h-3 w-3" />
                              <span>{emp.email}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Contact */}
                      <td className="p-4">
                        <div className="space-y-0.5 text-xs">
                          <div className="flex items-center gap-1.5 font-medium text-foreground">
                            <Phone className="h-3 w-3 text-muted-foreground" />
                            <span>{emp.phone}</span>
                          </div>
                          {emp.address && (
                            <p className="text-muted-foreground text-[11px] truncate max-w-[200px]">
                              {emp.address}
                            </p>
                          )}
                        </div>
                      </td>

                      {/* Department & Role */}
                      <td className="p-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Badge variant="outline" className="text-xs bg-muted/40 font-normal">
                              {emp.department?.name || "General"}
                            </Badge>
                            <Badge variant="secondary" className="text-xs font-semibold">
                              {emp.role?.name || "Staff"}
                            </Badge>
                            {emp.isTechnician && (
                              <Badge className="text-[10px] bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200">
                                <Sparkles className="h-3 w-3 mr-0.5" />
                                Tech ({Number(emp.commissionRate || 0)}%)
                              </Badge>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Access Level */}
                      <td className="p-4">
                        <div className="space-y-1">
                          <Badge
                            className={`text-xs font-medium ${
                              isAdmin
                                ? "bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border-emerald-300"
                                : "bg-sky-100 dark:bg-sky-950/80 text-sky-800 dark:text-sky-300 border-sky-300"
                            }`}
                          >
                            <Shield className="h-3 w-3 mr-1" />
                            {accessLabel}
                          </Badge>
                          {emp.adminPanelAccess && (
                            <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-0.5">
                              • Admin Login ON
                            </p>
                          )}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="p-4 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(emp)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold cursor-pointer transition-all ${
                            emp.status === "ACTIVE"
                              ? "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100"
                              : "bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 hover:bg-red-100"
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              emp.status === "ACTIVE" ? "bg-emerald-500" : "bg-red-500"
                            }`}
                          />
                          {emp.status === "ACTIVE" ? "Active" : "Inactive"}
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => setDetailsModalEmployee(emp)}
                            title="View Profile Details"
                            className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <Eye className="h-4 w-4" />
                          </button>

                          <Link
                            href={`/admin/hrm/employees/${emp.id}/edit`}
                            title="Edit Employee"
                            className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-emerald-600 transition-colors"
                          >
                            <Edit className="h-4 w-4" />
                          </Link>

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                                <MoreVertical className="h-4 w-4" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44">
                              <DropdownMenuItem
                                onClick={() => handleResetPassword(emp)}
                                className="cursor-pointer"
                              >
                                <Key className="h-4 w-4 mr-2 text-amber-500" />
                                Reset Password
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => handleDeleteEmployee(emp)}
                                className="cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950/50"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete Employee
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
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
              ? "Showing 0 team members"
              : `Showing ${(currentPage - 1) * 15 + 1} to ${Math.min(currentPage * 15, totalCount)} of ${totalCount.toLocaleString()} team members`}
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
      {/* DETAILS MODAL */}
      {/* ========================================================================= */}
      {detailsModalEmployee && (
        <Dialog open={!!detailsModalEmployee} onOpenChange={() => setDetailsModalEmployee(null)}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <User className="h-5 w-5 text-emerald-600" />
                Employee Profile Details
              </DialogTitle>
              <DialogDescription>
                Detailed credentials, permissions, and branch assignments
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 pt-2">
              {/* Header Profile Badge */}
              <div className="flex items-start gap-4 p-4 rounded-xl bg-muted/30 border border-border">
                <div className="h-14 w-14 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 font-bold flex items-center justify-center shrink-0 overflow-hidden text-lg border border-border">
                  {detailsModalEmployee.photo ? (
                    <PrivateImage
                      endpointOrPath={`/employees/${detailsModalEmployee.id}/document/photo`}
                      alt={detailsModalEmployee.name}
                      className="h-full w-full object-cover"
                      fallback={
                        detailsModalEmployee.name
                          .split(" ")
                          .map((n) => n[0])
                          .slice(0, 2)
                          .join("")
                          .toUpperCase()
                      }
                    />
                  ) : (
                    detailsModalEmployee.name
                      .split(" ")
                      .map((n) => n[0])
                      .slice(0, 2)
                      .join("")
                      .toUpperCase()
                  )}
                </div>
                <div className="space-y-1 flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-foreground">{detailsModalEmployee.name}</h3>
                    <Badge
                      className={
                        detailsModalEmployee.status === "ACTIVE"
                          ? "bg-emerald-600 text-white"
                          : "bg-red-600 text-white"
                      }
                    >
                      {detailsModalEmployee.status}
                    </Badge>
                  </div>
                  <p className="text-xs font-mono text-muted-foreground">{detailsModalEmployee.employeeId}</p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground pt-1 flex-wrap">
                    <span>{detailsModalEmployee.email}</span>
                    <span>•</span>
                    <span>{detailsModalEmployee.phone}</span>
                  </div>
                </div>
              </div>

              {/* Grid 2 Cols: Job & Access */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3.5 rounded-lg border border-border space-y-2 bg-card">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Job Information
                  </h4>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Department:</span>
                      <span className="font-semibold text-foreground">{detailsModalEmployee.department?.name || "N/A"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Role:</span>
                      <span className="font-semibold text-foreground">{detailsModalEmployee.role?.name || "N/A"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Employment Type:</span>
                      <span className="font-semibold text-foreground">{detailsModalEmployee.employmentType}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Basic Salary:</span>
                      <span className="font-semibold text-foreground font-mono">
                        ৳{Number(detailsModalEmployee.basicSalary || 0).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Bonus Limit:</span>
                      <span className="font-semibold text-foreground font-mono">
                        ৳{Number(detailsModalEmployee.bonusLimit || 0).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-3.5 rounded-lg border border-border space-y-2 bg-card">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Access & Capabilities
                  </h4>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">System Scope:</span>
                      <span className="font-semibold text-foreground">{detailsModalEmployee.access}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Admin Portal Access:</span>
                      <span className={`font-semibold ${detailsModalEmployee.adminPanelAccess ? "text-emerald-600" : "text-muted-foreground"}`}>
                        {detailsModalEmployee.adminPanelAccess ? "Allowed" : "Restricted"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Technician Flag:</span>
                      <span className={`font-semibold ${detailsModalEmployee.isTechnician ? "text-purple-600" : "text-muted-foreground"}`}>
                        {detailsModalEmployee.isTechnician ? `Active (${detailsModalEmployee.commissionRate}%)` : "No"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Multi-Branch Access List */}
              <div className="p-3.5 rounded-lg border border-border space-y-2 bg-card">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 text-emerald-600" />
                  Assigned Branch Privileges
                </h4>
                <div className="flex items-center gap-2 flex-wrap pt-1">
                  {detailsModalEmployee.branchAccess && detailsModalEmployee.branchAccess.length > 0 ? (
                    detailsModalEmployee.branchAccess.map((ba) => (
                      <Badge key={ba.id} variant="secondary" className="text-xs py-1 px-2.5">
                        {ba.branch.name} ({ba.branch.code || "Code N/A"})
                      </Badge>
                    ))
                  ) : detailsModalEmployee.branch ? (
                    <Badge variant="secondary" className="text-xs py-1 px-2.5">
                      {detailsModalEmployee.branch.name}
                    </Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">No specific branch assigned.</span>
                  )}
                </div>
              </div>

              {/* Emergency Contact */}
              {(detailsModalEmployee.emergencyContactName || detailsModalEmployee.emergencyContactPhone) && (
                <div className="p-3.5 rounded-lg border border-amber-500/20 bg-amber-500/5 space-y-1 text-xs">
                  <h4 className="font-bold text-amber-700 dark:text-amber-400">
                    Emergency Contact: {detailsModalEmployee.emergencyContactName} ({detailsModalEmployee.emergencyContactRelationship || "Relation N/A"})
                  </h4>
                  <p className="text-muted-foreground">Phone: {detailsModalEmployee.emergencyContactPhone}</p>
                </div>
              )}

              {/* Document Link */}
              {detailsModalEmployee.birthCertificateUrl && (
                <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/20 text-xs">
                  <div className="flex items-center gap-2">
                    <ExternalLink className="h-4 w-4 text-emerald-600" />
                    <span>Birth Certificate / ID Document attached</span>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      downloadPrivateAsset(
                        `/employees/${detailsModalEmployee.id}/document/birthCertificate`,
                        `${detailsModalEmployee.name.replace(/\s+/g, "_")}_birth_certificate`,
                      )
                    }
                    className="font-medium text-emerald-600 hover:underline cursor-pointer"
                  >
                    Download Document
                  </button>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* ========================================================================= */}
      {/* RESET PASSWORD MODAL */}
      {/* ========================================================================= */}
      {resetModalInfo && (
        <Dialog open={!!resetModalInfo} onOpenChange={() => setResetModalInfo(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-amber-600">
                <Key className="h-5 w-5" />
                Temporary Password Generated
              </DialogTitle>
              <DialogDescription>
                A new secure password has been generated for {resetModalInfo.name}.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 pt-2">
              <div className="p-4 rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/30 flex items-center justify-between">
                <span className="font-mono text-lg font-bold text-foreground tracking-wider">
                  {resetModalInfo.tempPass}
                </span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(resetModalInfo.tempPass)}
                  className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold flex items-center gap-1.5 transition"
                >
                  {hasCopiedPass ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {hasCopiedPass ? "Copied!" : "Copy"}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                Please share this temporary password with the employee. They will be required to change it on their next login.
              </p>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
