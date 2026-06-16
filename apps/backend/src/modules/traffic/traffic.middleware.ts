import type { MiddlewareHandler } from 'hono';
import { trafficService } from './traffic.service.js';

export const trafficLogger = (): MiddlewareHandler => {
  return async (c, next) => {
    const pathStr = c.req.path;
    // Ignore OPTIONS requests, internal health checks, explicit page views, and admin API calls
    if (
      c.req.method === 'OPTIONS' || 
      pathStr.includes('/health') || 
      pathStr.includes('/ui/state') ||
      pathStr.includes('/pulse') ||
      pathStr.includes('/traffic/route') ||
      pathStr.includes('/admin')
    ) {
      return next();
    }

    const start = performance.now();
    await next();
    const end = performance.now();

    // Vercel proxies send the real user IP in x-vercel-forwarded-for.
    // Render might overwrite x-forwarded-for.
    const ip = c.req.header('x-vercel-forwarded-for') || 
               c.req.header('x-forwarded-for') || 
               c.req.header('cf-connecting-ip') || 
               '127.0.0.1';
               
    const method = c.req.method;
    const path = new URL(c.req.url).pathname;
    const userAgent = c.req.header('user-agent');
    const statusCode = c.res.status;
    const responseTimeMs = Math.round(end - start);

    // Fire and forget so we don't block the response
    trafficService.logTraffic({
      ip,
      method,
      path,
      userAgent,
      statusCode,
      responseTimeMs
    }).catch(err => {
      console.error('[TrafficLogger] Error saving log:', err);
    });
  };
};
