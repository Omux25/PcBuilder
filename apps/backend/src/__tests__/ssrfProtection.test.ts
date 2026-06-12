import { describe, test, expect } from 'bun:test';
import { app } from '../app.js';

describe('SSRF Protection in Image Proxy', () => {
  test('rejects localhost and 127.0.0.1 loopback', async () => {
    const res1 = await app.request('/api/builds/proxy-image?url=' + encodeURIComponent('http://localhost:3000/api/health'));
    expect(res1.status).toBe(403);
    expect(await res1.text()).toBe('Forbidden URL target');

    const res2 = await app.request('/api/builds/proxy-image?url=' + encodeURIComponent('http://127.0.0.1:80/foo'));
    expect(res2.status).toBe(403);
    expect(await res2.text()).toBe('Forbidden URL target');
  });

  test('rejects link-local addresses (AWS / metadata)', async () => {
    const res = await app.request('/api/builds/proxy-image?url=' + encodeURIComponent('http://169.254.169.254/latest/meta-data'));
    expect(res.status).toBe(403);
    expect(await res.text()).toBe('Forbidden URL target');
  });

  test('rejects private Class C addresses (192.168.x.x)', async () => {
    const res = await app.request('/api/builds/proxy-image?url=' + encodeURIComponent('http://192.168.1.1/index.html'));
    expect(res.status).toBe(403);
    expect(await res.text()).toBe('Forbidden URL target');
  });

  test('rejects invalid schemes (file://, ftp://)', async () => {
    const res1 = await app.request('/api/builds/proxy-image?url=' + encodeURIComponent('file:///etc/passwd'));
    expect(res1.status).toBe(403);

    const res2 = await app.request('/api/builds/proxy-image?url=' + encodeURIComponent('ftp://example.com/file'));
    expect(res2.status).toBe(403);
  });
});
