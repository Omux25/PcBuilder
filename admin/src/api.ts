/**
 * Admin API client — auth-aware fetch wrapper.
 * Stores the access token in memory. On 401, attempts token refresh.
 * On refresh failure, redirects to /admin/login.
 */

const BASE = import.meta.env.VITE_API_BASE_URL ?? '/api';

let accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

async function request<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string> ?? {}),
  };

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const res = await fetch(`${BASE}${path}`, { ...init, headers, credentials: 'include' });

  // Attempt token refresh on 401
  if (res.status === 401 && retry) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      return request<T>(path, init, false);
    }
    // Refresh failed — redirect to login
    window.location.href = '/admin/login';
    throw new Error('Session expired');
  }

  const data = await res.json();

  if (!res.ok) {
    const message = data?.error?.message ?? `HTTP ${res.status}`;
    throw new Error(message);
  }

  return data as T;
}

async function tryRefresh(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });
    if (!res.ok) return false;
    const data = await res.json() as { access_token: string };
    setAccessToken(data.access_token);
    return true;
  } catch {
    return false;
  }
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export async function login(username: string, password: string): Promise<void> {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message ?? 'Login failed');
  setAccessToken(data.access_token);
}

export async function logout(): Promise<void> {
  await fetch(`${BASE}/auth/logout`, { method: 'POST', credentials: 'include' });
  setAccessToken(null);
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export const getDashboard = () => request<any>('/admin/dashboard');

// ── Components ────────────────────────────────────────────────────────────────

export const getAdminComponents = (params: Record<string, string> = {}) => {
  const qs = new URLSearchParams(params).toString();
  return request<any>(`/admin/components${qs ? `?${qs}` : ''}`);
};

export const createAdminComponent = (data: Record<string, unknown>) =>
  request<any>('/admin/components', { method: 'POST', body: JSON.stringify(data) });

export const updateAdminComponent = (id: number, data: Record<string, unknown>) =>
  request<any>(`/admin/components/${id}`, { method: 'PUT', body: JSON.stringify(data) });

export const deleteAdminComponent = (id: number) =>
  request<any>(`/admin/components/${id}`, { method: 'DELETE' });

// ── Retailers ─────────────────────────────────────────────────────────────────

export const getAdminRetailers = () => request<any>('/admin/retailers');

export const createAdminRetailer = (data: Record<string, unknown>) =>
  request<any>('/admin/retailers', { method: 'POST', body: JSON.stringify(data) });

export const updateAdminRetailer = (id: number, data: Record<string, unknown>) =>
  request<any>(`/admin/retailers/${id}`, { method: 'PUT', body: JSON.stringify(data) });

// ── Scrapers ──────────────────────────────────────────────────────────────────

export const runAllScrapers = () =>
  request<any>('/admin/scrapers/run-all', { method: 'POST' });

export const runScraper = (retailerId: number) =>
  request<any>(`/admin/scrapers/${retailerId}/run`, { method: 'POST' });

// ── Logs ──────────────────────────────────────────────────────────────────────

export const getAdminLogs = (params: Record<string, string> = {}) => {
  const qs = new URLSearchParams(params).toString();
  return request<any>(`/admin/logs${qs ? `?${qs}` : ''}`);
};

// ── Unmatched listings ────────────────────────────────────────────────────────

export const getUnmatchedListings = (params: Record<string, string> = {}) => {
  const qs = new URLSearchParams(params).toString();
  return request<any>(`/admin/unmatched-listings${qs ? `?${qs}` : ''}`);
};

export const linkUnmatched = (id: number, componentId: number) =>
  request<any>(`/admin/unmatched-listings/${id}/link`, {
    method: 'POST',
    body: JSON.stringify({ component_id: componentId }),
  });

export const dismissUnmatched = (id: number) =>
  request<any>(`/admin/unmatched-listings/${id}/dismiss`, { method: 'POST' });

// ── Presets ───────────────────────────────────────────────────────────────────

export const getAdminPresets = () => request<any>('/admin/presets');

export const createAdminPreset = (data: Record<string, unknown>) =>
  request<any>('/admin/presets', { method: 'POST', body: JSON.stringify(data) });

export const deleteAdminPreset = (id: number) =>
  request<any>(`/admin/presets/${id}`, { method: 'DELETE' });

// ── Public components (for search in unmatched linking) ───────────────────────

export const searchComponents = (search: string) =>
  request<any>(`/components?search=${encodeURIComponent(search)}&limit=10`);
