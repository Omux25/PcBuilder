/**
 * Build URL persistence — encode/decode build config into URL search params.
 * Also handles localStorage fallback for page refreshes.
 *
 * Multi-slot keys (ram_1, ram_2, storage_1, etc.) are encoded/decoded
 * the same way as single-slot keys — they're just URL params.
 */

import type { BuildConfig } from '../types';
import { CATEGORY_ORDER } from '../types';

const STORAGE_KEY = 'pcbuilder_build';

// All valid slot keys — single-slot categories + up to 4 RAM and 4 storage slots
// Legacy bare 'ram' and 'storage' keys are included for backwards compatibility
// with existing saved builds in localStorage and shared URLs.
const SINGLE_SLOT_KEYS = CATEGORY_ORDER.filter(c => c !== 'ram' && c !== 'storage');
const ALL_SLOT_KEYS: string[] = [
  ...SINGLE_SLOT_KEYS,
  'ram', 'ram_1', 'ram_2', 'ram_3', 'ram_4',
  'storage', 'storage_1', 'storage_2', 'storage_3', 'storage_4',
];

/** Encode a build into compact URL search params (only IDs). */
export function encodeBuildToUrl(build: BuildConfig): string {
  const params = new URLSearchParams();
  for (const key of ALL_SLOT_KEYS) {
    const comp = build[key];
    if (comp) params.set(key, String(comp.id));
  }
  return params.toString();
}

/** Parse build component IDs from URL search params. */
export function decodeBuildFromUrl(search: string): Record<string, number> {
  const params = new URLSearchParams(search);
  const ids: Record<string, number> = {};
  for (const key of ALL_SLOT_KEYS) {
    const val = params.get(key);
    if (val && !isNaN(Number(val))) {
      ids[key] = Number(val);
    }
  }
  return ids;
}

/** Save build component IDs to localStorage. */
export function saveBuildToStorage(build: BuildConfig): void {
  try {
    const ids: Record<string, number> = {};
    for (const [key, comp] of Object.entries(build)) {
      if (comp) ids[key] = comp.id;
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
