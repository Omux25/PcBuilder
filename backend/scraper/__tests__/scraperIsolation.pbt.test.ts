/**
 * Property-Based Tests — Scraper error isolation (Task 10.6)
 *
 * Property: when one scraper fails, the session still completes and
 * logs a session-complete entry — for any error message.
 *
 * Requirements: 6.4, 9.2
 */

// @ts-nocheck
import { describe, test, beforeEach, afterAll } from 'bun:test';
import * as fc from 'fast-check';
import { runScrapingSession } from '../scheduler.js';
import { setSql as setLoggerSql, resetSql as resetLoggerSql } from '../utils/logger.js';
import { setSql as setAggregatorSql, resetSql as resetAggregatorSql } from '../aggregator.js';
import { setSql as setAutoMapperSql, resetSql as resetAutoMapperSql } from '../autoMapper.js';
import { setSql as setCatalogBuilderSql, resetSql as resetCatalogBuilderSql } from '../catalogBuilder.js';
import { setFetch, resetFetchAndLoad, setRetryDelay, setSilent } from '../scrapers/baseScraper.js';
import { setUltraPcFetch, resetUltraPcFetch } from '../scrapers/ultrapcScraper.js';
import { setSetupGameFetch, resetSetupGameFetch } from '../scrapers/setupgameScraper.js';

const logEntries: Array<{ level: string; message: string }> = [];

function makeLoggerSql() {
  return (_strings: TemplateStringsArray, ...values: unknown[]) => {
    logEntries.push({ level: values[0] as string, message: values[2] as string });
    return Promise.resolve([]);
  };
}

function makeAggregatorSql() {
  return (strings: TemplateStringsArray, ..._values: unknown[]) => {
    const query = strings.join('?');
    // scraper_mappings lookup → return empty (unmatched path, no DB writes needed)
    if (query.includes('scraper_mappings')) {
      return Promise.resolve([]);
    }
    // unmatched_listings insert → success
    if (query.includes('unmatched_listings')) {
      return Promise.resolve([]);
    }
    // Any other query → empty result
    return Promise.resolve([]);
  };
}

beforeEach(() => {
  logEntries.length = 0;
  setLoggerSql(makeLoggerSql());
  setAggregatorSql(makeAggregatorSql());
  setAutoMapperSql((_strings: TemplateStringsArray, ..._values: unknown[]) => Promise.resolve([]));
  setCatalogBuilderSql((_strings: TemplateStringsArray, ..._values: unknown[]) => Promise.resolve([]));
  setRetryDelay(0);
  setSilent(true);
  setUltraPcFetch((_url: string) => Promise.resolve({
    ok: true,
    status: 200,
    text: () => Promise.resolve('{"products":[],"pagination":{"total_items":0,"pages_count":1,"current_page":1}}'),
  }));
  setSetupGameFetch((_url: string) => Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve([]),
  }));
});

afterAll(() => {
  resetLoggerSql();
  resetAggregatorSql();
  resetAutoMapperSql();
  resetCatalogBuilderSql();
  resetFetchAndLoad();
  resetUltraPcFetch();
  resetSetupGameFetch();
});

describe('PBT 10.6 — scraper error isolation', () => {
  test('session always completes even when fetch throws any error message', async () => {
    await fc.assert(fc.asyncProperty(
      fc.string({ minLength: 1, maxLength: 200 }),
      async (errorMessage) => {
        logEntries.length = 0;
        setFetch((_url: string) => Promise.reject(new Error(errorMessage)));

        await runScrapingSession();

        // Session must always log a "complete" entry
        const hasComplete = logEntries.some(
          e => e.level === 'INFO' && e.message.includes('complete'),
        );
        return hasComplete;
      },
    ));
  });

  test('session always logs at least one INFO entry when fetch fails', async () => {
    await fc.assert(fc.asyncProperty(
      fc.string({ minLength: 1, maxLength: 200 }),
      async (errorMessage) => {
        logEntries.length = 0;
        setFetch((_url: string) => Promise.reject(new Error(errorMessage)));

        await runScrapingSession();

        // Scrapers handle fetch errors internally — session still logs INFO entries
        // (started + complete). No ERROR is expected since scrapers return [] on failure.
        const hasInfo = logEntries.some(e => e.level === 'INFO');
        return hasInfo;
      },
    ));
  });

  test('session never throws regardless of fetch error', async () => {
    await fc.assert(fc.asyncProperty(
      fc.string({ minLength: 1, maxLength: 200 }),
      async (errorMessage) => {
        logEntries.length = 0;
        setFetch((_url: string) => Promise.reject(new Error(errorMessage)));

        let threw = false;
        try {
          await runScrapingSession();
        } catch {
          threw = true;
        }
        return !threw;
      },
    ));
  });

  test('session always logs started before complete', async () => {
    await fc.assert(fc.asyncProperty(
      fc.string({ minLength: 1, maxLength: 200 }),
      async (errorMessage) => {
        logEntries.length = 0;
        setFetch((_url: string) => Promise.reject(new Error(errorMessage)));

        await runScrapingSession();

        const startedIdx  = logEntries.findIndex(e => e.message.includes('started'));
        const completeIdx = logEntries.findIndex(e => e.message.includes('complete'));

        return startedIdx !== -1 && completeIdx !== -1 && startedIdx < completeIdx;
      },
    ));
  });
});
