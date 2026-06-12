/**
 * Centralized database module.
 *
 * All services import `getSql()` from here instead of `import { sql } from 'bun'` directly.
 * This gives us:
 *   - A single place to configure the connection
 *   - Centralized dependency injection for tests (setSql / resetSql)
 *   - A clear import path: `from '../core/db/index.js'`
 */

import { sql as bunSql } from 'bun';

export type SqlFn = {
  (strings: TemplateStringsArray, ...values: unknown[]): Promise<unknown[]>;
  (value: unknown): any; // Support for sql(array) or sql(object)
  begin<T>(cb: (tx: SqlFn) => Promise<T>): Promise<T>;
  unsafe(query: string, params?: unknown[]): Promise<unknown[]>;
};

let _sql: SqlFn = bunSql as unknown as SqlFn;

/** Returns the current SQL tagged template function. */
export function getSql(): SqlFn {
  return _sql;
}

/** Replaces the SQL function with a mock (for testing). */
export function setSql(mockSql: SqlFn): void {
  _sql = mockSql;
}

/** Resets the SQL function back to the real Bun.sql. */
export function resetSql(): void {
  _sql = bunSql as unknown as SqlFn;
}

if (typeof process !== 'undefined') {
  const isPostgresCloseError = (err: any) => {
    return err && (
      err.code === 'ERR_POSTGRES_CONNECTION_CLOSED' || 
      (typeof err.message === 'string' && err.message.includes('Connection closed'))
    );
  };

  process.on('unhandledRejection', (reason: any) => {
    if (isPostgresCloseError(reason)) {
      return;
    }
  });

  process.on('uncaughtException', (err: any) => {
    if (isPostgresCloseError(err)) {
      return;
    }
    console.error('Uncaught Exception:', err);
    process.exit(1);
  });
}
