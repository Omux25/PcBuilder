// @ts-nocheck — runs in Bun (WSL2); bun:test types not available on Windows
import { describe, test, expect } from 'bun:test';

// theme.ts uses window.matchMedia and document.documentElement — not available in Bun.
// We test the logic by importing the module and verifying it doesn't throw on import,
// and test the pure logic that doesn't depend on DOM APIs.

describe('theme module', () => {
  test('can be imported without throwing', async () => {
    // The module references window/document at call time, not at import time.
    // This verifies the module structure is valid.
    await expect(import('../theme')).resolves.toBeDefined();
  });

  test('exports the expected functions', async () => {
    const mod = await import('../theme');
    expect(typeof mod.getInitialTheme).toBe('function');
    expect(typeof mod.applyTheme).toBe('function');
    expect(typeof mod.toggleTheme).toBe('function');
  });
});
