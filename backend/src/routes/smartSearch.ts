/**
 * Smart Search route — returns components enriched with compatibility and price data.
 *
 * GET /api/components/smart-search
 *
 * Query params:
 *   category  (required) — component category to search
 *   search    (optional) — text search
 *   page      (optional, default 1)
 *   limit     (optional, default 20, max 100)
 *   build     (optional) — JSON-encoded current build for compatibility checking
 *
 * Response: components sorted by:
 *   1. Compatible + in stock + cheapest first
 *   2. Compatible + out of stock
 *   3. Incompatible (with reason)
 *
 * Each component includes:
 *   - lowest_price: number | null
 *   - in_stock: boolean
 *   - compatibility: 'compatible' | 'incompatible' | 'unknown'
 *   - compatibility_issues: string[] (human-readable reasons)
 */

import { Hono } from 'hono';
import { getComponents } from '../services/componentService.js';
import { validateCompatibility } from '../services/compatibilityService.js';
import { sql } from 'bun';

const smartSearchRouter = new Hono();

smartSearchRouter.get('/', async (c) => {
  const category = c.req.query('category');
  const search   = c.req.query('search');
  const page     = c.req.query('page')  ? Number(c.req.query('page'))  : 1;
  const limit    = Math.min(100, c.req.query('limit') ? Number(c.req.query('limit')) : 20);

  if (!category) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Le paramètre category est requis' } }, 400);
  }

  // Parse current build from query param
  let currentBuild: Record<string, unknown> = {};
  const buildParam = c.req.query('build');
  if (buildParam) {
    try {
      currentBuild = JSON.parse(buildParam);
    } catch {
      return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Le paramètre build doit être du JSON valide' } }, 400);
    }
  }

  // Fetch all matching components (no pagination yet — we need to sort by compatibility first)
  // For large catalogs this could be optimized, but 305 components is fine
  const { components } = await getComponents({
    category,
    search: search || undefined,
    page: 1,
    limit: 300, // fetch all, sort client-side, then paginate
  });

  if (components.length === 0) {
    return c.json({ components: [], total: 0 });
  }

  // Fetch lowest prices for all components in one query.
  // We join against the prices table filtered by the same category/search
  // to avoid passing a JS array as a Postgres parameter (Bun.sql limitation).
  const priceRows = await sql`
    SELECT
      p.component_id,
      MIN(p.price)        AS lowest_price,
      BOOL_OR(p.in_stock) AS any_in_stock
    FROM prices p
    JOIN components c ON c.id = p.component_id
    WHERE c.category = ${category}
      AND c.is_active = true
    GROUP BY p.component_id
  ` as { component_id: number; lowest_price: number; any_in_stock: boolean }[];

  const priceMap = new Map(priceRows.map((r) => [r.component_id, r]));

  // Check compatibility for each component
  const enriched = components.map((component) => {
    const priceData = priceMap.get(component.id);
    const lowest_price = priceData ? Number(priceData.lowest_price) : null;
    const in_stock = priceData ? priceData.any_in_stock : false;

    // Build a test build with this component in the target slot
    const testBuild = { ...currentBuild, [category]: component };

    let compatibility: 'compatible' | 'incompatible' | 'unknown' = 'unknown';
    let compatibility_issues: string[] = [];

    // Only check compatibility if there are other components in the build
    const hasOtherComponents = Object.keys(currentBuild).some((k) => k !== category);

    if (hasOtherComponents) {
      try {
        const result = validateCompatibility(testBuild as Parameters<typeof validateCompatibility>[0]);
        // Only count errors that involve this component
        const relevantErrors = result.errors.filter((e) =>
          e.components.includes(category)
        );
        if (relevantErrors.length > 0) {
          compatibility = 'incompatible';
          compatibility_issues = relevantErrors.map((e) => e.message);
        } else {
          compatibility = 'compatible';
        }
      } catch {
        compatibility = 'unknown';
      }
    } else {
      compatibility = 'compatible'; // no other components to conflict with
    }

    return {
      ...component,
      lowest_price,
      in_stock,
      compatibility,
      compatibility_issues,
    };
  });

  // Sort: compatible+in_stock+cheapest → compatible+no_price → incompatible
  enriched.sort((a, b) => {
    // Incompatible always goes to the bottom
    if (a.compatibility === 'incompatible' && b.compatibility !== 'incompatible') return 1;
    if (b.compatibility === 'incompatible' && a.compatibility !== 'incompatible') return -1;

    // Among compatible: in_stock before out_of_stock
    if (a.in_stock && !b.in_stock) return -1;
    if (!a.in_stock && b.in_stock) return 1;

    // Among same stock status: cheapest first (null price goes last)
    if (a.lowest_price !== null && b.lowest_price !== null) {
      return a.lowest_price - b.lowest_price;
    }
    if (a.lowest_price !== null) return -1;
    if (b.lowest_price !== null) return 1;

    // Fallback: alphabetical
    return a.name.localeCompare(b.name);
  });

  // Paginate after sorting
  const total = enriched.length;
  const start = (page - 1) * limit;
  const paginated = enriched.slice(start, start + limit);

  c.header('X-Total-Count', String(total));
  return c.json({ components: paginated, total });
});

export { smartSearchRouter };
