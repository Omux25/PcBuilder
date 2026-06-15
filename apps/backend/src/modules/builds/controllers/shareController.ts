import type { Context } from 'hono';
import { getSql } from '../../../core/db/index.js';
import { getComponentsByIds } from '../../catalog/services/componentService.js';

export class ShareController {
  private generateSlug(length = 7): string {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars[bytes[i] % chars.length];
    }
    return result;
  }

  async share(c: Context) {
    const body = await c.req.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid build configuration' } }, 400);
    }

    const sql = getSql();
    let id = '';
    let exists = true;

    for (let attempt = 0; attempt < 5; attempt++) {
      id = this.generateSlug(7);
      const rows = await sql`SELECT 1 FROM shared_builds WHERE id = ${id}`;
      if (rows.length === 0) {
        exists = false;
        break;
      }
    }

    if (exists) {
      return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to generate unique share code' } }, 500);
    }

    await sql`
      INSERT INTO shared_builds (id, config_json)
      VALUES (${id}, ${JSON.stringify(body)}::jsonb)
    `;

    return c.json({
      id,
      url: `/b/${id}`
    });
  }

  async retrieve(c: Context) {
    const id = c.req.param('id');
    if (!id) {
      return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Missing share ID' } }, 400);
    }

    const sql = getSql();
    const rows = await sql`SELECT config_json FROM shared_builds WHERE id = ${id}`;
    if (rows.length === 0) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'Shared build not found' } }, 404);
    }

    return c.json(rows[0].config_json);
  }

  async redirect(c: Context) {
    const id = c.req.param('id');
    if (!id) {
      return c.html(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Configuration PC Maroc</title>
          <script>
            window.location.replace("/build");
          </script>
        </head>
        <body>Redirecting...</body>
        </html>
      `);
    }

    const sql = getSql();
    const rows = await sql`SELECT config_json FROM shared_builds WHERE id = ${id}`;
    if (rows.length === 0) {
      return c.html(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Configuration PC Maroc</title>
          <script>
            window.location.replace("/build");
          </script>
        </head>
        <body>Redirecting...</body>
        </html>
      `);
    }

    const configJson = rows[0].config_json as Record<string, unknown>;
    const ids = Object.values(configJson).filter((v): v is number => typeof v === 'number');

    let summary = 'Découvrez cette configuration personnalisée';
    if (ids.length > 0) {
      try {
        const components = await getComponentsByIds(ids);
        const cpu = components.find(comp => comp.category === 'cpu');
        const gpu = components.find(comp => comp.category === 'gpu');

        const parts: string[] = [];
        if (cpu) parts.push(cpu.name);
        if (gpu) parts.push(gpu.name);

        if (parts.length === 0) {
          for (const comp of components.slice(0, 2)) {
            parts.push(comp.name);
          }
        }

        const partsStr = parts.join(' + ');
        const totalPrice = components.reduce((sum, comp) => sum + Number(comp.lowest_price || 0), 0);
        const formattedPrice = Number(totalPrice).toLocaleString('en-US', { maximumFractionDigits: 0 });

        summary = `${partsStr} | Total: ${formattedPrice} DH`;
      } catch (err) {
        console.error('[Share Redirect Error while loading components]:', err);
      }
    }

    return c.html(`
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="utf-8">
        <title>Configuration PC Maroc</title>
        <meta property="og:title" content="Configuration PC Maroc" />
        <meta property="og:description" content="Découvrez cette configuration personnalisée : ${summary}" />
        <meta property="og:type" content="website" />
        <meta name="description" content="Découvrez cette configuration personnalisée : ${summary}" />
        <script>
          window.location.replace("/build?s=${id}");
        </script>
      </head>
      <body>
        Redirecting to your custom PC build...
      </body>
      </html>
    `);
  }
}
