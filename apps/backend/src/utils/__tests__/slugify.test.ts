// @ts-nocheck
import { describe, it, expect } from 'bun:test';
import { slugify, componentSlug, generateUniqueSlug } from '../slugify';

describe('slugify', () => {
  it('lowercases the input', () => {
    expect(slugify('AMD Ryzen')).toBe('amd-ryzen');
  });

  it('replaces spaces with hyphens', () => {
    expect(slugify('Ryzen 5 7600X')).toBe('ryzen-5-7600x');
  });

  it('replaces underscores with hyphens', () => {
    expect(slugify('ryzen_5_7600x')).toBe('ryzen-5-7600x');
  });

  it('strips special characters', () => {
    expect(slugify('Core i5-13600K (LGA1700)')).toBe('core-i5-13600k-lga1700');
  });

  it('collapses multiple hyphens', () => {
    expect(slugify('MSI  B650--GAMING')).toBe('msi-b650-gaming');
  });

  it('trims leading and trailing hyphens', () => {
    expect(slugify('  -Noctua- ')).toBe('noctua');
  });

  it('handles numbers correctly', () => {
    expect(slugify('RTX 4090')).toBe('rtx-4090');
  });

  it('returns empty string for empty input', () => {
    expect(slugify('')).toBe('');
  });
});

describe('componentSlug', () => {
  it('combines brand and name', () => {
    expect(componentSlug('AMD', 'Ryzen 5 7600X')).toBe('amd-ryzen-5-7600x');
  });

  it('uses only name when brand is null', () => {
    expect(componentSlug(null, 'Ryzen 5 7600X')).toBe('ryzen-5-7600x');
  });

  it('uses only name when brand is undefined', () => {
    expect(componentSlug(undefined, 'Ryzen 5 7600X')).toBe('ryzen-5-7600x');
  });

  it('uses only name when brand is empty string', () => {
    expect(componentSlug('', 'Ryzen 5 7600X')).toBe('ryzen-5-7600x');
  });

  it('handles Intel brand correctly', () => {
    expect(componentSlug('Intel', 'Core i5-13600K')).toBe('intel-core-i5-13600k');
  });
});

describe('generateUniqueSlug', () => {
  it('returns base slug when no collision', () => {
    const existing = new Set<string>(['other-slug']);
    expect(generateUniqueSlug('amd-ryzen-5-7600x', existing)).toBe('amd-ryzen-5-7600x');
  });

  it('appends -2 on first collision', () => {
    const existing = new Set<string>(['amd-ryzen-5-7600x']);
    expect(generateUniqueSlug('amd-ryzen-5-7600x', existing)).toBe('amd-ryzen-5-7600x-2');
  });

  it('increments suffix until unique', () => {
    const existing = new Set<string>([
      'amd-ryzen-5-7600x',
      'amd-ryzen-5-7600x-2',
      'amd-ryzen-5-7600x-3',
    ]);
    expect(generateUniqueSlug('amd-ryzen-5-7600x', existing)).toBe('amd-ryzen-5-7600x-4');
  });

  it('returns base slug for empty existing set', () => {
    expect(generateUniqueSlug('my-slug', new Set())).toBe('my-slug');
  });
});
