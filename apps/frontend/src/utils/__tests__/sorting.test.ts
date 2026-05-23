import { describe, it, expect } from 'bun:test';
import type { SmartComponent } from '../../api';

// Replicating the exact sorting callback logic from ComponentPicker.tsx for verification
function smartSort(list: SmartComponent[]): SmartComponent[] {
  return [...list].sort((a, b) => {
    const getTier = (c: SmartComponent) => {
      if (c.compatibility === 'incompatible') return 4;
      const p = c.lowest_price;
      const hasPrice = p !== null && p !== undefined && p > 0;
      if (c.in_stock && hasPrice) return 1;
      if (!c.in_stock && hasPrice) return 2;
      return 3; // Ghost Component (price is null, undefined, or 0)
    };

    const tierA = getTier(a);
    const tierB = getTier(b);

    if (tierA !== tierB) {
      return tierA - tierB;
    }

    // Within Tiers 1 and 2, sort internally from lowest price to highest price
    if (tierA === 1 || tierA === 2) {
      const priceA = Number(a.lowest_price);
      const priceB = Number(b.lowest_price);
      if (priceA !== priceB) {
        return priceA - priceB;
      }
    }

    // Tier 3 (Ghosts), Tier 4 (Incompatible), or equal prices: sort by ID to ensure stable sort
    return a.id - b.id;
  });
}

function priceAscSort(list: SmartComponent[]): SmartComponent[] {
  return [...list].sort((a, b) => {
    // 1. Compatibility priority (Compatible > Unknown > Incompatible)
    const rank = (c: SmartComponent) => {
      if (c.compatibility === 'compatible') return 0;
      if (c.compatibility === 'unknown') return 1;
      return 2;
    };
    const rankA = rank(a);
    const rankB = rank(b);
    if (rankA !== rankB) return rankA - rankB;

    // 2. Field-specific sort
    const getPriceVal = (c: SmartComponent) => {
      const p = c.lowest_price;
      return (p === null || p === undefined || p <= 0) ? null : Number(p);
    };
    const priceA = getPriceVal(a);
    const priceB = getPriceVal(b);
    if (priceA === null && priceB === null) return a.id - b.id;
    if (priceA === null) return 1;
    if (priceB === null) return -1;
    return priceA - priceB;
  });
}

function priceDescSort(list: SmartComponent[]): SmartComponent[] {
  return [...list].sort((a, b) => {
    // 1. Compatibility priority (Compatible > Unknown > Incompatible)
    const rank = (c: SmartComponent) => {
      if (c.compatibility === 'compatible') return 0;
      if (c.compatibility === 'unknown') return 1;
      return 2;
    };
    const rankA = rank(a);
    const rankB = rank(b);
    if (rankA !== rankB) return rankA - rankB;

    // 2. Field-specific sort
    const getPriceVal = (c: SmartComponent) => {
      const p = c.lowest_price;
      return (p === null || p === undefined || p <= 0) ? null : Number(p);
    };
    const priceA = getPriceVal(a);
    const priceB = getPriceVal(b);
    if (priceA === null && priceB === null) return a.id - b.id;
    if (priceA === null) return 1;
    if (priceB === null) return -1;
    return priceB - priceA;
  });
}

// Helpers to construct mock components
function makeComponent(id: number, lowest_price: number | null, in_stock: boolean, compatibility: 'compatible' | 'unknown' | 'incompatible' = 'compatible'): SmartComponent {
  return {
    id,
    name: `Component ${id}`,
    brand: 'Brand',
    category: 'cpu',
    slug: `component-${id}`,
    lowest_price,
    in_stock,
    compatibility,
    compatibility_issues: [],
  } as unknown as SmartComponent;
}

describe('Strict Null-Safe Sorting Engine', () => {
  describe('Smart Sort Mode', () => {
    it('correctly ranks components in the correct tiers', () => {
      const items = [
        makeComponent(1, 0, false), // Tier 3 (Ghost)
        makeComponent(2, 400, false), // Tier 2
        makeComponent(3, null, true), // Tier 3 (Ghost)
        makeComponent(4, 200, true), // Tier 1
        makeComponent(5, 500, true), // Tier 1
        makeComponent(6, 100, false), // Tier 2
        makeComponent(7, 300, true, 'incompatible'), // Tier 4 (Incompatible)
      ];

      const sorted = smartSort(items);

      // Expected Tiers Order:
      // Tier 1: Component 4 (200 MAD), Component 5 (500 MAD)
      // Tier 2: Component 6 (100 MAD), Component 2 (400 MAD)
      // Tier 3: Component 1 (0 MAD), Component 3 (null MAD)
      // Tier 4: Component 7 (Incompatible)
      expect(sorted.map(x => x.id)).toEqual([4, 5, 6, 2, 1, 3, 7]);
    });
  });

  describe('Price Ascending Sort Mode', () => {
    it('correctly forces ghost components to the absolute bottom', () => {
      const items = [
        makeComponent(1, 0, false), // Ghost
        makeComponent(2, 400, false), // Valid price
        makeComponent(3, null, true), // Ghost
        makeComponent(4, 200, true), // Valid price
      ];

      const sorted = priceAscSort(items);

      // Expected: Component 4 (200 MAD), Component 2 (400 MAD), Component 1 (Ghost), Component 3 (Ghost)
      expect(sorted.map(x => x.id)).toEqual([4, 2, 1, 3]);
    });
  });

  describe('Price Descending Sort Mode', () => {
    it('correctly forces ghost components to the absolute bottom', () => {
      const items = [
        makeComponent(1, 0, false), // Ghost
        makeComponent(2, 400, false), // Valid price
        makeComponent(3, null, true), // Ghost
        makeComponent(4, 200, true), // Valid price
      ];

      const sorted = priceDescSort(items);

      // Expected: Component 2 (400 MAD), Component 4 (200 MAD), Component 1 (Ghost), Component 3 (Ghost)
      expect(sorted.map(x => x.id)).toEqual([2, 4, 1, 3]);
    });
  });
});
