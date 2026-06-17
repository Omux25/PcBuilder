import { Hono } from 'hono';
import { trafficService } from './traffic.service.js';

export const publicTrafficRouter = new Hono();

const handleTrafficRequest = async (c: any) => {
  try {
    const body = await c.req.json();
    const paths = Array.isArray(body.keys) ? body.keys : (Array.isArray(body.paths) ? body.paths : (body.path ? [body.path] : []));
    
    if (paths.length === 0) return c.json({ success: false });

    const ip = c.req.header('x-vercel-forwarded-for') || 
               c.req.header('x-forwarded-for') || 
               c.req.header('cf-connecting-ip') || 
               '127.0.0.1';
    const userAgent = c.req.header('user-agent');
    
    for (const path of paths) {
      trafficService.logTraffic({
        ip,
        method: 'VIEW',
        path,
        userAgent,
        statusCode: 200,
        responseTimeMs: 0
      }).catch(() => {});
    }

    return c.json({ success: true });
  } catch (err) {
    return c.json({ success: false });
  }
};

publicTrafficRouter.post('/theme', handleTrafficRequest);
publicTrafficRouter.post('/metrics', handleTrafficRequest);
publicTrafficRouter.post('/state', handleTrafficRequest);
publicTrafficRouter.post('/route', handleTrafficRequest);
