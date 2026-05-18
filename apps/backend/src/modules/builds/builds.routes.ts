import { Hono } from 'hono';
import { authMiddleware } from '../../core/middleware/auth.js';
import { PresetController } from './controllers/presetController.js';

const presetController = new PresetController();

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
      const response = await fetch(decodedUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)',
        },
      });

      if (!response.ok) {
        return c.text('Failed to fetch image from remote server', 502);
      }

      const contentType = response.headers.get('content-type') || 'image/jpeg';
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
