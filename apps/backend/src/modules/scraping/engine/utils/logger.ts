/**
 * Structured logger — writes scraper events to the `scraper_logs` table.
 *
 * Usage:
 *   import { logger } from './logger.js';
 *   await logger.info('Scraping session started');
 *   await logger.warn('HTML structure changed', 'site1.ma');
 *   await logger.error('Failed to fetch product page', 'site2.ma');
 *
 * Requirements: 9.1, 9.2
 */

import { sql as bunSql } from 'bun';

export type LogLevel = 'INFO' | 'WARNING' | 'ERROR';

// ── Dependency injection ──────────────────────────────────────────────────────
// Same pattern as componentService.ts — tests inject a mock via setSql().

type SqlFn = (strings: TemplateStringsArray, ...values: unknown[]) => Promise<unknown[]>;

let _sql: SqlFn = bunSql as unknown as SqlFn;

/** Replace the SQL executor — used in unit tests to inject a mock. */
export function setSql(mockSql: SqlFn): void {
  _sql = mockSql;
}

/** Reset the SQL executor back to the real Bun.sql — call in afterEach/afterAll. */
export function resetSql(): void {
  _sql = bunSql as unknown as SqlFn;
}

// ── Core log function ─────────────────────────────────────────────────────────

/**
 * Writes a single log entry to the `scraper_logs` table.
 * Failures are swallowed and printed to stderr — a logging failure must
 * never crash the scraper.
 */
async function log(level: LogLevel, message: string, site?: string): Promise<void> {
  const ts = new Date().toLocaleString('en-GB');
  const levelPad = level.padEnd(7);
  console.log(`[${ts}] ${levelPad} ${message}`);

  try {
    await _sql`
      INSERT INTO scraper_logs (level, site, message)
      VALUES (${level}, ${site ?? null}, ${message})
    `;
  } catch (err) {
    // Logging must never crash the scraper — print to stderr and continue.
    console.error(`[logger] Failed to write log entry (${level}): ${message}`, err);
  }
}

export const logger = {
  /** Normal operation — session started, session complete, etc. */
  info:  (message: string, site?: string) => log('INFO',    message, site),
  /** Something unusual but not critical — e.g. HTML structure changed. */
  warn:  (message: string, site?: string) => log('WARNING', message, site),
  /** A scraper failed for a specific site. */
  error: (message: string, site?: string) => log('ERROR',   message, site),
};
