import { Hono } from 'hono';
import { getSql } from '../../core/db/index.js';

export const seoRouter = new Hono();

seoRouter.get('/sitemap.xml', async (c) => {
  const sql = getSql();

  try {
    // Get all components with a slug
    const components = await sql`
      SELECT c.category, c.slug, c.updated_at 
      FROM components c
      WHERE c.slug IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM prices p WHERE p.component_id = c.id
      )
    `;

    const baseUrl = 'https://pcbuilder.ma';

    // Core static pages
    const staticPages = [
      '',
      '/build',
      '/components',
      '/compare',
      '/search',
      '/market-trends',
      '/presets'
    ];

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

    // Add static pages
    for (const page of staticPages) {
      xml += `  <url>\n`;
      xml += `    <loc>${baseUrl}${page}</loc>\n`;
      xml += `    <changefreq>daily</changefreq>\n`;
      xml += `    <priority>${page === '' ? '1.0' : '0.8'}</priority>\n`;
      xml += `  </url>\n`;
    }

    // Add dynamic component pages
    for (const comp of (components as any[])) {
      // Format date as YYYY-MM-DD
      const date = new Date(comp.updated_at).toISOString().split('T')[0];
      xml += `  <url>\n`;
      xml += `    <loc>${baseUrl}/components/${encodeURIComponent(comp.category)}/${encodeURIComponent(comp.slug)}</loc>\n`;
      xml += `    <lastmod>${date}</lastmod>\n`;
      xml += `    <changefreq>weekly</changefreq>\n`;
      xml += `    <priority>0.6</priority>\n`;
      xml += `  </url>\n`;
    }

    xml += `</urlset>`;

    return c.text(xml, 200, {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400', // Cache at edge for 24h
    });
  } catch (error) {
    console.error('Error generating sitemap:', error);
    return c.text('Error generating sitemap', 500);
  }
});
