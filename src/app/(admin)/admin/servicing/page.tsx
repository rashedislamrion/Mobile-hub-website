"use client";

import { useEffect, useState, useCallback } from "react";
import { 
  Wrench, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Phone, 
  User, 
  Smartphone, 
  Loader2, 
  RefreshCw,
  Search,
  Filter,
  Eye,
  Edit,
  Trash2,
  Calendar,
  Layers,
  MapPin,
  Tag,
  Receipt,
  PlusCircle,
  X,
  Sparkles,
  Truck,
  Building2,
  Calculator,
  Package,
  DollarSign,
  FileText,
  CreditCard
} from "lucide-react";
import { apiGet, apiPatch, apiDelete } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { AdminTableState } from "@/components/admin/AdminTableState";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useStaffAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

// Reuse interfaces
interface ServiceJob {
  id: string;
  orderId?: string | null;
  invoiceNo?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  device: string;
  model?: string | null;
  deviceType?: { id: string; name: string } | null;
  brand?: { id: string; name: string } | null;
  issueDescription: string;
  laborCost?: number | string;
  materialCost?: number | string;
  totalBill?: number | string;
  discount?: number | string;
  finalAmount?: number | string;
  paidAmount?: number | string;
  dueAmount?: number | string;
  serviceCharge: number;
  technicianProfitShare?: number | string | null;
  supplierId?: string | null;
  supplierPaymentStatus?: string | null;
  supplier?: { id: string; name: string; phone?: string; companyName?: string } | null;
  status: "PENDING" | "IN_PROGRESS" | "READY_FOR_PICKUP" | "DELIVERED" | "CANCELLED";
  createdAt: string;
  updatedAt: string;
  materials?: any[];
  customer?: any;
  order?: any;
  technician?: any;
}

const statusColors = {
  PENDING: "bg-amber-100 text-amber-700 border-amber-200",
  IN_PROGRESS: "bg-blue-100 text-blue-700 border-blue-200",
  READY_FOR_PICKUP: "bg-purple-100 text-purple-700 border-purple-200",
  DELIVERED: "bg-emerald-100 text-emerald-700 border-emerald-200",
  CANCELLED: "bg-red-100 text-red-700 border-red-200",
};

const statusLabels = {
  PENDING: "Pending",
  IN_PROGRESS: "In Progress",
  READY_FOR_PICKUP: "Ready for Pickup",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};

const supplierPaymentStatusColors: Record<string, string> = {
  Paid: "bg-emerald-100 text-emerald-800 border-emerald-300",
  Due: "bg-red-100 text-red-800 border-red-300",
  Pending: "bg-amber-100 text-amber-800 border-amber-300",
};

export default function AdminServicingPage() {
  const { user, hasPermission } = useStaffAuth();
  const router = useRouter();

  const [jobs, setJobs] = useState<ServiceJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [branchFilter, setBranchFilter] = useState("ALL");
  const [technicianFilter, setTechnicianFilter] = useState("ALL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Dropdown data
  const [branches, setBranches] = useState<any[]>([]);
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);

  // View Modal
  const [selectedJob, setSelectedJob] = useState<ServiceJob | null>(null);
  const [viewModalOpen, setViewModalOpen] = useState(false);

  // Edit Modal
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editData, setEditData] = useState<any>({});

  // Delete Modal
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [jobToDelete, setJobToDelete] = useState<ServiceJob | null>(null);

  // Fetch dropdown data
  const fetchDropdownData = useCallback(async () => {
    try {
      const [branchRes, techRes, supRes] = await Promise.all([
        apiGet<any>("/branches"),
        apiGet<any>("/employees/technicians"),
        apiGet<any>("/suppliers?limit=100").catch(() => ({ data: [] }))
      ]);
      const branchList = Array.isArray(branchRes) ? branchRes : (branchRes?.data || []);
      setBranches(branchList);
      
      const techList = Array.isArray(techRes) ? techRes : (techRes?.data || []);
      setTechnicians(techList);

      const supList = Array.isArray(supRes) ? supRes : (supRes?.data || []);
      setSuppliers(supList);
    } catch (err) {
      console.error("Failed to load dropdown data", err);
    }
  }, []);

  // Fetch Jobs
  const fetchJobs = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: "20",
      });
      if (search) queryParams.append("search", search);
      if (statusFilter !== "ALL") queryParams.append("status", statusFilter);
      if (branchFilter !== "ALL") queryParams.append("branch", branchFilter);
      if (technicianFilter !== "ALL") queryParams.append("technicianId", technicianFilter);
      if (startDate) queryParams.append("startDate", startDate);
      if (endDate) queryParams.append("endDate", endDate);

      const res = await apiGet<any>(`/service-jobs?${queryParams.toString()}`);
      if (res && Array.isArray(res.data)) {
        setJobs(res.data);
        setTotalPages(res.meta?.totalPages || 1);
      } else if (Array.isArray(res)) {
        setJobs(res);
        setTotalPages(1);
      } else {
        setError("Failed to load service jobs");
      }
    } catch (err: any) {
      if (err.status === 403) {
        router.push("/admin/unauthorized");
      }
      setError(err?.message || "Failed to load service jobs");
      console.error("Failed to fetch service jobs:", err);
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, branchFilter, technicianFilter, startDate, endDate, router]);

  useEffect(() => {
    // Check permission
    if (user && user.role) {
      const isTech = user.role.name.toLowerCase().includes("technician");
      if (isTech) {
        router.push("/admin/unauthorized");
        return;
      }
      if (!hasPermission("SALES", "READ")) {
        router.push("/admin/unauthorized");
        return;
      }
      fetchDropdownData();
      fetchJobs();
    }
  }, [user, fetchJobs, fetchDropdownData, hasPermission, router]);

  // Handlers
  const handleView = (job: ServiceJob) => {
    setSelectedJob(job);
    setViewModalOpen(true);
  };

  const handleEdit = (job: ServiceJob) => {
    setSelectedJob(job);
    const totalBill = Number(job.totalBill || 0);
    const discount = Number(job.discount || 0);
    const laborCost = Number(job.laborCost || 0);
    const advancePayment = Number(job.paidAmount || 0);
    const finalAmount = Math.max(0, totalBill - discount);
    const dueAmount = Math.max(0, finalAmount - advancePayment);

    setEditData({
      status: job.status,
      device: job.device || "",
      issueDescription: job.issueDescription || "",
      laborCost,
      totalBill,
      discount,
      advancePayment,
      finalAmount,
      dueAmount,
      supplierId: job.supplierId || job.supplier?.id || "NONE",
      supplierPaymentStatus: job.supplierPaymentStatus || "Pending",
    });
    setEditModalOpen(true);
  };

  const handleFinancialChange = (field: string, rawVal: string | number) => {
    const val = typeof rawVal === "number" ? rawVal : (rawVal === "" ? 0 : Number(rawVal));
    setEditData((prev: any) => {
      const updated = { ...prev, [field]: val };
      const currentTotal = field === "totalBill" ? val : Number(updated.totalBill || 0);
      const currentDiscount = field === "discount" ? val : Number(updated.discount || 0);
      const currentPaid = field === "advancePayment" ? val : Number(updated.advancePayment || 0);

      const calculatedFinal = Math.max(0, currentTotal - currentDiscount);
      const calculatedDue = Math.max(0, calculatedFinal - currentPaid);

      return {
        ...updated,
        finalAmount: calculatedFinal,
        dueAmount: calculatedDue,
      };
    });
  };

  const handleSaveEdit = async () => {
    if (!selectedJob) return;
    try {
      const payload: any = {
        status: editData.status,
        device: editData.device,
        issueDescription: editData.issueDescription,
        laborCost: Number(editData.laborCost || 0),
        totalBill: Number(editData.totalBill || 0),
        discount: Number(editData.discount || 0),
        advancePayment: Number(editData.advancePayment || 0),
        dueAmount: Number(editData.dueAmount || 0),
        supplierId: editData.supplierId === "NONE" ? null : (editData.supplierId || null),
        supplierPaymentStatus: editData.supplierPaymentStatus || "Pending",
      };

      const res = await apiPatch<any>(`/service-jobs/${selectedJob.id}`, payload);
      toast.success("Service job updated successfully");
      setEditModalOpen(false);
      if (res) setSelectedJob(res);
      fetchJobs();
    } catch (err: any) {
      toast.error(err?.message || "Failed to update service job");
    }
  };

  const handleDelete = (job: ServiceJob) => {
    setJobToDelete(job);
    setDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!jobToDelete) return;
    try {
      await apiDelete(`/service-jobs/${jobToDelete.id}`);
      toast.success("Service job deleted successfully");
      setDeleteModalOpen(false);
      fetchJobs();
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete service job");
    }
  };

  if (!user) return null;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Wrench className="w-6 h-6 text-emerald-600" />
            Servicing Management
          </h1>
          <p className="text-slate-500 mt-1">Manage all service jobs across branches and technicians.</p>
        </div>
        <Button onClick={() => router.push("/admin/servicing/create")} className="bg-emerald-600 hover:bg-emerald-700">
          <PlusCircle className="w-4 h-4 mr-2" />
          New Service Job
        </Button>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row flex-wrap gap-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input 
            placeholder="Search invoice, customer, device..." 
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchJobs()}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Status</SelectItem>
            {Object.entries(statusLabels).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        {(user?.role?.scope === 'GLOBAL' || (user as any)?.roleScope === 'GLOBAL') && (
          <Select value={branchFilter} onValueChange={setBranchFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Branch" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Branches</SelectItem>
              {branches.map(b => (
                <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Select value={technicianFilter} onValueChange={setTechnicianFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Technician" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Techs</SelectItem>
            {technicians.map(t => (
              <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2">
          <Input 
            type="date" 
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-[140px]"
            title="Start Date"
          />
          <span className="text-slate-400">-</span>
          <Input 
            type="date" 
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-[140px]"
            title="End Date"
          />
        </div>

        <Button variant="outline" onClick={fetchJobs} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <AdminTableState
          isLoading={loading}
          error={error}
          isEmpty={jobs.length === 0}
          onRetry={fetchJobs}
          loadingRows={5}
          emptyTitle="No service jobs found"
          emptyDescription="Adjust your filters or create a new job."
          emptyActionLabel="Create New Job"
          onEmptyAction={() => router.push("/admin/servicing/create")}
          emptyIcon={<Wrench className="w-8 h-8 text-slate-300" />}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-medium">Job Details</th>
                  <th className="px-4 py-3 font-medium">Customer</th>
                  <th className="px-4 py-3 font-medium">Technician</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium text-right">Billing & Cost</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {jobs.map((job) => (
                  <tr key={job.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800">{job.invoiceNo || 'N/A'}</div>
                      <div className="text-slate-500 text-xs mt-0.5">{job.device}</div>
                      <div className="text-slate-400 text-xs mt-0.5 max-w-[200px] truncate">{job.issueDescription}</div>
                      <div className="text-slate-400 text-xs mt-1">{new Date(job.createdAt).toLocaleDateString()}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-slate-400" />
                        <span className="font-medium text-slate-700">{job.customerName || job.customer?.name || 'Walk-in'}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <Phone className="w-3 h-3 text-slate-400" />
                        <span className="text-xs text-slate-500">{job.customerPhone || job.customer?.phone || 'No phone'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {job.technician ? (
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-xs">
                            {job.technician.name.charAt(0)}
                          </div>
                          <span className="text-slate-700">{job.technician.name}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">Unassigned</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className={statusColors[job.status] || "bg-slate-100 text-slate-700"}>
                        {statusLabels[job.status] || job.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="font-medium text-slate-800">Bill: ৳{Number(job.finalAmount || 0).toLocaleString()}</div>
                      <div className="text-slate-500 text-xs mt-0.5">Mat. Cost: ৳{Number(job.materialCost || 0).toLocaleString()}</div>
                      <div className="text-emerald-600 text-xs mt-0.5 font-medium">Profit: ৳{Math.max(0, Number(job.finalAmount || 0) - Number(job.materialCost || 0)).toLocaleString()}</div>
                      <div className="text-slate-400 text-xs mt-0.5">
                        Pay: {job.order?.payments?.length ? Array.from(new Set(job.order.payments.map((p: any) => p.paymentMethod || p.method).filter(Boolean))).join(", ") : (job.order?.paymentMethod || "N/A")}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => handleView(job)} className="text-slate-500 hover:text-emerald-600 hover:bg-emerald-50">
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(job)} className="text-slate-500 hover:text-blue-600 hover:bg-blue-50">
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(job)} className="text-slate-500 hover:text-red-600 hover:bg-red-50">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AdminTableState>
      </div>

      {/* Detail Modal */}
      <Dialog open={viewModalOpen} onOpenChange={setViewModalOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0 gap-0 rounded-2xl border-slate-200">
          {selectedJob && (
            <div>
              {/* Modal Header */}
              <div className="p-6 border-b border-slate-100 bg-white sticky top-0 z-10">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200/80 flex items-center justify-center text-emerald-600 shadow-xs">
                      <Wrench className="w-5 h-5" />
                    </div>
                    <div>
                      <DialogTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
                        Service Job Details
                        <Badge variant="outline" className="font-mono text-xs bg-slate-100 text-slate-700 border-slate-200">
                          {selectedJob.invoiceNo || 'N/A'}
                        </Badge>
                      </DialogTitle>
                      <DialogDescription className="text-xs text-slate-500 mt-0.5">
                        Created on {new Date(selectedJob.createdAt).toLocaleDateString()} at {new Date(selectedJob.createdAt).toLocaleTimeString()}
                      </DialogDescription>
                    </div>
                  </div>
                  <Badge variant="outline" className={`px-3 py-1 font-semibold text-xs rounded-full ${statusColors[selectedJob.status] || "bg-slate-100 text-slate-700"}`}>
                    {statusLabels[selectedJob.status] || selectedJob.status}
                  </Badge>
                </div>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-5 bg-slate-50/50">
                {/* 2-Column Info Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Job Information */}
                  <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs space-y-3">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-2">
                      <Layers className="w-4 h-4 text-emerald-600" />
                      Job Information
                    </div>
                    <div className="space-y-2.5 text-sm">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">Invoice No:</span>
                        <span className="font-mono font-medium text-slate-800">{selectedJob.invoiceNo || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">Status:</span>
                        <Badge variant="outline" className={`text-xs ${statusColors[selectedJob.status]}`}>
                          {statusLabels[selectedJob.status] || selectedJob.status}
                        </Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">Technician:</span>
                        {selectedJob.technician ? (
                          <div className="flex items-center gap-1.5 font-medium text-slate-800">
                            <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-[10px] font-bold">
                              {selectedJob.technician.name.charAt(0)}
                            </div>
                            <span>{selectedJob.technician.name}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Unassigned</span>
                        )}
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">Created:</span>
                        <span className="text-xs text-slate-700 font-medium">{new Date(selectedJob.createdAt).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* Customer & Device */}
                  <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs space-y-3">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-2">
                      <User className="w-4 h-4 text-emerald-600" />
                      Customer & Device
                    </div>
                    <div className="space-y-2.5 text-sm">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">Customer:</span>
                        <span className="font-medium text-slate-800">{selectedJob.customerName || selectedJob.customer?.name || 'Walk-in'}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">Phone:</span>
                        <span className="text-slate-800 font-mono text-xs">{selectedJob.customerPhone || selectedJob.customer?.phone || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">Device:</span>
                        <span className="font-medium text-slate-800">{selectedJob.device}</span>
                      </div>
                      <div className="pt-1">
                        <span className="text-xs text-slate-400 block mb-1">Issue Description:</span>
                        <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/70 text-xs text-slate-700 font-medium">
                          {selectedJob.issueDescription}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Sourcing & Supplier Info Card */}
                <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                      <Truck className="w-4 h-4 text-emerald-600" />
                      Supplier Sourcing & Vendor Info
                    </div>
                    <span className="text-[11px] text-slate-400">Outsourced / Supplier Attribution</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm pt-1">
                    <div className="flex items-start justify-between sm:justify-start gap-4 p-3 rounded-lg bg-slate-50 border border-slate-100">
                      <div>
                        <span className="text-xs text-slate-500 block mb-0.5">Assigned Supplier</span>
                        {selectedJob.supplier ? (
                          <div className="font-medium text-slate-800 flex items-center gap-1.5">
                            <Building2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>{selectedJob.supplier.name}</span>
                            {selectedJob.supplier.phone && (
                              <span className="text-xs text-slate-400 font-mono">({selectedJob.supplier.phone})</span>
                            )}
                          </div>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-200/70 text-slate-600">
                            In-house / No Supplier
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-start justify-between sm:justify-start gap-4 p-3 rounded-lg bg-slate-50 border border-slate-100">
                      <div>
                        <span className="text-xs text-slate-500 block mb-0.5">Supplier Payment Status</span>
                        {selectedJob.supplierPaymentStatus ? (
                          <Badge variant="outline" className={`text-xs font-semibold ${supplierPaymentStatusColors[selectedJob.supplierPaymentStatus] || "bg-slate-100 text-slate-700"}`}>
                            {selectedJob.supplierPaymentStatus}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs bg-slate-100 text-slate-500">
                            Pending
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Financial Breakdown */}
                <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs space-y-3">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-2">
                    <Receipt className="w-4 h-4 text-emerald-600" />
                    Financial Breakdown & Billing
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Labor Cost:</span>
                      <span className="font-medium text-slate-800 font-mono">৳{Number(selectedJob.laborCost || 0).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Material Cost:</span>
                      <span className="font-medium text-slate-800 font-mono">৳{Number(selectedJob.materialCost || 0).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center border-t border-slate-100 pt-2">
                      <span className="text-slate-700 font-medium">Total Bill:</span>
                      <span className="font-bold text-slate-800 font-mono">৳{Number(selectedJob.totalBill || 0).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center text-red-500">
                      <span>Discount Applied:</span>
                      <span className="font-mono font-medium">-৳{Number(selectedJob.discount || 0).toLocaleString()}</span>
                    </div>

                    {/* Final Amount Highlight Box */}
                    <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200/90 flex justify-between items-center my-2">
                      <div>
                        <span className="text-xs font-semibold uppercase tracking-wider text-emerald-800 block">Final Bill Amount</span>
                        <span className="text-[11px] text-emerald-600">Total Bill − Discount</span>
                      </div>
                      <span className="font-bold text-emerald-700 text-xl font-mono">৳{Number(selectedJob.finalAmount || 0).toLocaleString()}</span>
                    </div>

                    <div className="flex justify-between items-center pt-1">
                      <span className="text-slate-500">Paid Amount (Advance):</span>
                      <span className="font-medium text-slate-800 font-mono">৳{Number(selectedJob.paidAmount || 0).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Due Amount:</span>
                      <span className={`font-bold font-mono ${Number(selectedJob.dueAmount) > 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                        ৳{Number(selectedJob.dueAmount || 0).toLocaleString()}
                      </span>
                    </div>

                    {Number(selectedJob.technicianProfitShare) > 0 && (
                      <div className="flex justify-between items-center mt-3 pt-3 border-t border-slate-100 bg-amber-50/50 p-2.5 rounded-lg border border-amber-200/60">
                        <span className="text-slate-700 text-xs font-medium flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-amber-500"/> Technician Profit Share:
                        </span>
                        <span className="font-bold text-amber-700 font-mono text-sm">৳{Number(selectedJob.technicianProfitShare).toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Parts & Materials Used */}
                {selectedJob.materials && selectedJob.materials.length > 0 && (
                  <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs space-y-3">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-2">
                      <Package className="w-4 h-4 text-emerald-600" />
                      Parts & Materials Used ({selectedJob.materials.length})
                    </div>
                    <div className="space-y-2">
                      {selectedJob.materials.map((m: any) => (
                        <div key={m.id} className="p-3 rounded-lg bg-slate-50/80 border border-slate-200/70 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div>
                            <div className="font-semibold text-slate-800 text-sm">{m.partName}</div>
                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                              {m.sourceType === "OTHER" ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                  Sourced From Outside: {m.sourcedFromName || "Ad-hoc"}
                                </span>
                              ) : m.sourceType === "SUPPLIER" || m.supplier ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                                  From Supplier: {m.supplier?.name || "Registered"}
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                  From Own Stock
                                </span>
                              )}
                              {m.sourceNote && (
                                <span className="text-[11px] text-slate-500 italic">({m.sourceNote})</span>
                              )}
                            </div>
                          </div>
                          <div className="text-right font-mono sm:self-center">
                            <span className="text-slate-500">{m.quantity} × ৳{Number(m.cost || 0).toLocaleString()} = </span>
                            <strong className="text-slate-800 font-bold text-sm">৳{Number(m.total || (Number(m.cost || 0) * Number(m.quantity || 1))).toLocaleString()}</strong>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-slate-100 bg-white flex justify-end">
                <Button variant="outline" onClick={() => setViewModalOpen(false)}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Modal */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto p-0 gap-0 rounded-2xl border-slate-200">
          {selectedJob && (
            <div>
              {/* Modal Header */}
              <div className="p-6 border-b border-slate-100 bg-white sticky top-0 z-10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200/80 flex items-center justify-center text-blue-600 shadow-xs">
                      <Edit className="w-5 h-5" />
                    </div>
                    <div>
                      <DialogTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
                        Edit Service Job
                        <Badge variant="outline" className="font-mono text-xs bg-slate-100 text-slate-700 border-slate-200">
                          {selectedJob.invoiceNo || 'N/A'}
                        </Badge>
                      </DialogTitle>
                      <DialogDescription className="text-xs text-slate-500 mt-0.5">
                        Update job status, supplier sourcing, and pricing with real-time live discount calculation.
                      </DialogDescription>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-5 bg-slate-50/50">
                {/* Section 1: Job & Device Information */}
                <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs space-y-4">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-2">
                    <Layers className="w-4 h-4 text-emerald-600" />
                    Job Status & Device
                  </div>
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-slate-700">Status</label>
                      <Select value={editData.status} onValueChange={(val) => setEditData({...editData, status: val})}>
                        <SelectTrigger className="w-full bg-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(statusLabels).map(([key, label]) => (
                            <SelectItem key={key} value={key}>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className={`text-[11px] ${statusColors[key as keyof typeof statusColors]}`}>
                                  {label}
                                </Badge>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-slate-700">Device / Model</label>
                      <Input 
                        value={editData.device || ""} 
                        onChange={(e) => setEditData({...editData, device: e.target.value})} 
                        className="bg-white"
                        placeholder="e.g. iPhone 13 Pro Max"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-slate-700">Issue Description</label>
                      <Input 
                        value={editData.issueDescription || ""} 
                        onChange={(e) => setEditData({...editData, issueDescription: e.target.value})} 
                        className="bg-white"
                        placeholder="Describe the issue reported by the customer"
                      />
                    </div>
                  </div>
                </div>

                {/* Section 2: Supplier Sourcing & Payment Status */}
                <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                      <Truck className="w-4 h-4 text-emerald-600" />
                      Supplier & Sourcing Information
                    </div>
                    <span className="text-[11px] text-slate-400">Job-level attribution</span>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Supplier Dropdown */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-slate-700 flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-slate-400" />
                        Supplier
                      </label>
                      <Select 
                        value={editData.supplierId || "NONE"} 
                        onValueChange={(val) => setEditData({ ...editData, supplierId: val })}
                      >
                        <SelectTrigger className="bg-white">
                          <SelectValue placeholder="Select supplier" />
                        </SelectTrigger>
                        <SelectContent className="max-h-60">
                          <SelectItem value="NONE">
                            <span className="text-slate-500 italic">No Supplier (In-house)</span>
                          </SelectItem>
                          {suppliers.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              <div className="flex items-center gap-1.5">
                                <span className="font-medium text-slate-800">{s.name}</span>
                                {s.phone && <span className="text-xs text-slate-400 font-mono">({s.phone})</span>}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-[11px] text-slate-400">Registered supplier who sourced parts or outsourced service.</p>
                    </div>

                    {/* Supplier Payment Status */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-slate-700 flex items-center gap-1.5">
                        <CreditCard className="w-3.5 h-3.5 text-slate-400" />
                        Supplier Payment Status
                      </label>
                      <Select 
                        value={editData.supplierPaymentStatus || "Pending"} 
                        onValueChange={(val) => setEditData({ ...editData, supplierPaymentStatus: val })}
                      >
                        <SelectTrigger className="bg-white">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Paid">
                            <div className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-emerald-500" />
                              <span className="font-medium text-emerald-700">Paid</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="Due">
                            <div className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-red-500" />
                              <span className="font-medium text-red-700">Due</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="Pending">
                            <div className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-amber-500" />
                              <span className="font-medium text-amber-700">Pending</span>
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-[11px] text-slate-400">Payment status to the supplier for this job.</p>
                    </div>
                  </div>
                </div>

                {/* Section 3: Financials & Live Pricing Calculator */}
                <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                      <Calculator className="w-4 h-4 text-emerald-600" />
                      Financials & Live Pricing Calculator
                    </div>
                    <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px] font-mono">
                      Live Calculator
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-slate-700">Labor Cost (৳)</label>
                      <Input 
                        type="number" 
                        min="0"
                        value={editData.laborCost} 
                        onChange={(e) => handleFinancialChange('laborCost', e.target.value)} 
                        className="bg-white font-mono"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-slate-700">Total Bill (৳)</label>
                      <Input 
                        type="number" 
                        min="0"
                        value={editData.totalBill} 
                        onChange={(e) => handleFinancialChange('totalBill', e.target.value)} 
                        className="bg-white font-mono font-medium"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-slate-700 flex items-center justify-between">
                        <span>Discount (৳)</span>
                        <span className="text-[10px] text-emerald-600 font-semibold">Live Deducted</span>
                      </label>
                      <Input 
                        type="number" 
                        min="0"
                        value={editData.discount} 
                        onChange={(e) => handleFinancialChange('discount', e.target.value)} 
                        className="bg-white font-mono text-red-600 font-medium"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-slate-700">Paid Amount / Advance (৳)</label>
                      <Input 
                        type="number" 
                        min="0"
                        value={editData.advancePayment} 
                        onChange={(e) => handleFinancialChange('advancePayment', e.target.value)} 
                        className="bg-white font-mono"
                      />
                    </div>
                  </div>

                  {/* Live Calculation Display Card */}
                  <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-50/90 to-teal-50/70 border border-emerald-200/90 space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-emerald-900 flex items-center gap-1.5">
                        <Calculator className="w-3.5 h-3.5 text-emerald-600" />
                        Live Formula Calculation
                      </span>
                      <span className="font-mono text-[11px] text-emerald-700">
                        ৳{Number(editData.totalBill || 0).toLocaleString()} − ৳{Number(editData.discount || 0).toLocaleString()}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <div className="bg-white p-3 rounded-lg border border-emerald-100 shadow-xs">
                        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                          Final Amount (Live)
                        </span>
                        <span className="text-xl font-bold text-emerald-700 font-mono block mt-0.5">
                          ৳{Number(editData.finalAmount || 0).toLocaleString()}
                        </span>
                      </div>

                      <div className="bg-white p-3 rounded-lg border border-slate-200/80 shadow-xs">
                        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                          Due Amount (Live)
                        </span>
                        <span className={`text-xl font-bold font-mono block mt-0.5 ${Number(editData.dueAmount || 0) > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                          ৳{Number(editData.dueAmount || 0).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-slate-100 bg-white flex items-center justify-end gap-2">
                <Button variant="outline" onClick={() => setEditModalOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSaveEdit} className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  Save Changes
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-600">Delete Service Job</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {jobToDelete?.invoiceNo}? This action cannot be undone. All associated materials, payments, and order data will be permanently removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteModalOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete}>Delete Job</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
