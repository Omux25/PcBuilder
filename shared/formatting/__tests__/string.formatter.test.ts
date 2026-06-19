import { describe, expect, it } from 'bun:test';
import { getInitials } from '@shared/formatting/string.formatter';

describe('getInitials', () => {
  it('returns two initials for a two-word name', () => {
    expect(getInitials('John Doe')).toBe('JD');
  });

  it('returns two initials for a three-word name', () => {
    expect(getInitials('John Doe Smith')).toBe('JD');
  });

  it('returns first two letters for a single-word name', () => {
    expect(getInitials('Amazon')).toBe('AM');
  });

  it('handles leading and trailing spaces', () => {
    expect(getInitials('  John Doe  ')).toBe('JD');
    expect(getInitials('  Amazon  ')).toBe('AM');
  });

  it('handles multiple spaces between words', () => {
    expect(getInitials('John   Doe')).toBe('JD');
  });

  it('handles underscores and hyphens as word separators', () => {
    expect(getInitials('John_Doe')).toBe('JD');
    expect(getInitials('John-Doe')).toBe('JD');
    expect(getInitials('John -_ Doe')).toBe('JD');
  });

  it('returns empty string if name is empty', () => {
    expect(getInitials('')).toBe('');
  });

  it('returns one letter if name is one letter', () => {
    expect(getInitials('A')).toBe('A');
  });
});
