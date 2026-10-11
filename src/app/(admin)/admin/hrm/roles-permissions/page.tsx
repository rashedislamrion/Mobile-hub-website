"use client";

import { useEffect, useState, useCallback } from "react";
import { useAdminPage } from "@/contexts/AdminPageContext";
import {
  Shield,
  Plus,
  Search,
  CheckCircle2,
  Lock,
  Save,
  Trash2,
  Check,
  Building2,
  Globe,
  User,
  Users,
  Layers,
  MapPin,
} from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api-client";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ListLoadingSkeleton, ListEmptyState, ListErrorState } from "@/components/admin/AdminTableState";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface RoleItem {
  id: string;
  name: string;
  description: string | null;
  scope: string;
  isSystem: boolean;
  permissionCount?: number;
  _count?: { staff: number };
}

interface PermissionItem {
  module: string;
  action: "CREATE" | "READ" | "UPDATE" | "DELETE" | "VIEW_DETAILS";
  allowed: boolean;
}

interface BranchPermissionItem {
  branchId: string;
  branchName: string;
  branchCode: string;
  branchType?: string;
  branchAddress?: string;
  branchCity?: string;
  canAccess: boolean;
}

// Complete 26-module mapping matching ModuleName enum
const MODULE_GROUPS: Array<{
  groupName: string;
  modules: Array<{ key: string; label: string; desc: string }>;
}> = [
  {
    groupName: "Sales, Counter & Orders",
    modules: [
      { key: "DASHBOARD", label: "Dashboard Analytics", desc: "Executive KPI dashboard and stats" },
      { key: "SALES", label: "POS & Sales Register", desc: "Counter sales, cash register, and receipts" },
      { key: "ORDERS", label: "Online Orders & Dispatch", desc: "Storefront web orders and parcel booking" },
      { key: "SALES_RETURNS", label: "Sales Returns & Refunds", desc: "Customer item returns and cash refunds" },
      { key: "EXCHANGES", label: "Product Exchanges", desc: "Product swap and price adjustments" },
    ],
  },
  {
    groupName: "Catalog, Inventory & Logistics",
    modules: [
      { key: "PRODUCTS", label: "Products & Stock Catalog", desc: "Inventory variants, prices, and stock tracking" },
      { key: "CATEGORY", label: "Categories & Brands", desc: "Category hierarchy, series, units, and brands" },
      { key: "STOCK_ADJUSTMENTS", label: "Stock Adjustments & Wasted", desc: "Batch stock adjustments and write-offs" },
      { key: "PURCHASE", label: "Purchase Orders & Receiving", desc: "Procurement orders and stock receipts" },
      { key: "SUPPLIERS", label: "Suppliers & Payables", desc: "Vendor directory and accounts payable" },
      { key: "BRANCH", label: "Branch Management", desc: "Outlets, warehouses, and locations" },
    ],
  },
  {
    groupName: "Accounting, Reports & Finance",
    modules: [
      { key: "REPORT", label: "Reports & Financials", desc: "10 core sales, stock, and ledger reports" },
      { key: "WALLET", label: "Wallets & Accounts Ledger", desc: "Cash, bank, and mobile financial accounts" },
      { key: "EXPENSE", label: "Expense Management", desc: "Daily operational expenses and categories" },
      { key: "CUSTOMERS", label: "Customer Relations", desc: "Customer profiles, history, and receivables" },
    ],
  },
  {
    groupName: "HRM & Personnel",
    modules: [
      { key: "HRM", label: "HRM, Staff & Payroll", desc: "Staff directory, technicians, roles, and payroll" },
    ],
  },
  {
    groupName: "Marketing, Promotion & Content",
    modules: [
      { key: "PROMOTIONAL_BANNER", label: "Promotional Banners", desc: "Hero sliders and homepage banners" },
      { key: "ADS", label: "Advertisements", desc: "Popups, side adverts, and deals" },
      { key: "PROMO_CODE", label: "Promo Codes & Discounts", desc: "Coupon vouchers and discount rules" },
      { key: "PUSH_NOTIFICATION", label: "Push Notifications", desc: "App & browser broadcast alerts" },
      { key: "BLOGS", label: "Blogs & News", desc: "News posts, tech articles, and SEO blogs" },
    ],
  },
  {
    groupName: "Support & System Administration",
    modules: [
      { key: "HELP_REQUESTS", label: "Help & Support Tickets", desc: "Customer support tickets and resolution" },
      { key: "HELP_NOTES", label: "Help Notes & Internal FAQs", desc: "Internal staff knowledge base" },
      { key: "BUSINESS_SETTINGS", label: "Business & Tax Settings", desc: "Store config, currency, and tax rules" },
      { key: "CMS", label: "Content Management (CMS)", desc: "Static pages, policy documents, and headers" },
      { key: "THIRD_PARTY_CONFIG", label: "3rd Party & Gateway Config", desc: "Payment gateways, SMS, and courier APIs" },
    ],
  },
];

export default function RolesPermissionsPage() {
  const { setTitle, setBadge, setDateFilter } = useAdminPage();

  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [searchRoleQuery, setSearchRoleQuery] = useState("");
  const [selectedRoleId, setSelectedRoleId] = useState<string>("");
  const [currentRole, setCurrentRole] = useState<RoleItem | null>(null);

  // Matrix State: [moduleKey]: { CREATE, READ, UPDATE, DELETE, VIEW_DETAILS }
  const [permissions, setPermissions] = useState<Record<string, Record<string, boolean>>>({});
  const [branchPermissions, setBranchPermissions] = useState<BranchPermissionItem[]>([]);
  const [roleScope, setRoleScope] = useState<string>("GLOBAL");

  const [isLoadingRoles, setIsLoadingRoles] = useState(true);
  const [rolesError, setRolesError] = useState<string | null>(null);
  const [isLoadingPerms, setIsLoadingPerms] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Create Role Modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleDesc, setNewRoleDesc] = useState("");
  const [newRoleScope, setNewRoleScope] = useState<string>("GLOBAL");
  const [cloneRoleId, setCloneRoleId] = useState("");
  const [isSubmittingCreate, setIsSubmittingCreate] = useState(false);

  useEffect(() => {
    setTitle("Roles & Permissions");
    setBadge("HRM");
    setDateFilter("");
  }, [setTitle, setBadge, setDateFilter]);

  const loadRoles = useCallback(async (selectId?: string) => {
    try {
      setIsLoadingRoles(true);
      setRolesError(null);
      const res = await apiGet<RoleItem[]>("/roles");
      const list = Array.isArray(res) ? res : [];
      setRoles(list);

      if (selectId) {
        setSelectedRoleId(selectId);
      } else if (!selectedRoleId && list.length > 0) {
        const defaultRole = list.find((r) => r.name !== "Admin") || list[0];
        setSelectedRoleId(defaultRole.id);
      }
    } catch (err: any) {
      setRolesError(err.message || "Failed to load roles");
      toast.error(err.message || "Failed to load roles");
    } finally {
      setIsLoadingRoles(false);
    }
  }, [selectedRoleId]);

  useEffect(() => {
    loadRoles();
  }, [loadRoles]);

  const loadRoleData = useCallback(async (roleId: string) => {
    if (!roleId) {
      setCurrentRole(null);
      setPermissions({});
      setBranchPermissions([]);
      return;
    }
    try {
      setIsLoadingPerms(true);
      const [permsRes, branchRes] = await Promise.all([
        apiGet<{
          role: RoleItem;
          permissions: PermissionItem[];
        }>(`/roles/${roleId}/permissions`),
        apiGet<BranchPermissionItem[]>(`/roles/${roleId}/branch-permissions`).catch(() => []),
      ]);

      setCurrentRole(permsRes.role);
      setRoleScope(permsRes.role.scope || "GLOBAL");

      const map: Record<string, Record<string, boolean>> = {};
      permsRes.permissions.forEach((p) => {
        if (!map[p.module]) map[p.module] = {};
        map[p.module][p.action] = p.allowed;
      });

      setPermissions(map);
      setBranchPermissions(Array.isArray(branchRes) ? branchRes : []);
    } catch (err: any) {
      toast.error(err.message || "Failed to load role permissions");
    } finally {
      setIsLoadingPerms(false);
    }
  }, []);

  useEffect(() => {
    if (selectedRoleId) {
      loadRoleData(selectedRoleId);
    }
  }, [selectedRoleId, loadRoleData]);

  const handleToggleAction = (
    moduleKey: string,
    action: "CREATE" | "READ" | "UPDATE" | "DELETE" | "VIEW_DETAILS",
  ) => {
    if (currentRole?.name === "Admin" || currentRole?.name === "Super Admin") {
      toast.error("Super Admin permissions cannot be restricted.");
      return;
    }

    setPermissions((prev) => {
      const moduleObj = { ...(prev[moduleKey] || {}) };
      moduleObj[action] = !moduleObj[action];
      return {
        ...prev,
        [moduleKey]: moduleObj,
      };
    });
  };

  const handleToggleRow = (moduleKey: string, enable: boolean) => {
    if (currentRole?.name === "Admin" || currentRole?.name === "Super Admin") {
      toast.error("Super Admin permissions cannot be modified.");
      return;
    }

    setPermissions((prev) => ({
      ...prev,
      [moduleKey]: {
        READ: enable,
        CREATE: enable,
        UPDATE: enable,
        DELETE: enable,
        VIEW_DETAILS: enable,
      },
    }));
  };

  const handleToggleGlobalAll = (enable: boolean) => {
    if (currentRole?.name === "Admin" || currentRole?.name === "Super Admin") {
      toast.error("Super Admin permissions cannot be modified.");
      return;
    }

    const newMap: Record<string, Record<string, boolean>> = {};
    MODULE_GROUPS.forEach((group) => {
      group.modules.forEach((mod) => {
        newMap[mod.key] = {
          READ: enable,
          CREATE: enable,
          UPDATE: enable,
          DELETE: enable,
          VIEW_DETAILS: enable,
        };
      });
    });
    setPermissions(newMap);
  };

  const handleToggleBranch = (branchId: string) => {
    if (currentRole?.name === "Admin" || currentRole?.name === "Super Admin") {
      toast.error("Super Admin has full access to all branches.");
      return;
    }

    setBranchPermissions((prev) =>
      prev.map((bp) =>
        bp.branchId === branchId ? { ...bp, canAccess: !bp.canAccess } : bp,
      ),
    );
  };

  const handleSave = async () => {
    if (!selectedRoleId) return;
    try {
      setIsSaving(true);

      const flatPerms: PermissionItem[] = [];
      MODULE_GROUPS.forEach((group) => {
        group.modules.forEach((mod) => {
          const modPerms = permissions[mod.key] || {};
          const actions: Array<"CREATE" | "READ" | "UPDATE" | "DELETE" | "VIEW_DETAILS"> = [
            "READ",
            "CREATE",
            "UPDATE",
            "DELETE",
            "VIEW_DETAILS",
          ];
          actions.forEach((act) => {
            flatPerms.push({
              module: mod.key,
              action: act,
              allowed: Boolean(modPerms[act]),
            });
          });
        });
      });

      // Save both Module Permissions and Branch Permissions in parallel
      await Promise.all([
        apiPatch(`/roles/${selectedRoleId}/permissions`, {
          scope: roleScope,
          permissions: flatPerms,
        }),
        apiPatch(`/roles/${selectedRoleId}/branch-permissions`, {
          branchPermissions: branchPermissions.map((bp) => ({
            branchId: bp.branchId,
            canAccess: bp.canAccess,
          })),
        }),
      ]);

      toast.success(`${currentRole?.name || "Role"} permissions and branch access updated successfully!`);
      loadRoles(selectedRoleId);
      loadRoleData(selectedRoleId);
    } catch (err: any) {
      toast.error(err.message || "Failed to save permissions");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoleName.trim()) {
      toast.error("Role name is required");
      return;
    }

    try {
      setIsSubmittingCreate(true);
      const res = await apiPost<RoleItem>("/roles", {
        name: newRoleName.trim(),
        description: newRoleDesc.trim() || undefined,
        scope: newRoleScope,
        cloneFromRoleId: cloneRoleId || undefined,
      });

      toast.success(`Role "${res.name}" created successfully!`);
      setCreateModalOpen(false);
      setNewRoleName("");
      setNewRoleDesc("");
      setCloneRoleId("");
      loadRoles(res.id);
    } catch (err: any) {
      toast.error(err.message || "Failed to create role");
    } finally {
      setIsSubmittingCreate(false);
    }
  };

  const handleDeleteRole = async (role: RoleItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Are you sure you want to delete custom role "${role.name}"?`)) {
      return;
    }

    try {
      await apiDelete(`/roles/${role.id}`);
      toast.success(`Role "${role.name}" deleted successfully`);
      if (selectedRoleId === role.id) {
        setSelectedRoleId("");
      }
      loadRoles();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete role");
    }
  };

  const filteredRoles = roles.filter((r) =>
    !searchRoleQuery.trim()
      ? true
      : r.name.toLowerCase().includes(searchRoleQuery.toLowerCase().trim()),
  );

  const isSuperAdmin = currentRole?.name === "Admin" || currentRole?.name === "Super Admin";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <Shield className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            Roles & Permissions Matrix
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Full 26-module authorization matrix with 5 granular actions and multi-branch operation access
          </p>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* ========================================================================= */}
        {/* LEFT COLUMN: Role Selector */}
        {/* ========================================================================= */}
        <div className="w-full lg:w-80 shrink-0 rounded-xl border border-border bg-card shadow-xs overflow-hidden">
          {/* Search + Add Role */}
          <div className="p-3 border-b border-border bg-muted/20 flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="h-3.5 w-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search roles..."
                value={searchRoleQuery}
                onChange={(e) => setSearchRoleQuery(e.target.value)}
                className="w-full h-8 pl-8 pr-2 text-xs rounded-md border border-input bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <button
              type="button"
              onClick={() => setCreateModalOpen(true)}
              className="h-8 px-2.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1 shrink-0 shadow-xs transition"
            >
              <Plus className="h-3.5 w-3.5" />
              Role
            </button>
          </div>

          {/* List of Roles */}
          <div className="p-2 space-y-1 max-h-[calc(100vh-260px)] overflow-y-auto">
            {isLoadingRoles ? (
              <ListLoadingSkeleton count={4} />
            ) : rolesError ? (
              <ListErrorState error={rolesError} onRetry={() => loadRoles()} />
            ) : filteredRoles.length === 0 ? (
              <ListEmptyState
                title="No records found"
                description="No roles found matching your search."
                actionLabel="Create Role"
                onAction={() => setCreateModalOpen(true)}
              />
            ) : (
              filteredRoles.map((role) => {
                const isSelected = selectedRoleId === role.id;
                return (
                  <div
                    key={role.id}
                    onClick={() => setSelectedRoleId(role.id)}
                    className={`p-3 rounded-lg border text-xs cursor-pointer transition-all flex items-center justify-between group ${
                      isSelected
                        ? "border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/30 text-foreground font-semibold shadow-xs"
                        : "border-transparent hover:bg-muted/40 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <div className="space-y-1 min-w-0 pr-2">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-foreground truncate">
                          {role.name}
                        </span>
                        {role.isSystem && (
                          <span className="text-[9px] px-1 py-0.2 rounded bg-muted text-muted-foreground uppercase font-mono">
                            Sys
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-normal">
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          {role.permissionCount ?? 0} active perms
                        </Badge>
                        <span>•</span>
                        <span>{role.scope}</span>
                      </div>
                    </div>

                    {!role.isSystem && (
                      <button
                        type="button"
                        onClick={(e) => handleDeleteRole(role, e)}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-50 dark:hover:bg-red-950/40 text-muted-foreground hover:text-red-600 transition"
                        title="Delete Role"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* RIGHT COLUMN: Permissions Matrix (26 Modules × 5 Actions + Branches) */}
        {/* ========================================================================= */}
        <div className="flex-1 w-full rounded-xl border border-border bg-card shadow-xs overflow-hidden">
          {!currentRole ? (
            <div className="p-16 text-center space-y-3">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mx-auto text-muted-foreground">
                <Lock className="h-6 w-6" />
              </div>
              <h3 className="text-base font-semibold text-foreground">No Role Selected</h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Select any system or custom role on the left panel to configure its feature access matrix and authorization scope.
              </p>
            </div>
          ) : (
            <div>
              {/* Header Bar */}
              <div className="p-4 border-b border-border bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-foreground">{currentRole.name}</h3>
                    {currentRole.isSystem && (
                      <Badge variant="outline" className="text-[10px]">
                        System Built-in
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Customize module access toggles and operational branch permissions below.
                  </p>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  {/* Scope dropdown */}
                  <div className="flex items-center gap-1.5">
                    <label className="text-xs font-semibold text-muted-foreground">Scope:</label>
                    <select
                      value={roleScope}
                      onChange={(e) => setRoleScope(e.target.value)}
                      disabled={isSuperAdmin}
                      className="h-9 px-2.5 text-xs rounded-md border border-input bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    >
                      <option value="GLOBAL">Global (All Data & Branches)</option>
                      <option value="OWN_BRANCH">Own Branch Only</option>
                      <option value="OWN_DATA">Own Data Only</option>
                    </select>
                  </div>

                  {/* Save button */}
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={isSaving || isSuperAdmin}
                    className="px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs flex items-center gap-1.5 transition disabled:opacity-50"
                  >
                    {isSaving ? (
                      <div className="h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Save className="h-3.5 w-3.5" />
                    )}
                    Update Permissions
                  </button>
                </div>
              </div>

              {/* Quick Global Action Bar */}
              {!isSuperAdmin && (
                <div className="px-4 py-2 border-b border-border bg-muted/10 flex items-center justify-between text-xs text-muted-foreground">
                  <span>Quick bulk action for all 26 modules:</span>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => handleToggleGlobalAll(true)}
                      className="text-emerald-600 hover:underline font-semibold"
                    >
                      Select All Permissions
                    </button>
                    <span>•</span>
                    <button
                      type="button"
                      onClick={() => handleToggleGlobalAll(false)}
                      className="text-muted-foreground hover:underline"
                    >
                      Deselect All
                    </button>
                  </div>
                </div>
              )}

              {/* Permissions Matrix Grouped by Section */}
              <div className="p-4 space-y-6 max-h-[calc(100vh-320px)] overflow-y-auto">
                {MODULE_GROUPS.map((group) => (
                  <div key={group.groupName} className="space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 border-b border-border pb-1.5">
                      <Layers className="h-3.5 w-3.5 text-primary" />
                      {group.groupName}
                    </h4>

                    <div className="rounded-lg border border-border overflow-hidden bg-background">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-muted/40 border-b border-border text-[11px] uppercase text-muted-foreground font-semibold">
                          <tr>
                            <th className="p-3 font-semibold tracking-wider w-1/3">Module</th>
                            <th className="p-3 font-semibold tracking-wider text-center">List (READ)</th>
                            <th className="p-3 font-semibold tracking-wider text-center">Create</th>
                            <th className="p-3 font-semibold tracking-wider text-center">Edit</th>
                            <th className="p-3 font-semibold tracking-wider text-center">Delete</th>
                            <th className="p-3 font-semibold tracking-wider text-center">View Details</th>
                            <th className="p-3 font-semibold tracking-wider text-right">Row Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border text-foreground">
                          {group.modules.map((mod) => {
                            const modPerms = permissions[mod.key] || {
                              READ: false,
                              CREATE: false,
                              UPDATE: false,
                              DELETE: false,
                              VIEW_DETAILS: false,
                            };
                            const allEnabled =
                              Boolean(modPerms.READ) &&
                              Boolean(modPerms.CREATE) &&
                              Boolean(modPerms.UPDATE) &&
                              Boolean(modPerms.DELETE) &&
                              Boolean(modPerms.VIEW_DETAILS);

                            return (
                              <tr key={mod.key} className="hover:bg-muted/30 transition-colors">
                                {/* Module Name & Description */}
                                <td className="p-3">
                                  <div className="space-y-0.5">
                                    <p className="font-semibold text-foreground text-xs">{mod.label}</p>
                                    <p className="text-[11px] text-muted-foreground">{mod.desc}</p>
                                  </div>
                                </td>

                                {/* Action 1: List (READ) */}
                                <td className="p-3 text-center">
                                  <Switch
                                    checked={Boolean(modPerms.READ)}
                                    onCheckedChange={() => handleToggleAction(mod.key, "READ")}
                                    disabled={isSuperAdmin}
                                  />
                                </td>

                                {/* Action 2: Create (CREATE) */}
                                <td className="p-3 text-center">
                                  <Switch
                                    checked={Boolean(modPerms.CREATE)}
                                    onCheckedChange={() => handleToggleAction(mod.key, "CREATE")}
                                    disabled={isSuperAdmin}
                                  />
                                </td>

                                {/* Action 3: Edit (UPDATE) */}
                                <td className="p-3 text-center">
                                  <Switch
                                    checked={Boolean(modPerms.UPDATE)}
                                    onCheckedChange={() => handleToggleAction(mod.key, "UPDATE")}
                                    disabled={isSuperAdmin}
                                  />
                                </td>

                                {/* Action 4: Delete (DELETE) */}
                                <td className="p-3 text-center">
                                  <Switch
                                    checked={Boolean(modPerms.DELETE)}
                                    onCheckedChange={() => handleToggleAction(mod.key, "DELETE")}
                                    disabled={isSuperAdmin}
                                  />
                                </td>

                                {/* Action 5: View Details (VIEW_DETAILS) */}
                                <td className="p-3 text-center">
                                  <Switch
                                    checked={Boolean(modPerms.VIEW_DETAILS)}
                                    onCheckedChange={() => handleToggleAction(mod.key, "VIEW_DETAILS")}
                                    disabled={isSuperAdmin}
                                  />
                                </td>

                                {/* Quick Row Toggle */}
                                <td className="p-3 text-right">
                                  <button
                                    type="button"
                                    onClick={() => handleToggleRow(mod.key, !allEnabled)}
                                    disabled={isSuperAdmin}
                                    className="text-[11px] font-semibold text-emerald-600 hover:text-emerald-700 disabled:opacity-40"
                                  >
                                    {allEnabled ? "Disable All" : "Enable All"}
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}

                {/* ========================================================================= */}
                {/* BRANCH PERMISSIONS SECTION AT BOTTOM */}
                {/* ========================================================================= */}
                <div className="space-y-3 pt-4 border-t border-border">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Building2 className="h-4 w-4 text-emerald-600" />
                      Branch Operational Access Permissions
                    </h4>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Explicitly authorize this role to operate across specific branches in addition to their default scope
                    </p>
                  </div>

                  {branchPermissions.length === 0 ? (
                    <div className="p-4 rounded-lg border border-border bg-muted/20 text-xs text-muted-foreground text-center">
                      No branches found in system.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {branchPermissions.map((bp) => (
                        <div
                          key={bp.branchId}
                          className={`p-3 rounded-lg border transition-colors flex items-center justify-between gap-3 ${
                            bp.canAccess
                              ? "border-emerald-300 bg-emerald-50/50 dark:bg-emerald-950/20"
                              : "border-border bg-background"
                          }`}
                        >
                          <div className="space-y-0.5 min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-xs text-foreground truncate">
                                {bp.branchName}
                              </span>
                              <Badge variant="outline" className="text-[10px] uppercase font-mono">
                                {bp.branchCode}
                              </Badge>
                            </div>
                            {bp.branchAddress && (
                              <p className="text-[11px] text-muted-foreground truncate flex items-center gap-1">
                                <MapPin className="h-3 w-3 shrink-0" />
                                <span>{bp.branchAddress}</span>
                              </p>
                            )}
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[11px] font-medium text-muted-foreground">
                              {bp.canAccess ? "Authorized" : "Disabled"}
                            </span>
                            <Switch
                              checked={isSuperAdmin || Boolean(bp.canAccess)}
                              onCheckedChange={() => handleToggleBranch(bp.branchId)}
                              disabled={isSuperAdmin}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Sticky Bottom Save Button Bar */}
                <div className="pt-4 border-t border-border flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    Role: <strong className="text-foreground">{currentRole.name}</strong> • Total Modules: 26 (130 granular action rules)
                  </span>

                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={isSaving || isSuperAdmin}
                    className="px-5 py-2.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm flex items-center gap-2 transition disabled:opacity-50"
                  >
                    {isSaving ? (
                      <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4" />
                    )}
                    Update Roles & Branch Permissions
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* CREATE ROLE DIALOG */}
      {/* ========================================================================= */}
      <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-emerald-600" />
              Create Custom Role
            </DialogTitle>
            <DialogDescription>
              Define a new system role and optionally clone permissions from an existing role.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateRole} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">
                Role Name <span className="text-red-500">*</span>
              </label>
              <Input
                placeholder="e.g. Senior Inventory Lead, Branch Accountant"
                value={newRoleName}
                onChange={(e) => setNewRoleName(e.target.value)}
                required
                className="h-10"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">
                Description (Optional)
              </label>
              <Input
                placeholder="e.g. Manages counter sales, inventory receipts, and daily ledgers"
                value={newRoleDesc}
                onChange={(e) => setNewRoleDesc(e.target.value)}
                className="h-10"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">
                Default Scope
              </label>
              <select
                value={newRoleScope}
                onChange={(e) => setNewRoleScope(e.target.value)}
                className="w-full h-10 px-3 py-2 text-sm rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="GLOBAL">Global (All Data & Branches)</option>
                <option value="OWN_BRANCH">Own Branch Only</option>
                <option value="OWN_DATA">Own Data Only</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">
                Clone Permissions From
              </label>
              <select
                value={cloneRoleId}
                onChange={(e) => setCloneRoleId(e.target.value)}
                className="w-full h-10 px-3 py-2 text-sm rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">-- Start with Empty Permissions --</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.permissionCount ?? 0} active perms)
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
              <button
                type="button"
                onClick={() => setCreateModalOpen(false)}
                className="px-4 py-2 text-sm font-medium border border-border rounded-lg bg-background hover:bg-muted text-foreground transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmittingCreate || !newRoleName.trim()}
                className="px-5 py-2 text-sm font-medium rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm flex items-center gap-2 transition-colors disabled:opacity-50"
              >
                {isSubmittingCreate ? (
                  <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                Create Role
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
