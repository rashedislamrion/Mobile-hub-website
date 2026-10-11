export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

export const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

if (typeof window !== 'undefined') {
  if (process.env.NODE_ENV === 'production' && !process.env.NEXT_PUBLIC_API_URL) {
    console.error(
      '%c[FATAL CONFIG ERROR] NEXT_PUBLIC_API_URL is NOT configured in production! Set NEXT_PUBLIC_API_URL to your backend API URL.',
      'background: red; color: white; font-size: 14px; font-weight: bold; padding: 6px;',
    );
  }
  console.log(`[MobileHubBD Client Init] API Base URL: ${API_BASE_URL}`);
}

import {
  getStaffToken as getSessionStaffToken,
  setStaffToken as setSessionStaffToken,
  STAFF_TOKEN_KEY as SESSION_STAFF_TOKEN_KEY,
} from './staff-session';

export const CUSTOMER_TOKEN_KEY = 'novamobile_customer_token';
export const STAFF_TOKEN_KEY = SESSION_STAFF_TOKEN_KEY;

let inMemoryCustomerToken: string | null =
  typeof window !== 'undefined' ? localStorage.getItem(CUSTOMER_TOKEN_KEY) : null;

let customerUnauthorizedListeners: Array<() => void> = [];
let staffUnauthorizedListeners: Array<() => void> = [];
let genericUnauthorizedListeners: Array<() => void> = [];

export function getCustomerToken(): string | null {
  if (!inMemoryCustomerToken && typeof window !== 'undefined') {
    inMemoryCustomerToken = localStorage.getItem(CUSTOMER_TOKEN_KEY);
  }
  return inMemoryCustomerToken;
}

export function setCustomerToken(token: string | null): void {
  inMemoryCustomerToken = token;
  if (typeof window !== 'undefined') {
    if (token) {
      localStorage.setItem(CUSTOMER_TOKEN_KEY, token);
    } else {
      localStorage.removeItem(CUSTOMER_TOKEN_KEY);
    }
  }
}

export function getStaffToken(): string | null {
  return getSessionStaffToken();
}

export function setStaffToken(token: string | null): void {
  setSessionStaffToken(token);
}

export function getEffectiveToken(
  endpoint?: string,
  explicitScope?: 'STAFF' | 'CUSTOMER'
): string | null {
  if (explicitScope === 'STAFF') return getStaffToken();
  if (explicitScope === 'CUSTOMER') return getCustomerToken();

  const isStaffTarget =
    (typeof window !== 'undefined' && window.location.pathname.startsWith('/admin')) ||
    (endpoint && (endpoint.includes('/auth/staff') || endpoint.includes('/stock-adjustments/batch')));

  if (isStaffTarget) {
    return getStaffToken() || getCustomerToken();
  }

  const isCustomerTarget =
    endpoint && (endpoint.includes('/auth/customer') || endpoint.includes('/orders/checkout'));

  if (isCustomerTarget) {
    return getCustomerToken() || getStaffToken();
  }

  return (
    (typeof window !== 'undefined' && window.location.pathname.startsWith('/admin')
      ? getStaffToken() || getCustomerToken()
      : getCustomerToken() || getStaffToken())
  );
}

// Backwards-compatible aliases
export function getAccessToken(): string | null {
  return getEffectiveToken();
}

export function getAuthToken(): string | null {
  return getEffectiveToken();
}

export function setAccessToken(token: string | null, scope?: 'STAFF' | 'CUSTOMER'): void {
  if (scope === 'STAFF') {
    setStaffToken(token);
    return;
  }
  if (scope === 'CUSTOMER') {
    setCustomerToken(token);
    return;
  }
  if (typeof window !== 'undefined' && window.location.pathname.startsWith('/admin')) {
    setStaffToken(token);
  } else {
    setCustomerToken(token);
  }
}

export function onUnauthorized(listener: () => void): () => void {
  genericUnauthorizedListeners.push(listener);
  return () => {
    genericUnauthorizedListeners = genericUnauthorizedListeners.filter((l) => l !== listener);
  };
}

export function onStaffUnauthorized(listener: () => void): () => void {
  staffUnauthorizedListeners.push(listener);
  return () => {
    staffUnauthorizedListeners = staffUnauthorizedListeners.filter((l) => l !== listener);
  };
}

export function onCustomerUnauthorized(listener: () => void): () => void {
  customerUnauthorizedListeners.push(listener);
  return () => {
    customerUnauthorizedListeners = customerUnauthorizedListeners.filter((l) => l !== listener);
  };
}

function notifyUnauthorized(scope?: 'STAFF' | 'CUSTOMER') {
  if (scope === 'STAFF') {
    staffUnauthorizedListeners.forEach((l) => {
      try { l(); } catch (e) { console.error(e); }
    });
  } else if (scope === 'CUSTOMER') {
    customerUnauthorizedListeners.forEach((l) => {
      try { l(); } catch (e) { console.error(e); }
    });
  }
  genericUnauthorizedListeners.forEach((listener) => {
    try {
      listener();
    } catch (e) {
      console.error('Error in unauthorized listener', e);
    }
  });
}

export function getImageUrl(path?: string | null, fallback = '/images/placeholder.png'): string {
  if (!path) return fallback;
  if (typeof path !== 'string') return fallback;
  if (path.includes('placehold.co')) return fallback;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  if (path.startsWith('/uploads/')) return `${BACKEND_URL}${path}`;
  if (path.startsWith('uploads/')) return `${BACKEND_URL}/${path}`;
  if (path.startsWith('/')) return path;
  return `${BACKEND_URL}/uploads/${path}`;
}

export class ApiError extends Error {
  statusCode: number;
  data: any;

  constructor(message: string, statusCode: number, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.data = data;
  }
}

let isRefreshingCustomer = false;
let customerRefreshPromise: Promise<string | null> | null = null;

let isRefreshingStaff = false;
let staffRefreshPromise: Promise<string | null> | null = null;

export async function refreshCustomerToken(): Promise<string | null> {
  if (isRefreshingCustomer && customerRefreshPromise) {
    return customerRefreshPromise;
  }

  isRefreshingCustomer = true;
  customerRefreshPromise = (async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/customer/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      if (!res.ok) {
        setCustomerToken(null);
        notifyUnauthorized('CUSTOMER');
        return null;
      }

      const data = await res.json();
      const newToken = data.accessToken;
      if (newToken) {
        setCustomerToken(newToken);
        return newToken;
      }
      return null;
    } catch {
      setCustomerToken(null);
      notifyUnauthorized('CUSTOMER');
      return null;
    } finally {
      isRefreshingCustomer = false;
      customerRefreshPromise = null;
    }
  })();

  return customerRefreshPromise;
}

export async function refreshStaffToken(): Promise<string | null> {
  if (isRefreshingStaff && staffRefreshPromise) {
    return staffRefreshPromise;
  }

  isRefreshingStaff = true;
  staffRefreshPromise = (async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/staff/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      if (!res.ok) {
        setStaffToken(null);
        notifyUnauthorized('STAFF');
        return null;
      }

      const data = await res.json();
      const newToken = data.accessToken;
      if (newToken) {
        setStaffToken(newToken);
        return newToken;
      }
      return null;
    } catch {
      setStaffToken(null);
      notifyUnauthorized('STAFF');
      return null;
    } finally {
      isRefreshingStaff = false;
      staffRefreshPromise = null;
    }
  })();

  return staffRefreshPromise;
}

export interface ApiFetchOptions extends RequestInit {
  authScope?: 'STAFF' | 'CUSTOMER';
}

export async function apiFetch<T>(
  endpoint: string,
  options: ApiFetchOptions = {},
  isRetry = false,
): Promise<T> {
  const url = endpoint.startsWith('http')
    ? endpoint
    : `${API_BASE_URL}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

  const headers = new Headers(options.headers || {});

  const token = getEffectiveToken(endpoint, options.authScope);
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  if (typeof window !== 'undefined') {
    const isAdmin = window.location.pathname.startsWith('/admin') || options.authScope === 'STAFF';
    if (isAdmin && !headers.has('x-branch-id')) {
      const savedBranchId = localStorage.getItem('admin_selected_branch_id');
      if (savedBranchId) {
        headers.set('x-branch-id', savedBranchId);
      }
    }
  }

  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  if (!isFormData && !headers.has('Content-Type') && options.body && typeof options.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }

  const config: RequestInit = {
    ...options,
    headers,
    ...(typeof window !== 'undefined' ? { credentials: options.credentials || 'include' } : {}),
  };

  try {
    const response = await fetch(url, config);

    if (
      response.status === 401 &&
      !isRetry &&
      !endpoint.includes("login") &&
      !endpoint.includes("refresh") &&
      !endpoint.includes("register")
    ) {
      const isStaff =
        options.authScope === 'STAFF' ||
        (typeof window !== 'undefined' && window.location.pathname.startsWith('/admin')) ||
        endpoint.includes('/auth/staff');

      const newToken = isStaff
        ? await refreshStaffToken()
        : await refreshCustomerToken();

      if (newToken) {
        headers.set('Authorization', `Bearer ${newToken}`);
        return apiFetch<T>(endpoint, { ...options, headers }, true);
      }
    }

    if (!response.ok) {
      let errorBody: any = {};
      try {
        errorBody = await response.json();
      } catch {
        errorBody = { message: response.statusText };
      }

      const message =
        Array.isArray(errorBody.message)
          ? errorBody.message.join(', ')
          : errorBody.message || errorBody.error || `HTTP error ${response.status}`;

      throw new ApiError(message, response.status, errorBody);
    }

    if (response.status === 204) {
      return {} as T;
    }

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return (await response.json()) as T;
    }

    return (await response.text()) as unknown as T;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError((error as Error).message || 'Network request failed', 0);
  }
}

export function buildQueryString(params?: Record<string, any>): string {
  if (!params) return '';
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.append(key, String(value));
    }
  });
  const qs = searchParams.toString();
  return qs ? `?${qs}` : '';
}

export async function apiGet<T>(
  endpoint: string,
  params?: Record<string, any>,
  options?: ApiFetchOptions,
): Promise<T> {
  const qs = buildQueryString(params);
  return apiFetch<T>(`${endpoint}${qs}`, { ...options, method: 'GET' });
}

export async function apiPost<T>(
  endpoint: string,
  data?: any,
  options?: ApiFetchOptions,
): Promise<T> {
  const isFormData = typeof FormData !== 'undefined' && data instanceof FormData;
  const body = isFormData ? data : data !== undefined ? JSON.stringify(data) : undefined;

  return apiFetch<T>(endpoint, {
    ...options,
    method: 'POST',
    body,
  });
}

export async function apiPatch<T>(
  endpoint: string,
  data?: any,
  options?: ApiFetchOptions,
): Promise<T> {
  const isFormData = typeof FormData !== 'undefined' && data instanceof FormData;
  const body = isFormData ? data : data !== undefined ? JSON.stringify(data) : undefined;

  return apiFetch<T>(endpoint, {
    ...options,
    method: 'PATCH',
    body,
  });
}

export async function apiDelete<T>(
  endpoint: string,
  options?: ApiFetchOptions,
): Promise<T> {
  return apiFetch<T>(endpoint, { ...options, method: 'DELETE' });
}

