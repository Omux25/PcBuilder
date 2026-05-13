// @ts-nocheck
import { describe, it, expect } from 'bun:test';
import { getSpecLine } from '../specLine';

// Minimal Component factory — only set fields relevant to each test
function make(overrides: Record<string, unknown> = {}) {
    return {
        id: 1,
        slug: 'test',
        name: 'Test Component',
        category: 'accessory',
        is_active: true,
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
        ...overrides,
    };
}

// ── CPU ───────────────────────────────────────────────────────────────────────

describe('getSpecLine — CPU', () => {
    it('shows socket and core count', () => {
        const c = make({ category: 'cpu', socket: 'AM5', core_count: 8 });
        expect(getSpecLine(c)).toBe('AM5 · 8 cores');
    });

    it('shows only socket when core_count absent', () => {
        const c = make({ category: 'cpu', socket: 'LGA1700' });
        expect(getSpecLine(c)).toBe('LGA1700');
    });

    it('shows only cores when socket absent', () => {
        const c = make({ category: 'cpu', core_count: 6 });
        expect(getSpecLine(c)).toBe('6 cores');
    });

    it('falls back to TDP when socket and core_count absent', () => {
        const c = make({ category: 'cpu', tdp: 65 });
        expect(getSpecLine(c)).toBe('65W TDP');
    });

    it('returns empty string when all fields absent', () => {
        const c = make({ category: 'cpu' });
        expect(getSpecLine(c)).toBe('');
    });
});

// ── GPU ───────────────────────────────────────────────────────────────────────

describe('getSpecLine — GPU', () => {
    it('shows chipset and VRAM', () => {
        const c = make({ category: 'gpu', chipset: 'GeForce RTX 4070', vram_gb: 12 });
        expect(getSpecLine(c)).toBe('GeForce RTX 4070 · 12GB');
    });

    it('shows only chipset when vram_gb absent', () => {
        const c = make({ category: 'gpu', chipset: 'Radeon RX 7900 XTX' });
        expect(getSpecLine(c)).toBe('Radeon RX 7900 XTX');
    });

    it('falls back to wattage when chipset absent', () => {
        const c = make({ category: 'gpu', wattage: 200 });
        expect(getSpecLine(c)).toBe('200W');
    });

    it('returns empty string when all fields absent', () => {
        const c = make({ category: 'gpu' });
        expect(getSpecLine(c)).toBe('');
    });
});

// ── RAM ───────────────────────────────────────────────────────────────────────

describe('getSpecLine — RAM', () => {
    it('shows type, frequency, and kit label for 2-stick kit', () => {
        const c = make({ category: 'ram', ram_type: 'DDR5', frequency_mhz: 6000, capacity_gb: 32, kit_count: 2 });
        expect(getSpecLine(c)).toBe('DDR5 · 6000MHz · 2×16GB');
    });

    it('shows type, frequency, and capacity for single stick', () => {
        const c = make({ category: 'ram', ram_type: 'DDR4', frequency_mhz: 3200, capacity_gb: 16, kit_count: 1 });
        expect(getSpecLine(c)).toBe('DDR4 · 3200MHz · 16GB');
    });

    it('shows capacity without multiplier when kit_count absent', () => {
        const c = make({ category: 'ram', ram_type: 'DDR5', frequency_mhz: 5600, capacity_gb: 16 });
        expect(getSpecLine(c)).toBe('DDR5 · 5600MHz · 16GB');
    });

    it('shows type and frequency when capacity absent', () => {
        const c = make({ category: 'ram', ram_type: 'DDR4', frequency_mhz: 3200 });
        expect(getSpecLine(c)).toBe('DDR4 · 3200MHz');
    });

    it('returns empty string when all fields absent', () => {
        const c = make({ category: 'ram' });
        expect(getSpecLine(c)).toBe('');
    });

    it('computes per-stick correctly for 4-stick kit', () => {
        const c = make({ category: 'ram', ram_type: 'DDR5', frequency_mhz: 6000, capacity_gb: 64, kit_count: 4 });
        expect(getSpecLine(c)).toBe('DDR5 · 6000MHz · 4×16GB');
    });
});

// ── Storage ───────────────────────────────────────────────────────────────────

describe('getSpecLine — Storage', () => {
    it('shows interface and TB capacity for 2000GB', () => {
        const c = make({ category: 'storage', interface_type: 'NVMe', capacity_gb: 2000 });
        expect(getSpecLine(c)).toBe('NVMe · 2TB');
    });

    it('shows interface and TB capacity for exactly 1000GB', () => {
        const c = make({ category: 'storage', interface_type: 'SATA', capacity_gb: 1000 });
        expect(getSpecLine(c)).toBe('SATA · 1TB');
    });

    it('shows interface and GB capacity for 999GB', () => {
        const c = make({ category: 'storage', interface_type: 'SATA', capacity_gb: 999 });
        expect(getSpecLine(c)).toBe('SATA · 999GB');
    });

    it('shows only interface when capacity absent', () => {
        const c = make({ category: 'storage', interface_type: 'HDD' });
        expect(getSpecLine(c)).toBe('HDD');
    });

    it('shows only capacity when interface absent', () => {
        const c = make({ category: 'storage', capacity_gb: 500 });
        expect(getSpecLine(c)).toBe('500GB');
    });

    it('returns empty string when all fields absent', () => {
        const c = make({ category: 'storage' });
        expect(getSpecLine(c)).toBe('');
    });
});

// ── PSU ───────────────────────────────────────────────────────────────────────

describe('getSpecLine — PSU', () => {
    it('shows wattage, efficiency, and Fully Modular', () => {
        const c = make({ category: 'psu', wattage: 850, efficiency_rating: 'Gold', modular: 'Full' });
        expect(getSpecLine(c)).toBe('850W · 80+ Gold · Fully Modular');
    });

    it('shows Semi Modular label', () => {
        const c = make({ category: 'psu', wattage: 650, efficiency_rating: 'Bronze', modular: 'Semi' });
        expect(getSpecLine(c)).toBe('650W · 80+ Bronze · Semi Modular');
    });

    it('shows Non Modular label', () => {
        const c = make({ category: 'psu', wattage: 550, efficiency_rating: 'Bronze', modular: 'Non' });
        expect(getSpecLine(c)).toBe('550W · 80+ Bronze · Non Modular');
    });

    it('does not double-prefix already-prefixed efficiency rating', () => {
        const c = make({ category: 'psu', wattage: 750, efficiency_rating: '80+ Gold', modular: 'Full' });
        expect(getSpecLine(c)).toBe('750W · 80+ Gold · Fully Modular');
        expect(getSpecLine(c)).not.toContain('80+ 80+');
    });

    it('shows only wattage when efficiency and modular absent', () => {
        const c = make({ category: 'psu', wattage: 600 });
        expect(getSpecLine(c)).toBe('600W');
    });

    it('returns empty string when all fields absent', () => {
        const c = make({ category: 'psu' });
        expect(getSpecLine(c)).toBe('');
    });
});

// ── Motherboard ───────────────────────────────────────────────────────────────

describe('getSpecLine — Motherboard', () => {
    it('shows socket and form factor', () => {
        const c = make({ category: 'motherboard', socket: 'AM5', form_factor: 'ATX' });
        expect(getSpecLine(c)).toBe('AM5 · ATX');
    });

    it('shows only socket when form_factor absent', () => {
        const c = make({ category: 'motherboard', socket: 'LGA1700' });
        expect(getSpecLine(c)).toBe('LGA1700');
    });

    it('shows only form_factor when socket absent', () => {
        const c = make({ category: 'motherboard', form_factor: 'mATX' });
        expect(getSpecLine(c)).toBe('mATX');
    });

    it('returns empty string when all fields absent', () => {
        const c = make({ category: 'motherboard' });
        expect(getSpecLine(c)).toBe('');
    });
});

// ── Case ──────────────────────────────────────────────────────────────────────

describe('getSpecLine — Case', () => {
    it('shows form factor and Black color', () => {
        const c = make({ category: 'case', form_factor: 'ATX', tags: ['black', 'tempered-glass'] });
        expect(getSpecLine(c)).toBe('ATX · Black');
    });

    it('shows form factor and White color', () => {
        const c = make({ category: 'case', form_factor: 'mATX', tags: ['white', 'rgb'] });
        expect(getSpecLine(c)).toBe('mATX · White');
    });

    it('shows only form factor when no color tag', () => {
        const c = make({ category: 'case', form_factor: 'ITX', tags: ['rgb', 'mesh'] });
        expect(getSpecLine(c)).toBe('ITX');
    });

    it('shows only color when form_factor absent', () => {
        const c = make({ category: 'case', tags: ['black'] });
        expect(getSpecLine(c)).toBe('Black');
    });

    it('returns empty string when all fields absent', () => {
        const c = make({ category: 'case' });
        expect(getSpecLine(c)).toBe('');
    });
});

// ── Cooler ────────────────────────────────────────────────────────────────────

describe('getSpecLine — Cooler', () => {
    it('shows AIO and radiator size from tags', () => {
        const c = make({ category: 'cooling', tags: ['aio', '280mm'] });
        expect(getSpecLine(c)).toBe('AIO · 280mm');
    });

    it('shows AIO and 360mm radiator', () => {
        const c = make({ category: 'cooling', tags: ['aio', '360mm'] });
        expect(getSpecLine(c)).toBe('AIO · 360mm');
    });

    it('shows Air and max_tdp when no radiator tag', () => {
        const c = make({ category: 'cooling', tags: ['air'], max_tdp: 250 });
        expect(getSpecLine(c)).toBe('Air · 250W TDP');
    });

    it('falls back to tdp when max_tdp absent', () => {
        const c = make({ category: 'cooling', tags: ['air'], tdp: 65 });
        expect(getSpecLine(c)).toBe('Air · 65W TDP');
    });

    it('defaults to Air type when no aio tag', () => {
        const c = make({ category: 'cooling', tags: ['rgb'], max_tdp: 180 });
        expect(getSpecLine(c)).toBe('Air · 180W TDP');
    });

    it('returns empty string when no size or TDP info', () => {
        const c = make({ category: 'cooling', tags: ['aio'] });
        expect(getSpecLine(c)).toBe('');
    });

    it('returns empty string when all fields absent', () => {
        const c = make({ category: 'cooling' });
        expect(getSpecLine(c)).toBe('');
    });
});

// ── Fallback ──────────────────────────────────────────────────────────────────

describe('getSpecLine — Fallback (uncategorized)', () => {
    it('shows tdp first in priority order', () => {
        const c = make({ category: 'fan', tdp: 15, frequency_mhz: 1200, wattage: 5, form_factor: 'PWM' });
        expect(getSpecLine(c)).toBe('15W TDP · 1200MHz');
    });

    it('shows frequency and wattage when tdp absent', () => {
        const c = make({ category: 'monitor', frequency_mhz: 144, wattage: 30 });
        expect(getSpecLine(c)).toBe('144MHz · 30W');
    });

    it('caps at two tokens', () => {
        const c = make({ category: 'fan', tdp: 5, frequency_mhz: 1200, wattage: 3, form_factor: 'PWM' });
        const result = getSpecLine(c);
        const tokens = result.split(' · ');
        expect(tokens.length).toBeLessThanOrEqual(2);
    });

    it('shows form_factor as last resort', () => {
        const c = make({ category: 'fan', form_factor: '120mm' });
        expect(getSpecLine(c)).toBe('120mm');
    });

    it('returns empty string when all fields absent', () => {
        const c = make({ category: 'fan' });
        expect(getSpecLine(c)).toBe('');
    });
});

// ── Separator integrity ───────────────────────────────────────────────────────

describe('getSpecLine — Separator integrity', () => {
    const categories = ['cpu', 'gpu', 'ram', 'storage', 'psu', 'motherboard', 'case', 'cooling', 'fan'];

    for (const category of categories) {
        it(`no leading/trailing/double separator for ${category} with no fields`, () => {
            const result = getSpecLine(make({ category }));
            expect(result).not.toMatch(/^ · /);
            expect(result).not.toMatch(/ · $/);
            expect(result).not.toContain(' ·  · ');
        });
    }

    it('no double separator when middle field absent (RAM missing frequency)', () => {
        const c = make({ category: 'ram', ram_type: 'DDR5', capacity_gb: 32, kit_count: 2 });
        const result = getSpecLine(c);
        expect(result).not.toContain(' ·  · ');
        expect(result).toBe('DDR5 · 2×16GB');
    });

    it('no leading separator when first field absent (GPU missing chipset)', () => {
        const c = make({ category: 'gpu', vram_gb: 8 });
        // chipset absent → falls back to wattage; vram alone not shown without chipset
        const result = getSpecLine(c);
        expect(result).not.toMatch(/^ · /);
    });
});
