/**
 * Admin API client — auth-aware fetch wrapper.
 * Stores the access token in memory. On 401, attempts token refresh.
 * On refresh failure, redirects to /admin/login.
 */

const BASE = import.meta.env.VITE_API_BASE_URL ?? '/api';

// ── Types ────────────────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface DashboardData {
  stats: {
    total_components: number;
    active_retailers: number;
    total_retailers: number;
    total_price_records: number;
    unmatched_listings_count: number;
    last_scrape: {
      time: string | null;
      status: string | null;
    };
  };
  price_updates_chart: Array<{ date: string; count: number }>;
  recent_activity: Array<{
    id: number;
    action: string;
    entity_type: string | null;
    entity_id: number | null;
    created_at: string;
  }>;
}

export interface AdminComponent {
  id: number;
  name: string;
  category: string;
  is_active: boolean;
  [key: string]: unknown;
}

export interface AdminRetailer {
  id: number;
  name: string;
  base_url: string;
  country: string;
  scraping_interval_hours: number;
  last_scrape_at: string | null;
  last_scrape_status: string | null;
  price_records_count: number | null;
  is_active: boolean;
  [key: string]: unknown;
}

export interface AdminPreset {
  id: number;
  name: string;
  [key: string]: unknown;
}

export interface LogEntry {
  id: number;
  level: 'INFO' | 'WARNING' | 'ERROR';
  site: string | null;
  message: string;
  created_at: string;
}

export interface UnmatchedListing {
  id: number;
  retailer_id: number;
  [key: string]: unknown;
}

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

export const getDashboard = () => request<DashboardData>('/admin/dashboard');

// ── Components ────────────────────────────────────────────────────────────────

export const getAdminComponents = (params: Record<string, string> = {}) => {
  const qs = new URLSearchParams(params).toString();
  return request<{ components: AdminComponent[]; total: number }>(`/admin/components${qs ? `?${qs}` : ''}`);
};

export const createAdminComponent = (data: Record<string, unknown>) =>
  request<AdminComponent>('/admin/components', { method: 'POST', body: JSON.stringify(data) });

export const updateAdminComponent = (id: number, data: Record<string, unknown>) =>
  request<AdminComponent>(`/admin/components/${id}`, { method: 'PUT', body: JSON.stringify(data) });

export const deleteAdminComponent = (id: number) =>
  request<{ message: string }>(`/admin/components/${id}`, { method: 'DELETE' });

// ── Retailers ─────────────────────────────────────────────────────────────────

export const getAdminRetailers = () => request<{ retailers: AdminRetailer[] }>('/admin/retailers');

export const createAdminRetailer = (data: Record<string, unknown>) =>
  request<AdminRetailer>('/admin/retailers', { method: 'POST', body: JSON.stringify(data) });

export const updateAdminRetailer = (id: number, data: Record<string, unknown>) =>
  request<AdminRetailer>(`/admin/retailers/${id}`, { method: 'PUT', body: JSON.stringify(data) });

// ── Scrapers ──────────────────────────────────────────────────────────────────

export const runAllScrapers = () =>
  request<{ message: string; job_ids: string[]; retailers_count: number }>('/admin/scrapers/run-all', { method: 'POST' });

export const runScraper = (retailerId: number) =>
  request<{ job_id: string; status: string; retailer_id: number }>(`/admin/scrapers/${retailerId}/run`, { method: 'POST' });

// ── Logs ──────────────────────────────────────────────────────────────────────

export const getAdminLogs = (params: Record<string, string> = {}) => {
  const qs = new URLSearchParams(params).toString();
  return request<PaginatedResponse<LogEntry>>(`/admin/logs${qs ? `?${qs}` : ''}`);
};

// ── Unmatched listings ────────────────────────────────────────────────────────

export const getUnmatchedListings = (params: Record<string, string> = {}) => {
  const qs = new URLSearchParams(params).toString();
  return request<PaginatedResponse<UnmatchedListing>>(`/admin/unmatched-listings${qs ? `?${qs}` : ''}`);
};

export const linkUnmatched = (id: number, componentId: number) =>
  request<{ message: string }>(`/admin/unmatched-listings/${id}/link`, {
    method: 'POST',
    body: JSON.stringify({ component_id: componentId }),
  });

export const dismissUnmatched = (id: number) =>
  request<{ message: string }>(`/admin/unmatched-listings/${id}/dismiss`, { method: 'POST' });

// ── Presets ───────────────────────────────────────────────────────────────────

export const getAdminPresets = () => request<{ presets: AdminPreset[] }>('/admin/presets');

export const createAdminPreset = (data: Record<string, unknown>) =>
  request<AdminPreset>('/admin/presets', { method: 'POST', body: JSON.stringify(data) });

export const deleteAdminPreset = (id: number) =>
  request<{ message: string }>(`/admin/presets/${id}`, { method: 'DELETE' });

// ── Public components (for search in unmatched linking) ───────────────────────

export const searchComponents = (search: string) =>
  request<{ components: AdminComponent[]; total: number }>(`/components?search=${encodeURIComponent(search)}&limit=10`);
