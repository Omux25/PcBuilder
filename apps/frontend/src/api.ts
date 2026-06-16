/**
 * API client — thin wrappers around fetch() for each backend endpoint.
 * All requests go to /api (proxied to http://localhost:3000 by Vite in dev).
 */

import { createRequest, createClient } from '@shared/api-client';
import type {
  Component, ComponentCategory, PriceOffer, PriceHistoryEntry,
  CompatibilityResult, BuildConfig, PresetBuild,
} from './types';

const BASE = import.meta.env.VITE_API_BASE_URL ?? import.meta.env.VITE_API_URL ?? '/api';
const request = createRequest(BASE);

// For the Hono RPC client, the backend's AppRouter type already includes the '/api' prefix
// (e.g. '.route("/api/builds", buildsRouter)'). Therefore, the RPC client's base URL must
// be the domain root (without the '/api' prefix) so that keys like 'client.api.builds'
// resolve to '[domain root]/api/builds' instead of '[domain root]/api/api/builds'.
const clientBaseUrl = BASE.endsWith('/api') ? BASE.slice(0, -4) || '/' : BASE;
const client = createClient(clientBaseUrl);

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
  in_stock_total: number;
  available_brands: string[];
  available_sockets: string[];
  available_vram: number[];
  available_chipsets: string[];
  available_form_factors: string[];
}

/** Smart search — returns components sorted by compatibility, stock, and price. */
export async function smartSearch(params: {
  category: ComponentCategory;
  search?: string;
  brand?: string | string[];
  socket?: string | string[];
  ram_type?: string | string[];
  vram_gb?: number | number[] | string;
  chipset?: string | string[];
  form_factor?: string | string[];
  interface_type?: string | string[];
  efficiency_rating?: string | string[];
  modular?: string | string[];
  cooling_type?: string | string[];
  core_count?: number;
  sort?: string;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC' | 'asc' | 'desc';
  min_price?: number;
  max_price?: number;
  min_wattage?: number;
  max_wattage?: number;
  min_capacity_gb?: number;
  max_capacity_gb?: number;
  min_frequency_mhz?: number;
  max_frequency_mhz?: number;
  in_stock?: boolean;
  compatible_only?: boolean;
  build?: BuildConfig;
  page?: number;
  limit?: number;
}): Promise<SmartSearchResult> {
  const qs = new URLSearchParams();
  qs.set('category', params.category);
  if (params.search) qs.set('search', params.search);
  if (params.brand) {
    const brandStr = Array.isArray(params.brand) ? params.brand.join(',') : params.brand;
    qs.set('brands', brandStr);
  }
  if (params.socket) {
    const socketStr = Array.isArray(params.socket) ? params.socket.join(',') : params.socket;
    qs.set('sockets', socketStr);
  }
  if (params.ram_type) {
    const ramTypeStr = Array.isArray(params.ram_type) ? params.ram_type.join(',') : params.ram_type;
    qs.set('ram_types', ramTypeStr);
  }
  if (params.vram_gb != null) {
    const vramStr = Array.isArray(params.vram_gb) ? params.vram_gb.join(',') : String(params.vram_gb);
    qs.set('vrams', vramStr);
  }
  if (params.chipset) {
    const chipsetStr = Array.isArray(params.chipset) ? params.chipset.join(',') : params.chipset;
    qs.set('chipsets', chipsetStr);
  }
  if (params.form_factor) {
    const formFactorStr = Array.isArray(params.form_factor) ? params.form_factor.join(',') : params.form_factor;
    qs.set('form_factors', formFactorStr);
  }
  if (params.interface_type) {
    const interfaceStr = Array.isArray(params.interface_type) ? params.interface_type.join(',') : params.interface_type;
    qs.set('interfaces', interfaceStr);
  }
  if (params.efficiency_rating) {
    const efficiencyStr = Array.isArray(params.efficiency_rating) ? params.efficiency_rating.join(',') : params.efficiency_rating;
    qs.set('efficiencies', efficiencyStr);
  }
  if (params.modular) {
    const modularStr = Array.isArray(params.modular) ? params.modular.join(',') : params.modular;
    qs.set('modulars', modularStr);
  }
  if (params.cooling_type) {
    const coolingTypeStr = Array.isArray(params.cooling_type) ? params.cooling_type.join(',') : params.cooling_type;
    qs.set('cooling_types', coolingTypeStr);
  }
  if (params.core_count != null) qs.set('core_count', String(params.core_count));
  if (params.sort) qs.set('sort', params.sort);
  if (params.sortBy) qs.set('sortBy', params.sortBy);
  if (params.sortOrder) qs.set('sortOrder', params.sortOrder);
  if (params.min_price != null) qs.set('min_price', String(params.min_price));
  if (params.max_price != null) qs.set('max_price', String(params.max_price));
  if (params.min_wattage != null) qs.set('min_wattage', String(params.min_wattage));
  if (params.max_wattage != null) qs.set('max_wattage', String(params.max_wattage));
  if (params.min_capacity_gb != null) qs.set('min_capacity_gb', String(params.min_capacity_gb));
  if (params.max_capacity_gb != null) qs.set('max_capacity_gb', String(params.max_capacity_gb));
  if (params.min_frequency_mhz != null) qs.set('min_frequency_mhz', String(params.min_frequency_mhz));
  if (params.max_frequency_mhz != null) qs.set('max_frequency_mhz', String(params.max_frequency_mhz));
  if (params.in_stock) qs.set('in_stock', 'true');
  if (params.compatible_only) qs.set('compatible_only', 'true');
  if (params.page) qs.set('page', String(params.page));
  if (params.limit) qs.set('limit', String(params.limit));

  return request<SmartSearchResult>(`/components/smart-search?${qs.toString()}`, {
    method: 'POST',
    body: JSON.stringify({ build: params.build || {} })
  });
}

/** Fetch paginated components with optional filters. */
export async function getComponents(params: GetComponentsParams = {}): Promise<ComponentListResult> {
  const qs = new URLSearchParams();
  if (params.category) qs.set('category', params.category);
  if (params.search) qs.set('search', params.search);
  if (params.brand) qs.set('brand', params.brand);
  if (params.socket) qs.set('socket', params.socket);
  if (params.ram_type) qs.set('ram_type', params.ram_type);
  if (params.page) qs.set('page', String(params.page));
  if (params.limit) qs.set('limit', String(params.limit));
  const query = qs.toString() ? `?${qs.toString()}` : '';
  return request<ComponentListResult>(`/components${query}`);
}

/** Fetch aggregated component counts by category. */
export async function getComponentCounts(): Promise<Record<string, number>> {
  return request<Record<string, number>>('/components/counts');
}

/** Fetch a single component by ID. */
export function getComponentById(id: number): Promise<Component> {
  return request<Component>(`/components/${id}`);
}

/** Fetch multiple components by their IDs. */
export async function getComponentsByIds(ids: number[]): Promise<Component[]> {
  if (ids.length === 0) return [];
  const res = await request<{ components: Component[] }>(`/components?ids=${ids.join(',')}`);
  return res.components;
}

/** Fetch a single component by slug. */
export function getComponentBySlug(slug: string): Promise<Component> {
  return request<Component>(`/components/slug/${slug}`);
}

/** Fetch a single component by category and identifier (MPN or Slug). */
export function getComponentByIdentifier(category: string, identifier: string): Promise<Component> {
  return request<Component>(`/components/mpn/${category}/${identifier}`);
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
  const days = params.days ?? 30;
  qs.set('days', String(days));
  const query = qs.toString() ? `?${qs.toString()}` : '';
  const data = await request<{ component_id: number; history: PriceHistoryEntry[] }>(
    `/components/${componentId}/price-history${query}`
  );
  return data.history;
}

// ── Compatibility ─────────────────────────────────────────────────────────────

/** Validate a build configuration. */
export function trackTraffic(path: string) {
  // Fire and forget
  request('/pulse/route', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path })
  }).catch(() => {});
}

export async function validateBuild(build: BuildConfig): Promise<CompatibilityResult> {
  const payload: Record<string, number> = {};
  for (const [category, component] of Object.entries(build)) {
    if (component) payload[category] = component.id;
  }

  const res = await client.api.compatibility.validate.$post({
    json: payload,
  });

  if (!res.ok) {
    throw new Error('Failed to validate build');
  }

  return res.json() as Promise<CompatibilityResult>;
}

// ── Market Trends ─────────────────────────────────────────────────────────────

export interface MarketTrend {
  component_id: number;
  name: string;
  brand: string | null;
  slug: string;
  category: string;
  image_url: string | null;
  price_before: number;
  price_after: number;
  diff_amount: number;
  change_pct: number;
  type: 'drops' | 'hikes';
  in_stock: boolean;
}

export interface MarketTrendsResult {
  trends: MarketTrend[];
  days: number;
  type: 'drops' | 'hikes';
  total: number;
}

export async function getMarketTrends(params: {
  days?: number;
  limit?: number;
  category?: string;
  type?: 'drops' | 'hikes';
  in_stock?: 'true' | 'false' | 'all';
} = {}): Promise<MarketTrendsResult> {
  const qs = new URLSearchParams();
  if (params.days) qs.set('days', String(params.days));
  if (params.limit) qs.set('limit', String(params.limit));
  if (params.category) qs.set('category', params.category);
  if (params.type) qs.set('type', params.type);
  if (params.in_stock) qs.set('in_stock', params.in_stock);
  const query = qs.toString() ? `?${qs.toString()}` : '';
  return request<MarketTrendsResult>(`/market-trends${query}`);
}

/** Fetch preset builds, optionally filtered by use case. */
export async function getPresets(useCase?: string): Promise<PresetBuild[]> {
  const res = await client.api.builds.presets.$get({
    query: useCase ? { use_case: useCase } : undefined,
  });

  if (!res.ok) {
    throw new Error('Failed to fetch presets');
  }

  const data = await res.json();
  return data.presets as unknown as PresetBuild[];
}

/** Fetch a shared build configuration by ID. */
export async function getSharedBuild(id: string): Promise<Record<string, number>> {
  return request<Record<string, number>>(`/builds/share/${id}`);
}

/** Share/save a build configuration to get a short URL/code. */
export async function shareBuild(buildIds: Record<string, number>): Promise<{ id: string; url: string }> {
  return request<{ id: string; url: string }>('/builds/share', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(buildIds),
  });
}
