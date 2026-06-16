import { Hono } from 'hono';
import { trafficService } from '../traffic/traffic.service.js';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { authMiddleware } from '../../core/middleware/auth.js';

export const adminTrafficRouter = new Hono();

adminTrafficRouter.use('/*', authMiddleware);

const paginationSchema = z.object({
  limit: z.coerce.number().min(1).max(500).default(50),
  offset: z.coerce.number().min(0).default(0),
  ip: z.string().optional(),
});

adminTrafficRouter.get('/traffic', zValidator('query', paginationSchema), async (c) => {
  const { limit, offset, ip } = c.req.valid('query');
  const result = await trafficService.getTrafficLogs(limit, offset, ip);
  return c.json(result);
});

adminTrafficRouter.get('/traffic/visitors', zValidator('query', paginationSchema), async (c) => {
  const { limit, offset } = c.req.valid('query');
  const result = await trafficService.getTrafficVisitors(limit, offset);
  return c.json(result);
});

adminTrafficRouter.delete('/traffic', async (c) => {
  await trafficService.clearAllLogs();
  return c.json({ success: true, message: 'All traffic logs cleared' });
});
