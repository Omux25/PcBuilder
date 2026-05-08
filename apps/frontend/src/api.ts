/**
 * API client — thin wrappers around fetch() for each backend endpoint.
 * All requests go to /api (proxied to http://localhost:3000 by Vite in dev).
 */

import { createRequest } from '@shared/api-client';
import type {
  Component, ComponentCategory, PriceOffer, PriceHistoryEntry,
  CompatibilityResult, BuildConfig, PresetBuild,
} from './types';

const BASE = import.meta.env.VITE_API_BASE_URL ?? '/api';
const request = createRequest(BASE);

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
}

/** Smart search — returns components sorted by compatibility, stock, and price. */
export async function smartSearch(params: {
  category: ComponentCategory;
  search?: string;
  brand?: string;
  socket?: string;
  ram_type?: string;
  build?: BuildConfig;
  page?: number;
  limit?: number;
}): Promise<SmartSearchResult> {
  const qs = new URLSearchParams();
  qs.set('category', params.category);
  if (params.search) qs.set('search', params.search);
  if (params.brand) qs.set('brand', params.brand);
  if (params.socket) qs.set('socket', params.socket);
  if (params.ram_type) qs.set('ram_type', params.ram_type);
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
export function validateBuild(build: BuildConfig): Promise<CompatibilityResult> {
  const payload: Record<string, number> = {};
  for (const [category, component] of Object.entries(build)) {
    if (component) payload[category] = component.id;
  }
  return request<CompatibilityResult>('/compatibility/validate', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
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
} = {}): Promise<MarketTrendsResult> {
  const qs = new URLSearchParams();
  if (params.days) qs.set('days', String(params.days));
  if (params.limit) qs.set('limit', String(params.limit));
  if (params.category) qs.set('category', params.category);
  if (params.type) qs.set('type', params.type);
  const query = qs.toString() ? `?${qs.toString()}` : '';
  return request<MarketTrendsResult>(`/market-trends${query}`);
}

/** Fetch preset builds, optionally filtered by use case. */
export async function getPresets(useCase?: string): Promise<PresetBuild[]> {
  const qs = useCase ? `?use_case=${useCase}` : '';
  const data = await request<{ presets: PresetBuild[] }>(`/builds/presets${qs}`);
  return data.presets;
}
