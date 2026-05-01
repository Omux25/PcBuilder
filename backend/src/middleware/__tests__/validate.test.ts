/**
 * Unit tests for Zod validation middleware.
 *
 * Requirements: 8.2, 8.3, 11.2
 */

// @ts-nocheck — this file runs in Bun (WSL2); bun:test types not available on Windows
import { describe, test, expect } from 'bun:test';
import { Hono, type Context } from 'hono';
import { validateComponent } from '../validate.js';

describe('validateComponent middleware', () => {
  test('returns 400 when body is not valid JSON', async () => {
    const app = new Hono();
    app.post('/test', validateComponent, (c: Context) => c.json({ success: true }));

    const res = await app.request('/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'invalid json{',
    });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe('VALIDATION_ERROR');
    expect(json.error.message).toContain('valid JSON');
  });

  test('returns 400 when category is missing', async () => {
    const app = new Hono();
    app.post('/test', validateComponent, (c: Context) => c.json({ success: true }));

    const res = await app.request('/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test Component' }),
    });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe('VALIDATION_ERROR');
    expect(json.error.fields).toContain('category');
  });

  test('returns 400 when category is invalid', async () => {
    const app = new Hono();
    app.post('/test', validateComponent, (c: Context) => c.json({ success: true }));

    const res = await app.request('/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category: 'invalid_category', name: 'Test' }),
    });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe('VALIDATION_ERROR');
    expect(json.error.fields).toContain('category');
  });

  test('returns 400 when required field is missing for cpu', async () => {
    const app = new Hono();
    app.post('/test', validateComponent, (c: Context) => c.json({ success: true }));

    const res = await app.request('/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category: 'cpu',
        name: 'Intel i9',
        // missing socket
      }),
    });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe('VALIDATION_ERROR');
    expect(json.error.message).toBe('Validation failed');
    expect(json.error.fields).toContain('socket');
  });

  test('returns 400 when required field is missing for motherboard', async () => {
    const app = new Hono();
    app.post('/test', validateComponent, (c: Context) => c.json({ success: true }));

    const res = await app.request('/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category: 'motherboard',
        name: 'ASUS ROG',
        socket: 'AM5',
        // missing supported_ram_types and max_ram_frequency
      }),
    });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe('VALIDATION_ERROR');
    expect(json.error.fields.length).toBeGreaterThan(0);
  });

  test('returns 400 when required field is missing for gpu', async () => {
    const app = new Hono();
    app.post('/test', validateComponent, (c: Context) => c.json({ success: true }));

    const res = await app.request('/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category: 'gpu',
        name: 'RTX 4090',
        // missing length_mm
      }),
    });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe('VALIDATION_ERROR');
    expect(json.error.fields).toContain('length_mm');
  });

  test('returns 400 when required field is missing for ram', async () => {
    const app = new Hono();
    app.post('/test', validateComponent, (c: Context) => c.json({ success: true }));

    const res = await app.request('/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category: 'ram',
        name: 'Corsair Vengeance',
        // missing ram_type and frequency_mhz
      }),
    });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe('VALIDATION_ERROR');
    expect(json.error.fields.length).toBeGreaterThan(0);
  });

  test('returns 400 when ram_type is invalid', async () => {
    const app = new Hono();
    app.post('/test', validateComponent, (c: Context) => c.json({ success: true }));

    const res = await app.request('/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category: 'ram',
        name: 'Corsair Vengeance',
        ram_type: 'DDR3', // invalid, only DDR4 or DDR5 allowed
        frequency_mhz: 3200,
      }),
    });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe('VALIDATION_ERROR');
    expect(json.error.fields).toContain('ram_type');
  });

  test('returns 400 when required field is missing for psu', async () => {
    const app = new Hono();
    app.post('/test', validateComponent, (c: Context) => c.json({ success: true }));

    const res = await app.request('/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category: 'psu',
        name: 'Corsair RM850x',
        // missing wattage
      }),
    });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe('VALIDATION_ERROR');
    expect(json.error.fields).toContain('wattage');
  });

  test('returns 400 when required field is missing for case', async () => {
    const app = new Hono();
    app.post('/test', validateComponent, (c: Context) => c.json({ success: true }));

    const res = await app.request('/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category: 'case',
        name: 'NZXT H510',
        // missing max_gpu_length_mm
      }),
    });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe('VALIDATION_ERROR');
    expect(json.error.fields).toContain('max_gpu_length_mm');
  });

  test('passes validation for valid cpu', async () => {
    const app = new Hono();
    app.post('/test', validateComponent, (c: Context) => c.json({ success: true }));

    const res = await app.request('/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category: 'cpu',
        name: 'Intel i9-13900K',
        brand: 'Intel',
        socket: 'LGA1700',
        tdp: 125,
      }),
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
  });

  test('passes validation for valid motherboard', async () => {
    const app = new Hono();
    app.post('/test', validateComponent, (c: Context) => c.json({ success: true }));

    const res = await app.request('/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category: 'motherboard',
        name: 'ASUS ROG STRIX B650',
        brand: 'ASUS',
        socket: 'AM5',
        supported_ram_types: ['DDR5'],
        max_ram_frequency: 6000,
        tdp: 50,
      }),
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
  });

  test('passes validation for valid gpu', async () => {
    const app = new Hono();
    app.post('/test', validateComponent, (c: Context) => c.json({ success: true }));

    const res = await app.request('/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category: 'gpu',
        name: 'RTX 4090',
        brand: 'NVIDIA',
        length_mm: 336,
        tdp: 450,
      }),
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
  });

  test('passes validation for valid ram', async () => {
    const app = new Hono();
    app.post('/test', validateComponent, (c: Context) => c.json({ success: true }));

    const res = await app.request('/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category: 'ram',
        name: 'Corsair Vengeance DDR5',
        brand: 'Corsair',
        ram_type: 'DDR5',
        frequency_mhz: 6000,
        tdp: 10,
      }),
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
  });

  test('passes validation for valid storage (minimal fields)', async () => {
    const app = new Hono();
    app.post('/test', validateComponent, (c: Context) => c.json({ success: true }));

    const res = await app.request('/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category: 'storage',
        name: 'Samsung 980 PRO',
        brand: 'Samsung',
      }),
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
  });

  test('passes validation for valid psu', async () => {
    const app = new Hono();
    app.post('/test', validateComponent, (c: Context) => c.json({ success: true }));

    const res = await app.request('/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category: 'psu',
        name: 'Corsair RM850x',
        brand: 'Corsair',
        wattage: 850,
      }),
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
  });

  test('passes validation for valid case', async () => {
    const app = new Hono();
    app.post('/test', validateComponent, (c: Context) => c.json({ success: true }));

    const res = await app.request('/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category: 'case',
        name: 'NZXT H510',
        brand: 'NZXT',
        max_gpu_length_mm: 381,
      }),
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
  });

  test('optional fields can be omitted', async () => {
    const app = new Hono();
    app.post('/test', validateComponent, (c: Context) => c.json({ success: true }));

    const res = await app.request('/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category: 'cpu',
        name: 'AMD Ryzen 9 7950X',
        socket: 'AM5',
        // brand and tdp are optional
      }),
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
  });

  test('returns 400 with multiple missing fields', async () => {
    const app = new Hono();
    app.post('/test', validateComponent, (c: Context) => c.json({ success: true }));

    const res = await app.request('/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category: 'motherboard',
        // missing name, socket, supported_ram_types, max_ram_frequency
      }),
    });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe('VALIDATION_ERROR');
    expect(json.error.fields.length).toBeGreaterThan(1);
  });
});
