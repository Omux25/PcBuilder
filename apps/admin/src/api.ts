/**
 * Admin API client — auth-aware fetch wrapper.
 * Stores the access token in memory. On 401, attempts token refresh.
 * On refresh failure, redirects to /admin/login.
 */

// ── Types ────────────────────────────────────────────────────────────────────

import type {
  LogEntry, UnmatchedListing, Component,
  AdminRetailer, DashboardData, PresetBuild
} from '@shared/types';

export type AdminComponent = Component;
export type { LogEntry, UnmatchedListing, AdminRetailer, DashboardData };
export type AdminPreset = PresetBuild;

import { createRequest, type RequestOptions } from '@shared/api-client';

const BASE = import.meta.env.VITE_API_BASE_URL ?? '/api';

export function getProxyImageUrl(url: string | null | undefined): string {
  if (!url) return '';
  return `${BASE}/builds/proxy-image?url=${encodeURIComponent(url)}`;
}
const baseRequest = createRequest(BASE);

let accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

/**
 * Extracts a human-readable error message from any thrown value.
 * Handles both ApiError objects (plain objects from the API client)
 * and standard Error instances.
 */
export function getErrorMessage(err: unknown, fallback = 'Erreur inattendue'): string {
  if (err && typeof err === 'object') {
    // ApiError from shared/api-client.ts — plain object with message + status
    const apiErr = err as { message?: string; status?: number; code?: string };
    if (apiErr.message) return apiErr.message;
  }
  if (err instanceof Error) return err.message;
  return fallback;
}

async function request<T>(path: string, options: RequestOptions = {}, retry = true): Promise<T> {
  try {
    return await baseRequest<T>(path, {
      ...options,
      token: accessToken,
      credentials: 'include',
    });
  } catch (err: unknown) {
    const apiErr = err as { status?: number };
    if (apiErr.status === 401 && retry) {
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

/**
 * Attempt to restore the session from the httpOnly refresh-token cookie.
 * Call this once on app mount before rendering protected routes.
 * Returns true if a valid access token was obtained.
 */
export async function restoreSession(): Promise<boolean> {
  return tryRefresh();
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

export const deactivateAdminComponent = (id: number) =>
  request<{ message: string }>(`/admin/components/${id}/deactivate`, { method: 'POST' });

export const activateAdminComponent = (id: number) =>
  request<{ message: string }>(`/admin/components/${id}/activate`, { method: 'POST' });

export const unlinkAdminComponent = (id: number) =>
  request<{ message: string; listings_reset: number }>(`/admin/components/${id}/unlink`, { method: 'POST' });

// ── Retailers ─────────────────────────────────────────────────────────────────

export const getAdminRetailers = () => request<{ retailers: AdminRetailer[] }>('/admin/retailers');

export const createAdminRetailer = (data: Record<string, unknown>) =>
  request<AdminRetailer>('/admin/retailers', { method: 'POST', body: JSON.stringify(data) });

export const updateAdminRetailer = (id: number, data: Record<string, unknown>) =>
  request<AdminRetailer>(`/admin/retailers/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const hardDeleteRetailer = (id: number) =>
  request<{ message: string }>(`/admin/retailers/${id}/hard`, { method: 'DELETE' });

// ── Scrapers ──────────────────────────────────────────────────────────────────

export const getScraperStatus = () =>
  request<{ running: boolean; full_session_running: boolean; running_jobs: number[] }>('/admin/scrapers/status');

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

export const clearAdminLogs = (mode: 'keep7' | 'all') => {
  const qs = mode === 'all' ? 'all=true' : 'keep_days=7';
  return request<{ deleted: number }>(`/admin/logs?${qs}`, { method: 'DELETE' });
};

// ── Traffic Logs ──────────────────────────────────────────────────────────────

export interface TrafficLogEntry {
  id: number;
  ip: string | null;
  method: string;
  path: string;
  userAgent: string | null;
  statusCode: number;
  responseTimeMs: number;
  createdAt: string;
}

export interface TrafficLogsResponse {
  data: TrafficLogEntry[];
  total: number;
}

export const getAdminTrafficLogs = (params: Record<string, string> = {}) => {
  const qs = new URLSearchParams(params).toString();
  return request<TrafficLogsResponse>(`/admin/traffic${qs ? `?${qs}` : ''}`);
};

export interface TrafficVisitorEntry {
  ip: string;
  userAgent: string | null;
  firstSeen: string;
  lastSeen: string;
  totalRequests: number;
  errorCount: number;
}

export interface TrafficVisitorsResponse {
  data: TrafficVisitorEntry[];
  total: number;
}

export const getAdminTrafficVisitors = (params: Record<string, string> = {}) => {
  const qs = new URLSearchParams(params).toString();
  return request<TrafficVisitorsResponse>(`/admin/traffic/visitors${qs ? `?${qs}` : ''}`);
};

export const clearAllTrafficLogs = () =>
  request<{ success: boolean; message: string }>('/admin/traffic', { method: 'DELETE' });

// ── Unmatched listings ────────────────────────────────────────────────────────

export interface UnmatchedListingsResponse {
  listings: UnmatchedListing[];
  total: number;
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

export const updateUnmatchedCategory = (id: number, category: string | null) =>
  request<{ success: boolean }>(`/admin/unmatched-listings/${id}/category`, {
    method: 'PATCH',
    body: JSON.stringify({ category }),
  });

// ── Unmatched suggestions (grouped view + bulk actions) ───────────────────────

export interface CanonicalGroupListing {
  id: number;
  retailer_id: number;
  retailer_name: string;
  scraped_name: string;
  scraped_price: number | null;
  product_url: string;
  image_url: string | null;
  image_urls: string[] | null;
  scraped_at: string;
  confidence: 'high' | 'medium' | 'low' | 'unknown';
}

export interface CanonicalGroup {
  canonical_name: string;
  brand: string | null;
  category: string | null;
  confidence: 'high' | 'medium' | 'low' | 'unknown';
  existing_component_id: number | null;
  existing_component_name: string | null;
  specs_hint: Record<string, unknown>;
  retailer_count: number;
  listing_count: number;
  price_min: number | null;
  price_max: number | null;
  listings: CanonicalGroupListing[];
}

export interface GroupedUnmatchedResponse {
  groups: CanonicalGroup[];
  total_groups: number;
  total_listings: number;
}

export const getGroupedUnmatched = (params: Record<string, string> = {}) => {
  const qs = new URLSearchParams(params).toString();
  return request<GroupedUnmatchedResponse>(`/admin/unmatched-listings/grouped${qs ? `?${qs}` : ''}`);
};

export const reprocessSuggestions = () =>
  request<{ processed: number; skipped: number }>('/admin/unmatched-listings/reprocess', { method: 'POST' });

export const bulkDismissUnmatched = (listingIds: number[]) =>
  request<{ dismissed: number; skipped: number }>('/admin/unmatched-listings/bulk-dismiss', {
    method: 'POST',
    body: JSON.stringify({ listing_ids: listingIds }),
  });


export const scrapeUrls = (urls: Array<{ retailer_id: number; product_url: string }>) =>
  request<{ scraped: number; failed: number }>('/admin/scrapers/scrape-urls', {
    method: 'POST',
    body: JSON.stringify({ urls }),
  });

export interface CreateAndLinkPayload {
  name: string;
  brand: string | null;
  category: string;
  specs: Record<string, unknown>;
  listing_ids: number[];
  link_to_existing?: boolean;
  existing_component_id?: number;
}

export interface CreateAndLinkResponse {
  component_id: number;
  component_slug: string | null;
  linked_count: number;
}

export const createAndLinkComponent = (payload: CreateAndLinkPayload) =>
  request<CreateAndLinkResponse>('/admin/unmatched-listings/create-and-link', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

// ── Unmatched accordion (new category-accordion UI) ───────────────────────────

export interface CategorySummaryEntry {
  category: string | null;
  group_count: number;
  high_confidence_linkable_count: number;
  high_confidence_count: number;
}

export interface CategorySummaryResponse {
  categories: CategorySummaryEntry[];
}

export interface BulkAssociateSuccess {
  canonical_name: string;
  linked_count: number;
  component_id: number;
}

export interface BulkAssociateFailed {
  canonical_name: string;
  error: string;
}

export interface BulkAssociateResponse {
  successful: BulkAssociateSuccess[];
  failed: BulkAssociateFailed[];
}

export interface ToastState {
  message: string;
  type: 'success' | 'error';
  failures?: Array<{ canonical_name: string; error: string }>;
}

export interface CategoryState {
  groups: CanonicalGroup[];
  offset: number;
  hasMore: boolean;
  loading: boolean;
  error: string | null;
  expandedGroups: Set<string>;
}

export const getCategoryUnmatchedSummary = (params: Record<string, string> = {}) => {
  const qs = new URLSearchParams(params).toString();
  return request<CategorySummaryResponse>(`/admin/unmatched-listings/by-category${qs ? `?${qs}` : ''}`);
};

export const rejectUnmatchedListings = (listingIds: number[]) =>
  request<{ rejected: number }>('/admin/unmatched-listings/reject', {
    method: 'POST',
    body: JSON.stringify({ listing_ids: listingIds }),
  });

export const bulkAssociateUnmatched = (canonicalNames: string[]) =>
  request<BulkAssociateResponse>('/admin/unmatched-listings/bulk-associate', {
    method: 'POST',
    body: JSON.stringify({ canonical_names: canonicalNames }),
  });

export interface BulkConfirmResponse {
  linked_listings: number;
  created_components: number;
  created_listings: number;
}

export const bulkUpdateUnmatchedCategory = (listingIds: number[], category: string | null) =>
  request<{ success: boolean; count: number }>('/admin/unmatched-listings/bulk-category', {
    method: 'POST',
    body: JSON.stringify({ listing_ids: listingIds, category }),
  });

export const bulkConfirmAllWithCategories = (category?: string, includeMedium: boolean = false) =>
  request<BulkConfirmResponse>('/admin/unmatched-listings/bulk-confirm-categories', {
    method: 'POST',
    body: JSON.stringify({ category, includeMedium }),
  });

// ── Presets ───────────────────────────────────────────────────────────────────

export interface PresetPayload {
  name: string;
  description?: string;
  use_case: 'gaming' | 'workstation' | 'office' | 'budget';
  is_featured?: boolean;
  /** Map of category → component_id */
  components: Record<string, number>;
}

export const getAdminPresets = () => request<{ presets: AdminPreset[] }>('/admin/presets');

export const createAdminPreset = (data: PresetPayload) =>
  request<AdminPreset>('/admin/presets', { method: 'POST', body: JSON.stringify(data) });

export const updateAdminPreset = (id: number, data: Partial<PresetPayload>) =>
  request<AdminPreset>(`/admin/presets/${id}`, { method: 'PUT', body: JSON.stringify(data) });

export const deleteAdminPreset = (id: number) =>
  request<{ message: string }>(`/admin/presets/${id}`, { method: 'DELETE' });

// ── Public components (for search in unmatched linking and preset building) ──

export const searchComponents = (search: string, category?: string) => {
  const params = new URLSearchParams({ search: encodeURIComponent(search), limit: '10' });
  if (category) params.set('category', category);
  return request<{ components: AdminComponent[]; total: number }>(`/components?${params.toString()}`);
};

// ── Bulk import ───────────────────────────────────────────────────────────────

export interface ImportResult {
  total_rows: number;
  imported: number;
  skipped: number;
  failed: number;
  errors?: Array<{ row: number; message: string }>;
}

/**
 * Upload a CSV or JSON file for bulk component import.
 * Uses the auth-aware request wrapper so 401 auto-refresh applies.
 */
export async function bulkImportComponents(file: File): Promise<ImportResult> {
  const formData = new FormData();
  formData.append('file', file);
  // Pass the token manually — FormData requests can't go through the JSON wrapper
  // but we still want the 401-refresh behaviour, so we call the raw baseRequest
  // with the current token injected.
  const token = accessToken;
  const res = await fetch(`${BASE}/admin/components/import`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    credentials: 'include',
    body: formData,
  });
  const data = await res.json();
  if (res.status === 401) {
    const refreshed = await tryRefresh();
    if (refreshed) return bulkImportComponents(file);
    window.location.href = '/admin/login';
    throw new Error('Session expired');
  }
  if (!res.ok) throw new Error(data?.error?.message ?? `HTTP ${res.status}`);
  return data as ImportResult;
}

// ── Keyword Rules ─────────────────────────────────────────────────────────────

export interface KeywordRuleResponse {
  id: number;
  keyword: string;
  match_type: 'contains' | 'word' | 'starts_with' | 'number_before';
  category: string;
  source: 'admin' | 'builtin';
  created_by: number | null;
  created_at: string;
  match_count: number;
}

export interface KeywordRulePreviewResponse {
  match_count: number;
  sample_names: string[];
}

export const getKeywordRules = () =>
  request<KeywordRuleResponse[]>('/admin/keyword-rules');

export const createKeywordRule = (data: {
  keyword: string;
  match_type: 'contains' | 'word' | 'starts_with' | 'number_before';
  category: string;
}) =>
  request<KeywordRuleResponse>('/admin/keyword-rules', {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const deleteKeywordRule = (id: number) =>
  request<{ success: boolean }>(`/admin/keyword-rules/${id}`, { method: 'DELETE' });

export const previewKeywordRule = (data: {
  keyword: string;
  match_type: 'contains' | 'word' | 'starts_with' | 'number_before';
}) =>
  request<KeywordRulePreviewResponse>('/admin/keyword-rules/preview', {
    method: 'POST',
    body: JSON.stringify(data),
  });
