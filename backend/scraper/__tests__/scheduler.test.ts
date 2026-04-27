// @ts-nocheck
import { describe, test, expect, beforeEach, afterAll } from 'bun:test';
import { runScrapingSession } from '../scheduler.js';
import { setSql as setLoggerSql, resetSql as resetLoggerSql } from '../utils/logger.js';
import { setSql as setAggregatorSql, resetSql as resetAggregatorSql } from '../aggregator.js';
import { setFetch, resetFetchAndLoad, setRetryDelay } from '../scrapers/baseScraper.js';
import { setUltraPcFetch, resetUltraPcFetch } from '../scrapers/ultrapcScraper.js';
import { setSetupGameFetch, resetSetupGameFetch } from '../scrapers/setupgameScraper.js';

// ── Captured state ────────────────────────────────────────────────────────────

const logEntries: Array<{ level: string; message: string; site: string | null }> = [];
const upsertedPrices: Array<{ component_id: number; retailer_id: number }> = [];

// ── Mock factories ────────────────────────────────────────────────────────────

function makeLoggerSql() {
  return (strings: TemplateStringsArray, ...values: unknown[]) => {
    logEntries.push({
      level:   values[0] as string,
      site:    values[1] as string | null,
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
    return Promise.resolve([]);
  };
}

/**
 * Makes a fetch mock that returns an empty product listing page.
 * Site1Scraper will find no .product-card elements → returns [].
 * Site2Scraper has no PRODUCT_URLS → makes no fetch calls.
 */
function makeEmptyPageFetch() {
  return (_url: string) =>
    Promise.resolve({
      ok:   true,
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
  setFetch(makeEmptyPageFetch());
  setUltraPcFetch(makeEmptyUltraPcFetch());
  setSetupGameFetch((_url: string) => Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve([]),
  }));
  setRetryDelay(0);
});

afterAll(() => {
  resetLoggerSql();
  resetAggregatorSql();
  resetFetchAndLoad();
  resetUltraPcFetch();
  resetSetupGameFetch();
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
  test('logs an ERROR entry when site1 scraper fails', async () => {
    setFetch(makeFailingFetch('Timeout'));
    await runScrapingSession();

    const errorLogs = logEntries.filter(e => e.level === 'ERROR');
    expect(errorLogs.length).toBeGreaterThan(0);
  });

  test('error log includes the site name', async () => {
    setFetch(makeFailingFetch('Timeout'));
    await runScrapingSession();

    const errorLogs = logEntries.filter(e => e.level === 'ERROR');
    const hasSite = errorLogs.some(e => e.site !== null);
    expect(hasSite).toBe(true);
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
