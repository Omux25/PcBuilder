/**
 * Shared TypeScript interfaces — re-exported from global shared/types.ts
 */

export * from '@shared/types';

import type { Component, ComponentCategory } from '@shared/types';

/** The build configuration — one optional slot per category.
 *
 * Keys are either a base category ('cpu', 'motherboard', etc.) or an indexed
 * multi-slot key ('ram_1', 'ram_2', 'storage_1', 'storage_2', etc.).
 * Single-slot categories still use their plain name as the key.
 */
export type BuildConfig = Partial<Record<string, Component>>;

/** Derive the component category from a slot key (e.g. 'ram_2' → 'ram'). */
export function slotKeyToCategory(key: string): ComponentCategory {
    const base = key.replace(/_\d+$/, '');
    return base as ComponentCategory;
}

/** Returns true if the slot key is a multi-slot RAM key. */
export function isRamSlotKey(key: string): boolean {
    return key === 'ram' || /^ram_\d+$/.test(key);
}

/** Returns true if the slot key is a multi-slot storage key. */
export function isStorageSlotKey(key: string): boolean {
    return key === 'storage' || /^storage_\d+$/.test(key);
}
