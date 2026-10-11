"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import { useState, useEffect } from "react";
import { 
  Building2,
  ChevronDown,
  Expand,
  Moon,
  Power,
  User,
  PanelLeftClose,
  PanelLeftOpen,
  Wrench,
  PlusCircle,
  PieChart
} from "lucide-react";
import { NavItem } from "@/lib/mock-data/admin-nav";
import { getVisibleNavConfig } from "@/lib/admin-nav-service";
import { useAdminPage } from "@/contexts/AdminPageContext";
import { useStaffAuth } from "@/context/AuthContext";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

function NavItemComponent({ item, isCollapsed, level = 0 }: { item: NavItem, isCollapsed: boolean, level?: number }) {
  const pathname = usePathname();
  const isActive = item.href
    ? (item.href === "/admin" ? pathname === "/admin" : (pathname === item.href || pathname.startsWith(`${item.href}/`)))
    : false;
  const isParentActive = item.children?.some(child =>
    child.href ? (child.href === "/admin" ? pathname === "/admin" : (pathname === child.href || pathname.startsWith(`${child.href}/`))) : false
  );
  const [isOpen, setIsOpen] = useState(isParentActive);

  useEffect(() => {
    if (isParentActive) {
      setIsOpen(true);
    }
  }, [isParentActive]);

  if (item.children) {
    return (
      <Collapsible open={isOpen} onOpenChange={setIsOpen} className="w-full">
        <CollapsibleTrigger asChild>
          <button className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors hover:bg-slate-100 text-slate-700
            ${isParentActive ? 'bg-emerald-50 text-emerald-600' : ''}
            ${level > 0 ? 'ml-4 w-[calc(100%-1rem)]' : ''}
          `}>
            <div className="flex items-center gap-3 overflow-hidden">
              {item.icon && <item.icon className={`w-5 h-5 flex-shrink-0 ${isParentActive ? 'text-emerald-600' : 'text-slate-500'}`} />}
              {!isCollapsed && <span className="font-medium truncate text-sm">{item.label}</span>}
            </div>
            {!isCollapsed && (
              <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''} ${isParentActive ? 'text-emerald-600' : 'text-slate-400'}`} />
            )}
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-1 mt-1 data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down overflow-hidden">
          {!isCollapsed && (
            <div className="ml-[1.35rem] pl-4 border-l border-slate-200 py-1 space-y-1">
              {item.children.map((child, idx) => (
                <NavItemComponent key={idx} item={child} isCollapsed={isCollapsed} level={level + 1} />
              ))}
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>
    );
  }

  const content = (
    <Link
      href={item.href || "#"}
      className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm
        ${isActive 
          ? 'bg-emerald-50 text-emerald-600 border-l-2 border-emerald-600 font-medium' 
          : 'text-slate-700 hover:bg-slate-100 border-l-2 border-transparent'
        }
        ${level > 0 ? 'pl-4' : ''}
      `}
    >
      {item.icon && <item.icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-emerald-600' : 'text-slate-500'}`} />}
      {!isCollapsed && <span className="truncate">{item.label}</span>}
    </Link>
  );

  if (isCollapsed) {
    return (
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger asChild>
            {content}
          </TooltipTrigger>
          <TooltipContent side="right">{item.label}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return content;
}

export function AdminSidebar() {
  const { isSidebarCollapsed, setIsSidebarCollapsed } = useAdminPage();
  const { user, hasPermission, logout } = useStaffAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    router.push("/admin/login");
  };

  const visibleNavConfig = getVisibleNavConfig(user, hasPermission);

  return (
    <div className={`flex flex-col h-full bg-white border-r border-slate-200 transition-all duration-300 ${isSidebarCollapsed ? 'w-[72px]' : 'w-[260px]'}`}>
      <div className="h-16 flex items-center justify-between px-4 border-b border-slate-200 flex-shrink-0">
        {!isSidebarCollapsed && (
          <div className="flex items-center gap-2 overflow-hidden">
            <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-white">
              <Image src="/images/logo-icon.jpeg" alt="Logo" width={32} height={32} className="rounded-full" />
            </div>
            <span className="font-bold text-slate-800 whitespace-nowrap text-lg">Mobile Hub BD</span>
          </div>
        )}
        {isSidebarCollapsed && (
          <div className="w-full flex justify-center">
            <div className="w-8 h-8 rounded-full flex items-center justify-center bg-white">
              <Image src="/images/logo-icon.jpeg" alt="Logo" width={32} height={32} className="rounded-full" />
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 space-y-6 scrollbar-thin">
        {visibleNavConfig.map((group, groupIndex) => (
          <div key={groupIndex} className="space-y-1">
            {group.groupLabel && !isSidebarCollapsed && (
              <div className="px-3 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                {group.groupLabel}
              </div>
            )}
            {group.items.map((item, itemIndex) => (
              <NavItemComponent key={itemIndex} item={item} isCollapsed={isSidebarCollapsed} />
            ))}
          </div>
        ))}
      </div>

      <div className="p-3 border-t border-slate-200 flex flex-col gap-2 flex-shrink-0">
        <div className={`flex items-center gap-2 ${isSidebarCollapsed ? 'flex-col' : 'justify-between'} text-slate-500`}>
          <button className="p-2 hover:bg-slate-200 rounded-md transition-colors" title="Toggle Sidebar" onClick={() => setIsSidebarCollapsed(p => !p)}>
            {isSidebarCollapsed ? <PanelLeftOpen className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
          </button>
          <button className="p-2 hover:bg-slate-200 rounded-md transition-colors" title="Fullscreen">
            <Expand className="w-5 h-5" />
          </button>
          <button className="p-2 hover:bg-slate-200 rounded-md transition-colors" title="Theme">
            <Moon className="w-5 h-5" />
          </button>
          <button className="p-2 hover:bg-slate-200 rounded-md transition-colors" title="Profile">
            <User className="w-5 h-5" />
          </button>
        </div>
        
        <button 
          onClick={handleLogout}
          className={`flex items-center gap-3 px-3 py-2 rounded-lg text-danger hover:bg-danger/10 transition-colors w-full text-left ${isSidebarCollapsed ? 'justify-center' : ''}`}
        >
          <Power className="w-5 h-5 flex-shrink-0" />
          {!isSidebarCollapsed && <span className="font-medium text-sm">Logout Account</span>}
        </button>
      </div>
    </div>
  );
}
