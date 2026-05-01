// @ts-nocheck
import { describe, test, expect, beforeEach, afterAll } from 'bun:test';
import { logger, setSql, resetSql } from '../logger.js';

// ── Mock SQL factory ──────────────────────────────────────────────────────────

const insertedRows: Array<{ level: string; site: string | null; message: string }> = [];

/**
 * Creates a mock sql tagged-template that captures INSERT values.
 * The INSERT template is:
 *   INSERT INTO scraper_logs (level, site, message) VALUES ($1, $2, $3)
 * so values[0]=level, values[1]=site, values[2]=message.
 */
function makeMockSql() {
  return (strings: TemplateStringsArray, ...values: unknown[]) => {
    insertedRows.push({
      level:   values[0] as string,
      site:    values[1] as string | null,
      message: values[2] as string,
    });
    return Promise.resolve([]);
  };
}

function makeThrowingSql() {
  return (_strings: TemplateStringsArray, ..._values: unknown[]) =>
    Promise.reject(new Error('DB connection failed'));
}

beforeEach(() => {
  insertedRows.length = 0;
  setSql(makeMockSql());
});

afterAll(() => {
  resetSql();
});

// ── logger.info ───────────────────────────────────────────────────────────────

describe('logger.info', () => {
  test('inserts a row with level INFO', async () => {
    await logger.info('Scraping session started');
    expect(insertedRows).toHaveLength(1);
    expect(insertedRows[0].level).toBe('INFO');
    expect(insertedRows[0].message).toBe('Scraping session started');
  });

  test('sets site to null when not provided', async () => {
    await logger.info('Session complete');
    expect(insertedRows[0].site).toBeNull();
  });

  test('sets site when provided', async () => {
    await logger.info('Fetched 12 products', 'site1.ma');
    expect(insertedRows[0].site).toBe('site1.ma');
  });
});

// ── logger.warn ───────────────────────────────────────────────────────────────

describe('logger.warn', () => {
  test('inserts a row with level WARNING', async () => {
    await logger.warn('HTML structure changed', 'site2.ma');
    expect(insertedRows).toHaveLength(1);
    expect(insertedRows[0].level).toBe('WARNING');
    expect(insertedRows[0].message).toBe('HTML structure changed');
    expect(insertedRows[0].site).toBe('site2.ma');
  });

  test('sets site to null when not provided', async () => {
    await logger.warn('Unusual response code');
    expect(insertedRows[0].site).toBeNull();
  });
});

// ── logger.error ──────────────────────────────────────────────────────────────

describe('logger.error', () => {
  test('inserts a row with level ERROR', async () => {
    await logger.error('Failed to fetch product page', 'site1.ma');
    expect(insertedRows).toHaveLength(1);
    expect(insertedRows[0].level).toBe('ERROR');
    expect(insertedRows[0].message).toBe('Failed to fetch product page');
    expect(insertedRows[0].site).toBe('site1.ma');
  });

  test('sets site to null when not provided', async () => {
    await logger.error('Unknown error');
    expect(insertedRows[0].site).toBeNull();
  });
});

// ── Resilience ────────────────────────────────────────────────────────────────

describe('logger resilience', () => {
  test('does not throw when the DB insert fails', async () => {
    setSql(makeThrowingSql());
    // Must resolve without throwing — logging failures must never crash the scraper
    await expect(logger.error('DB is down', 'site1.ma')).resolves.toBeUndefined();
  });

  test('does not insert a row when the DB insert fails', async () => {
    setSql(makeThrowingSql());
    await logger.info('This will fail silently');
    expect(insertedRows).toHaveLength(0);
  });
});
