/**
 * spec-line.formatter.ts — Category-aware spec line generator.
 *
 * getSpecLine(component) returns a compact, cleanly formatted string of key
 * specs for a given component. Each category has its own handler that builds
 * a token array, filters out falsy values, and joins with ' · '.
 *
 * This is a pure function — no side effects, deterministic output.
 */

import type { Component } from '../types.js';

// ── Internal helpers ──────────────────────────────────────────────────────────

/** Capitalize the first letter of a string. */
function capitalize(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Format capacity_gb as a human-readable string.
 * Values ≥ 1000 display as "{n}TB", values < 1000 display as "{n}GB".
 */
function formatCapacity(gb: number): string {
    if (gb >= 1000) {
        const tb = gb / 1000;
        // Show integer TB if clean, otherwise one decimal
        return `${Number.isInteger(tb) ? tb : tb.toFixed(1)}TB`;
    }
    return `${gb}GB`;
}

/**
 * Find the first matching tag from a tags array.
 * Returns undefined if tags is absent or no match found.
 */
function findTag(tags: string[] | undefined, candidates: string[]): string | undefined {
    if (!tags) return undefined;
    return tags.find(t => candidates.includes(t));
}

/**
 * Normalize PSU efficiency rating — prefix "80+ " if not already present.
 * e.g. "Gold" → "80+ Gold", "80+ Gold" → "80+ Gold" (no double prefix)
 */
function normalizeEfficiency(rating: string): string {
    if (rating.startsWith('80+ ') || rating.startsWith('80+')) return rating;
    return `80+ ${rating}`;
}

/**
 * Format RAM kit label.
 * kit_count > 1: "{kit_count}×{per_stick}GB" (per_stick = capacity_gb / kit_count, rounded)
 * kit_count = 1 or absent: "{capacity_gb}GB"
 */
function formatKitLabel(capacity_gb: number, kit_count: number | undefined): string {
    if (kit_count && kit_count > 1) {
        const perStick = Math.round(capacity_gb / kit_count);
        return `${kit_count}×${perStick}GB`;
    }
    return `${capacity_gb}GB`;
}

/** Join non-empty tokens with ' · ' separator. */
function join(tokens: (string | undefined | null | false | 0)[]): string {
    return (tokens
        .filter(t => typeof t === 'string' ? t.trim().length > 0 : Boolean(t)) as string[])
        .join(' · ');
}

// ── Category handlers ─────────────────────────────────────────────────────────

function cpuSpecLine(c: Component): string {
    const socket = c.socket;
    const cores = c.core_count ? `${c.core_count} cores` : undefined;

    // If both primary fields absent, fall back to TDP
    if (!socket && !cores) {
        return c.tdp ? `${c.tdp}W TDP` : '';
    }

    return join([socket, cores]);
}

function gpuSpecLine(c: Component): string {
    const chipset = c.chipset;
    const vram = c.vram_gb ? `${c.vram_gb}GB` : undefined;

    // If chipset absent, fall back to wattage
    if (!chipset) {
        return c.wattage ? `${c.wattage}W` : '';
    }

    return join([chipset, vram]);
}

function ramSpecLine(c: Component): string {
    const type = c.ram_type;
    const freq = c.frequency_mhz ? `${c.frequency_mhz}MHz` : undefined;
    const kit = c.capacity_gb ? formatKitLabel(c.capacity_gb, c.kit_count) : undefined;

    return join([type, freq, kit]);
}

function storageSpecLine(c: Component): string {
    const iface = c.interface_type;
    const cap = c.capacity_gb ? formatCapacity(c.capacity_gb) : undefined;

    return join([iface, cap]);
}

function psuSpecLine(c: Component): string {
    const watts = c.wattage ? `${c.wattage}W` : undefined;
    const eff = c.efficiency_rating ? normalizeEfficiency(c.efficiency_rating) : undefined;

    let modularLabel: string | undefined;
    if (c.modular === 'Full') modularLabel = 'Fully Modular';
    else if (c.modular === 'Semi') modularLabel = 'Semi Modular';
    else if (c.modular === 'Non') modularLabel = 'Non Modular';

    return join([watts, eff, modularLabel]);
}

function motherboardSpecLine(c: Component): string {
    return join([c.socket, c.form_factor]);
}

function caseSpecLine(c: Component): string {
    const color = findTag(c.tags, ['black', 'white']);
    const colorLabel = color ? capitalize(color) : undefined;

    return join([c.form_factor, colorLabel]);
}

function coolerSpecLine(c: Component): string {
    // Cooler type: 'aio' tag → "AIO", else "Air"
    const isAio = c.tags?.includes('aio');
    const coolerType = isAio ? 'AIO' : 'Air';

    // Size: radiator size tag, then max_tdp, then tdp
    const sizeTag = findTag(c.tags, ['120mm', '140mm', '240mm', '280mm', '360mm', '420mm']);
    let sizeToken: string | undefined;
    if (sizeTag) {
        sizeToken = sizeTag;
    } else if (c.max_tdp) {
        sizeToken = `${c.max_tdp}W TDP`;
    } else if (c.tdp) {
        sizeToken = `${c.tdp}W TDP`;
    }

    // If no size/TDP info at all, omit cooler type too (empty line)
    if (!sizeToken) return '';

    return join([coolerType, sizeToken]);
}

function fallbackSpecLine(c: Component): string {
    // Priority: tdp → frequency_mhz → wattage → form_factor, max 2 tokens
    const candidates: string[] = [];
    if (c.tdp) candidates.push(`${c.tdp}W TDP`);
    if (c.frequency_mhz) candidates.push(`${c.frequency_mhz}MHz`);
    if (c.wattage) candidates.push(`${c.wattage}W`);
    if (c.form_factor) candidates.push(c.form_factor);

    return candidates.slice(0, 2).join(' · ');
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns a category-aware spec line string for a component.
 * Pure function — deterministic, no side effects.
 *
 * @example
 * getSpecLine(cpuComponent)      // "AM5 · 8 cores"
 * getSpecLine(gpuComponent)      // "GeForce RTX 4070 · 12GB"
 * getSpecLine(ramComponent)      // "DDR5 · 6000MHz · 2×16GB"
 * getSpecLine(storageComponent)  // "NVMe · 1TB"
 * getSpecLine(psuComponent)      // "850W · 80+ Gold · Fully Modular"
 */
export function getSpecLine(component: Component): string {
    switch (component.category) {
        case 'cpu': return cpuSpecLine(component);
        case 'gpu': return gpuSpecLine(component);
        case 'ram': return ramSpecLine(component);
        case 'storage': return storageSpecLine(component);
        case 'psu': return psuSpecLine(component);
        case 'motherboard': return motherboardSpecLine(component);
        case 'case': return caseSpecLine(component);
        case 'cooling': return coolerSpecLine(component);
        default: return fallbackSpecLine(component);
    }
}
