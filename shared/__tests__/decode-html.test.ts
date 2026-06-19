import { describe, it, expect } from 'bun:test';
import { decodeHtml } from '../decode-html';

describe('decodeHtml', () => {
  it('should handle missing html correctly', () => {
    expect(decodeHtml('')).toBe('');
    expect(decodeHtml(null as any)).toBe('');
    expect(decodeHtml(undefined as any)).toBe('');
  });

  it('should correctly decode named entities', () => {
    expect(decodeHtml('Core&trade; i9')).toBe('Core™ i9');
    expect(decodeHtml('ROG Strix &amp; TUF')).toBe('ROG Strix & TUF');
    expect(decodeHtml('&lt;script&gt;')).toBe('<script>');
  });

  it('should ignore unknown named entities', () => {
    expect(decodeHtml('&unknown;')).toBe('&unknown;');
  });

  it('should correctly decode numeric decimal entities', () => {
    expect(decodeHtml('&#39;')).toBe("'");
    expect(decodeHtml('&#8211;')).toBe('–');
  });

  it('should correctly decode numeric hex entities', () => {
    expect(decodeHtml('&#x27;')).toBe("'");
    expect(decodeHtml('&#x2019;')).toBe('’');
  });

  it('should handle malformed entities gracefully', () => {
    // Tests for issues like &#9999999999; which may exceed String.fromCodePoint limits
    expect(decodeHtml('&#9999999999;')).toBe('&#9999999999;');
    expect(decodeHtml('&#x110000;')).toBe('&#x110000;');
    expect(decodeHtml('&#0;')).toBe('&#0;');
  });
});
