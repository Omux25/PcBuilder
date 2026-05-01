/**
 * Build URL persistence — encode/decode build config into URL search params.
 * Also handles localStorage fallback for page refreshes.
 */

import type { BuildConfig } from '../types';
import { CATEGORY_ORDER } from '../types';

const STORAGE_KEY = 'pcbuilder_build';

/** Encode a build into compact URL search params (only IDs). */
export function encodeBuildToUrl(build: BuildConfig): string {
  const params = new URLSearchParams();
  for (const cat of CATEGORY_ORDER) {
    const comp = build[cat];
    if (comp) params.set(cat, String(comp.id));
  }
  return params.toString();
}

/** Parse build component IDs from URL search params. */
export function decodeBuildFromUrl(search: string): Record<string, number> {
  const params = new URLSearchParams(search);
  const ids: Record<string, number> = {};
  for (const cat of CATEGORY_ORDER) {
    const val = params.get(cat);
    if (val && !isNaN(Number(val))) {
      ids[cat as string] = Number(val);
    }
  }
  return ids;
}

/** Save build component IDs to localStorage. */
export function saveBuildToStorage(build: BuildConfig): void {
  try {
    const ids: Record<string, number> = {};
    for (const [cat, comp] of Object.entries(build)) {
      if (comp) ids[cat] = comp.id;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch { /* quota exceeded or private browsing */ }
}

/** Load build component IDs from localStorage. */
export function loadBuildFromStorage(): Record<string, number> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, number>;
  } catch {
    return {};
  }
}

/** Clear saved build from localStorage. */
export function clearBuildStorage(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch { /* ignore */ }
}
