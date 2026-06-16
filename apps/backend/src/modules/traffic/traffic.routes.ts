import { Hono } from 'hono';
import { trafficService } from './traffic.service.js';

export const publicTrafficRouter = new Hono();

publicTrafficRouter.post('/track', async (c) => {
  try {
    const { path } = await c.req.json();
    if (!path) return c.json({ success: false });

    const ip = c.req.header('x-vercel-forwarded-for') || 
               c.req.header('x-forwarded-for') || 
               c.req.header('cf-connecting-ip') || 
               '127.0.0.1';
    const userAgent = c.req.header('user-agent');
    
    trafficService.logTraffic({
      ip,
      method: 'VIEW',
      path,
      userAgent,
      statusCode: 200,
      responseTimeMs: 0
    }).catch(() => {});

    return c.json({ success: true });
  } catch (err) {
    return c.json({ success: false });
  }
});
