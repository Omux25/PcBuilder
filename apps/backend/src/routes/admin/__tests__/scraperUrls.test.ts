// @ts-nocheck
/**
 * Tests for POST /api/admin/scrapers/scrape-urls
 * Requirements: 12.3, 15.9
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { Hono } from 'hono';
import jwt from 'jsonwebtoken';
import { scraperUrlsRouter } from '../scraperUrls.js';
import { setSql, resetSql } from '../../../db/index.js';

const JWT_SECRET = 'test-secret';

function makeApp() {
    process.env.JWT_SECRET = JWT_SECRET;
    const app = new Hono();
    app.route('/api/admin/scrapers', scraperUrlsRouter);
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

describe('POST /api/admin/scrapers/scrape-urls', () => {
    let app: Hono;
    beforeEach(() => { app = makeApp(); });
    afterEach(() => { resetSql(); });

    test('returns 401 without token', async () => {
        const res = await app.request('/api/admin/scrapers/scrape-urls', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ urls: [{ retailer_id: 10, product_url: 'https://ultrapc.ma/p/1' }] }),
        });
        expect(res.status).toBe(401);
    });

    test('returns 400 when urls is missing', async () => {
        const res = await app.request('/api/admin/scrapers/scrape-urls', {
            method: 'POST',
            headers: JSON_HEADERS(),
            body: JSON.stringify({}),
        });
        expect(res.status).toBe(400);
    });

    test('returns 400 when urls is empty', async () => {
        const res = await app.request('/api/admin/scrapers/scrape-urls', {
            method: 'POST',
            headers: JSON_HEADERS(),
            body: JSON.stringify({ urls: [] }),
        });
        expect(res.status).toBe(400);
    });

    test('returns 400 when urls entries are invalid', async () => {
        const res = await app.request('/api/admin/scrapers/scrape-urls', {
            method: 'POST',
            headers: JSON_HEADERS(),
            body: JSON.stringify({ urls: [{ retailer_id: 'not-a-number', product_url: 123 }] }),
        });
        expect(res.status).toBe(400);
    });

    test('returns scraped and failed counts for unknown retailer', async () => {
        // retailer_id 999 has no scraper config → all fail
        const res = await app.request('/api/admin/scrapers/scrape-urls', {
            method: 'POST',
            headers: JSON_HEADERS(),
            body: JSON.stringify({
                urls: [{ retailer_id: 999, product_url: 'https://unknown.ma/p/1' }],
            }),
        });

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(typeof body.scraped).toBe('number');
        expect(typeof body.failed).toBe('number');
        expect(body.failed).toBe(1);
        expect(body.scraped).toBe(0);
    });

    test('returns 400 for invalid JSON body', async () => {
        const res = await app.request('/api/admin/scrapers/scrape-urls', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${makeToken()}` },
            body: 'not-json',
        });
        expect(res.status).toBe(400);
    });
});
