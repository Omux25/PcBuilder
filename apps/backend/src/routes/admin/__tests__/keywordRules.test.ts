// @ts-nocheck
/**
 * Integration tests for the keyword rules router.
 * Requirements: 8.1–8.11
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { Hono } from 'hono';
import jwt from 'jsonwebtoken';
import { keywordRulesRouter } from '../keywordRulesRouter.js';
import { setSql, resetSql } from '../../../db/index.js';

const JWT_SECRET = 'test-secret';

function makeApp() {
    process.env.JWT_SECRET = JWT_SECRET;
    const app = new Hono();
    app.route('/api/admin/keyword-rules', keywordRulesRouter);
    return app;
}

function makeToken() {
    return jwt.sign({ id: 1, username: 'admin' }, JWT_SECRET, { expiresIn: '1h' });
}

const AUTH = () => ({ Authorization: `Bearer ${makeToken()}` });
const JSON_HEADERS = () => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${makeToken()}`,
});

const MOCK_RULE = {
    id: 1,
    keyword: 'coreliquid',
    match_type: 'contains',
    category: 'cooling',
    source: 'admin',
    created_by: 1,
    created_at: '2026-05-01T10:00:00Z',
    match_count: 5,
};

const MOCK_BUILTIN_RULE = {
    ...MOCK_RULE,
    id: 2,
    source: 'builtin',
    created_by: null,
};

// ── GET / ─────────────────────────────────────────────────────────────────────

describe('GET /api/admin/keyword-rules', () => {
    let app: Hono;
    beforeEach(() => { app = makeApp(); });
    afterEach(() => { resetSql(); });

    test('returns 401 without token', async () => {
        const res = await app.request('/api/admin/keyword-rules');
        expect(res.status).toBe(401);
    });

    test('returns array with match_count field', async () => {
        setSql(async () => [MOCK_RULE]);

        const res = await app.request('/api/admin/keyword-rules', { headers: AUTH() });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(Array.isArray(body)).toBe(true);
        expect(body[0].match_count).toBeDefined();
        expect(body[0].keyword).toBe('coreliquid');
    });

    test('returns empty array when no rules', async () => {
        setSql(async () => []);
        const res = await app.request('/api/admin/keyword-rules', { headers: AUTH() });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body).toHaveLength(0);
    });
});

// ── POST / ────────────────────────────────────────────────────────────────────

describe('POST /api/admin/keyword-rules', () => {
    let app: Hono;
    beforeEach(() => { app = makeApp(); });
    afterEach(() => { resetSql(); });

    test('returns 401 without token', async () => {
        const res = await app.request('/api/admin/keyword-rules', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ keyword: 'test', match_type: 'contains', category: 'cooling' }),
        });
        expect(res.status).toBe(401);
    });

    test('returns 201 with created rule', async () => {
        setSql(async () => [MOCK_RULE]);

        const res = await app.request('/api/admin/keyword-rules', {
            method: 'POST',
            headers: JSON_HEADERS(),
            body: JSON.stringify({ keyword: 'coreliquid', match_type: 'contains', category: 'cooling' }),
        });
        expect(res.status).toBe(201);
        const body = await res.json();
        expect(body.keyword).toBe('coreliquid');
        expect(body.source).toBe('admin');
    });

    test('returns 400 INVALID_KEYWORD for empty keyword', async () => {
        const res = await app.request('/api/admin/keyword-rules', {
            method: 'POST',
            headers: JSON_HEADERS(),
            body: JSON.stringify({ keyword: '', match_type: 'contains', category: 'cooling' }),
        });
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error.code).toBe('INVALID_KEYWORD');
    });

    test('returns 400 INVALID_CATEGORY for unknown category', async () => {
        const res = await app.request('/api/admin/keyword-rules', {
            method: 'POST',
            headers: JSON_HEADERS(),
            body: JSON.stringify({ keyword: 'test', match_type: 'contains', category: 'unknown_cat' }),
        });
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error.code).toBe('INVALID_CATEGORY');
    });

    test('returns 400 INVALID_MATCH_TYPE for unknown match_type', async () => {
        const res = await app.request('/api/admin/keyword-rules', {
            method: 'POST',
            headers: JSON_HEADERS(),
            body: JSON.stringify({ keyword: 'test', match_type: 'regex', category: 'cooling' }),
        });
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error.code).toBe('INVALID_MATCH_TYPE');
    });

    test('returns 409 DUPLICATE_RULE on unique constraint violation', async () => {
        setSql(async () => { throw new Error('duplicate key value violates unique constraint 23505'); });

        const res = await app.request('/api/admin/keyword-rules', {
            method: 'POST',
            headers: JSON_HEADERS(),
            body: JSON.stringify({ keyword: 'coreliquid', match_type: 'contains', category: 'cooling' }),
        });
        expect(res.status).toBe(409);
        const body = await res.json();
        expect(body.error.code).toBe('DUPLICATE_RULE');
    });
});

// ── DELETE /:id ───────────────────────────────────────────────────────────────

describe('DELETE /api/admin/keyword-rules/:id', () => {
    let app: Hono;
    beforeEach(() => { app = makeApp(); });
    afterEach(() => { resetSql(); });

    test('returns 401 without token', async () => {
        const res = await app.request('/api/admin/keyword-rules/1', { method: 'DELETE' });
        expect(res.status).toBe(401);
    });

    test('returns 404 for non-existent rule', async () => {
        setSql(async () => []);
        const res = await app.request('/api/admin/keyword-rules/9999', {
            method: 'DELETE',
            headers: AUTH(),
        });
        expect(res.status).toBe(404);
    });

    test('returns 403 CANNOT_DELETE_BUILTIN for builtin rule', async () => {
        let call = 0;
        setSql(async () => {
            call++;
            if (call === 1) return [MOCK_BUILTIN_RULE]; // fetch rule
            return [];
        });

        const res = await app.request('/api/admin/keyword-rules/2', {
            method: 'DELETE',
            headers: AUTH(),
        });
        expect(res.status).toBe(403);
        const body = await res.json();
        expect(body.error.code).toBe('CANNOT_DELETE_BUILTIN');
    });

    test('returns 200 for admin rule deletion', async () => {
        let call = 0;
        setSql(async () => {
            call++;
            if (call === 1) return [MOCK_RULE]; // fetch rule
            return []; // delete + logActivity
        });

        const res = await app.request('/api/admin/keyword-rules/1', {
            method: 'DELETE',
            headers: AUTH(),
        });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.success).toBe(true);
    });
});

// ── POST /preview ─────────────────────────────────────────────────────────────

describe('POST /api/admin/keyword-rules/preview', () => {
    let app: Hono;
    beforeEach(() => { app = makeApp(); });
    afterEach(() => { resetSql(); });

    test('returns 401 without token', async () => {
        const res = await app.request('/api/admin/keyword-rules/preview', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ keyword: 'test', match_type: 'contains' }),
        });
        expect(res.status).toBe(401);
    });

    test('returns match_count and sample_names', async () => {
        setSql(async () => [
            { id: 1, scraped_name: 'MSI MAG CORELIQUID E240' },
            { id: 2, scraped_name: 'MSI MAG CORELIQUID A13 360' },
        ]);

        const res = await app.request('/api/admin/keyword-rules/preview', {
            method: 'POST',
            headers: JSON_HEADERS(),
            body: JSON.stringify({ keyword: 'coreliquid', match_type: 'contains' }),
        });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(typeof body.match_count).toBe('number');
        expect(Array.isArray(body.sample_names)).toBe(true);
        expect(body.match_count).toBe(2);
    });

    test('returns 400 INVALID_KEYWORD for empty keyword', async () => {
        const res = await app.request('/api/admin/keyword-rules/preview', {
            method: 'POST',
            headers: JSON_HEADERS(),
            body: JSON.stringify({ keyword: '', match_type: 'contains' }),
        });
        expect(res.status).toBe(400);
        expect((await res.json()).error.code).toBe('INVALID_KEYWORD');
    });

    test('returns 400 INVALID_MATCH_TYPE for unknown match_type', async () => {
        const res = await app.request('/api/admin/keyword-rules/preview', {
            method: 'POST',
            headers: JSON_HEADERS(),
            body: JSON.stringify({ keyword: 'test', match_type: 'regex' }),
        });
        expect(res.status).toBe(400);
        expect((await res.json()).error.code).toBe('INVALID_MATCH_TYPE');
    });

    test('number_before match type correctly matches 240ML but not ML alone', async () => {
        setSql(async () => [
            { id: 1, scraped_name: 'SG 240ML ARGB NOIR' },
            { id: 2, scraped_name: 'SG 360ML ARGB BLANC' },
            { id: 3, scraped_name: 'Some product with ML in name' }, // should NOT match
        ]);

        const res = await app.request('/api/admin/keyword-rules/preview', {
            method: 'POST',
            headers: JSON_HEADERS(),
            body: JSON.stringify({ keyword: 'ML', match_type: 'number_before' }),
        });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.match_count).toBe(2); // only 240ML and 360ML match
    });
});
