// @ts-nocheck
/**
 * Tests for the unmatched accordion routes:
 *   GET  /by-category
 *   POST /reject
 *   POST /bulk-associate
 *
 * Requirements: 9.1, 9.3, 9.4, 9.5, 9.6, 9.7, 5.4, 5.5
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { Hono } from 'hono';
import jwt from 'jsonwebtoken';
import { unmatchedAccordionRouter } from '../unmatchedAccordion.js';
import { setSql, resetSql } from '../../../db/index.js';

const JWT_SECRET = 'test-secret';

function makeApp() {
    process.env.JWT_SECRET = JWT_SECRET;
    const app = new Hono();
    app.route('/api/admin/unmatched-listings', unmatchedAccordionRouter);
    return app;
}

function makeToken() {
    return jwt.sign({ id: 1, username: 'admin' }, JWT_SECRET, { expiresIn: '1h' });
}

const AUTH = (token = makeToken()) => ({ Authorization: `Bearer ${token}` });
const JSON_HEADERS = (token = makeToken()) => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
});

// ── GET /by-category ──────────────────────────────────────────────────────────

describe('GET /api/admin/unmatched-listings/by-category', () => {
    let app: Hono;
    beforeEach(() => { app = makeApp(); });
    afterEach(() => { resetSql(); });

    test('returns 401 without token', async () => {
        const res = await app.request('/api/admin/unmatched-listings/by-category');
        expect(res.status).toBe(401);
    });

    test('returns categories array with correct shape', async () => {
        setSql(async () => [
            { category: 'cpu', group_count: 12, high_confidence_linkable_count: 8 },
            { category: 'gpu', group_count: 5, high_confidence_linkable_count: 2 },
            { category: null, group_count: 7, high_confidence_linkable_count: 0 },
        ]);

        const res = await app.request('/api/admin/unmatched-listings/by-category', {
            headers: AUTH(),
        });

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(Array.isArray(body.categories)).toBe(true);
        expect(body.categories.length).toBe(3);

        const cpu = body.categories.find((c) => c.category === 'cpu');
        expect(cpu).toBeDefined();
        expect(cpu.group_count).toBe(12);
        expect(cpu.high_confidence_linkable_count).toBe(8);

        const unknown = body.categories.find((c) => c.category === null);
        expect(unknown).toBeDefined();
        expect(unknown.group_count).toBe(7);
        expect(unknown.high_confidence_linkable_count).toBe(0);
    });

    test('returns empty categories array when no pending listings', async () => {
        setSql(async () => []);

        const res = await app.request('/api/admin/unmatched-listings/by-category', {
            headers: AUTH(),
        });

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.categories).toEqual([]);
    });
});

// ── POST /reject ──────────────────────────────────────────────────────────────

describe('POST /api/admin/unmatched-listings/reject', () => {
    let app: Hono;
    beforeEach(() => { app = makeApp(); });
    afterEach(() => { resetSql(); });

    test('returns 401 without token', async () => {
        const res = await app.request('/api/admin/unmatched-listings/reject', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ listing_ids: [1] }),
        });
        expect(res.status).toBe(401);
    });

    test('returns 400 when listing_ids is missing', async () => {
        const res = await app.request('/api/admin/unmatched-listings/reject', {
            method: 'POST',
            headers: JSON_HEADERS(),
            body: JSON.stringify({}),
        });
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    test('returns 400 when listing_ids is empty array', async () => {
        const res = await app.request('/api/admin/unmatched-listings/reject', {
            method: 'POST',
            headers: JSON_HEADERS(),
            body: JSON.stringify({ listing_ids: [] }),
        });
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    test('returns 400 when listing_ids is not an array', async () => {
        const res = await app.request('/api/admin/unmatched-listings/reject', {
            method: 'POST',
            headers: JSON_HEADERS(),
            body: JSON.stringify({ listing_ids: 'not-an-array' }),
        });
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    test('returns 400 when all IDs are invalid (non-integers)', async () => {
        const res = await app.request('/api/admin/unmatched-listings/reject', {
            method: 'POST',
            headers: JSON_HEADERS(),
            body: JSON.stringify({ listing_ids: ['abc', -1, 0] }),
        });
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    test('returns 200 with rejected count for valid IDs', async () => {
        // sql.unsafe() is used for IN clause — mock must expose .unsafe()
        // logActivity also calls getSql() as a template tag, so mock must be callable too
        let callCount = 0;
        const mockSql = Object.assign(
            async () => [], // template tag calls (logActivity)
            {
                unsafe: async () => {
                    callCount++;
                    if (callCount === 1) return [{ id: 1 }, { id: 2 }]; // UPDATE RETURNING
                    return []; // DELETE suggestions
                },
            },
        );
        setSql(mockSql);

        const res = await app.request('/api/admin/unmatched-listings/reject', {
            method: 'POST',
            headers: JSON_HEADERS(),
            body: JSON.stringify({ listing_ids: [1, 2, 3] }),
        });

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.rejected).toBe(2); // only 2 were pending
    });

    test('returns rejected=0 when no IDs were pending (all skipped)', async () => {
        setSql({
            unsafe: async () => [], // UPDATE returns nothing — all were non-pending
        });

        const res = await app.request('/api/admin/unmatched-listings/reject', {
            method: 'POST',
            headers: JSON_HEADERS(),
            body: JSON.stringify({ listing_ids: [99, 100] }),
        });

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.rejected).toBe(0);
    });
});

// ── POST /bulk-associate ──────────────────────────────────────────────────────

describe('POST /api/admin/unmatched-listings/bulk-associate', () => {
    let app: Hono;
    beforeEach(() => { app = makeApp(); });
    afterEach(() => { resetSql(); });

    test('returns 401 without token', async () => {
        const res = await app.request('/api/admin/unmatched-listings/bulk-associate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ canonical_names: ['Intel Core i5'] }),
        });
        expect(res.status).toBe(401);
    });

    test('returns 400 when canonical_names is missing', async () => {
        const res = await app.request('/api/admin/unmatched-listings/bulk-associate', {
            method: 'POST',
            headers: JSON_HEADERS(),
            body: JSON.stringify({}),
        });
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    test('returns 400 when canonical_names is empty array', async () => {
        const res = await app.request('/api/admin/unmatched-listings/bulk-associate', {
            method: 'POST',
            headers: JSON_HEADERS(),
            body: JSON.stringify({ canonical_names: [] }),
        });
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    test('returns 400 when canonical_names is not an array', async () => {
        const res = await app.request('/api/admin/unmatched-listings/bulk-associate', {
            method: 'POST',
            headers: JSON_HEADERS(),
            body: JSON.stringify({ canonical_names: 'not-an-array' }),
        });
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    test('returns failed entry when no high-confidence match found', async () => {
        setSql(async () => []); // no listings found for this canonical name

        const res = await app.request('/api/admin/unmatched-listings/bulk-associate', {
            method: 'POST',
            headers: JSON_HEADERS(),
            body: JSON.stringify({ canonical_names: ['Unknown Product XYZ'] }),
        });

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(Array.isArray(body.successful)).toBe(true);
        expect(Array.isArray(body.failed)).toBe(true);
        expect(body.successful.length).toBe(0);
        expect(body.failed.length).toBe(1);
        expect(body.failed[0].canonical_name).toBe('Unknown Product XYZ');
        expect(body.failed[0].error).toBe('No high-confidence match found');
    });

    test('returns correct shape with successful and failed arrays', async () => {
        // Mock: first name has no match (failed), second name also no match
        setSql(async () => []);

        const res = await app.request('/api/admin/unmatched-listings/bulk-associate', {
            method: 'POST',
            headers: JSON_HEADERS(),
            body: JSON.stringify({ canonical_names: ['Product A', 'Product B'] }),
        });

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body).toHaveProperty('successful');
        expect(body).toHaveProperty('failed');
        expect(Array.isArray(body.successful)).toBe(true);
        expect(Array.isArray(body.failed)).toBe(true);
        // Both failed since mock returns no listings
        expect(body.failed.length).toBe(2);
        expect(body.successful.length).toBe(0);
    });

    test('failed entries have canonical_name and error fields', async () => {
        setSql(async () => []);

        const res = await app.request('/api/admin/unmatched-listings/bulk-associate', {
            method: 'POST',
            headers: JSON_HEADERS(),
            body: JSON.stringify({ canonical_names: ['Test Product'] }),
        });

        const body = await res.json();
        expect(body.failed[0]).toHaveProperty('canonical_name');
        expect(body.failed[0]).toHaveProperty('error');
        expect(typeof body.failed[0].canonical_name).toBe('string');
        expect(typeof body.failed[0].error).toBe('string');
    });

    test('filters out empty string canonical names', async () => {
        const res = await app.request('/api/admin/unmatched-listings/bulk-associate', {
            method: 'POST',
            headers: JSON_HEADERS(),
            body: JSON.stringify({ canonical_names: ['', '   ', ''] }),
        });

        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error.code).toBe('VALIDATION_ERROR');
    });
});
