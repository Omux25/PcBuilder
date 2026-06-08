import type { MiddlewareHandler } from 'hono';
import { trafficService } from './traffic.service.js';

export const trafficLogger = (): MiddlewareHandler => {
  return async (c, next) => {
    // Ignore OPTIONS requests or internal health checks
    if (c.req.method === 'OPTIONS' || c.req.path.startsWith('/api/health')) {
      return next();
    }

    const start = performance.now();
    await next();
    const end = performance.now();

    const ip = c.req.header('x-forwarded-for') || c.req.header('cf-connecting-ip') || '127.0.0.1';
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
