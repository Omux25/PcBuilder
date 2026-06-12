import { Hono } from 'hono';
import { authMiddleware } from '../../core/middleware/auth.js';
import { PresetController } from './controllers/presetController.js';
import { lookup } from 'node:dns/promises';

const presetController = new PresetController();

async function isSafeUrl(urlStr: string): Promise<boolean> {
  try {
    const url = new URL(urlStr);
    
    // Only allow HTTP/HTTPS
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return false;
    }
    
    const hostname = url.hostname;
    if (!hostname) return false;

    // Resolve domain to IP address
    const result = await lookup(hostname);
    const ip = result.address;
    
    // Check loopback and localhost
    if (ip === '::1' || ip === 'localhost') {
      return false;
    }
    
    // IPv4 Checks
    if (ip.includes('.')) {
      const parts = ip.split('.').map(Number);
      if (parts.length === 4) {
        const [o1, o2] = parts;
        // Loopback: 127.0.0.0/8
        if (o1 === 127) return false;
        // Private Class A: 10.0.0.0/8
        if (o1 === 10) return false;
        // Private Class B: 172.16.0.0/12
        if (o1 === 172 && o2 >= 16 && o2 <= 31) return false;
        // Private Class C: 192.168.0.0/16
        if (o1 === 192 && o2 === 168) return false;
        // Link-local: 169.254.0.0/16
        if (o1 === 169 && o2 === 254) return false;
        // Broadcast / Multicast: 224.0.0.0/4
        if (o1 >= 224) return false;
        // 0.0.0.0 (any address)
        if (o1 === 0) return false;
      }
    } else if (ip.includes(':')) {
      // IPv6 Checks
      const normalized = ip.toLowerCase();
      if (normalized === '::' || normalized === '::1') return false;
      // Link-local (fe80::/10)
      if (normalized.startsWith('fe8') || normalized.startsWith('fe9') || normalized.startsWith('fea') || normalized.startsWith('feb')) return false;
      // Unique local (fc00::/7)
      if (normalized.startsWith('fc') || normalized.startsWith('fd')) return false;
    }
    
    return true;
  } catch {
    return false;
  }
}

const buildsRouter = new Hono()
  .get('/presets', (c) => presetController.index(c))
  .get('/presets/:id', (c) => presetController.show(c))
  .get('/proxy-image', async (c) => {
    const imageUrl = c.req.query('url');
    if (!imageUrl) {
      return c.text('Missing url parameter', 400);
    }

    try {
      const decodedUrl = decodeURIComponent(imageUrl);
      
      // Enforce SSRF protection
      const safe = await isSafeUrl(decodedUrl);
      if (!safe) {
        return c.text('Forbidden URL target', 403);
      }

      const response = await fetch(decodedUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)',
        },
      });

      if (!response.ok) {
        return c.text('Failed to fetch image from remote server', 502);
      }

      const contentType = response.headers.get('content-type') || 'image/jpeg';
      
      // Enforce image-only returns
      if (!contentType.startsWith('image/')) {
        return c.text('Only image resources are allowed', 400);
      }

      const arrayBuffer = await response.arrayBuffer();

      c.header('Content-Type', contentType);
      c.header('Cache-Control', 'public, max-age=604800'); // Cache for 7 days
      c.header('Access-Control-Allow-Origin', '*'); // Expose CORS to browser
      
      return c.body(arrayBuffer);
    } catch (err) {
      console.error('[Image Proxy Route Error]:', err);
      return c.text('Internal Server Error', 500);
    }
  });

// --- Admin Routes ---
const adminRouter = new Hono()
  .use('/*', authMiddleware)
  .get('/presets', (c) => presetController.getAdminPresets(c))
  .post('/presets', (c) => presetController.create(c))
  .put('/presets/:id', (c) => presetController.update(c))
  .delete('/presets/:id', (c) => presetController.delete(c));

export { buildsRouter, adminRouter as adminBuildsRouter };
