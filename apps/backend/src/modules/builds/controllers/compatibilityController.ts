import type { Context } from 'hono';
import { z } from 'zod';
import { CompatibilityService } from '../services/compatibilityService.js';
import { ComponentService } from '../../catalog/services/componentService.js';

const buildIdSchema = z.record(z.string(), z.number().int().positive());

export class CompatibilityController {
  private compatibilityService = new CompatibilityService();
  private componentService = new ComponentService();

  async validate(c: Context) {
    let body: any;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid JSON body' } }, 400);
    }

    const parsed = buildIdSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid build configuration' } }, 400);
    }

    const componentIds = Array.from(new Set(Object.values(parsed.data)));
    const components = await this.componentService.getComponentsByIds(componentIds);
    const idMap = new Map(components.map(comp => [comp.id, comp]));

    const buildInput: Record<string, any> = {};
    for (const [key, id] of Object.entries(parsed.data)) {
      const comp = idMap.get(id);
      if (comp) {
        buildInput[key] = comp;
      }
    }

    const result = this.compatibilityService.validateCompatibility(buildInput);
    return c.json(result);
  }
}
