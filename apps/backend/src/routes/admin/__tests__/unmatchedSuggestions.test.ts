// @ts-nocheck
/**
 * Tests for the unmatched suggestions routes:
 *   GET  /grouped
 *   POST /reprocess
 *   POST /bulk-dismiss
 *   POST /bulk-approve
 *   POST /create-and-link
 *
 * Requirements: 7, 8, 9, 10, 13, 14, 15.9
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { Hono } from 'hono';
import jwt from 'jsonwebtoken';
import { unmatchedSuggestionsRouter } from '../unmatchedSuggestions.js';
import { setSql, resetSql } from '../../../db/index.js';

const JWT_SECRET = 'test-secret';

function makeApp() {
    process.env.JWT_SECRET = JWT_SECRET;
    const app = new Hono();
    app.route('/api/admin/unmatched-listings', unmatchedSuggestionsRouter);
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

// ── Mock data ─────────────────────────────────────────────────────────────────

const MOCK_ROW = {
    id: 1,
    retailer_id: 10,
    retailer_name: 'UltraPC',
    scraped_name: 'DeepCool AK400 Noir',
    scraped_price: '599.00',
    product_url: 'https://ultrapc.ma/product/ak400',
    scraped_at: '2026-05-01T10:00:00Z',
    canonical_name: 'AK400',
    brand: 'DeepCool',
    category: 'cooling',
    confidence: 'high',
    existing_component_id: 42,
    specs_hint: { tdp: 220 },
    existing_component_name: 'DeepCool AK400',
    existing_component_brand: 'DeepCool',
};

// ── GET /grouped ──────────────────────────────────────────────────────────────

describe('GET /api/admin/unmatched-listings/grouped', () => {
    let app: Hono;
    beforeEach(() => { app = makeApp(); });
    afterEach(() => { resetSql(); });

    test('returns 401 without token', async () => {
        const res = await app.request('/api/admin/unmatched-listings/grouped');
        expect(res.status).toBe(401);
    });

    test('returns grouped listings with suggestion data', async () => {
        setSql(async () => [MOCK_ROW]);

        const res = await app.request('/api/admin/unmatched-listings/grouped', {
            headers: AUTH(),
        });

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(Array.isArray(body.groups)).toBe(true);
        expect(body.groups.length).toBe(1);
        expect(body.groups[0].canonical_name).toBe('AK400');
        expect(body.groups[0].confidence).toBe('high');
        expect(body.groups[0].existing_component_id).toBe(42);
        expect(body.groups[0].listing_count).toBe(1);
    });

    test('falls back to raw scraped_name with confidence "unknown" when no suggestion', async () => {
        setSql(async () => [{
            ...MOCK_ROW,
            canonical_name: 'DeepCool AK400 Noir', // COALESCE fallback
            confidence: 'unknown',
            existing_component_id: null,
            specs_hint: null,
        }]);

        const res = await app.request('/api/admin/unmatched-listings/grouped', {
            headers: AUTH(),
        });

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.groups[0].confidence).toBe('unknown');
        expect(body.groups[0].existing_component_id).toBeNull();
    });

    test('returns empty groups when no pending listings', async () => {
        setSql(async () => []);

        const res = await app.request('/api/admin/unmatched-listings/grouped', {
            headers: AUTH(),
        });

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.groups).toHaveLength(0);
        expect(body.total_groups).toBe(0);
        expect(body.total_listings).toBe(0);
    });

    test('groups multiple listings with same canonical_name', async () => {
        setSql(async () => [
            { ...MOCK_ROW, id: 1, retailer_id: 10, retailer_name: 'UltraPC' },
            { ...MOCK_ROW, id: 2, retailer_id: 11, retailer_name: 'NextLevel PC' },
        ]);

        const res = await app.request('/api/admin/unmatched-listings/grouped', {
            headers: AUTH(),
        });

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.groups.length).toBe(1);
        expect(body.groups[0].listing_count).toBe(2);
        expect(body.groups[0].retailer_count).toBe(2);
    });
});

// ── POST /reprocess ───────────────────────────────────────────────────────────

describe('POST /api/admin/unmatched-listings/reprocess', () => {
    let app: Hono;
    beforeEach(() => { app = makeApp(); });
    afterEach(() => { resetSql(); });

    test('returns 401 without token', async () => {
        const res = await app.request('/api/admin/unmatched-listings/reprocess', { method: 'POST' });
        expect(res.status).toBe(401);
    });

    test('returns processed and skipped counts', async () => {
        // Now returns 202 immediately (fire-and-forget) to avoid socket timeout on large datasets
        setSql(async () => []);

        const res = await app.request('/api/admin/unmatched-listings/reprocess', {
            method: 'POST',
            headers: AUTH(),
        });

        expect(res.status).toBe(202);
        const body = await res.json();
        expect(body.message).toBeDefined();
    });
});

// ── POST /bulk-dismiss ────────────────────────────────────────────────────────

describe('POST /api/admin/unmatched-listings/bulk-dismiss', () => {
    let app: Hono;
    beforeEach(() => { app = makeApp(); });
    afterEach(() => { resetSql(); });

    test('returns 401 without token', async () => {
        const res = await app.request('/api/admin/unmatched-listings/bulk-dismiss', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ listing_ids: [1, 2] }),
        });
        expect(res.status).toBe(401);
    });

    test('returns 400 when listing_ids is missing', async () => {
        const res = await app.request('/api/admin/unmatched-listings/bulk-dismiss', {
            method: 'POST',
            headers: JSON_HEADERS(),
            body: JSON.stringify({}),
        });
        expect(res.status).toBe(400);
    });

    test('returns 400 when listing_ids is empty', async () => {
        const res = await app.request('/api/admin/unmatched-listings/bulk-dismiss', {
            method: 'POST',
            headers: JSON_HEADERS(),
            body: JSON.stringify({ listing_ids: [] }),
        });
        expect(res.status).toBe(400);
    });

    test('dismisses pending listings and returns counts', async () => {
        let call = 0;
        setSql({
            unsafe: async () => {
                call++;
                if (call === 1) return [{ id: 1 }, { id: 2 }]; // UPDATE returns dismissed rows
                return []; // DELETE suggestions
            },
        });

        const res = await app.request('/api/admin/unmatched-listings/bulk-dismiss', {
            method: 'POST',
            headers: JSON_HEADERS(),
            body: JSON.stringify({ listing_ids: [1, 2, 3] }),
        });

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.dismissed).toBe(2);
        expect(body.skipped).toBe(1); // 3 requested - 2 dismissed
    });

    test('skips non-integer IDs', async () => {
        const res = await app.request('/api/admin/unmatched-listings/bulk-dismiss', {
            method: 'POST',
            headers: JSON_HEADERS(),
            body: JSON.stringify({ listing_ids: ['abc', -1, 0] }),
        });
        expect(res.status).toBe(400);
    });
});

// ── POST /bulk-approve ────────────────────────────────────────────────────────

describe('POST /api/admin/unmatched-listings/bulk-approve', () => {
    let app: Hono;
    beforeEach(() => { app = makeApp(); });
    afterEach(() => { resetSql(); });

    test('returns 401 without token', async () => {
        const res = await app.request('/api/admin/unmatched-listings/bulk-approve', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ canonical_names: ['AK400'] }),
        });
        expect(res.status).toBe(401);
    });

    test('returns 400 when canonical_names is missing', async () => {
        const res = await app.request('/api/admin/unmatched-listings/bulk-approve', {
            method: 'POST',
            headers: JSON_HEADERS(),
            body: JSON.stringify({}),
        });
        expect(res.status).toBe(400);
    });

    test('returns skipped_groups when no high-confidence groups found', async () => {
        setSql(async () => []); // no matching groups

        const res = await app.request('/api/admin/unmatched-listings/bulk-approve', {
            method: 'POST',
            headers: JSON_HEADERS(),
            body: JSON.stringify({ canonical_names: ['AK400', 'Kraken 360'] }),
        });

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.approved_groups).toBe(0);
        expect(body.linked_listings).toBe(0);
        expect(body.skipped_groups).toBe(2);
    });

    test('returns 200 with summary shape when no groups match (safe mock)', async () => {
        // Use empty mock — no high-confidence groups found → skipped_groups = 1
        setSql(async () => []);

        const res = await app.request('/api/admin/unmatched-listings/bulk-approve', {
            method: 'POST',
            headers: JSON_HEADERS(),
            body: JSON.stringify({ canonical_names: ['AK400'] }),
        });

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(typeof body.approved_groups).toBe('number');
        expect(typeof body.linked_listings).toBe('number');
        expect(typeof body.skipped_groups).toBe('number');
        expect(body.skipped_groups).toBe(1);
    });
});

// ── POST /create-and-link ─────────────────────────────────────────────────────

describe('POST /api/admin/unmatched-listings/create-and-link', () => {
    let app: Hono;
    beforeEach(() => { app = makeApp(); });
    afterEach(() => { resetSql(); });

    test('returns 401 without token', async () => {
        const res = await app.request('/api/admin/unmatched-listings/create-and-link', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'AK400', brand: 'DeepCool', category: 'cooling', listing_ids: [1] }),
        });
        expect(res.status).toBe(401);
    });

    test('returns 400 when name is missing', async () => {
        const res = await app.request('/api/admin/unmatched-listings/create-and-link', {
            method: 'POST',
            headers: JSON_HEADERS(),
            body: JSON.stringify({ brand: 'DeepCool', category: 'cooling', listing_ids: [1] }),
        });
        expect(res.status).toBe(400);
    });

    test('returns 400 when category is missing', async () => {
        const res = await app.request('/api/admin/unmatched-listings/create-and-link', {
            method: 'POST',
            headers: JSON_HEADERS(),
            body: JSON.stringify({ name: 'AK400', brand: 'DeepCool', listing_ids: [1] }),
        });
        expect(res.status).toBe(400);
    });

    test('returns 400 when listing_ids is empty', async () => {
        const res = await app.request('/api/admin/unmatched-listings/create-and-link', {
            method: 'POST',
            headers: JSON_HEADERS(),
            body: JSON.stringify({ name: 'AK400', brand: 'DeepCool', category: 'cooling', listing_ids: [] }),
        });
        expect(res.status).toBe(400);
    });

    test('returns 409 when exact duplicate component exists', async () => {
        setSql(async () => [{ id: 99, name: 'AK400', brand: 'DeepCool', slug: 'deepcool-ak400' }]);

        const res = await app.request('/api/admin/unmatched-listings/create-and-link', {
            method: 'POST',
            headers: JSON_HEADERS(),
            body: JSON.stringify({
                name: 'AK400',
                brand: 'DeepCool',
                category: 'cooling',
                listing_ids: [1],
            }),
        });

        expect(res.status).toBe(409);
        const body = await res.json();
        expect(body.error.code).toBe('DUPLICATE_COMPONENT');
    });

    test('returns 400 when category-specific validation fails (fan without size_mm)', async () => {
        setSql(async () => []); // no duplicate

        const res = await app.request('/api/admin/unmatched-listings/create-and-link', {
            method: 'POST',
            headers: JSON_HEADERS(),
            body: JSON.stringify({
                name: 'F120 RGB Core',
                brand: 'NZXT',
                category: 'fan',
                specs: {}, // missing required size_mm
                listing_ids: [1],
            }),
        });

        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error.code).toBe('VALIDATION_ERROR');
    });
});
