"use client";

import { ReactNode, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminTopbar } from "@/components/admin/AdminTopbar";
import { AdminPageProvider } from "@/contexts/AdminPageContext";
import { StaffAuthProvider, useStaffAuth } from "@/context/AuthContext";
import { StaffIdleTimeoutModal } from "@/components/admin/StaffIdleTimeoutModal";
import { ShieldCheck, Loader2, AlertTriangle, RotateCw, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

function AdminContentWrapper({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoading, isAuthenticated, authError, retryVerification } = useStaffAuth();
  const [mounted, setMounted] = useState(false);
  const isLoginPage = pathname === "/admin/login";
  const isPrintPage = pathname?.startsWith("/admin/pos/invoice-print");

  useEffect(() => {
    setMounted(true);
  }, []);

  // Role-based route redirection for Technician and Branch Admin
  useEffect(() => {
    if (isPrintPage) return;
    if (!isLoading && isAuthenticated && user && user.userType === "STAFF") {
      const roleName = user.role?.name?.toLowerCase() || "";
      const isTech = roleName.includes("technician");

      if (isTech) {
        if (pathname === "/admin") {
          router.replace("/admin/technician");
        } else if (
          pathname.startsWith("/admin/customers") ||
          pathname.startsWith("/admin/orders") ||
          pathname.startsWith("/admin/business-settings") ||
          pathname.startsWith("/admin/cms") ||
          pathname.startsWith("/admin/reports") ||
          pathname.startsWith("/admin/accounting")
        ) {
          router.replace("/admin/technician");
        }
      } else if (user.role?.scope === "OWN_BRANCH" || roleName.includes("branch")) {
        // Branch Admin barred from global business settings & CMS
        if (
          pathname.startsWith("/admin/business-settings") ||
          pathname.startsWith("/admin/cms") ||
          pathname.startsWith("/admin/3rd-party")
        ) {
          router.replace("/admin");
        }
      }
    }
  }, [isLoading, isAuthenticated, user, pathname, router, isPrintPage]);

  // If on login page or print-only page, render children cleanly without dashboard chrome
  if (isLoginPage || isPrintPage) {
    return <>{children}</>;
  }

  // If auth verification failed with timeout or network error, show clear error state with retry and login options
  if (authError) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white p-6 space-y-6">
        <div className="p-4 bg-amber-500/20 text-amber-400 rounded-2xl">
          <AlertTriangle className="w-12 h-12" />
        </div>
        <div className="text-center max-w-md space-y-2">
          <h2 className="text-xl font-bold tracking-tight">Authentication Verification Failed</h2>
          <p className="text-slate-400 text-sm leading-relaxed">{authError}</p>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <Button
            onClick={() => retryVerification?.()}
            className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-6 py-2.5 rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-sm"
          >
            <RotateCw className="w-4 h-4" />
            Retry
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              if (typeof window !== "undefined") {
                router.replace("/admin/login");
              }
            }}
            className="w-full sm:w-auto border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white px-6 py-2.5 rounded-xl flex items-center justify-center gap-2 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to login
          </Button>
        </div>
      </div>
    );
  }

  // If still mounting or verifying staff session, show clean isolated loader (identical on SSR & initial hydration)
  if (!mounted || isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white space-y-4">
        <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-2xl animate-pulse">
          <ShieldCheck className="w-10 h-10" />
        </div>
        <div className="flex items-center gap-2 text-slate-300 text-sm font-medium">
          <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
          <span>Verifying Staff Credentials...</span>
        </div>
      </div>
    );
  }

  // If unauthenticated or not staff, redirect to login cleanly
  if (!isAuthenticated || !user || user.userType !== "STAFF") {
    if (typeof window !== "undefined") {
      router.replace("/admin/login");
    }
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white space-y-4">
        <div className="p-3 bg-rose-500/20 text-rose-400 rounded-2xl">
          <ShieldCheck className="w-10 h-10" />
        </div>
        <p className="text-slate-400 text-sm">Redirecting to Staff Login Portal...</p>
      </div>
    );
  }

  // Authenticated staff user: render full ERP shell
  return (
    <AdminPageProvider>
      <StaffIdleTimeoutModal />
      <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
        {/* Desktop Sidebar */}
        <div className="hidden lg:block h-full">
          <AdminSidebar />
        </div>

        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <AdminTopbar />

          <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
            <div className="mx-auto max-w-7xl">{children}</div>
          </main>
        </div>
      </div>
    </AdminPageProvider>
  );
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <StaffAuthProvider>
      <AdminContentWrapper>{children}</AdminContentWrapper>
    </StaffAuthProvider>
  );
}

