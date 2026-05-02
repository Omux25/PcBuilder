// @ts-nocheck — runs in Bun (WSL2); bun:test types not available on Windows
import { describe, test, expect } from 'bun:test';
import { UI } from '../ui-strings';

describe('UI string constants', () => {
  test('app strings are defined', () => {
    expect(UI.app.name).toBe('PC Builder');
    expect(UI.app.subtitle).toBe('Maroc');
    expect(typeof UI.app.tagline).toBe('string');
  });

  test('nav strings are all non-empty strings', () => {
    for (const [key, value] of Object.entries(UI.nav)) {
      expect(typeof value).toBe('string');
      expect(value.length).toBeGreaterThan(0);
    }
  });

  test('hero strings are defined', () => {
    expect(typeof UI.hero.title).toBe('string');
    expect(typeof UI.hero.titleAccent).toBe('string');
    expect(typeof UI.hero.subtitle).toBe('string');
  });

  test('build strings are defined', () => {
    expect(typeof UI.build.share).toBe('string');
    expect(typeof UI.build.export).toBe('string');
    expect(typeof UI.build.copied).toBe('string');
  });

  test('configurator.tdpInfo is a function returning a string', () => {
    const result = UI.configurator.tdpInfo(300, 450);
    expect(typeof result).toBe('string');
    expect(result).toContain('300');
    expect(result).toContain('450');
  });

  test('picker strings are all non-empty', () => {
    for (const [key, value] of Object.entries(UI.picker)) {
      expect(typeof value).toBe('string');
      expect(value.length).toBeGreaterThan(0);
    }
  });

  test('footer strings are defined', () => {
    expect(typeof UI.footer.tagline).toBe('string');
    expect(typeof UI.footer.search).toBe('string');
    expect(typeof UI.footer.compare).toBe('string');
    expect(typeof UI.footer.trends).toBe('string');
  });
});
