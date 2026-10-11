"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ShieldAlert, LogOut, CheckCircle2, AlertTriangle } from "lucide-react";
import {
  getStaffToken,
  clearStaffSession,
  DEFAULT_IDLE_TIMEOUT_MS,
  DEFAULT_WARNING_TIMEOUT_MS,
} from "@/lib/staff-session";

export function StaffIdleTimeoutModal() {
  const router = useRouter();
  const pathname = usePathname();
  const [showWarning, setShowWarning] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(60);
  const [unsavedWork, setUnsavedWork] = useState<string[]>([]);
  const lastActivityRef = useRef<number>(Date.now());
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);

  const isLoginPage = pathname === "/admin/login";

  const checkForUnsavedWork = useCallback(() => {
    if (typeof window === "undefined") return [];
    const detected: string[] = [];
    try {
      // Check POS cart
      const posCount = sessionStorage.getItem("novamobile_pos_cart_count");
      if (posCount && Number(posCount) > 0) {
        detected.push(`POS Cart (${posCount} items)`);
      }
      // Check Product form drafts
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && key.startsWith("novamobile_draft_product_")) {
          detected.push("Product Form (Draft)");
          break;
        }
      }
    } catch {}
    return detected;
  }, []);

  const handleLogout = useCallback(() => {
    setShowWarning(false);
    clearStaffSession();
    if (typeof window !== "undefined") {
      window.location.href = "/admin/login";
    } else {
      router.push("/admin/login");
    }
  }, [router]);

  const resetTimer = useCallback(() => {
    lastActivityRef.current = Date.now();
    if (showWarning) {
      setShowWarning(false);
    }
  }, [showWarning]);

  // Back button protection (bfcache pageshow event)
  useEffect(() => {
    const handlePageShow = (e: PageTransitionEvent) => {
      if (!isLoginPage && pathname.startsWith("/admin")) {
        const token = getStaffToken();
        if (!token) {
          window.location.href = "/admin/login";
        }
      }
    };

    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, [isLoginPage, pathname]);

  // Activity listeners & heartbeat: includes typing, barcode scanners (keypress/input), clicks, scrolls
  useEffect(() => {
    if (isLoginPage) return;

    const events = [
      "mousedown",
      "mousemove",
      "keydown",
      "keypress",
      "keyup",
      "input",
      "change",
      "touchstart",
      "scroll",
      "click",
    ];
    const handleActivity = () => {
      lastActivityRef.current = Date.now();
    };

    events.forEach((ev) => window.addEventListener(ev, handleActivity, { passive: true }));

    // Heartbeat check every 5 seconds
    const interval = setInterval(() => {
      const token = getStaffToken();
      if (!token) return;

      const elapsed = Date.now() - lastActivityRef.current;
      const warningThreshold = DEFAULT_IDLE_TIMEOUT_MS - DEFAULT_WARNING_TIMEOUT_MS;

      if (elapsed >= DEFAULT_IDLE_TIMEOUT_MS) {
        handleLogout();
      } else if (elapsed >= warningThreshold && !showWarning) {
        setUnsavedWork(checkForUnsavedWork());
        setShowWarning(true);
        const remaining = Math.max(1, Math.round((DEFAULT_IDLE_TIMEOUT_MS - elapsed) / 1000));
        setSecondsRemaining(remaining);
      }
    }, 5000);

    return () => {
      events.forEach((ev) => window.removeEventListener(ev, handleActivity));
      clearInterval(interval);
    };
  }, [isLoginPage, showWarning, handleLogout, checkForUnsavedWork]);

  // Countdown timer when warning modal is visible
  useEffect(() => {
    if (!showWarning) return;

    countdownRef.current = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(countdownRef.current!);
          handleLogout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [showWarning, handleLogout]);

  if (!showWarning || isLoginPage) return null;

  return (
    <Dialog open={showWarning} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md border-amber-200 bg-white p-6 shadow-2xl">
        <DialogHeader className="space-y-3">
          <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <DialogTitle className="text-center text-lg font-bold text-slate-900">
            Session Expiring Due to Inactivity
          </DialogTitle>
          <DialogDescription className="text-center text-sm text-slate-600">
            For security on shared devices, your admin session will automatically close in{" "}
            <span className="font-bold text-red-600 text-base">{secondsRemaining}</span> seconds.
          </DialogDescription>

          {unsavedWork.length > 0 && (
            <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-left text-xs text-amber-900 space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-amber-800">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Unsaved Work Warning</span>
              </div>
              <p className="text-amber-700">
                You have active unsaved work in: <span className="font-bold">{unsavedWork.join(", ")}</span>. Logging out now will discard these changes.
              </p>
            </div>
          )}
        </DialogHeader>

        <DialogFooter className="mt-6 flex flex-col sm:flex-row gap-2 sm:justify-center">
          <Button
            type="button"
            variant="outline"
            onClick={handleLogout}
            className="w-full sm:w-auto border-slate-300 text-slate-700 hover:bg-slate-100"
          >
            <LogOut className="w-4 h-4 mr-2" /> Log Out Now
          </Button>
          <Button
            type="button"
            onClick={resetTimer}
            className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
          >
            <CheckCircle2 className="w-4 h-4 mr-2" /> Stay Signed In
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
