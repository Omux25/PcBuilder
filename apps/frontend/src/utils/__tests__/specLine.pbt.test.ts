// @ts-nocheck
import { describe, it } from 'vitest';
import * as fc from 'fast-check';
import { getSpecLine } from '@shared/formatting/spec-line.formatter';

// ── Arbitraries ───────────────────────────────────────────────────────────────

const optString = fc.option(fc.string({ minLength: 1, maxLength: 30 }), { nil: undefined });
const optPosInt = fc.option(fc.integer({ min: 1, max: 9999 }), { nil: undefined });
const optSmallInt = fc.option(fc.integer({ min: 1, max: 64 }), { nil: undefined });

const CATEGORIES = [
    'cpu', 'gpu', 'ram', 'storage', 'psu', 'motherboard', 'case', 'cooling',
    'fan', 'thermal_paste', 'monitor', 'keyboard', 'mouse', 'accessory',
] as const;

/** Arbitrary for a full Component with all optional fields randomized */
const anyComponent = fc.record({
    id: fc.integer({ min: 1 }),
    slug: fc.string({ minLength: 1, maxLength: 20 }),
    name: fc.string({ minLength: 1, maxLength: 50 }),
    category: fc.constantFrom(...CATEGORIES),
    is_active: fc.boolean(),
    created_at: fc.constant('2024-01-01'),
    updated_at: fc.constant('2024-01-01'),
    // Spec fields
    socket: optString,
    core_count: optSmallInt,
    tdp: optPosInt,
    chipset: optString,
    vram_gb: optSmallInt,
    wattage: optPosInt,
    ram_type: optString,
    frequency_mhz: optPosInt,
    kit_count: fc.option(fc.integer({ min: 1, max: 8 }), { nil: undefined }),
    capacity_gb: optPosInt,
    interface_type: optString,
    efficiency_rating: optString,
    modular: fc.option(fc.constantFrom('Full', 'Semi', 'Non'), { nil: undefined }),
    form_factor: optString,
    max_tdp: optPosInt,
    tags: fc.option(fc.array(fc.string({ minLength: 1, maxLength: 20 }), { maxLength: 8 }), { nil: undefined }),
});

// ── Property 1: Separator integrity ──────────────────────────────────────────
// Feature: configurator-spec-line, Property 1: Separator integrity

describe('PBT — Property 1: Separator integrity', () => {
    it('output never starts/ends with " · " and never contains double separator', () => {
        fc.assert(
            fc.property(anyComponent, (component) => {
                const result = getSpecLine(component);
                expect(result).not.toMatch(/^ · /);
                expect(result).not.toMatch(/ · $/);
                expect(result).not.toContain(' ·  · ');
            }),
            { numRuns: 200 }
        );
    });
});

// ── Property 2: Determinism ───────────────────────────────────────────────────
// Feature: configurator-spec-line, Property 2: Determinism

describe('PBT — Property 2: Determinism', () => {
    it('same input always returns same output', () => {
        fc.assert(
            fc.property(anyComponent, (component) => {
                const first = getSpecLine(component);
                const second = getSpecLine(component);
                expect(first).toBe(second);
            }),
            { numRuns: 100 }
        );
    });
});

// ── Property 3: CPU format ────────────────────────────────────────────────────
// Feature: configurator-spec-line, Property 3: CPU format

describe('PBT — Property 3: CPU format', () => {
    it('when socket and core_count both populated, output contains both', () => {
        fc.assert(
            fc.property(
                fc.string({ minLength: 1, maxLength: 20 }),
                fc.integer({ min: 1, max: 64 }),
                (socket, core_count) => {
                    const component = {
                        id: 1, slug: 'cpu', name: 'CPU', category: 'cpu' as const,
                        is_active: true, created_at: '2024-01-01', updated_at: '2024-01-01',
                        socket, core_count,
                    };
                    const result = getSpecLine(component);
                    expect(result).toContain(socket);
                    expect(result).toContain(`${core_count} cores`);
                }
            ),
            { numRuns: 100 }
        );
    });
});

// ── Property 4: GPU format ────────────────────────────────────────────────────
// Feature: configurator-spec-line, Property 4: GPU format

describe('PBT — Property 4: GPU format', () => {
    it('when chipset and vram_gb both populated, output contains both', () => {
        fc.assert(
            fc.property(
                fc.string({ minLength: 1, maxLength: 30 }),
                fc.integer({ min: 1, max: 48 }),
                (chipset, vram_gb) => {
                    const component = {
                        id: 1, slug: 'gpu', name: 'GPU', category: 'gpu' as const,
                        is_active: true, created_at: '2024-01-01', updated_at: '2024-01-01',
                        chipset, vram_gb,
                    };
                    const result = getSpecLine(component);
                    expect(result).toContain(chipset);
                    expect(result).toContain(`${vram_gb}GB`);
                }
            ),
            { numRuns: 100 }
        );
    });
});

// ── Property 5: RAM kit label ─────────────────────────────────────────────────
// Feature: configurator-spec-line, Property 5: RAM kit label computation

describe('PBT — Property 5: RAM kit label', () => {
    it('when kit_count > 1 and capacity_gb populated, output contains correct kit label', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 2, max: 8 }),
                fc.integer({ min: 2, max: 256 }),
                (kit_count, capacity_gb) => {
                    const component = {
                        id: 1, slug: 'ram', name: 'RAM', category: 'ram' as const,
                        is_active: true, created_at: '2024-01-01', updated_at: '2024-01-01',
                        kit_count, capacity_gb,
                    };
                    const result = getSpecLine(component);
                    const perStick = Math.round(capacity_gb / kit_count);
                    expect(result).toContain(`${kit_count}×${perStick}GB`);
                }
            ),
            { numRuns: 100 }
        );
    });
});

// ── Property 6: Storage capacity format ──────────────────────────────────────
// Feature: configurator-spec-line, Property 6: Storage capacity formatting

describe('PBT — Property 6: Storage capacity format', () => {
    it('capacity_gb >= 1000 displays as TB', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 1000, max: 100000 }),
                (capacity_gb) => {
                    const component = {
                        id: 1, slug: 'storage', name: 'SSD', category: 'storage' as const,
                        is_active: true, created_at: '2024-01-01', updated_at: '2024-01-01',
                        capacity_gb,
                    };
                    const result = getSpecLine(component);
                    expect(result).toContain('TB');
                    expect(result).not.toContain('GB');
                }
            ),
            { numRuns: 100 }
        );
    });

    it('capacity_gb < 1000 displays as GB', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 1, max: 999 }),
                (capacity_gb) => {
                    const component = {
                        id: 1, slug: 'storage', name: 'SSD', category: 'storage' as const,
                        is_active: true, created_at: '2024-01-01', updated_at: '2024-01-01',
                        capacity_gb,
                    };
                    const result = getSpecLine(component);
                    expect(result).toContain(`${capacity_gb}GB`);
                    expect(result).not.toContain('TB');
                }
            ),
            { numRuns: 100 }
        );
    });
});

// ── Property 7: PSU efficiency prefix ────────────────────────────────────────
// Feature: configurator-spec-line, Property 7: PSU efficiency prefix normalization

describe('PBT — Property 7: PSU efficiency prefix', () => {
    it('output contains exactly one "80+ " prefix before the rating', () => {
        fc.assert(
            fc.property(
                fc.constantFrom('Bronze', 'Gold', 'Platinum', 'Titanium', '80+ Gold', '80+ Bronze', '80+ Platinum'),
                (efficiency_rating) => {
                    const component = {
                        id: 1, slug: 'psu', name: 'PSU', category: 'psu' as const,
                        is_active: true, created_at: '2024-01-01', updated_at: '2024-01-01',
                        efficiency_rating,
                    };
                    const result = getSpecLine(component);
                    // Should contain "80+ " exactly once
                    const count = (result.match(/80\+ /g) || []).length;
                    expect(count).toBe(1);
                    // Should not contain double prefix
                    expect(result).not.toContain('80+ 80+');
                }
            ),
            { numRuns: 100 }
        );
    });
});

// ── Property 8: Case color tag ────────────────────────────────────────────────
// Feature: configurator-spec-line, Property 8: Case color tag extraction

describe('PBT — Property 8: Case color tag', () => {
    it('when tags contains "black", output contains "Black"', () => {
        fc.assert(
            fc.property(
                fc.array(fc.string({ minLength: 1, maxLength: 15 }), { maxLength: 5 }),
                (extraTags) => {
                    const component = {
                        id: 1, slug: 'case', name: 'Case', category: 'case' as const,
                        is_active: true, created_at: '2024-01-01', updated_at: '2024-01-01',
                        tags: ['black', ...extraTags],
                    };
                    const result = getSpecLine(component);
                    expect(result).toContain('Black');
                }
            ),
            { numRuns: 100 }
        );
    });

    it('when tags contains "white", output contains "White"', () => {
        fc.assert(
            fc.property(
                fc.array(fc.string({ minLength: 1, maxLength: 15 }), { maxLength: 5 }),
                (extraTags) => {
                    const component = {
                        id: 1, slug: 'case', name: 'Case', category: 'case' as const,
                        is_active: true, created_at: '2024-01-01', updated_at: '2024-01-01',
                        tags: ['white', ...extraTags],
                    };
                    const result = getSpecLine(component);
                    expect(result).toContain('White');
                }
            ),
            { numRuns: 100 }
        );
    });
});

// ── Property 9: Cooler radiator size tag ──────────────────────────────────────
// Feature: configurator-spec-line, Property 9: Cooler radiator size tag extraction

describe('PBT — Property 9: Cooler radiator size tag', () => {
    it('when tags contains a radiator size tag, output contains that size', () => {
        fc.assert(
            fc.property(
                fc.constantFrom('120mm', '140mm', '240mm', '280mm', '360mm', '420mm'),
                fc.array(fc.string({ minLength: 1, maxLength: 15 }), { maxLength: 4 }),
                (sizeTag, extraTags) => {
                    const component = {
                        id: 1, slug: 'cooler', name: 'Cooler', category: 'cooling' as const,
                        is_active: true, created_at: '2024-01-01', updated_at: '2024-01-01',
                        tags: ['aio', sizeTag, ...extraTags],
                    };
                    const result = getSpecLine(component);
                    expect(result).toContain(sizeTag);
                }
            ),
            { numRuns: 100 }
        );
    });
});

// ── Property 10: Fallback priority and two-token cap ─────────────────────────
// Feature: configurator-spec-line, Property 10: Fallback handler priority and cap

describe('PBT — Property 10: Fallback priority and two-token cap', () => {
    const nonPrimaryCategories = [
        'fan', 'thermal_paste', 'monitor', 'keyboard', 'mouse',
        'headphones', 'speakers', 'webcam', 'accessory',
    ] as const;

    it('output has at most 2 tokens for non-primary categories', () => {
        fc.assert(
            fc.property(
                fc.constantFrom(...nonPrimaryCategories),
                optPosInt,
                optPosInt,
                optPosInt,
                optString,
                (category, tdp, frequency_mhz, wattage, form_factor) => {
                    const component = {
                        id: 1, slug: 'comp', name: 'Component', category,
                        is_active: true, created_at: '2024-01-01', updated_at: '2024-01-01',
                        tdp, frequency_mhz, wattage, form_factor,
                    };
                    const result = getSpecLine(component);
                    if (result === '') return; // empty is fine
                    const tokens = result.split(' · ');
                    expect(tokens.length).toBeLessThanOrEqual(2);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('when tdp is populated, it appears before frequency_mhz, wattage, form_factor', () => {
        fc.assert(
            fc.property(
                fc.constantFrom(...nonPrimaryCategories),
                fc.integer({ min: 1, max: 500 }),
                optPosInt,
                optPosInt,
                optString,
                (category, tdp, frequency_mhz, wattage, form_factor) => {
                    const component = {
                        id: 1, slug: 'comp', name: 'Component', category,
                        is_active: true, created_at: '2024-01-01', updated_at: '2024-01-01',
                        tdp, frequency_mhz, wattage, form_factor,
                    };
                    const result = getSpecLine(component);
                    expect(result).toContain(`${tdp}W TDP`);
                    // TDP token must be first
                    expect(result.startsWith(`${tdp}W TDP`)).toBe(true);
                }
            ),
            { numRuns: 100 }
        );
    });
});
