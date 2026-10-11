"use client";

/**
 * Single source of truth for Staff session management.
 * Enforces sessionStorage-only storage so sessions do not persist across browser close.
 * Purges legacy localStorage keys on initialization.
 */

export const STAFF_TOKEN_KEY = "novamobile_staff_token";
export const STAFF_USER_KEY = "novamobile_staff_user";

// In-memory cache for ultra-fast access
let inMemoryStaffToken: string | null = null;
let inMemoryStaffUser: any | null = null;

// Idle configuration
export const DEFAULT_IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
export const DEFAULT_WARNING_TIMEOUT_MS = 60 * 1000;   // 1 minute

// Purge any legacy keys left in localStorage
export function purgeLegacyStaffLocalStorage(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STAFF_TOKEN_KEY);
    localStorage.removeItem(STAFF_USER_KEY);
    localStorage.removeItem("novamobile_staff_refresh_token");
  } catch {
    // Ignore storage restrictions
  }
}

// Auto-purge legacy keys immediately upon script load
if (typeof window !== "undefined") {
  purgeLegacyStaffLocalStorage();
}

/**
 * Retrieves the staff token strictly from sessionStorage (or in-memory cache).
 */
export function getStaffToken(): string | null {
  if (inMemoryStaffToken) return inMemoryStaffToken;
  if (typeof window === "undefined") return null;

  try {
    // Always check sessionStorage
    const token = sessionStorage.getItem(STAFF_TOKEN_KEY);
    inMemoryStaffToken = token;
    return token;
  } catch {
    return inMemoryStaffToken;
  }
}

/**
 * Sets or removes the staff token in sessionStorage.
 */
export function setStaffToken(token: string | null): void {
  inMemoryStaffToken = token;
  if (typeof window === "undefined") return;

  try {
    if (token) {
      sessionStorage.setItem(STAFF_TOKEN_KEY, token);
    } else {
      sessionStorage.removeItem(STAFF_TOKEN_KEY);
    }
    // Guarantee legacy localStorage is clean
    localStorage.removeItem(STAFF_TOKEN_KEY);
  } catch {
    // Ignore storage restrictions
  }
}

/**
 * Retrieves the staff user object from sessionStorage.
 */
export function getStaffUser<T = any>(): T | null {
  if (inMemoryStaffUser) return inMemoryStaffUser;
  if (typeof window === "undefined") return null;

  try {
    const raw = sessionStorage.getItem(STAFF_USER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    inMemoryStaffUser = parsed;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Sets or removes the staff user object in sessionStorage.
 */
export function setStaffUser(user: any): void {
  inMemoryStaffUser = user;
  if (typeof window === "undefined") return;

  try {
    if (user) {
      sessionStorage.setItem(STAFF_USER_KEY, JSON.stringify(user));
    } else {
      sessionStorage.removeItem(STAFF_USER_KEY);
    }
    localStorage.removeItem(STAFF_USER_KEY);
  } catch {
    // Ignore storage restrictions
  }
}

/**
 * Completely clears all staff session data, saved drafts, cached query keys, and selected branch.
 */
export function clearStaffSession(): void {
  inMemoryStaffToken = null;
  inMemoryStaffUser = null;

  if (typeof window === "undefined") return;

  try {
    // 1. Session Storage removal
    sessionStorage.removeItem(STAFF_TOKEN_KEY);
    sessionStorage.removeItem(STAFF_USER_KEY);

    // Remove any saved product form drafts in sessionStorage
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const key = sessionStorage.key(i);
      if (key && (key.startsWith("product_form_draft_") || key.includes("draft"))) {
        sessionStorage.removeItem(key);
      }
    }

    // 2. Legacy Local Storage removal
    localStorage.removeItem(STAFF_TOKEN_KEY);
    localStorage.removeItem(STAFF_USER_KEY);
    localStorage.removeItem("novamobile_staff_refresh_token");
    localStorage.removeItem("admin_selected_branch_id");
  } catch {
    // Ignore storage restrictions
  }
}
