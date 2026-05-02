/**
 * Admin API client — auth-aware fetch wrapper.
 * Stores the access token in memory. On 401, attempts token refresh.
 * On refresh failure, redirects to /admin/login.
 */

// ── Types ────────────────────────────────────────────────────────────────────

import {
  LogEntry, UnmatchedListing, Component,
  AdminRetailer, DashboardData, PresetBuild
} from '@shared/types';

export type AdminComponent = Component;
export type { LogEntry, UnmatchedListing, AdminRetailer, DashboardData, PresetBuild as AdminPreset };

import { createRequest, type RequestOptions } from '@shared/api-client';

const BASE = import.meta.env.VITE_API_BASE_URL ?? '/api';
const baseRequest = createRequest(BASE);

let accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

async function request<T>(path: string, options: RequestOptions = {}, retry = true): Promise<T> {
  try {
    return await baseRequest<T>(path, {
      ...options,
      token: accessToken,
      credentials: 'include',
    });
  } catch (err: any) {
    if (err.status === 401 && retry) {
      const refreshed = await tryRefresh();
      if (refreshed) {
        return request<T>(path, options, false);
      }
      window.location.href = '/admin/login';
      throw new Error('Session expired');
    }
    throw err;
  }
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
  request<{ message: string; status: string }>('/admin/scrapers/run-all', { method: 'POST' });

export const runScraper = (retailerId: number) =>
  request<{ status: string; retailer_id: number }>(`/admin/scrapers/${retailerId}/run`, { method: 'POST' });

// ── Logs ──────────────────────────────────────────────────────────────────────

export interface LogsResponse {
  logs: LogEntry[];
  count: number;
}

export const getAdminLogs = (params: Record<string, string> = {}) => {
  const qs = new URLSearchParams(params).toString();
  return request<LogsResponse>(`/admin/logs${qs ? `?${qs}` : ''}`);
};

// ── Unmatched listings ────────────────────────────────────────────────────────

export interface UnmatchedListingsResponse {
  listings: UnmatchedListing[];
}

export const getUnmatchedListings = (params: Record<string, string> = {}) => {
  const qs = new URLSearchParams(params).toString();
  return request<UnmatchedListingsResponse>(`/admin/unmatched-listings${qs ? `?${qs}` : ''}`);
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
