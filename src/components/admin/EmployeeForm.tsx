"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { toast } from "sonner";
import {
  User,
  Upload,
  Key,
  Shield,
  Briefcase,
  Building2,
  PhoneCall,
  FileText,
  X,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Percent,
  Sparkles,
  RefreshCw,
} from "lucide-react";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { apiGet, apiPost, apiPatch, getStaffToken, API_BASE_URL } from "@/lib/api-client";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";

const formSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().min(6, "Valid phone number is required"),
  address: z.string().optional(),
  gender: z.string().optional(),
  dob: z.string().optional(),
  nid: z.string().optional(),

  password: z.string().optional(),
  sendCredentialsEmail: z.boolean().default(false),
  adminPanelAccess: z.boolean().default(false),
  isActive: z.boolean().default(true),

  departmentId: z.string().optional(),
  roleId: z.string().min(1, "Role is required"),
  joiningDate: z.string().optional(),
  employmentType: z.enum(["FULL_TIME", "PART_TIME", "CONTRACT", "INTERN"]).default("FULL_TIME"),
  reportingManagerId: z.string().optional(),
  basicSalary: z.coerce.number().min(0).default(0),
  bonusLimit: z.coerce.number().min(0).default(0),

  branchIds: z.array(z.string()).default([]),

  isTechnician: z.boolean().default(false),
  commissionRate: z.coerce.number().min(0).max(100).default(0),

  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  emergencyContactRelationship: z.string().optional(),
});

type EmployeeFormValues = z.infer<typeof formSchema>;

interface EmployeeFormProps {
  initialData?: any;
  isEdit?: boolean;
}

export function EmployeeForm({ initialData, isEdit }: EmployeeFormProps) {
  const router = useRouter();

  const [departments, setDepartments] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [managers, setManagers] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // File upload state & previews
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(initialData?.photo || null);
  const [certFile, setCertFile] = useState<File | null>(null);
  const [certPreview, setCertPreview] = useState<string | null>(initialData?.birthCertificateUrl || null);

  const photoInputRef = useRef<HTMLInputElement>(null);
  const certInputRef = useRef<HTMLInputElement>(null);

  const initialBranchIds: string[] = initialData?.branchAccess?.map((b: any) => b.branchId) ||
    (initialData?.branchId ? [initialData.branchId] : []);

  const form = useForm<EmployeeFormValues>({
    resolver: zodResolver(formSchema) as any,
    defaultValues: {
      name: initialData?.name || "",
      email: initialData?.email || "",
      phone: initialData?.phone || "",
      address: initialData?.address || "",
      gender: initialData?.gender || "Male",
      dob: initialData?.dob
        ? new Date(initialData.dob).toISOString().split("T")[0]
        : "",
      nid: initialData?.nidNumber || "",

      password: "",
      sendCredentialsEmail: initialData?.sendCredentialsEmailOnCreate || false,
      adminPanelAccess: initialData?.adminPanelAccess || false,
      isActive: initialData ? initialData.status === "ACTIVE" : true,

      departmentId: initialData?.departmentId || initialData?.department?.id || "",
      roleId: initialData?.roleId || initialData?.role?.id || "",
      joiningDate: initialData?.joiningDate
        ? new Date(initialData.joiningDate).toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0],
      employmentType: initialData?.employmentType || "FULL_TIME",
      reportingManagerId: initialData?.reportingManagerId || "",
      basicSalary: initialData?.basicSalary ? Number(initialData.basicSalary) : 0,
      bonusLimit: initialData?.bonusLimit ? Number(initialData.bonusLimit) : 0,

      branchIds: initialBranchIds,

      isTechnician: initialData?.isTechnician || false,
      commissionRate: initialData?.commissionRate ? Number(initialData.commissionRate) : 0,

      emergencyContactName: initialData?.emergencyContactName || "",
      emergencyContactPhone: initialData?.emergencyContactPhone || "",
      emergencyContactRelationship: initialData?.emergencyContactRelationship || "",
    },
  });

  const isTechnicianWatch = form.watch("isTechnician");
  const selectedBranchIds = form.watch("branchIds");

  const [lookupErrors, setLookupErrors] = useState<string | null>(null);
  const [isLoadingLookups, setIsLoadingLookups] = useState(false);

  const loadLookups = async () => {
    try {
      setIsLoadingLookups(true);
      setLookupErrors(null);
      const [deptRes, roleRes, branchRes, mgrRes] = await Promise.all([
        apiGet<any[]>("/departments"),
        apiGet<any[]>("/roles"),
        apiGet<any[]>("/branches"),
        apiGet<{ data: any[] }>("/employees?limit=100"),
      ]);
      setDepartments(Array.isArray(deptRes) ? deptRes : []);
      setRoles(Array.isArray(roleRes) ? roleRes : []);
      setBranches(Array.isArray(branchRes) ? branchRes : []);
      const allEmp = mgrRes?.data || (Array.isArray(mgrRes) ? mgrRes : []);
      setManagers(allEmp.filter((e: any) => e.id !== initialData?.id));
    } catch (err: any) {
      console.error("Failed to load employee metadata:", err);
      setLookupErrors("Failed to load departments, roles or branches. Please retry.");
      toast.error("Failed to load employee configuration data");
    } finally {
      setIsLoadingLookups(false);
    }
  };

  useEffect(() => {
    loadLookups();
  }, [initialData?.id]);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const handleCertChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCertFile(file);
      setCertPreview(URL.createObjectURL(file));
    }
  };

  const toggleBranch = (branchId: string) => {
    const current = form.getValues("branchIds") || [];
    if (current.includes(branchId)) {
      form.setValue(
        "branchIds",
        current.filter((id) => id !== branchId),
      );
    } else {
      form.setValue("branchIds", [...current, branchId]);
    }
  };

  const selectAllBranches = () => {
    form.setValue(
      "branchIds",
      branches.map((b) => b.id),
    );
  };

  const clearAllBranches = () => {
    form.setValue("branchIds", []);
  };

  const onSubmit = async (values: EmployeeFormValues) => {
    try {
      setIsSubmitting(true);

      const formData = new FormData();
      formData.append("name", values.name);
      formData.append("email", values.email);
      formData.append("phone", values.phone);
      if (values.address) formData.append("address", values.address);
      if (values.gender) formData.append("gender", values.gender);
      if (values.dob) formData.append("dob", values.dob);
      if (values.nid) formData.append("nidNumber", values.nid);

      if (values.password && values.password.trim().length > 0) {
        formData.append("password", values.password);
      }
      formData.append("sendCredentialsEmail", String(values.sendCredentialsEmail));
      formData.append("adminPanelAccess", String(values.adminPanelAccess));
      formData.append("status", values.isActive ? "ACTIVE" : "INACTIVE");

      if (values.departmentId) formData.append("departmentId", values.departmentId);
      formData.append("roleId", values.roleId);
      if (values.joiningDate) formData.append("joiningDate", values.joiningDate);
      formData.append("employmentType", values.employmentType);
      if (values.reportingManagerId) formData.append("reportingManagerId", values.reportingManagerId);
      formData.append("basicSalary", String(values.basicSalary));
      formData.append("bonusLimit", String(values.bonusLimit));

      values.branchIds.forEach((bId) => {
        formData.append("branchIds[]", bId);
      });

      formData.append("isTechnician", String(values.isTechnician));
      formData.append("commissionRate", String(values.commissionRate));

      if (values.emergencyContactName) formData.append("emergencyContactName", values.emergencyContactName);
      if (values.emergencyContactPhone) formData.append("emergencyContactPhone", values.emergencyContactPhone);
      if (values.emergencyContactRelationship) formData.append("emergencyContactRelationship", values.emergencyContactRelationship);

      if (photoFile) {
        formData.append("profilePhoto", photoFile);
      }
      if (certFile) {
        formData.append("birthCertificate", certFile);
      }

      // If no files attached, we can also send JSON payload or standard FormData
      // Our apiPost/apiPatch can accept FormData directly
      const url = isEdit ? `/employees/${initialData.id}` : "/employees";

      const token = getStaffToken();
      const res = await fetch(`${API_BASE_URL}${url}`, {
        method: isEdit ? "PATCH" : "POST",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: formData,
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || "Failed to save employee");
      }

      toast.success(isEdit ? "Employee updated successfully!" : "Employee created successfully!");
      router.push("/admin/hrm/employees");
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "Something went wrong while saving employee");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <User className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            {isEdit ? "Edit Employee" : "Add New Employee"}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isEdit
              ? `Update employee credentials, branch privileges, and job information for ${initialData?.name || ""}.`
              : "Register a new team member with granular branch permissions and technician settings."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => router.push("/admin/hrm/employees")}
            className="px-4 py-2 text-sm font-medium border border-border rounded-lg bg-background hover:bg-muted text-foreground transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={form.handleSubmit(onSubmit)}
            disabled={isSubmitting}
            className="px-5 py-2 text-sm font-medium rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm flex items-center gap-2 transition-colors disabled:opacity-50"
          >
            {isSubmitting ? (
              <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            {isEdit ? "Update Employee" : "Save Employee"}
          </button>
        </div>
      </div>

      {lookupErrors && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 flex items-center justify-between text-rose-800 text-xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{lookupErrors}</span>
          </div>
          <button
            type="button"
            onClick={loadLookups}
            disabled={isLoadingLookups}
            className="flex items-center gap-1 px-3 py-1 bg-white border border-rose-200 text-rose-700 rounded-md font-medium hover:bg-rose-50 transition-colors"
          >
            <RefreshCw className={`w-3 h-3 ${isLoadingLookups ? "animate-spin" : ""}`} /> Retry
          </button>
        </div>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* ========================================================================= */}
          {/* CARD 1: Basic Information & Documents */}
          {/* ========================================================================= */}
          <div className="rounded-xl border border-border bg-card shadow-sm p-6 space-y-6">
            <div className="flex items-center gap-2.5 border-b border-border pb-3">
              <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
                <User className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-foreground">Basic Information</h3>
                <p className="text-xs text-muted-foreground">Personal contact, identity, and profile photos</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Left 2 Cols: Form Fields */}
              <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem className="sm:col-span-2">
                      <FormLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Full Name <span className="text-red-500">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Tanvir Ahmed" {...field} className="h-10" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Email Address <span className="text-red-500">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="e.g. tanvir@company.com" {...field} className="h-10" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Phone Number <span className="text-red-500">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input placeholder="01XXXXXXXXX" {...field} className="h-10" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem className="sm:col-span-2">
                      <FormLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Residential Address
                      </FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. House 12, Road 4, Sector 7, Uttara, Dhaka" {...field} className="h-10" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="gender"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Gender
                      </FormLabel>
                      <FormControl>
                        <select
                          {...field}
                          className="w-full h-10 px-3 py-2 text-sm rounded-md border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                        >
                          <option value="Male">Male</option>
                          <option value="Female">Female</option>
                          <option value="Other">Other</option>
                        </select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="dob"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Date of Birth
                      </FormLabel>
                      <FormControl>
                        <Input type="date" {...field} className="h-10" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="nid"
                  render={({ field }) => (
                    <FormItem className="sm:col-span-2">
                      <FormLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        National ID (NID) / Passport No
                      </FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. 19962691234567890" {...field} className="h-10" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Right Col: Dropzones */}
              <div className="space-y-4">
                {/* 1:1 Profile Photo */}
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-1.5">
                    Profile Photo (1:1 Ratio)
                  </label>
                  <div
                    onClick={() => photoInputRef.current?.click()}
                    className="relative border-2 border-dashed border-border rounded-xl p-4 flex flex-col items-center justify-center text-center cursor-pointer hover:border-emerald-500 hover:bg-emerald-50/20 dark:hover:bg-emerald-950/10 transition-all aspect-square max-w-[220px] mx-auto overflow-hidden group bg-muted/20"
                  >
                    {photoPreview ? (
                      <>
                        <img
                          src={photoPreview}
                          alt="Photo Preview"
                          className="w-full h-full object-cover rounded-lg"
                        />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPhotoFile(null);
                            setPhotoPreview(null);
                          }}
                          className="absolute top-2 right-2 p-1 bg-red-600 text-white rounded-full shadow hover:bg-red-700 transition"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </>
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <div className="p-3 rounded-full bg-muted group-hover:bg-emerald-100 dark:group-hover:bg-emerald-900/40 group-hover:text-emerald-600 transition-colors">
                          <Upload className="h-6 w-6" />
                        </div>
                        <span className="text-xs font-medium">Click to upload photo</span>
                        <span className="text-[10px] text-muted-foreground">PNG, JPG up to 5MB</span>
                      </div>
                    )}
                    <input
                      ref={photoInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoChange}
                      className="hidden"
                    />
                  </div>
                </div>

                {/* Birth Certificate / ID Document */}
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-1.5">
                    Birth Certificate / ID Document
                  </label>
                  <div
                    onClick={() => certInputRef.current?.click()}
                    className="relative border-2 border-dashed border-border rounded-xl p-3 flex items-center justify-between cursor-pointer hover:border-emerald-500 hover:bg-emerald-50/20 dark:hover:bg-emerald-950/10 transition-all bg-muted/20"
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div className="p-2 rounded-lg bg-muted text-muted-foreground shrink-0">
                        <FileText className="h-5 w-5" />
                      </div>
                      <div className="text-left overflow-hidden">
                        <p className="text-xs font-medium text-foreground truncate">
                          {certFile ? certFile.name : certPreview ? "Document attached" : "Upload Document"}
                        </p>
                        <p className="text-[10px] text-muted-foreground">PDF or Image up to 10MB</p>
                      </div>
                    </div>
                    {certPreview ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setCertFile(null);
                          setCertPreview(null);
                        }}
                        className="p-1 text-muted-foreground hover:text-red-500"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    ) : (
                      <Upload className="h-4 w-4 text-muted-foreground shrink-0" />
                    )}
                    <input
                      ref={certInputRef}
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={handleCertChange}
                      className="hidden"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* CARD 2: Authentication & Access Control */}
          {/* ========================================================================= */}
          <div className="rounded-xl border border-border bg-card shadow-sm p-6 space-y-6">
            <div className="flex items-center gap-2.5 border-b border-border pb-3">
              <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
                <Key className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-foreground">Authentication & Access Control</h3>
                <p className="text-xs text-muted-foreground">Credentials and admin portal login gates</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-1">
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {isEdit ? "New Password (Optional)" : "Temporary Password"}
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder={isEdit ? "Leave empty to retain existing" : "Set temporary password"}
                          {...field}
                          className="h-10"
                        />
                      </FormControl>
                      <FormDescription className="text-[11px] text-muted-foreground">
                        Must be at least 6 characters.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Switches */}
              <div className="md:col-span-2 space-y-4">
                <FormField
                  control={form.control}
                  name="sendCredentialsEmail"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border border-border p-3.5 bg-muted/10">
                      <div className="space-y-0.5 pr-4">
                        <FormLabel className="text-sm font-medium text-foreground cursor-pointer">
                          Send Credentials Email
                        </FormLabel>
                        <p className="text-xs text-muted-foreground">
                          Email login credentials and instructions automatically upon saving.
                        </p>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border border-border p-3.5 bg-muted/10">
                      <div className="space-y-0.5 pr-4">
                        <FormLabel className="text-sm font-medium text-foreground cursor-pointer">
                          Account Active
                        </FormLabel>
                        <p className="text-xs text-muted-foreground">
                          Active employees can log into the system and appear on active schedules.
                        </p>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="adminPanelAccess"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3.5">
                      <div className="space-y-0.5 pr-4">
                        <div className="flex items-center gap-1.5">
                          <FormLabel className="text-sm font-medium text-foreground cursor-pointer">
                            Admin Panel Access
                          </FormLabel>
                          <Badge variant="outline" className="text-[10px] bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300">
                            Master Gate
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Allow this employee to sign in to the Admin Dashboard (gated in addition to RBAC).
                        </p>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* CARD 3: Job & Branch Assignment */}
          {/* ========================================================================= */}
          <div className="rounded-xl border border-border bg-card shadow-sm p-6 space-y-6">
            <div className="flex items-center gap-2.5 border-b border-border pb-3">
              <div className="p-2 rounded-lg bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400">
                <Briefcase className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-foreground">Job & Branch Assignment</h3>
                <p className="text-xs text-muted-foreground">Department, role, multi-branch access, and compensation</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="departmentId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Department
                    </FormLabel>
                    <FormControl>
                      <SearchableSelect
                        options={[
                          { value: "", label: "-- None / General --" },
                          ...departments.map((d) => ({ value: d.id, label: d.name })),
                        ]}
                        value={field.value || ""}
                        onChange={(val) => field.onChange(val)}
                        placeholder="Select Department..."
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="roleId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Assigned Role <span className="text-red-500">*</span>
                    </FormLabel>
                    <FormControl>
                      <SearchableSelect
                        options={roles.map((r) => ({
                          value: r.id,
                          label: r.name,
                          secondary: r.scope === "GLOBAL" ? "Global Admin" : "Branch Restricted",
                        }))}
                        value={field.value || ""}
                        onChange={(val) => field.onChange(val)}
                        placeholder="Select Role..."
                        required
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="employmentType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Employment Type
                    </FormLabel>
                    <FormControl>
                      <select
                        {...field}
                        className="w-full h-10 px-3 py-2 text-sm rounded-md border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                      >
                        <option value="FULL_TIME">Full Time</option>
                        <option value="PART_TIME">Part Time</option>
                        <option value="CONTRACT">Contract</option>
                        <option value="INTERN">Intern</option>
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="joiningDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Joining Date
                    </FormLabel>
                    <FormControl>
                      <Input type="date" {...field} className="h-10" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="basicSalary"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Basic Salary (৳)
                    </FormLabel>
                    <FormControl>
                      <Input type="number" min="0" placeholder="0" {...field} className="h-10 font-mono" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="bonusLimit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Bonus Limit (৳)
                    </FormLabel>
                    <FormControl>
                      <Input type="number" min="0" placeholder="0" {...field} className="h-10 font-mono" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="reportingManagerId"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2 md:col-span-3">
                    <FormLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Reporting Manager
                    </FormLabel>
                    <FormControl>
                      <select
                        {...field}
                        className="w-full h-10 px-3 py-2 text-sm rounded-md border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                      >
                        <option value="">-- No Direct Manager --</option>
                        {managers.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name} ({m.employeeId} - {m.role?.name || "Staff"})
                          </option>
                        ))}
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Multi-Branch Assignment */}
            <div className="border-t border-border pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-sm font-semibold text-foreground">Branch Access Permissions</span>
                  <Badge variant="secondary" className="text-xs font-normal">
                    {selectedBranchIds.length} branch(es) selected
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={selectAllBranches}
                    className="text-xs text-emerald-600 hover:text-emerald-700 font-medium hover:underline"
                  >
                    Select All
                  </button>
                  <span className="text-muted-foreground text-xs">•</span>
                  <button
                    type="button"
                    onClick={clearAllBranches}
                    className="text-xs text-muted-foreground hover:text-foreground hover:underline"
                  >
                    Clear All
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 p-3 bg-muted/20 rounded-lg border border-border">
                {branches.length === 0 ? (
                  <p className="text-xs text-muted-foreground col-span-3">No branches found.</p>
                ) : (
                  branches.map((branch) => {
                    const isChecked = selectedBranchIds.includes(branch.id);
                    return (
                      <label
                        key={branch.id}
                        onClick={() => toggleBranch(branch.id)}
                        className={`flex items-start gap-3 p-2.5 rounded-lg border cursor-pointer transition-all ${
                          isChecked
                            ? "bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-500/50 shadow-xs"
                            : "bg-background border-border hover:border-muted-foreground/30"
                        }`}
                      >
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={() => toggleBranch(branch.id)}
                          className="mt-0.5 data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
                        />
                        <div className="space-y-0.5 leading-none">
                          <p className="text-xs font-semibold text-foreground">{branch.name}</p>
                          <p className="text-[11px] text-muted-foreground">Code: {branch.code || "N/A"}</p>
                        </div>
                      </label>
                    );
                  })
                )}
              </div>
            </div>

            {/* Technician Capability Flag & Commission */}
            <div className="border-t border-border pt-4 space-y-4">
              <div className="flex items-center justify-between p-3.5 rounded-lg border border-border bg-muted/10">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="h-4 w-4 text-emerald-600" />
                    <span className="text-sm font-semibold text-foreground">Technician Capability</span>
                    <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-300">
                      Decoupled
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Flag this employee as a Technician to allow assigning repair jobs and earning commission, regardless of role.
                  </p>
                </div>
                <FormField
                  control={form.control}
                  name="isTechnician"
                  render={({ field }) => (
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  )}
                />
              </div>

              {isTechnicianWatch && (
                <div className="p-4 rounded-lg bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                      Technician Commission Rate (%)
                    </label>
                    <p className="text-xs text-muted-foreground">
                      Percentage earned on completed service and repair ticket billing.
                    </p>
                  </div>
                  <FormField
                    control={form.control}
                    name="commissionRate"
                    render={({ field }) => (
                      <div className="relative w-full sm:w-48">
                        <Input
                          type="number"
                          step="0.1"
                          min="0"
                          max="100"
                          placeholder="e.g. 5.0"
                          {...field}
                          className="h-10 pl-3 pr-8 font-mono bg-background"
                        />
                        <Percent className="h-4 w-4 absolute right-2.5 top-3 text-muted-foreground" />
                      </div>
                    )}
                  />
                </div>
              )}
            </div>
          </div>

          {/* ========================================================================= */}
          {/* CARD 4: Emergency Contact */}
          {/* ========================================================================= */}
          <div className="rounded-xl border border-border bg-card shadow-sm p-6 space-y-6">
            <div className="flex items-center gap-2.5 border-b border-border pb-3">
              <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400">
                <PhoneCall className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-foreground">Emergency Contact</h3>
                <p className="text-xs text-muted-foreground">Next of kin or emergency notification contact</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="emergencyContactName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Contact Name
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Rashida Begum" {...field} className="h-10" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="emergencyContactPhone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Contact Phone
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="01XXXXXXXXX" {...field} className="h-10" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="emergencyContactRelationship"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Relationship
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Spouse / Mother / Brother" {...field} className="h-10" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          {/* Form Actions Footer */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
            <button
              type="button"
              onClick={() => router.push("/admin/hrm/employees")}
              className="px-5 py-2.5 text-sm font-medium border border-border rounded-lg bg-background hover:bg-muted text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 text-sm font-medium rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm flex items-center gap-2 transition-colors disabled:opacity-50"
            >
              {isSubmitting ? (
                <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              {isEdit ? "Update Employee Profile" : "Save & Register Employee"}
            </button>
          </div>
        </form>
      </Form>
    </div>
  );
}
