import { describe, expect, test } from 'bun:test';
import { slugify } from '../slugify';

describe('slugify', () => {
  test('converts a simple string to lowercase with hyphens', () => {
    expect(slugify('Hello World')).toBe('hello-world');
  });

  test('trims leading and trailing spaces', () => {
    expect(slugify('  Hello World  ')).toBe('hello-world');
  });

  test('replaces multiple spaces and underscores with a single hyphen', () => {
    expect(slugify('Hello   World___Test')).toBe('hello-world-test');
  });

  test('strips special characters that are not alphanumeric or hyphens', () => {
    expect(slugify('Hello @World! #Test$')).toBe('hello-world-test');
  });

  test('collapses multiple consecutive hyphens into a single hyphen', () => {
    expect(slugify('Hello---World--Test')).toBe('hello-world-test');
  });

  test('removes leading and trailing hyphens after processing', () => {
    expect(slugify('-Hello World-')).toBe('hello-world');
    expect(slugify('_Hello World_')).toBe('hello-world');
    expect(slugify('@Hello World!')).toBe('hello-world');
  });

  test('handles an already slugified string', () => {
    expect(slugify('hello-world-test')).toBe('hello-world-test');
  });

  test('handles an empty string', () => {
    expect(slugify('')).toBe('');
  });

  test('handles a string with only special characters', () => {
    expect(slugify('!@#$%^&*()_+')).toBe('');
  });
});
