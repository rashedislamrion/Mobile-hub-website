"use client";

import { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from "react";
import { StaffAuthContext } from "@/context/AuthContext";

type Breadcrumb = { label: string; href: string };

export interface AdminBranch {
  id: string;
  name: string;
  code?: string;
  isHeadquarters?: boolean;
}

type PageContextType = {
  title: string;
  setTitle: (title: string) => void;
  badge: string;
  setBadge: (badge: string) => void;
  dateFilter: string;
  setDateFilter: (filter: string) => void;
  isSidebarCollapsed: boolean;
  setIsSidebarCollapsed: (v: boolean | ((prev: boolean) => boolean)) => void;
  isMobileSidebarOpen: boolean;
  setIsMobileSidebarOpen: (v: boolean) => void;
  breadcrumbs: Breadcrumb[];
  setBreadcrumbs: (b: Breadcrumb[]) => void;
  setPageInfo: (info: { title?: string; badge?: string; breadcrumbs?: Breadcrumb[] }) => void;
  
  // Branch filter app-wide single source of truth
  selectedBranchId: string;
  setSelectedBranchId: (id: string) => void;
  selectedBranchName: string;
  setSelectedBranchName: (name: string) => void;
  branches: AdminBranch[];
  setBranches: (branches: AdminBranch[]) => void;
  selectBranch: (id: string, name: string) => void;

  // Branch scope helper states
  isGlobal: boolean;
  isSingleBranch: boolean;
  branchChangeVersion: number;
};

const AdminPageContext = createContext<PageContextType | undefined>(undefined);

export function AdminPageProvider({ children }: { children: ReactNode }) {
  const authContext = useContext(StaffAuthContext);
  const user = authContext?.user ?? null;

  const [title, setTitle] = useState("Dashboard");
  const [badge, setBadge] = useState("Website");
  const [dateFilter, setDateFilter] = useState("This Month");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [breadcrumbs, setBreadcrumbs] = useState<Breadcrumb[]>([]);

  // Branch state
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");
  const [selectedBranchName, setSelectedBranchName] = useState<string>("All Branches");
  const [branches, setBranches] = useState<AdminBranch[]>([]);
  const [branchChangeVersion, setBranchChangeVersion] = useState<number>(0);

  const isGlobal = Boolean(user?.isGlobal ?? (user?.role?.scope === "GLOBAL"));

  // Derive allowed branches strictly from the authenticated profile
  useEffect(() => {
    if (!user) return;

    let allowed: AdminBranch[] = [];
    if (user.allowedBranches && user.allowedBranches.length > 0) {
      allowed = user.allowedBranches.map((b) => ({
        id: b.id,
        name: b.name,
        code: b.code || undefined,
      }));
    } else if (user.branch) {
      allowed = [
        {
          id: user.branch.id,
          name: user.branch.name,
          code: user.branch.code || undefined,
        },
      ];
    }

    setBranches(allowed);

    // Validate and synchronize current branch selection
    if (typeof window !== "undefined") {
      const savedId = localStorage.getItem("admin_selected_branch_id") || "";

      if (isGlobal) {
        if (savedId) {
          const matched = allowed.find((b) => b.id === savedId);
          if (matched) {
            setSelectedBranchId(matched.id);
            setSelectedBranchName(matched.name);
          } else {
            // Saved id does not exist in active branches
            setSelectedBranchId("");
            setSelectedBranchName("All Branches");
            localStorage.setItem("admin_selected_branch_id", "");
            localStorage.setItem("admin_selected_branch_name", "All Branches");
          }
        } else {
          setSelectedBranchId("");
          setSelectedBranchName("All Branches");
        }
      } else {
        // Non-global users can NEVER select "All Branches"
        if (allowed.length === 1) {
          setSelectedBranchId(allowed[0].id);
          setSelectedBranchName(allowed[0].name);
          localStorage.setItem("admin_selected_branch_id", allowed[0].id);
          localStorage.setItem("admin_selected_branch_name", allowed[0].name);
        } else if (allowed.length > 1) {
          const matched = allowed.find((b) => b.id === savedId);
          if (matched) {
            setSelectedBranchId(matched.id);
            setSelectedBranchName(matched.name);
          } else {
            // Default to primary branch or first allowed branch
            const defaultBranch =
              allowed.find((b) => b.id === user.branchId) || allowed[0];
            setSelectedBranchId(defaultBranch.id);
            setSelectedBranchName(defaultBranch.name);
            localStorage.setItem("admin_selected_branch_id", defaultBranch.id);
            localStorage.setItem("admin_selected_branch_name", defaultBranch.name);
          }
        } else {
          // No branches assigned
          setSelectedBranchId("");
          setSelectedBranchName("No Assigned Branch");
        }
      }
    }
  }, [user, isGlobal]);

  const isSingleBranch = !isGlobal && branches.length <= 1;

  const selectBranch = useCallback(
    (id: string, name: string) => {
      // Validate selection
      if (!isGlobal) {
        if (!id) return; // Non-global cannot select "All"
        if (!branches.some((b) => b.id === id)) return; // Not an allowed branch
      }

      setSelectedBranchId(id);
      setSelectedBranchName(name);

      if (typeof window !== "undefined") {
        localStorage.setItem("admin_selected_branch_id", id);
        localStorage.setItem("admin_selected_branch_name", name);
        window.dispatchEvent(
          new CustomEvent("admin_branch_changed", {
            detail: { branchId: id, branchName: name },
          }),
        );
      }
      setBranchChangeVersion((v) => v + 1);
    },
    [isGlobal, branches],
  );

  const setPageInfo = useCallback(
    (info: { title?: string; badge?: string; breadcrumbs?: Breadcrumb[] }) => {
      if (info.title) setTitle(info.title);
      if (info.badge !== undefined) setBadge(info.badge);
      if (info.breadcrumbs) setBreadcrumbs(info.breadcrumbs);
    },
    [],
  );

  return (
    <AdminPageContext.Provider
      value={{
        title,
        setTitle,
        badge,
        setBadge,
        dateFilter,
        setDateFilter,
        isSidebarCollapsed,
        setIsSidebarCollapsed,
        isMobileSidebarOpen,
        setIsMobileSidebarOpen,
        breadcrumbs,
        setBreadcrumbs,
        setPageInfo,
        selectedBranchId,
        setSelectedBranchId,
        selectedBranchName,
        setSelectedBranchName,
        branches,
        setBranches,
        selectBranch,
        isGlobal,
        isSingleBranch,
        branchChangeVersion,
      }}
    >
      {children}
    </AdminPageContext.Provider>
  );
}

const defaultPageContext: PageContextType = {
  title: "Dashboard",
  setTitle: () => {},
  badge: "Website",
  setBadge: () => {},
  dateFilter: "This Month",
  setDateFilter: () => {},
  isSidebarCollapsed: false,
  setIsSidebarCollapsed: () => {},
  isMobileSidebarOpen: false,
  setIsMobileSidebarOpen: () => {},
  breadcrumbs: [],
  setBreadcrumbs: () => {},
  setPageInfo: () => {},
  selectedBranchId: "",
  setSelectedBranchId: () => {},
  selectedBranchName: "All Branches",
  setSelectedBranchName: () => {},
  branches: [],
  setBranches: () => {},
  selectBranch: () => {},
  isGlobal: true,
  isSingleBranch: false,
  branchChangeVersion: 0,
};

export function useAdminPage() {
  const context = useContext(AdminPageContext);
  return context || defaultPageContext;
}

/**
 * Shared hook to execute queries reactively when the selected branch changes.
 * Invalidates / re-executes whenever `selectedBranchId` or `branchChangeVersion` updates.
 */
export function useBranchScopedQuery(
  fetchFn: (branchId: string) => void | Promise<void>,
  deps: any[] = [],
) {
  const { selectedBranchId, branchChangeVersion } = useAdminPage();
  const fetchRef = useRef(fetchFn);
  fetchRef.current = fetchFn;

  useEffect(() => {
    fetchRef.current(selectedBranchId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBranchId, branchChangeVersion, ...deps]);

  return { selectedBranchId };
}
