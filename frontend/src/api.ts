/**
 * API client — thin wrappers around fetch() for each backend endpoint.
 * All requests go to /api (proxied to http://localhost:3000 by Vite in dev).
 */

import type {
  Component, ComponentCategory, PriceOffer, PriceHistoryEntry,
  CompatibilityResult, BuildConfig, PresetBuild,
} from './types';

const BASE = import.meta.env.VITE_API_BASE_URL ?? '/api';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });

  const data = await res.json();

  if (!res.ok) {
    const message = data?.error?.message ?? `HTTP ${res.status}`;
    throw new Error(message);
  }

  return data as T;
}

// ── Components ────────────────────────────────────────────────────────────────

export interface ComponentListResult {
  components: Component[];
  total: number;
}

export interface GetComponentsParams {
  category?: ComponentCategory;
  search?: string;
  brand?: string;
  socket?: string;
  ram_type?: string;
  page?: number;
  limit?: number;
}

export interface SmartComponent extends Component {
  lowest_price: number | null;
  in_stock: boolean;
  compatibility: 'compatible' | 'incompatible' | 'unknown';
  compatibility_issues: string[];
}

export interface SmartSearchResult {
  components: SmartComponent[];
  total: number;
}

/** Smart search — returns components sorted by compatibility, stock, and price. */
export async function smartSearch(params: {
  category: ComponentCategory;
  search?: string;
  build?: BuildConfig;
  page?: number;
  limit?: number;
}): Promise<SmartSearchResult> {
  const qs = new URLSearchParams();
  qs.set('category', params.category);
  if (params.search)  qs.set('search', params.search);
  if (params.page)    qs.set('page', String(params.page));
  if (params.limit)   qs.set('limit', String(params.limit));
  if (params.build && Object.keys(params.build).length > 0) {
    qs.set('build', JSON.stringify(params.build));
  }
  return request<SmartSearchResult>(`/components/smart-search?${qs.toString()}`);
}

/** Fetch paginated components with optional filters. */
export async function getComponents(params: GetComponentsParams = {}): Promise<ComponentListResult> {
  const qs = new URLSearchParams();
  if (params.category) qs.set('category', params.category);
  if (params.search)   qs.set('search', params.search);
  if (params.brand)    qs.set('brand', params.brand);
  if (params.socket)   qs.set('socket', params.socket);
  if (params.ram_type) qs.set('ram_type', params.ram_type);
  if (params.page)     qs.set('page', String(params.page));
  if (params.limit)    qs.set('limit', String(params.limit));
  const query = qs.toString() ? `?${qs.toString()}` : '';
  return request<ComponentListResult>(`/components${query}`);
}

/** Fetch a single component by ID. */
export function getComponentById(id: number): Promise<Component> {
  return request<Component>(`/components/${id}`);
}

/** Fetch a single component by slug. */
export function getComponentBySlug(slug: string): Promise<Component> {
  return request<Component>(`/components/slug/${slug}`);
}

// ── Prices ────────────────────────────────────────────────────────────────────

/** Fetch price offers for a component, sorted cheapest first. */
export async function getPrices(componentId: number): Promise<PriceOffer[]> {
  const data = await request<{ offers: PriceOffer[] }>(`/components/${componentId}/prices`);
  return data.offers;
}

/** Fetch price history for a component. */
export async function getPriceHistory(
  componentId: number,
  params: { retailer_id?: number; days?: number } = {}
): Promise<PriceHistoryEntry[]> {
  const qs = new URLSearchParams();
  if (params.retailer_id) qs.set('retailer_id', String(params.retailer_id));
  if (params.days)        qs.set('days', String(params.days));
  const query = qs.toString() ? `?${qs.toString()}` : '';
  const data = await request<{ component_id: number; history: PriceHistoryEntry[] }>(
    `/components/${componentId}/price-history${query}`
  );
  return data.history;
}

// ── Compatibility ─────────────────────────────────────────────────────────────

/** Validate a build configuration. */
export function validateBuild(build: BuildConfig): Promise<CompatibilityResult> {
  const payload: Record<string, unknown> = {};
  for (const [category, component] of Object.entries(build)) {
    if (component) payload[category] = component;
  }
  return request<CompatibilityResult>('/compatibility/validate', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// ── Presets ───────────────────────────────────────────────────────────────────

/** Fetch preset builds, optionally filtered by use case. */
export async function getPresets(useCase?: string): Promise<PresetBuild[]> {
  const qs = useCase ? `?use_case=${useCase}` : '';
  const data = await request<{ presets: PresetBuild[] }>(`/builds/presets${qs}`);
  return data.presets;
}
