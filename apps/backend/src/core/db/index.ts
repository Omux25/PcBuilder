/**
 * Centralized database module.
 *
 * All services import `getSql()` from here instead of `import { sql } from 'bun'` directly.
 * This gives us:
 *   - A single place to configure the connection
 *   - Centralized dependency injection for tests (setSql / resetSql)
 *   - A clear import path: `from '../core/db/index.js'`
 */

import { SQL } from 'bun';

export type SqlFn = {
  (strings: TemplateStringsArray, ...values: unknown[]): Promise<unknown[]>;
  (value: unknown): any; // Support for sql(array) or sql(object)
  begin<T>(cb: (tx: SqlFn) => Promise<T>): Promise<T>;
  unsafe(query: string, params?: unknown[]): Promise<unknown[]>;
};

// Configure SQL connection pool with optimization parameters
const dbUrl = process.env.DATABASE_URL;
const config: any = {
  max: 10,                 // Keep up to 10 connections warm in the pool
  idleTimeout: 30,         // Keep idle connections open for 30 seconds
  connectionTimeout: 5,    // Fail fast if database is unreachable
};

if (dbUrl) {
  config.url = dbUrl;
} else {
  config.host = process.env.PGHOST;
  config.port = Number(process.env.PGPORT) || 5432;
  config.database = process.env.PGDATABASE;
  config.username = process.env.PGUSER;
  config.password = process.env.PGPASSWORD;
}

let _sql: SqlFn = new SQL(config) as unknown as SqlFn;

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
  _sql = new SQL(config) as unknown as SqlFn;
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
