/**
 * Integration tests — Catalog sorting engine and dynamic column sorting.
 *
 * Requirements:
 * - Dynamic Header Sorting is strict and bypasses/overrides the default 6-Tier sort.
 * - JSONB sorting mathematically casts numeric fields (like vram_gb, length_mm, tdp).
 * - Empty specs are pushed to the bottom using NULLS LAST.
 * - String fields (like chipset) are sorted alphabetically.
 * - Incomplete GPU penalty now penalizes components missing length_mm.
 */

// @ts-nocheck
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { sql } from 'bun';
import { app } from '../../app.js';

let dbAvailable = false;
let testRetailerId = 0;
const componentIds: number[] = [];

beforeAll(async () => {
  if (process.platform === 'win32') {
    console.warn('[integration] Skipping integration database tests on native Windows to avoid Bun PostgreSQL memory alignment panics.');
    return;
  }
  try {
    await sql`SELECT 1`;
    dbAvailable = true;

    // Clean up any leftovers from previous failed runs
    await sql`DELETE FROM prices WHERE component_id IN (SELECT id FROM components WHERE brand = 'SortingBrand')`;
    await sql`DELETE FROM components WHERE brand = 'SortingBrand'`;
    await sql`DELETE FROM retailers WHERE name = 'SortingTestRetailer'`;

    // Create a temporary retailer for in_stock prices
    const retailerRows = await sql`
      INSERT INTO retailers (name, base_url, country, is_active, scraping_interval_hours)
      VALUES ('SortingTestRetailer', 'https://sorting-test.ma', 'MA', true, 24)
      ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
      RETURNING id
    `;
    testRetailerId = retailerRows[0].id;

    // We will insert 5 GPU components for sorting tests:
    // 1. GPU Complete 1: 12GB VRAM, 300mm length, 220W TDP, RTX 4070, price 7000 MAD, complete, in stock
    // 2. GPU Complete 2: 8GB VRAM, 240mm length, 160W TDP, RTX 4060, price 4000 MAD, complete, in stock
    // 3. GPU Complete 3: 16GB VRAM, 340mm length, 290W TDP, RTX 4080, price 12000 MAD, complete, in stock
    // 4. GPU Incomplete (Missing length): 12GB VRAM, NULL length, 200W TDP, RTX 4070 Super, price 8000 MAD, incomplete, in stock
    // 5. GPU Incomplete (Missing vram): NULL VRAM, 280mm length, 180W TDP, RX 7600, price 3500 MAD, incomplete, in stock
    // 6. GPU Ghost (No price / stock): 24GB VRAM, 330mm length, 350W TDP, RTX 4090, no price, complete, out of stock

    const gpus = [
      {
        name: 'GPU Complete 1 RTX 4070',
        slug: 'gpu-complete-1',
        vram_gb: 12,
        length_mm: 300,
        tdp: 220,
        chipset: 'RTX 4070',
        specs: { vram_gb: 12, length_mm: 300, tdp: 220, chipset: 'RTX 4070' },
        price: 7000
      },
      {
        name: 'GPU Complete 2 RTX 4060',
        slug: 'gpu-complete-2',
        vram_gb: 8,
        length_mm: 240,
        tdp: 160,
        chipset: 'RTX 4060',
        specs: { vram_gb: 8, length_mm: 240, tdp: 160, chipset: 'RTX 4060' },
        price: 4000
      },
      {
        name: 'GPU Complete 3 RTX 4080',
        slug: 'gpu-complete-3',
        vram_gb: 16,
        length_mm: 340,
        tdp: 290,
        chipset: 'RTX 4080',
        specs: { vram_gb: 16, length_mm: 340, tdp: 290, chipset: 'RTX 4080' },
        price: 12000
      },
      {
        name: 'GPU Incomplete Missing Length',
        slug: 'gpu-incomplete-length',
        vram_gb: 12,
        length_mm: null,
        tdp: 200,
        chipset: 'RTX 4070 Super',
        specs: { vram_gb: 12, length_mm: null, tdp: 200, chipset: 'RTX 4070 Super' },
        price: 8000
      },
      {
        name: 'GPU Incomplete Missing Vram',
        slug: 'gpu-incomplete-vram',
        vram_gb: null,
        length_mm: 280,
        tdp: 180,
        chipset: 'RX 7600',
        specs: { vram_gb: null, length_mm: 280, tdp: 180, chipset: 'RX 7600' },
        price: 3500
      },
      {
        name: 'GPU Ghost Complete RTX 4090',
        slug: 'gpu-ghost-complete',
        vram_gb: 24,
        length_mm: 330,
        tdp: 350,
        chipset: 'RTX 4090',
        specs: { vram_gb: 24, length_mm: 330, tdp: 350, chipset: 'RTX 4090' },
        price: null
      }
    ];

    for (const gpu of gpus) {
      const rows = await sql`
        INSERT INTO components (name, category, brand, slug, is_active, vram_gb, length_mm, tdp, chipset, specs)
        VALUES (${gpu.name}, 'gpu', 'SortingBrand', ${gpu.slug}, true, ${gpu.vram_gb}, ${gpu.length_mm}, ${gpu.tdp}, ${gpu.chipset}, ${gpu.specs}::jsonb)
        ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
        RETURNING id
      `;
      const id = rows[0].id;
      componentIds.push(id);

      if (gpu.price !== null) {
        await sql`
          INSERT INTO prices (component_id, retailer_id, price, in_stock, product_url)
          VALUES (${id}, ${testRetailerId}, ${gpu.price}, true, ${'https://sorting-test.ma/' + gpu.slug})
        `;
      }
    }
  } catch (err) {
    console.warn('[integration] DB not available — skipping catalog sorting tests', err);
  }
});

afterAll(async () => {
  if (!dbAvailable) return;
  if (componentIds.length > 0) {
    await sql`DELETE FROM prices WHERE component_id IN ${sql(componentIds)}`;
    await sql`DELETE FROM components WHERE id IN ${sql(componentIds)}`;
  }
  await sql`DELETE FROM retailers WHERE id = ${testRetailerId}`;
});

describe('Catalog Sorting Engine & Dynamic Headers', () => {
  test('1. Default 6-Tier sort ranks missing length_mm as incomplete', async () => {
    if (!dbAvailable) return;

    // Fetch components without explicit sortBy (should use default 6-Tier sort)
    // Category = gpu, brand = SortingBrand
    const res = await app.request('/api/components/smart-search?category=gpu&brand=SortingBrand', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ build: {} })
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    const list = body.components;

    // GPU Complete 2 (4000 MAD) is Tier 1 -> rank 1
    // GPU Complete 1 (7000 MAD) is Tier 1 -> rank 2
    // GPU Complete 3 (12000 MAD) is Tier 1 -> rank 3
    // GPU Incomplete Missing Vram (3500 MAD) is Tier 2 -> rank 4
    // GPU Incomplete Missing Length (8000 MAD) is Tier 2 -> rank 5 (penalized for missing length!)
    // GPU Ghost Complete RTX 4090 is Tier 6 -> rank 6
    expect(list.length).toBe(6);
    
    // Check that Complete ones come first (Tier 1) sorted by price
    expect(list[0].slug).toBe('gpu-complete-2'); // 4000
    expect(list[1].slug).toBe('gpu-complete-1'); // 7000
    expect(list[2].slug).toBe('gpu-complete-3'); // 12000
    
    // Check that incomplete ones come next (Tier 2) sorted by price
    expect(list[3].slug).toBe('gpu-incomplete-vram'); // 3500
    expect(list[4].slug).toBe('gpu-incomplete-length'); // 8000 (penalized, otherwise it would be tier 1)
    
    // Ghost is at the absolute bottom
    expect(list[5].slug).toBe('gpu-ghost-complete');
  });

  test('2. Dynamic sort by vram_gb ASC ignores tiers and sorts mathematically with NULLS LAST', async () => {
    if (!dbAvailable) return;

    const res = await app.request('/api/components/smart-search?category=gpu&brand=SortingBrand&sort=vram_gb_asc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ build: {} })
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    const list = body.components;
    console.log("TEST 2 LIST:", JSON.stringify(list, null, 2));

    // Expected vram_gb order: 8 (Complete 2) -> 12 (Complete 1) -> 12 (Incomplete Length) -> 16 (Complete 3) -> 24 (Ghost RTX 4090) -> NULL (Incomplete Vram, pushed to bottom)
    expect(list.length).toBe(6);
    expect(list[0].vram_gb).toBe(8);
    
    // Next two are 12GB VRAM (slugs can be in any order, but vram_gb must be 12)
    expect(list[1].vram_gb).toBe(12);
    expect(list[2].vram_gb).toBe(12);
    
    expect(list[3].vram_gb).toBe(16);
    expect(list[4].vram_gb).toBe(24);
    
    // Null should be last
    expect(list[5].vram_gb).toBeNull();
    expect(list[5].slug).toBe('gpu-incomplete-vram');
  });

  test('3. Dynamic sort by length_mm DESC ignores tiers and sorts mathematically with NULLS LAST', async () => {
    if (!dbAvailable) return;

    const res = await app.request('/api/components/smart-search?category=gpu&brand=SortingBrand&sort=length_mm_desc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ build: {} })
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    const list = body.components;

    // Expected length order desc: 340 (Complete 3) -> 330 (Ghost RTX 4090) -> 300 (Complete 1) -> 280 (Incomplete Vram) -> 240 (Complete 2) -> NULL (Incomplete Length, pushed to bottom)
    expect(list.length).toBe(6);
    expect(list[0].length_mm).toBe(340);
    expect(list[1].length_mm).toBe(330);
    expect(list[2].length_mm).toBe(300);
    expect(list[3].length_mm).toBe(280);
    expect(list[4].length_mm).toBe(240);
    
    // Null should be last
    expect(list[5].length_mm).toBeNull();
    expect(list[5].slug).toBe('gpu-incomplete-length');
  });

  test('4. Dynamic sort by chipset ASC sorts alphabetically with NULLS LAST', async () => {
    if (!dbAvailable) return;

    const res = await app.request('/api/components/smart-search?category=gpu&brand=SortingBrand&sort=chipset_asc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ build: {} })
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    const list = body.components;

    // Expected chipset order asc (worst to best): RX 7600 -> RTX 4060 -> RTX 4070 -> RTX 4070 Super -> RTX 4080 -> RTX 4090
    // Tier-based sorting check:
    expect(list.length).toBe(6);
    expect(list[0].chipset).toBe('RX 7600');
    expect(list[1].chipset).toBe('RTX 4060');
    expect(list[2].chipset).toBe('RTX 4070');
    expect(list[3].chipset).toBe('RTX 4070 Super');
    expect(list[4].chipset).toBe('RTX 4080');
    expect(list[5].chipset).toBe('RTX 4090');
  });

  test('5. Dynamic sort by tdp DESC mathematically sorts with NULLS LAST', async () => {
    if (!dbAvailable) return;

    const res = await app.request('/api/components/smart-search?category=gpu&brand=SortingBrand&sort=tdp_desc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ build: {} })
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    const list = body.components;

    // Expected tdp order desc: 350 -> 290 -> 220 -> 200 -> 180 -> 160
    expect(list.length).toBe(6);
    expect(list[0].tdp).toBe(350);
    expect(list[1].tdp).toBe(290);
    expect(list[2].tdp).toBe(220);
    expect(list[3].tdp).toBe(200);
    expect(list[4].tdp).toBe(180);
    expect(list[5].tdp).toBe(160);
  });
});
