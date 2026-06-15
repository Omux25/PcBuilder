import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { app } from '../app.js';
import { setSql, resetSql } from '../core/db/index.js';

describe('Shared Builds API & SEO redirects', () => {
  const mockDb: Record<string, any> = {};

  beforeAll(() => {
    // Mock database sql template tag
    const mockSql = (async (strings: TemplateStringsArray, ...values: any[]) => {
      const query = strings.join('?');
      if (query.includes('INSERT INTO shared_builds')) {
        const id = values[0];
        const configJson = JSON.parse(values[1]);
        mockDb[id] = configJson;
        return [];
      }
      if (query.includes('SELECT 1 FROM shared_builds WHERE id =')) {
        const id = values[0];
        return mockDb[id] ? [{ '1': 1 }] : [];
      }
      if (query.includes('SELECT config_json FROM shared_builds WHERE id =')) {
        const id = values[0];
        return mockDb[id] ? [{ config_json: mockDb[id] }] : [];
      }
      return [];
    }) as any;

    setSql(mockSql);
  });

  afterAll(() => {
    resetSql();
  });

  test('POST /api/builds/share and GET /api/builds/share/:id', async () => {
    // 1. Share a configuration
    const config = { cpu: 12, gpu: 34 };
    const postRes = await app.request('/api/builds/share', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
    expect(postRes.status).toBe(200);

    const postBody = await postRes.json();
    expect(postBody.id).toBeDefined();
    expect(postBody.id.length).toBe(7);
    expect(postBody.url).toBe(`/b/${postBody.id}`);

    // 2. Retrieve it
    const getRes = await app.request(`/api/builds/share/${postBody.id}`);
    expect(getRes.status).toBe(200);

    const getBody = await getRes.json();
    expect(getBody).toEqual(config);
  });

  test('GET /b/:id SEO Redirect page', async () => {
    const keys = Object.keys(mockDb);
    expect(keys.length).toBeGreaterThan(0);
    const shareId = keys[0];

    const redirectRes = await app.request(`/b/${shareId}`);
    expect(redirectRes.status).toBe(200);
    const htmlContent = await redirectRes.text();
    expect(htmlContent).toContain('<meta property="og:title" content="Configuration PC Maroc" />');
    expect(htmlContent).toContain(`window.location.replace("/build?s=${shareId}")`);
  });

  test('GET /share/:id SEO Redirect page', async () => {
    const keys = Object.keys(mockDb);
    expect(keys.length).toBeGreaterThan(0);
    const shareId = keys[0];

    const redirectRes = await app.request(`/share/${shareId}`);
    expect(redirectRes.status).toBe(200);
    const htmlContent = await redirectRes.text();
    expect(htmlContent).toContain('<meta property="og:title" content="Configuration PC Maroc" />');
    expect(htmlContent).toContain(`window.location.replace("/build?s=${shareId}")`);
  });
});
