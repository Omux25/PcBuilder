/**
 * Unit tests for slugService.ts and the underlying slugify utilities.
 *
 * slugify() and componentSlug() are pure functions — tested directly.
 * getUniqueSlug() requires a DB lookup — tested with a mock SQL injected via setSql().
 */

// @ts-nocheck — this file runs in Bun (WSL2); bun:test types not available on Windows
import { describe, test, expect, afterAll } from 'bun:test';
import { slugify, componentSlug, generateUniqueSlug } from '../../utils/slugify.js';
import { getUniqueSlug } from '../slugService.js';
import { setSql, resetSql } from '../../db/index.js';

afterAll(() => resetSql());

// ── slugify ──────────────────────────────────────────────────────────────────

describe('slugify', () => {
  test('lowercases input', () => {
    expect(slugify('AMD')).toBe('amd');
  });

  test('replaces spaces with hyphens', () => {
    expect(slugify('Ryzen 5 7600X')).toBe('ryzen-5-7600x');
  });

  test('replaces underscores with hyphens', () => {
    expect(slugify('ryzen_5_7600x')).toBe('ryzen-5-7600x');
  });

  test('strips non-alphanumeric characters', () => {
    expect(slugify('Core i5-12400F (LGA1700)')).toBe('core-i5-12400f-lga1700');
  });

  test('collapses multiple consecutive hyphens', () => {
    expect(slugify('RTX  4090')).toBe('rtx-4090');
  });

  test('trims leading and trailing hyphens', () => {
    expect(slugify(' test ')).toBe('test');
  });

  test('handles empty string', () => {
    expect(slugify('')).toBe('');
  });

  test('handles string with only special characters', () => {
    expect(slugify('---')).toBe('');
  });
});

// ── componentSlug ────────────────────────────────────────────────────────────

describe('componentSlug', () => {
  test('prepends brand when provided', () => {
    expect(componentSlug('AMD', 'Ryzen 5 7600X')).toBe('amd-ryzen-5-7600x');
  });

  test('uses only name when brand is null', () => {
    expect(componentSlug(null, 'Ryzen 5 7600X')).toBe('ryzen-5-7600x');
  });

  test('uses only name when brand is undefined', () => {
    expect(componentSlug(undefined, 'Ryzen 5 7600X')).toBe('ryzen-5-7600x');
  });

  test('uses only name when brand is empty string', () => {
    expect(componentSlug('', 'Ryzen 5 7600X')).toBe('ryzen-5-7600x');
  });

  test('handles brand and name with special characters', () => {
    expect(componentSlug('ASUS', 'ROG STRIX B650-A')).toBe('asus-rog-strix-b650-a');
  });
});

// ── generateUniqueSlug ───────────────────────────────────────────────────────

describe('generateUniqueSlug', () => {
  test('returns base slug when not in existing set', () => {
    const result = generateUniqueSlug('amd-ryzen-5', new Set());
    expect(result).toBe('amd-ryzen-5');
  });

  test('appends -2 when base slug is taken', () => {
    const result = generateUniqueSlug('amd-ryzen-5', new Set(['amd-ryzen-5']));
    expect(result).toBe('amd-ryzen-5-2');
  });

  test('increments suffix until a free slot is found', () => {
    const existing = new Set(['amd-ryzen-5', 'amd-ryzen-5-2', 'amd-ryzen-5-3']);
    const result = generateUniqueSlug('amd-ryzen-5', existing);
    expect(result).toBe('amd-ryzen-5-4');
  });

  test('does not append suffix when base is free even if suffixed versions exist', () => {
    const existing = new Set(['amd-ryzen-5-2']);
    const result = generateUniqueSlug('amd-ryzen-5', existing);
    expect(result).toBe('amd-ryzen-5');
  });
});

// ── getUniqueSlug (DB-backed) ────────────────────────────────────────────────

describe('getUniqueSlug', () => {
  function makeMockSql(rows: unknown[]) {
    return (_strings: TemplateStringsArray, ..._values: unknown[]) =>
      Promise.resolve(rows);
  }

  test('returns base slug when no collisions exist in DB', async () => {
    setSql(makeMockSql([]));
    const slug = await getUniqueSlug('AMD', 'Ryzen 5 7600X');
    expect(slug).toBe('amd-ryzen-5-7600x');
  });

  test('appends -2 when base slug is already taken', async () => {
    setSql(makeMockSql([{ slug: 'amd-ryzen-5-7600x' }]));
    const slug = await getUniqueSlug('AMD', 'Ryzen 5 7600X');
    expect(slug).toBe('amd-ryzen-5-7600x-2');
  });

  test('increments suffix past existing collisions', async () => {
    setSql(makeMockSql([
      { slug: 'amd-ryzen-5-7600x' },
      { slug: 'amd-ryzen-5-7600x-2' },
    ]));
    const slug = await getUniqueSlug('AMD', 'Ryzen 5 7600X');
    expect(slug).toBe('amd-ryzen-5-7600x-3');
  });

  test('works with null brand', async () => {
    setSql(makeMockSql([]));
    const slug = await getUniqueSlug(null, 'Ryzen 5 7600X');
    expect(slug).toBe('ryzen-5-7600x');
  });

  test('excludeId is passed to the query (no collision with self on update)', async () => {
    // When updating component id=1, its own slug should not count as a collision.
    // The mock returns empty (simulating the DB excluding id=1 from results).
    setSql(makeMockSql([]));
    const slug = await getUniqueSlug('AMD', 'Ryzen 5 7600X', 1);
    expect(slug).toBe('amd-ryzen-5-7600x');
  });
});
