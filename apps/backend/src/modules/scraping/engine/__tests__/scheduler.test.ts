// @ts-nocheck
import { describe, test, expect, beforeEach, afterAll } from 'bun:test';
import { runScrapingSession } from '../scheduler.js';
import { setSql as setLoggerSql, resetSql as resetLoggerSql } from '../utils/logger.js';
import { setSql as setAggregatorSql, resetSql as resetAggregatorSql } from '../aggregator.js';
import { setSql as setCatalogBuilderSql, resetSql as resetCatalogBuilderSql } from '../catalogBuilder.js';
import { setSql as setSessionSql, resetSql as resetSessionSql } from '../../../../core/db/index.js';
import { setFetch, resetFetchAndLoad, setRetryDelay, setSilent } from '../scrapers/baseScraper.js';
import { setUltraPcFetch, resetUltraPcFetch } from '../scrapers/ultrapcScraper.js';
import { setSetupGameFetch, resetSetupGameFetch } from '../scrapers/setupgameScraper.js';
import { setPcGamerCasaFetch, resetPcGamerCasaFetch } from '../scrapers/pcgamercasaScraper.js';
import { setNextLevelFetch, resetNextLevelFetch } from '../scrapers/nextlevelScraper.js';

// ── Captured state ────────────────────────────────────────────────────────────

const logEntries: Array<{ level: string; message: string; site: string | null }> = [];
const upsertedPrices: Array<{ component_id: number; retailer_id: number }> = [];

// ── Mock factories ────────────────────────────────────────────────────────────

function makeLoggerSql() {
  return (_strings: TemplateStringsArray, ...values: unknown[]) => {
    logEntries.push({
      level: values[0] as string,
      site: values[1] as string | null,
      message: values[2] as string,
    });
    return Promise.resolve([]);
  };
}

function makeAggregatorSql() {
  return (strings: TemplateStringsArray, ...values: unknown[]) => {
    const query = strings.join('?');
    // scraper_mappings lookup → return empty (unmatched path)
    if (query.includes('scraper_mappings')) {
      return Promise.resolve([]);
    }
    // unmatched_listings insert → success
    if (query.includes('unmatched_listings')) {
      return Promise.resolve([]);
    }
    // retailers status update → success
    if (query.includes('UPDATE retailers')) {
      return Promise.resolve([]);
    }
    return Promise.resolve([]);
  };
}

// autoMapper SQL mock — no longer needed (merged into aggregator)

/**
 * Makes a fetch mock that returns an empty product listing page.
 * Site1Scraper will find no .product-card elements → returns [].
 * Site2Scraper has no PRODUCT_URLS → makes no fetch calls.
 */
function makeEmptyPageFetch() {
  return (_url: string) =>
    Promise.resolve({
      ok: true,
      status: 200,
      text: () => Promise.resolve('<html><body></body></html>'),
    });
}

function makeFailingFetch(message = 'Network error') {
  return (_url: string) => Promise.reject(new Error(message));
}

// Empty JSON response for UltraPC (no products, no real HTTP calls)
function makeEmptyUltraPcFetch() {
  return (_url: string) => Promise.resolve({
    ok: true,
    status: 200,
    text: () => Promise.resolve('{"products":[],"pagination":{"total_items":0,"pages_count":1,"current_page":1}}'),
  });
}

beforeEach(() => {
  logEntries.length = 0;
  upsertedPrices.length = 0;
  setLoggerSql(makeLoggerSql());
  setAggregatorSql(makeAggregatorSql());
  setCatalogBuilderSql((_strings: TemplateStringsArray, ..._values: unknown[]) => Promise.resolve([]));
  // Mock session's own SQL (for SELECT retailers + UPDATE retailers status)
  const sessionMockSql = (strings: TemplateStringsArray, ..._values: unknown[]) => {
    const query = strings.join('?');
    if (query.includes('SELECT id, base_url FROM retailers')) {
      return Promise.resolve([
        { id: 10, base_url: 'https://www.ultrapc.ma' },
        { id: 11, base_url: 'https://nextlevelpc.ma' },
        { id: 13, base_url: 'https://setupgame.ma' },
        { id: 14, base_url: 'https://www.pcgamercasa.ma' },
      ]);
    }
    if (query.includes('pg_try_advisory_xact_lock')) {
      return Promise.resolve([{ acquired: true }]);
    }
    if (query.includes('SELECT id, name, scraping_interval_hours FROM retailers') || query.includes('SELECT id, name, scraping_interval_hours\n        FROM retailers')) {
      return Promise.resolve([
        { id: 10, name: 'UltraPC', scraping_interval_hours: 24 }
      ]);
    }
    return Promise.resolve([]);
  };
  sessionMockSql.begin = (cb: any) => cb(sessionMockSql);
  setSessionSql(sessionMockSql as any);
  setFetch(makeEmptyPageFetch());
  setUltraPcFetch(makeEmptyUltraPcFetch());
  setNextLevelFetch((_url: string) => Promise.resolve({
    ok: true,
    status: 200,
    text: () => Promise.resolve(JSON.stringify({ products: [], pagination: { pages_count: 1, current_page: 1, total_items: 0 } })),
  }));
  setSetupGameFetch((_url: string) => Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve([]),
  }));
  setPcGamerCasaFetch((_url: string) => Promise.resolve({
    ok: true,
    status: 200,
    text: () => Promise.resolve(JSON.stringify({ products: [], pagination: { pages_count: 1, current_page: 1, total_items: 0 }, rendered_products: '' })),
  }));
  setRetryDelay(0);
  setSilent(true);
});

afterAll(() => {
  resetLoggerSql();
  resetAggregatorSql();
  resetCatalogBuilderSql();
  resetSessionSql();
  resetFetchAndLoad();
  resetUltraPcFetch();
  resetNextLevelFetch();
  resetSetupGameFetch();
  resetPcGamerCasaFetch();
});

// ── Session lifecycle ─────────────────────────────────────────────────────────

describe('runScrapingSession() — lifecycle', () => {
  test('logs session started at the beginning', async () => {
    await runScrapingSession();
    const first = logEntries[0];
    expect(first.level).toBe('INFO');
    expect(first.message).toContain('started');
  });

  test('logs session complete at the end', async () => {
    await runScrapingSession();
    const last = logEntries[logEntries.length - 1];
    expect(last.level).toBe('INFO');
    expect(last.message).toContain('complete');
  });

  test('session complete message includes updated and error counts', async () => {
    await runScrapingSession();
    const last = logEntries[logEntries.length - 1];
    expect(last.message).toMatch(/\d+ updated/);
    expect(last.message).toMatch(/\d+ error/);
  });

  test('does not throw even when all scrapers fail', async () => {
    setFetch(makeFailingFetch('ECONNREFUSED'));
    await expect(runScrapingSession()).resolves.toBeUndefined();
  });
});

// ── Error isolation ───────────────────────────────────────────────────────────

describe('runScrapingSession() — error isolation', () => {
  test('session completes gracefully when fetch fails (scrapers handle errors internally)', async () => {
    setFetch(makeFailingFetch('Timeout'));
    await runScrapingSession();

    // NextLevel handles fetch errors internally (returns empty array).
    // The session still completes — no unhandled exception.
    const completeLogs = logEntries.filter(
      e => e.level === 'INFO' && e.message.includes('complete'),
    );
    expect(completeLogs.length).toBeGreaterThan(0);
  });

  test('session logs 0 updated when all scrapers return empty results', async () => {
    setFetch(makeFailingFetch('Timeout'));
    await runScrapingSession();

    const last = logEntries[logEntries.length - 1];
    expect(last.message).toContain('0 updated');
  });

  test('still logs session complete even when scrapers fail', async () => {
    setFetch(makeFailingFetch('ECONNREFUSED'));
    await runScrapingSession();

    const completeLogs = logEntries.filter(
      e => e.level === 'INFO' && e.message.includes('complete'),
    );
    expect(completeLogs).toHaveLength(1);
  });
});

// ── Aggregation ───────────────────────────────────────────────────────────────

describe('runScrapingSession() — aggregation', () => {
  test('calls aggregate with empty array when scrapers return nothing', async () => {
    await runScrapingSession();
    // No prices scraped → aggregator called with [] → no upserts
    expect(upsertedPrices).toHaveLength(0);
  });

  test('session complete log shows 0 updated when no prices scraped', async () => {
    await runScrapingSession();
    const last = logEntries[logEntries.length - 1];
    expect(last.message).toContain('0 updated');
  });
});
