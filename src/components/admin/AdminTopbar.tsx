"use client";

import { Search, Menu, History, Store, ChevronDown, Palette, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AdminSidebar } from "./AdminSidebar";
import { AdminPageSearchDialog } from "./AdminPageSearchDialog";
import { useAdminPage } from "@/contexts/AdminPageContext";
import { useStaffAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { toast } from "sonner";

const themePalette = [
  { name: "Emerald", bgClass: "bg-emerald-600", primary: "#059669" },
  { name: "Purple", bgClass: "bg-purple-600", primary: "#7c3aed" },
  { name: "Blue", bgClass: "bg-blue-600", primary: "#2563eb" },
  { name: "Rose", bgClass: "bg-rose-600", primary: "#e11d48" },
];

export function AdminTopbar() {
  const {
    title,
    badge,
    isMobileSidebarOpen,
    setIsMobileSidebarOpen,
    dateFilter,
    setDateFilter,
    selectedBranchId,
    selectedBranchName,
    selectBranch,
    branches,
    isGlobal,
    isSingleBranch,
  } = useAdminPage();
  const { user, logout } = useStaffAuth();
  const router = useRouter();
  const [activeTheme, setActiveTheme] = useState("Emerald");
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Keyboard shortcut: Ctrl+K, Cmd+K, or "/"
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") ||
        e.key === "/"
      ) {
        const activeTag = document.activeElement?.tagName;
        if (activeTag === "INPUT" || activeTag === "TEXTAREA") {
          if (e.key === "/") return; // Don't hijack normal typing in inputs
        }
        e.preventDefault();
        setIsSearchOpen(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    const savedTheme = localStorage.getItem("admin_theme_name");
    if (savedTheme) {
      setActiveTheme(savedTheme);
    }
  }, []);

  const handleSelectTheme = (theme: typeof themePalette[0]) => {
    setActiveTheme(theme.name);
    localStorage.setItem("admin_theme_name", theme.name);
    toast.success(`${theme.name} theme applied`);
  };

  const handleLogout = async () => {
    await logout();
    router.push("/admin/login");
  };

  return (
    <header className="h-16 border-b border-slate-200 bg-white flex items-center justify-between px-4 lg:px-6 sticky top-0 z-30">
      
      <div className="flex items-center gap-4 flex-1">
        {/* Mobile Sidebar Toggle */}
        <div className="lg:hidden">
          <Sheet open={isMobileSidebarOpen} onOpenChange={setIsMobileSidebarOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="text-slate-600">
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-64 border-r-0">
              <AdminSidebar />
            </SheetContent>
          </Sheet>
        </div>

        {/* Page Title & Badge */}
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-slate-800">{title}</h1>
          {badge && (
            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold uppercase tracking-wider hidden sm:inline-block">
              {badge}
            </span>
          )}
          
          {/* Date Filter */}
          <div className="ml-2 hidden sm:block">
            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger className="h-8 border-transparent bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-full text-xs font-medium px-3">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Today">Today</SelectItem>
                <SelectItem value="This Week">This Week</SelectItem>
                <SelectItem value="This Month">This Month</SelectItem>
                <SelectItem value="This Year">This Year</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 md:gap-3">
        {/* Page Search Trigger: Desktop */}
        <button
          type="button"
          onClick={() => setIsSearchOpen(true)}
          className="hidden sm:flex items-center gap-2.5 h-9 px-3.5 rounded-full border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-500 text-xs font-medium transition-all shadow-xs"
          title="Search admin pages (Ctrl+K or /)"
        >
          <Search className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-slate-600">Search pages...</span>
          <kbd className="font-mono text-[10px] bg-white border border-slate-200 rounded px-1.5 py-0.5 text-slate-400 font-semibold shadow-2xs">
            ⌘K
          </kbd>
        </button>

        {/* Page Search Trigger: Mobile */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsSearchOpen(true)}
          className="sm:hidden text-slate-600"
          title="Search admin pages"
        >
          <Search className="w-5 h-5" />
        </Button>
        
        {/* History Icon */}
        <Button variant="ghost" size="icon" className="text-slate-600 hidden sm:flex">
          <History className="w-5 h-5" />
        </Button>

        {/* POS Button */}
        <Button 
          onClick={() => router.push("/admin/pos")}
          title="Open POS Terminal"
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-full h-9 px-4 hidden sm:flex shadow-sm transition-colors"
        >
          <Store className="w-4 h-4 mr-2" />
          POS
        </Button>

        {/* Branch Selector */}
        <div className="hidden md:block">
          {isSingleBranch ? (
            <div className="h-9 px-3.5 rounded-full border border-slate-200 bg-slate-50 text-slate-700 text-xs font-medium flex items-center gap-2 cursor-default" title="Assigned Branch Scope">
              <Store className="w-3.5 h-3.5 text-emerald-600" />
              <span className="truncate max-w-[150px] font-semibold">{selectedBranchName || "Single Branch"}</span>
            </div>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="h-9 rounded-full border-slate-200 text-slate-700 font-normal">
                  <Store className="w-4 h-4 mr-2 text-emerald-600" />
                  <span className="truncate max-w-[150px]">{selectedBranchName || (isGlobal ? "All Branches" : "Select Branch")}</span>
                  <ChevronDown className="w-4 h-4 ml-2 text-slate-400" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[280px]">
                <DropdownMenuLabel>Select Branch Scope</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {isGlobal && (
                  <>
                    <DropdownMenuItem 
                      className={!selectedBranchId ? 'bg-emerald-50 text-emerald-700 font-semibold' : ''}
                      onClick={() => selectBranch("", "All Branches")}
                    >
                      🌐 All Branches (Global)
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                {branches.length > 0 ? (
                  branches.map(branch => (
                    <DropdownMenuItem 
                      key={branch.id} 
                      className={selectedBranchId === branch.id ? 'bg-emerald-50 text-emerald-700 font-medium' : ''}
                      onClick={() => selectBranch(branch.id, branch.name)}
                    >
                      <Store className="w-3.5 h-3.5 mr-2 text-slate-400" />
                      {branch.name}
                    </DropdownMenuItem>
                  ))
                ) : (
                  <DropdownMenuItem className="text-slate-400 text-xs">
                    No branches available
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Profile Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 hover:bg-slate-50 p-1 rounded-full pr-3 transition-colors text-left outline-none border border-transparent focus-visible:ring-2 focus-visible:ring-emerald-500">
              <Avatar className="h-9 w-9 border border-slate-200">
                <AvatarImage src={`https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || "Admin")}&background=10b981&color=fff`} alt={user?.name || "Admin"} />
                <AvatarFallback className="bg-emerald-100 text-emerald-700 font-bold">
                  {(user?.name || "A").charAt(0)}
                </AvatarFallback>
              </Avatar>
              <div className="hidden md:flex flex-col">
                <span className="text-sm font-bold text-slate-800 leading-none">{user?.name || "Admin Staff"}</span>
                <span className="text-xs text-slate-500 mt-1 leading-none">{user?.role?.name || "Administrator"}</span>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end" forceMount>
            <DropdownMenuLabel className="font-normal md:hidden">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-bold leading-none text-slate-900">{user?.name || "Admin Staff"}</p>
                <p className="text-xs leading-none text-slate-500">{user?.role?.name || "Administrator"}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="md:hidden" />
            <DropdownMenuItem onClick={() => router.push("/admin")}>Dashboard</DropdownMenuItem>
            
            {/* Nested Popover for Color Palette inside Dropdown (using sub menu pattern or just popover) */}
            <Popover>
              <PopoverTrigger asChild>
                <div className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-slate-100 focus:bg-slate-100 focus:text-slate-900 data-[disabled]:pointer-events-none data-[disabled]:opacity-50">
                  <Palette className="w-4 h-4 mr-2 text-slate-500" />
                  Change Color Palette
                </div>
              </PopoverTrigger>
              <PopoverContent side="left" className="w-44 p-2 bg-white border border-slate-200 shadow-md">
                <div className="grid grid-cols-2 gap-2">
                  {themePalette.map(theme => (
                    <button 
                      key={theme.name}
                      onClick={() => handleSelectTheme(theme)}
                      className={`flex flex-col items-center gap-1.5 p-2 rounded-lg transition-colors border ${
                        activeTheme === theme.name 
                          ? "bg-slate-50 border-slate-300 font-semibold" 
                          : "hover:bg-slate-50 border-transparent"
                      }`}
                      title={theme.name}
                    >
                      <div className={`w-7 h-7 rounded-full ${theme.bgClass} flex items-center justify-center text-white shadow-sm`}>
                        {activeTheme === theme.name && <Check className="w-3.5 h-3.5" />}
                      </div>
                      <span className="text-xs text-slate-600">{theme.name}</span>
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={handleLogout}
              className="text-danger focus:text-danger focus:bg-danger/5 cursor-pointer font-medium"
            >
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <AdminPageSearchDialog open={isSearchOpen} onOpenChange={setIsSearchOpen} />
    </header>
  );
}
