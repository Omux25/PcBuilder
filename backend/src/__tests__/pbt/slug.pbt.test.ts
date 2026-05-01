import { describe, expect, test } from 'bun:test';
import fc from 'fast-check';
import { componentSlug, generateUniqueSlug } from '../../utils/slugify.js';

describe('PBT 13.1 — Slug uniqueness', () => {
  test('For any set of component names, all generated slugs are unique', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            brand: fc.string({ minLength: 1, maxLength: 20 }),
            name: fc.string({ minLength: 1, maxLength: 50 })
          }),
          { minLength: 1, maxLength: 100 }
        ),
        (components) => {
          const generatedSlugs = new Set<string>();

          for (const comp of components) {
            const baseSlug = componentSlug(comp.brand, comp.name);
            // Even if base slug is empty or duplicates, generateUniqueSlug should handle it.
            const uniqueSlug = generateUniqueSlug(baseSlug || 'fallback', generatedSlugs);
            
            // It should not already exist
            expect(generatedSlugs.has(uniqueSlug)).toBeFalse();
            
            generatedSlugs.add(uniqueSlug);
          }

          // The total number of generated slugs must match the number of components processed
          expect(generatedSlugs.size).toBe(components.length);
        }
      ),
      { numRuns: 100 }
    );
  });
});
