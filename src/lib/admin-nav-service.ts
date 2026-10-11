import { ElementType } from "react";
import { adminNavConfig, NavGroup, NavItem } from "@/lib/mock-data/admin-nav";
import { Wrench, PlusCircle, PieChart } from "lucide-react";

export interface AdminSearchablePage {
  id: string;
  label: string;
  href: string;
  groupLabel?: string;
  parentLabel?: string;
  icon?: ElementType;
  keywords?: string[];
}

export function getVisibleNavConfig(
  user: any,
  hasPermission: (module: string, action: string) => boolean
): NavGroup[] {
  const roleName = user?.role?.name?.toLowerCase() || "";
  const isRestrictedStaff =
    user &&
    user.role &&
    roleName !== "admin" &&
    roleName !== "super admin" &&
    roleName !== "administrator" &&
    !(user.role.scope === "GLOBAL" && roleName.includes("admin"));

  const isTechnician = roleName.includes("technician");
  const isBranchRole =
    roleName.includes("branch admin") || roleName.includes("branch manager");

  if (isTechnician) {
    return [
      {
        groupLabel: "MY WORKSPACE",
        items: [
          {
            label: "Technician Workspace",
            href: "/admin/technician",
            icon: Wrench,
            module: "SALES",
          },
          {
            label: "Create New Service",
            href: "/admin/servicing/create",
            icon: PlusCircle,
            module: "SALES",
          },
          {
            label: "Servicing Report",
            href: "/admin/technician/servicing-report",
            icon: PieChart,
            module: "SALES",
          },
        ],
      },
    ];
  }

  const isItemVisible = (item: NavItem): boolean => {
    if (item.label === "Dashboard" || item.href === "/admin") return true;
    if (!isRestrictedStaff) return true;

    if (item.children && item.children.length > 0) {
      if (item.module && hasPermission(item.module, "READ")) {
        return true;
      }
      return item.children.some((child) => {
        const childModule = child.module || item.module;
        return childModule ? hasPermission(childModule, "READ") : false;
      });
    }

    if (!item.module) return false;
    return hasPermission(item.module, "READ");
  };

  const filterItemForRole = (item: NavItem): boolean => {
    if (item.href === "/admin/branch/product-requests") {
      return isBranchRole;
    }
    return true;
  };

  if (!isRestrictedStaff) {
    return adminNavConfig
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => filterItemForRole(item)),
      }))
      .filter((group) => group.items.length > 0);
  }

  return adminNavConfig
    .map((group) => ({
      ...group,
      items: group.items
        .filter((item) => filterItemForRole(item) && isItemVisible(item))
        .map((item) => {
          if (item.children) {
            return {
              ...item,
              children: item.children.filter((child) => {
                const childModule = child.module || item.module;
                return childModule ? hasPermission(childModule, "READ") : false;
              }),
            };
          }
          return item;
        }),
    }))
    .filter((group) => group.items.length > 0);
}

export function getFlatSearchablePages(
  user: any,
  hasPermission: (module: string, action: string) => boolean
): AdminSearchablePage[] {
  const visibleGroups = getVisibleNavConfig(user, hasPermission);
  const pages: AdminSearchablePage[] = [];

  for (const group of visibleGroups) {
    const groupLabel = group.groupLabel || "General";
    for (const item of group.items) {
      if (item.href) {
        pages.push({
          id: item.href,
          label: item.label,
          href: item.href,
          groupLabel,
          icon: item.icon,
          keywords: generateKeywords(item.label, groupLabel),
        });
      }
      if (item.children && item.children.length > 0) {
        for (const child of item.children) {
          if (child.href) {
            pages.push({
              id: child.href,
              label: child.label,
              href: child.href,
              groupLabel,
              parentLabel: item.label,
              icon: child.icon || item.icon,
              keywords: generateKeywords(child.label, groupLabel, item.label),
            });
          }
        }
      }
    }
  }

  return pages;
}

function generateKeywords(...terms: (string | undefined)[]): string[] {
  const aliases: Record<string, string[]> = {
    Purchase: ["buy", "supplier", "procurement", "po", "bill"],
    Purpose: ["reason", "wallet", "tag"],
    "Purchase Report": ["summary", "buying", "analytics"],
    Sales: ["invoice", "orders", "sell", "billing"],
    Servicing: ["repair", "technician", "diagnose", "fix", "jobs"],
    Products: ["inventory", "catalog", "items", "stock", "variants"],
    HRM: ["staff", "employees", "salaries", "payroll", "roles"],
    Expense: ["spending", "costs", "payments"],
    Wallet: ["cash", "bank", "balances", "deposit"],
  };

  const kwSet = new Set<string>();
  for (const t of terms) {
    if (!t) continue;
    const lower = t.toLowerCase();
    kwSet.add(lower);
    if (aliases[t]) {
      aliases[t].forEach((a) => kwSet.add(a.toLowerCase()));
    }
  }
  return Array.from(kwSet);
}

export function searchAdminPages(
  pages: AdminSearchablePage[],
  rawQuery: string
): AdminSearchablePage[] {
  const query = rawQuery.trim().toLowerCase();
  if (!query) return pages.slice(0, 15);

  const scored: Array<{ page: AdminSearchablePage; score: number }> = [];

  for (const page of pages) {
    const labelLower = page.label.toLowerCase();
    const groupLower = (page.groupLabel || "").toLowerCase();
    const parentLower = (page.parentLabel || "").toLowerCase();
    let score = 0;

    // Exact label match
    if (labelLower === query) {
      score += 200;
    }
    // Starts with label
    else if (labelLower.startsWith(query)) {
      score += 150;
    }
    // Any word in label starts with query (e.g. "Purchase Report" for "rep")
    else if (
      labelLower
        .split(/\s+/)
        .some((word) => word.startsWith(query))
    ) {
      score += 100;
    }
    // Label contains query
    else if (labelLower.includes(query)) {
      score += 60;
    }
    // Parent starts with or contains
    else if (parentLower.startsWith(query)) {
      score += 40;
    } else if (parentLower.includes(query)) {
      score += 30;
    }
    // Group starts with or contains
    else if (groupLower.startsWith(query)) {
      score += 25;
    } else if (groupLower.includes(query)) {
      score += 15;
    }
    // Keywords match
    else if (
      page.keywords &&
      page.keywords.some((k) => k.startsWith(query) || k.includes(query))
    ) {
      score += 20;
    }

    if (score > 0) {
      scored.push({ page, score });
    }
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.page.label.localeCompare(b.page.label);
  });

  return scored.map((s) => s.page);
}
