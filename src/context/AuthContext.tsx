"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import {
  apiGet,
  apiPost,
  getCustomerToken,
  setCustomerToken,
  onCustomerUnauthorized,
  onStaffUnauthorized,
  onUnauthorized,
} from "@/lib/api-client";
import {
  getStaffToken,
  setStaffToken,
  getStaffUser,
  setStaffUser,
  clearStaffSession,
} from "@/lib/staff-session";

export { STAFF_USER_KEY, STAFF_TOKEN_KEY } from "@/lib/staff-session";

export interface UserRole {
  id: string;
  name: string;
  scope?: string;
  permissions?: Array<{
    id: string;
    module: string;
    action: string;
    allowed: boolean;
  }>;
}

export interface UserBranch {
  id: string;
  name: string;
  code?: string;
}

export interface AuthUser {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  photo?: string;
  avatar?: string;
  userType: "STAFF" | "CUSTOMER";
  roleId?: string;
  role?: UserRole;
  branchId?: string;
  branch?: UserBranch;
  isGlobal?: boolean;
  allowedBranches?: Array<{
    id: string;
    name: string;
    code?: string | null;
  }>;
  permissions?: Array<{
    module: string;
    action: string;
    allowed: boolean;
  }>;
}

export interface AuthContextType {
  user: AuthUser | null;
  isLoggedIn: boolean;
  isAuthenticated: boolean;
  isLoading: boolean;
  customerName: string;
  login: (credentials: { emailOrPhone: string; password: string; email?: string }, isStaff?: boolean) => Promise<any>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  hasPermission: (module: string, action: string) => boolean;
  authError?: string | null;
  retryVerification?: () => Promise<void>;
}

export const CUSTOMER_USER_KEY = "novamobile_customer_user";

// 1. CUSTOMER AUTH CONTEXT
const CustomerAuthContext = createContext<AuthContextType | undefined>(undefined);

export function CustomerAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchCurrentUser = useCallback(async () => {
    try {
      const token = getCustomerToken();
      if (!token) {
        setUser(null);
        if (typeof window !== "undefined") localStorage.removeItem(CUSTOMER_USER_KEY);
        return null;
      }
      const profile = await apiGet<AuthUser>("/auth/me", undefined, { authScope: "CUSTOMER" });
      if (profile && profile.userType === "CUSTOMER") {
        setUser(profile);
        if (typeof window !== "undefined") {
          localStorage.setItem(CUSTOMER_USER_KEY, JSON.stringify(profile));
        }
        return profile;
      } else {
        setUser(null);
        if (typeof window !== "undefined") localStorage.removeItem(CUSTOMER_USER_KEY);
        return null;
      }
    } catch {
      setUser(null);
      if (typeof window !== "undefined") localStorage.removeItem(CUSTOMER_USER_KEY);
      return null;
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (typeof window !== "undefined" && window.location.pathname.startsWith("/admin")) {
          if (mounted) setIsLoading(false);
          return;
        }

        // Restore cached customer profile on client mount
        if (typeof window !== "undefined") {
          try {
            const saved = localStorage.getItem(CUSTOMER_USER_KEY);
            if (saved) {
              const parsed = JSON.parse(saved);
              if (parsed && parsed.userType === "CUSTOMER" && mounted) {
                setUser(parsed);
              }
            }
          } catch {
            // ignore
          }
        }

        const token = getCustomerToken();
        const hasSavedUser = typeof window !== "undefined" && !!localStorage.getItem(CUSTOMER_USER_KEY);

        if (token) {
          const profile = await fetchCurrentUser();
          if (!profile && hasSavedUser) {
            const res = await apiPost<{ accessToken: string }>("/auth/customer/refresh", undefined, { authScope: "CUSTOMER" });
            if (res?.accessToken) {
              setCustomerToken(res.accessToken);
              if (mounted) await fetchCurrentUser();
            }
          }
        } else if (hasSavedUser) {
          const res = await apiPost<{ accessToken: string }>("/auth/customer/refresh", undefined, { authScope: "CUSTOMER" });
          if (res?.accessToken) {
            setCustomerToken(res.accessToken);
            if (mounted) await fetchCurrentUser();
          }
        }
      } catch {
        // Not logged in
      } finally {
        if (mounted) setIsLoading(false);
      }
    })();

    const cleanup = onCustomerUnauthorized(() => {
      setUser(null);
      setCustomerToken(null);
      if (typeof window !== "undefined") localStorage.removeItem(CUSTOMER_USER_KEY);
    });

    return () => {
      mounted = false;
      cleanup();
    };
  }, [fetchCurrentUser]);

  const login = async (credentials: { emailOrPhone: string; password: string; email?: string }) => {
    setIsLoading(true);
    try {
      const payload = {
        emailOrPhone: credentials.emailOrPhone || credentials.email,
        password: credentials.password,
      };
      const res = await apiPost<{ accessToken: string }>("/auth/customer/login", payload, { authScope: "CUSTOMER" });
      if (res?.accessToken) {
        setCustomerToken(res.accessToken);
        const profile = await fetchCurrentUser();
        return profile;
      }
      throw new Error("Failed to obtain customer access token");
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await apiPost("/auth/customer/logout", undefined, { authScope: "CUSTOMER" });
    } catch {
      // Ignore
    } finally {
      setUser(null);
      setCustomerToken(null);
      if (typeof window !== "undefined") localStorage.removeItem(CUSTOMER_USER_KEY);
    }
  };

  const refreshUser = async () => {
    await fetchCurrentUser();
  };

  const hasPermission = () => false;

  return (
    <CustomerAuthContext.Provider
      value={{
        user,
        isLoggedIn: !!user,
        isAuthenticated: !!user,
        isLoading,
        customerName: user ? user.name : "",
        login,
        logout,
        refreshUser,
        hasPermission,
      }}
    >
      {children}
    </CustomerAuthContext.Provider>
  );
}

export function useCustomerAuth() {
  const context = useContext(CustomerAuthContext);
  if (!context) {
    throw new Error("useCustomerAuth must be used within a CustomerAuthProvider");
  }
  return context;
}

// 2. STAFF AUTH CONTEXT & PERSISTENT IN-MEMORY CACHE
export const StaffAuthContext = createContext<AuthContextType | undefined>(undefined);

interface VerifiedStaffCache {
  user: AuthUser;
  token: string;
  verifiedAt: number;
}

let inMemoryStaffCache: VerifiedStaffCache | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes in-memory cache

async function fetchStaffProfileWithTimeout(
  token: string,
  timeoutMs = 10000,
  retryCount = 1,
): Promise<{ success: boolean; data?: AuthUser | null; isUnauthorized?: boolean; error?: string }> {
  for (let attempt = 0; attempt <= retryCount; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const profile = await apiGet<AuthUser>("/auth/me", undefined, {
        authScope: "STAFF",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      clearTimeout(timer);

      if (profile && profile.userType === "STAFF") {
        return { success: true, data: profile };
      } else {
        return { success: false, isUnauthorized: true, error: "Not a staff account" };
      }
    } catch (err: any) {
      clearTimeout(timer);

      const is401 = err?.statusCode === 401 || err?.status === 401 || err?.message?.includes("401");
      if (is401) {
        return { success: false, isUnauthorized: true, error: "Session expired or unauthorized" };
      }

      const isAbort = err?.name === "AbortError" || controller.signal.aborted;
      const errorMsg = isAbort
        ? "Staff verification timed out (10s)"
        : err?.message || "Network error during staff verification";

      if (attempt < retryCount) {
        await new Promise((r) => setTimeout(r, 500));
        continue;
      }

      return { success: false, error: errorMsg };
    }
  }

  return { success: false, error: "Staff verification failed after retry" };
}

export function StaffAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const verifySession = useCallback(async (isManualRetry = false) => {
    const token = getStaffToken();
    if (!token) {
      setUser(null);
      setIsLoading(false);
      setAuthError(null);
      inMemoryStaffCache = null;
      setStaffUser(null);
      return null;
    }

    const isCacheFresh =
      !isManualRetry &&
      inMemoryStaffCache &&
      inMemoryStaffCache.token === token &&
      Date.now() - inMemoryStaffCache.verifiedAt < CACHE_TTL_MS;

    if (isCacheFresh && inMemoryStaffCache) {
      setUser(inMemoryStaffCache.user);
      setIsLoading(false);
      setAuthError(null);
      return inMemoryStaffCache.user;
    }

    // Only block if we have no rendered user or on manual retry
    if (!user || isManualRetry) {
      setIsLoading(true);
      setAuthError(null);
    }

    const res = await fetchStaffProfileWithTimeout(token, 10000, 1);

    if (res.success && res.data) {
      setUser(res.data);
      setAuthError(null);
      setIsLoading(false);
      inMemoryStaffCache = {
        user: res.data,
        token,
        verifiedAt: Date.now(),
      };
      setStaffUser(res.data);
      return res.data;
    }

    if (res.isUnauthorized) {
      inMemoryStaffCache = null;
      setUser(null);
      clearStaffSession();
      setIsLoading(false);
      setAuthError(null);
      if (typeof window !== "undefined") {
        window.location.href = "/admin/login";
      }
      return null;
    }

    // Timeout or network error
    if (!user) {
      setIsLoading(false);
      setAuthError(res.error || "Staff verification timed out. Please check network connection.");
    } else {
      console.warn("Background staff revalidation notice:", res.error);
      setIsLoading(false);
    }

    return null;
  }, [user]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const token = getStaffToken();
        const saved = getStaffUser();
        if (token && saved && mounted) {
          if (saved.userType === "STAFF") {
            setUser(saved);
            setIsLoading(false);
            if (!inMemoryStaffCache) {
              inMemoryStaffCache = {
                user: saved,
                token,
                verifiedAt: Date.now(),
              };
            }
          }
        }

        if (token) {
          await verifySession(false);
        } else {
          if (mounted) {
            setUser(null);
            setIsLoading(false);
          }
        }
      } catch {
        if (mounted) setIsLoading(false);
      }
    })();

    const cleanup = onStaffUnauthorized(() => {
      inMemoryStaffCache = null;
      setUser(null);
      clearStaffSession();
    });

    return () => {
      mounted = false;
      cleanup();
    };
  }, []);

  const login = async (credentials: { emailOrPhone: string; password: string; email?: string }) => {
    setIsLoading(true);
    setAuthError(null);
    try {
      const payload = {
        email: credentials.email || credentials.emailOrPhone,
        emailOrPhone: credentials.emailOrPhone || credentials.email,
        password: credentials.password,
      };
      const res = await apiPost<{ accessToken: string }>("/auth/staff/login", payload, { authScope: "STAFF" });
      if (res?.accessToken) {
        setStaffToken(res.accessToken);
        const verifyRes = await fetchStaffProfileWithTimeout(res.accessToken, 10000, 1);
        if (verifyRes.success && verifyRes.data) {
          setUser(verifyRes.data);
          inMemoryStaffCache = {
            user: verifyRes.data,
            token: res.accessToken,
            verifiedAt: Date.now(),
          };
          setStaffUser(verifyRes.data);
          return verifyRes.data;
        } else {
          throw new Error(verifyRes.error || "Failed to fetch staff profile");
        }
      }
      throw new Error("Failed to obtain staff access token");
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await apiPost("/auth/staff/logout", undefined, { authScope: "STAFF" });
    } catch {
      // Ignore
    } finally {
      inMemoryStaffCache = null;
      setUser(null);
      clearStaffSession();
    }
  };

  const refreshUser = async () => {
    await verifySession(true);
  };

  const retryVerification = async () => {
    await verifySession(true);
  };

  const hasPermission = useCallback(
    (moduleName: string, action = "READ"): boolean => {
      if (!user || user.userType !== "STAFF") return false;

      const roleName = user.role?.name?.toLowerCase() || "";
      const isGlobalAdmin =
        roleName === "admin" ||
        roleName === "super admin" ||
        (user.role?.scope === "GLOBAL" && roleName.includes("admin"));
      if (isGlobalAdmin) return true;

      const perms = user.role?.permissions || user.permissions || [];
      const match = perms.find(
        (p) =>
          p.module?.toUpperCase() === moduleName?.toUpperCase() &&
          p.action?.toUpperCase() === action?.toUpperCase(),
      );
      return match ? match.allowed : false;
    },
    [user],
  );

  return (
    <StaffAuthContext.Provider
      value={{
        user,
        isLoggedIn: !!user,
        isAuthenticated: !!user,
        isLoading,
        customerName: user ? user.name : "",
        login,
        logout,
        refreshUser,
        hasPermission,
        authError,
        retryVerification,
      }}
    >
      {children}
    </StaffAuthContext.Provider>
  );
}

export function useStaffAuth() {
  const context = useContext(StaffAuthContext);
  if (!context) {
    throw new Error("useStaffAuth must be used within a StaffAuthProvider");
  }
  return context;
}

// 3. UNIFIED / ADAPTIVE AUTH PROVIDER (Wraps customer auth at root level)
export function AuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <CustomerAuthProvider>
      {children}
    </CustomerAuthProvider>
  );
}

// Adaptive useAuth: automatically routes to StaffAuth when in /admin, else CustomerAuth
export function useAuth() {
  const staffCtx = useContext(StaffAuthContext);
  const customerCtx = useContext(CustomerAuthContext);

  if (typeof window !== "undefined" && window.location.pathname.startsWith("/admin")) {
    if (staffCtx) return staffCtx;
  }

  if (customerCtx) return customerCtx;
  if (staffCtx) return staffCtx;

  throw new Error("useAuth must be used within an AuthProvider");
}

export const useMockAuth = useAuth;
export const MockAuthProvider = AuthProvider;

