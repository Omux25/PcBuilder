// @ts-nocheck
import { describe, test, expect, beforeEach, mock } from 'bun:test';
import { Hono } from 'hono';

const validComponents = [
  { id: 1, category: 'cpu', socket: 'AM5', tdp: 105 },
  { id: 2, category: 'motherboard', socket: 'AM5', supported_ram_types: ['DDR5'], max_ram_frequency: 6000, tdp: 15 },
  { id: 3, category: 'gpu', length_mm: 320, tdp: 200 },
  { id: 4, category: 'ram', ram_type: 'DDR5', frequency_mhz: 5600, tdp: 10 },
  { id: 5, category: 'psu', wattage: 850, tdp: 0 },
  { id: 6, category: 'case', max_gpu_length_mm: 400, tdp: 0 },
  { id: 7, category: 'motherboard', socket: 'LGA1700', supported_ram_types: ['DDR5'], max_ram_frequency: 6000, tdp: 15 }, // incompatible mobo
  { id: 8, category: 'psu', wattage: 300, tdp: 0 }, // underpowered psu
  { id: 9, category: 'cpu', socket: 'AM5', tdp: null }, // nullable tdp
];

mock.module('../../services/componentService.js', () => ({
  getComponentsByIds: async (ids: number[]) => {
    return ids.map(id => validComponents.find(c => c.id === id)).filter(Boolean);
  }
}));

import { compatibilityRouter } from '../compatibility.js';

function makeApp() {
  const app = new Hono();
  app.route('/api/compatibility', compatibilityRouter);
  return app;
}

const validBuild = {
  cpu: 1,
  motherboard: 2,
  gpu: 3,
  ram: 4,
  psu: 5,
  case: 6,
};

describe('POST /api/compatibility/validate', () => {
  let app: Hono;

  beforeEach(() => {
    app = makeApp();
  });

  test('returns compatible=true for a valid build', async () => {
    const res = await app.request('/api/compatibility/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validBuild),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.compatible).toBe(true);
    expect(body.errors).toHaveLength(0);
  });

  test('returns compatible=false with socket_mismatch error', async () => {
    const build = {
      cpu: 1, // AM5
      motherboard: 7, // LGA1700
    };

    const res = await app.request('/api/compatibility/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(build),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.compatible).toBe(false);
    expect(body.errors[0].rule).toBe('socket_mismatch');
  });

  test('returns warnings for psu_underpowered', async () => {
    const build = {
      cpu: 1, // 105W
      gpu: 3, // 200W
      psu: 8, // 300W
    };

    const res = await app.request('/api/compatibility/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(build),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.warnings.some((w) => w.rule === 'psu_underpowered')).toBe(true);
  });

  test('returns total_tdp and recommended_psu_wattage', async () => {
    const res = await app.request('/api/compatibility/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validBuild),
    });

    const body = await res.json();
    expect(typeof body.total_tdp).toBe('number');
    expect(typeof body.recommended_psu_wattage).toBe('number');
  });

  test('accepts partial build (not all components required)', async () => {
    const res = await app.request('/api/compatibility/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cpu: 1 }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.compatible).toBe(true);
  });

  test('accepts empty build', async () => {
    const res = await app.request('/api/compatibility/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.compatible).toBe(true);
    expect(body.total_tdp).toBe(0);
  });

  test('returns 400 for invalid JSON', async () => {
    const res = await app.request('/api/compatibility/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  test('response always has compatible, errors, warnings, total_tdp, recommended_psu_wattage', async () => {
    const res = await app.request('/api/compatibility/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validBuild),
    });

    const body = await res.json();
    expect(body).toHaveProperty('compatible');
    expect(body).toHaveProperty('errors');
    expect(body).toHaveProperty('warnings');
    expect(body).toHaveProperty('total_tdp');
    expect(body).toHaveProperty('recommended_psu_wattage');
  });

  // ── Zod input validation ────────────────────────────────────────────────────

  test('returns 400 when a component slot is a string instead of a number', async () => {
    const res = await app.request('/api/compatibility/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cpu: 'not-a-number' }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  test('returns 400 when a component ID is negative', async () => {
    const res = await app.request('/api/compatibility/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cpu: -5 }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(Array.isArray(body.error.fields)).toBe(true);
  });

  test('accepts null tdp (nullable field in DB mapping)', async () => {
    const res = await app.request('/api/compatibility/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cpu: 9 }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total_tdp).toBe(0);
  });
});

