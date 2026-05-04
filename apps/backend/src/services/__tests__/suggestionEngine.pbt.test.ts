// @ts-nocheck
/**
 * Property-based tests for the Suggestion Engine.
 *
 * Properties tested:
 *   1. Canonical name idempotency
 *   2. Color variant collapse
 *   3. Suggestion engine purity
 *   4. Batch = individual
 *
 * Requirements: 1.7, 2.5, 3.1, 3.4, 3.5, 3.7, 4.5
 */

import { describe, test, expect } from 'bun:test';
import * as fc from 'fast-check';
import {
    deriveCanonicalName,
    suggestForListing,
    processBatch,
} from '../suggestionEngine.js';
import type { CatalogComponent } from '../../utils/componentMatcher.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────

// A small fixed catalog snapshot used for purity and batch tests
const FIXED_CATALOG: CatalogComponent[] = [
    { id: 1, name: 'Ryzen 5 7600X', brand: 'AMD', category: 'cpu' },
    { id: 2, name: 'GeForce RTX 4070', brand: 'NVIDIA', category: 'gpu' },
    { id: 3, name: 'B650M DS3H', brand: 'Gigabyte', category: 'motherboard' },
    { id: 4, name: 'Vengeance DDR5-5600 32GB', brand: 'Corsair', category: 'ram' },
    { id: 5, name: 'AK400', brand: 'DeepCool', category: 'cooling' },
];

const COLOR_TOKENS = [
    'Noir', 'Blanc', 'Black', 'White', 'Blanche', 'Noire',
    'Rouge', 'Red', 'Blue', 'Bleu', 'Silver', 'Argent', 'Gold', 'Or',
    'Pink', 'Rose', 'Green', 'Vert', 'Purple', 'Violet', 'Grey', 'Gray', 'Gris',
];

// ── Property 1: Canonical name idempotency ────────────────────────────────────
// deriveCanonicalName(deriveCanonicalName(x, null), null) === deriveCanonicalName(x, null)
// Requirements: 3.4, 3.7

describe('PBT — Suggestion Engine', () => {
    test('Property 1: canonical name derivation is idempotent', () => {
        fc.assert(
            fc.property(
                fc.string({ minLength: 1, maxLength: 100 }),
                (name) => {
                    const once = deriveCanonicalName(name, null);
                    const twice = deriveCanonicalName(once, null);
                    expect(twice).toBe(once);
                },
            ),
            { numRuns: 500 },
        );
    });

    // ── Property 2: Color variant collapse ─────────────────────────────────────
    // For any base name N and color token C:
    // deriveCanonicalName(N + " " + C, null) === deriveCanonicalName(N, null)
    // Requirements: 3.1, 3.5

    test('Property 2: color variants collapse to the same canonical name', () => {
        fc.assert(
            fc.property(
                // Base name: must start with alphanumeric, no color tokens, not whitespace-only
                fc.stringMatching(/^[A-Za-z0-9][A-Za-z0-9 ]{2,39}$/).filter(
                    (s) =>
                        s.trim().length > 0 &&
                        !COLOR_TOKENS.some((t) => s.toLowerCase().includes(t.toLowerCase())),
                ),
                fc.constantFrom(...COLOR_TOKENS),
                (baseName, colorToken) => {
                    const withColor = `${baseName} ${colorToken}`;
                    const canonical1 = deriveCanonicalName(baseName, null);
                    const canonical2 = deriveCanonicalName(withColor, null);
                    expect(canonical2).toBe(canonical1);
                },
            ),
            { numRuns: 500 },
        );
    });

    // ── Property 3: Suggestion engine purity ───────────────────────────────────
    // Calling suggestForListing(name, catalog) twice returns identical results.
    // Requirements: 1.7, 3.7

    test('Property 3: suggestion engine is pure — same inputs produce same outputs', () => {
        fc.assert(
            fc.property(
                fc.string({ minLength: 1, maxLength: 100 }),
                (name) => {
                    const result1 = suggestForListing(name, FIXED_CATALOG);
                    const result2 = suggestForListing(name, FIXED_CATALOG);
                    expect(result1.category).toBe(result2.category);
                    expect(result1.confidence).toBe(result2.confidence);
                    expect(result1.canonical_name).toBe(result2.canonical_name);
                    expect(result1.brand).toBe(result2.brand);
                    expect(result1.existing_component_id).toBe(result2.existing_component_id);
                },
            ),
            { numRuns: 300 },
        );
    });

    // ── Property 4: Batch = individual ─────────────────────────────────────────
    // processBatch([{id:1, scraped_name: name}], catalog).get(1)
    // produces the same result as suggestForListing(name, catalog)
    // Requirements: 4.5

    test('Property 4: batch processing produces same results as individual calls', () => {
        fc.assert(
            fc.property(
                fc.string({ minLength: 1, maxLength: 100 }),
                (name) => {
                    const individual = suggestForListing(name, FIXED_CATALOG);
                    const batch = processBatch([{ id: 42, scraped_name: name }], FIXED_CATALOG);
                    const fromBatch = batch.get(42);

                    expect(fromBatch).toBeDefined();
                    expect(fromBatch!.category).toBe(individual.category);
                    expect(fromBatch!.confidence).toBe(individual.confidence);
                    expect(fromBatch!.canonical_name).toBe(individual.canonical_name);
                    expect(fromBatch!.brand).toBe(individual.brand);
                    expect(fromBatch!.existing_component_id).toBe(individual.existing_component_id);
                },
            ),
            { numRuns: 300 },
        );
    });

    // ── Concrete regression tests ─────────────────────────────────────────────
    // Verify specific real-world cases from the unmatched queue

    test('Concrete: DeepCool AK400 Noir and Blanc collapse to same canonical name', () => {
        const noir = deriveCanonicalName('DeepCool AK400 Noir', 'DeepCool');
        const blanc = deriveCanonicalName('DeepCool AK400 Blanc', 'DeepCool');
        const plain = deriveCanonicalName('DeepCool AK400', 'DeepCool');
        expect(noir).toBe(plain);
        expect(blanc).toBe(plain);
    });

    test('Concrete: ASUS A21 Plus TG ARGB Black and Blanc collapse to same canonical name', () => {
        const black = deriveCanonicalName('ASUS A21 Plus TG ARGB Black', 'ASUS');
        const blanc = deriveCanonicalName('ASUS A21 Plus TG ARGB Blanc', 'ASUS');
        expect(black).toBe(blanc);
    });

    test('Concrete: Thermal Grizzly Kryonaut is suggested as thermal_paste', () => {
        const result = suggestForListing('Thermal Grizzly Kryonaut (1 gramme)', []);
        expect(result.category).toBe('thermal_paste');
    });

    test('Concrete: NZXT F120 RGB Core is suggested as fan', () => {
        const result = suggestForListing('NZXT F120 RGB Core (Black)', []);
        expect(result.category).toBe('fan');
    });

    test('Concrete: Suggestion returns non-null canonical_name for any input', () => {
        const inputs = [
            'DeepCool AK400 Noir',
            'Thermal Grizzly Kryonaut (1 gramme)',
            'NZXT F120 RGB Core',
            'ASUS PRIME B650M-K',
            'Corsair RM850x',
            '',
            '   ',
            '123',
        ];
        for (const input of inputs) {
            const result = suggestForListing(input, []);
            expect(typeof result.canonical_name).toBe('string');
            expect(result.confidence).toMatch(/^(high|medium|low)$/);
        }
    });
});
