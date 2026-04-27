/**
 * API client — thin wrappers around fetch() for each backend endpoint.
 * All requests go to /api (proxied to http://localhost:3000 by Vite in dev).
 */

import type { Component, ComponentCategory, PriceOffer, CompatibilityResult, BuildConfig } from './types';

const BASE = '/api';

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

/** Fetch all components, optionally filtered by category. */
export function getComponents(category?: ComponentCategory): Promise<Component[]> {
  const qs = category ? `?category=${category}` : '';
  return request<Component[]>(`/components${qs}`);
}

/** Fetch a single component by ID. */
export function getComponentById(id: number): Promise<Component> {
  return request<Component>(`/components/${id}`);
}

/** Fetch price offers for a component, sorted cheapest first. */
export async function getPrices(componentId: number): Promise<PriceOffer[]> {
  const data = await request<{ offers: PriceOffer[] }>(`/components/${componentId}/prices`);
  return data.offers;
}

/** Validate a build configuration. */
export function validateBuild(build: BuildConfig): Promise<CompatibilityResult> {
  // Strip the full Component objects down to just the fields the engine needs
  const payload: Record<string, unknown> = {};
  for (const [category, component] of Object.entries(build)) {
    if (component) payload[category] = component;
  }
  return request<CompatibilityResult>('/compatibility/validate', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
