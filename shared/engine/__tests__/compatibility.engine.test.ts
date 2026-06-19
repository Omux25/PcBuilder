import { describe, expect, test } from 'bun:test';
import { checkSocketCompatibility } from '../compatibility.engine.js';

describe('checkSocketCompatibility', () => {
  test('returns true when source is undefined', () => {
    expect(checkSocketCompatibility(undefined, 'AM4')).toBe(true);
  });

  test('returns true when target is undefined', () => {
    expect(checkSocketCompatibility('AM4', undefined)).toBe(true);
  });

  test('returns true when both source and target are undefined', () => {
    expect(checkSocketCompatibility(undefined, undefined)).toBe(true);
  });

  test('returns true for exact string match', () => {
    expect(checkSocketCompatibility('AM4', 'AM4')).toBe(true);
  });

  test('returns true for case-insensitive match', () => {
    expect(checkSocketCompatibility('am4', 'AM4')).toBe(true);
    expect(checkSocketCompatibility('AM4', 'am4')).toBe(true);
  });

  test('returns true for strings with spaces and dashes', () => {
    expect(checkSocketCompatibility('LGA 1700', 'LGA-1700')).toBe(true);
    expect(checkSocketCompatibility('LGA-1700', 'LGA 1700')).toBe(true);
    expect(checkSocketCompatibility('LGA1700', 'LGA 1700')).toBe(true);
  });

  test('returns false when strings do not match', () => {
    expect(checkSocketCompatibility('AM4', 'AM5')).toBe(false);
  });

  test('returns true when target matches an element in source array', () => {
    expect(checkSocketCompatibility(['AM4', 'AM5'], 'AM5')).toBe(true);
    expect(checkSocketCompatibility(['LGA-1700', 'AM4'], 'LGA 1700')).toBe(true);
  });

  test('returns false when target does not match any element in source array', () => {
    expect(checkSocketCompatibility(['AM4', 'AM5'], 'LGA 1700')).toBe(false);
  });
});
