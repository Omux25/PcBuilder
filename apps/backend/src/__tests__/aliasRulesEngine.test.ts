import { describe, test, expect } from 'bun:test';
import { deriveCanonicalName } from '../modules/scraping/services/suggestionEngine';
import type { AliasRule } from '../modules/scraping/services/aliasRulesService';

// ── Alias Rules Engine Tests ──────────────────────────────────────────────────

describe('Alias Rules Engine: dynamic regex replacements', () => {
    const rules: AliasRule[] = [
        {
            id: 1,
            pattern: '\\bryzen\\s+3\\s+3400g\\b',
            replacement: 'Ryzen 5 3400G',
            category: 'cpu',
            is_regex: true,
            created_at: '2026-01-01',
        },
    ];

    test('corrects vendor tier typo "Ryzen 3 3400G" -> "Ryzen 5 3400G"', () => {
        const result = deriveCanonicalName(
            'AMD Ryzen 3 3400G (3.7 GHz / 4.2 GHz) Tray',
            'AMD',
            'cpu',
            rules,
        );
        expect(result).toBe('Ryzen 5 3400G');
    });

    test('case-insensitive: "ryzen 3 3400G" also corrected', () => {
        const result = deriveCanonicalName(
            'AMD ryzen 3 3400G Tray',
            'AMD',
            'cpu',
            rules,
        );
        expect(result).toBe('Ryzen 5 3400G');
    });

    test('does NOT alter a different model (5600G stays as-is)', () => {
        const result = deriveCanonicalName(
            'AMD Ryzen 5 5600G Tray',
            'AMD',
            'cpu',
            rules,
        );
        expect(result).toBe('Ryzen 5 5600G');
    });
});

describe('Alias Rules Engine: plain string replacements', () => {
    const rules: AliasRule[] = [
        {
            id: 2,
            pattern: 'Core i5 12400F',
            replacement: 'Core i5-12400F',
            category: 'cpu',
            is_regex: false,
            created_at: '2026-01-01',
        },
    ];

    test('replaces plain string pattern correctly', () => {
        const result = deriveCanonicalName(
            'Intel Core i5 12400F Tray',
            'Intel',
            'cpu',
            rules,
        );
        expect(result).toBe('Core i5-12400F');
    });
});

describe('Alias Rules Engine: category scoping', () => {
    const rules: AliasRule[] = [
        {
            id: 3,
            pattern: 'Gold',
            replacement: 'Premium',
            category: 'psu',
            is_regex: false,
            created_at: '2026-01-01',
        },
    ];

    test('does NOT apply a PSU-scoped rule when processing a GPU listing', () => {
        const result = deriveCanonicalName(
            'Corsair RM850 Gold Modular',
            'Corsair',
            'gpu',  // Wrong category on purpose
            rules,
        );
        // "Gold" should NOT be replaced since rule is scoped to 'psu'
        expect(result).not.toContain('Premium');
    });

    test('DOES apply a PSU-scoped rule when processing a PSU listing', () => {
        const result = deriveCanonicalName(
            'Corsair RM850 Gold Modular',
            'Corsair',
            'psu',
            rules,
        );
        expect(result).toContain('Premium');
    });
});

describe('Alias Rules Engine: universal rules (null category)', () => {
    const rules: AliasRule[] = [
        {
            id: 4,
            pattern: 'RGB',
            replacement: 'ARGB',
            category: null,
            is_regex: false,
            created_at: '2026-01-01',
        },
    ];

    test('universal rule applies across categories', () => {
        const mbResult = deriveCanonicalName('MSI B650 RGB WiFi', 'MSI', 'motherboard', rules);
        const gpuResult = deriveCanonicalName('MSI RTX 4070 RGB Gaming', 'MSI', 'gpu', rules);
        expect(mbResult).toContain('ARGB');
        expect(gpuResult).toContain('ARGB');
    });
});

describe('Alias Rules Engine: fail-safe on malformed regex', () => {
    const rules: AliasRule[] = [
        {
            id: 5,
            pattern: '[invalid(regex',  // malformed regex
            replacement: 'Replaced',
            category: null,
            is_regex: true,
            created_at: '2026-01-01',
        },
    ];

    test('does not crash on malformed regex — falls through silently', () => {
        expect(() => {
            deriveCanonicalName('AMD Ryzen 5 5600 Tray', 'AMD', 'cpu', rules);
        }).not.toThrow();
    });
});

describe('Alias Rules Engine: no rules passed → backward compatible', () => {
    test('empty alias rules still produces correct canonical name', () => {
        const result = deriveCanonicalName(
            'AMD Ryzen 5 5600 (3.5 GHz / 4.4 GHz) Tray',
            'AMD',
            'cpu',
            [],
        );
        expect(result).toBe('Ryzen 5 5600');
    });

    test('undefined alias rules is safe (default parameter)', () => {
        const result = deriveCanonicalName(
            'AMD Ryzen 7 7800X3D Tray',
            'AMD',
            'cpu',
        );
        expect(result).toBe('Ryzen 7 7800X3D');
    });
});
