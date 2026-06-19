import puppeteer from 'puppeteer';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 5000;
const DIST_DIR = path.join(__dirname, 'dist');
const BASE_URL = `http://localhost:${PORT}`;
const PUBLIC_URL = 'https://pcbuilder.ma';

// Ensure dist exists
if (!fs.existsSync(DIST_DIR)) {
  console.error('dist directory not found. Please build the frontend first.');
  process.exit(1);
}

const routesToPrerender = [
  '/',
  '/configurateur',
  '/composants',
  '/configurations',
  '/comparer',
  '/tendances',
  '/parcourir/cpu',
  '/parcourir/gpu',
  '/parcourir/motherboard',
  '/parcourir/ram',
  '/parcourir/storage',
  '/parcourir/psu',
  '/parcourir/case',
  '/parcourir/cooling'
];

async function startServer() {
  const app = express();
  
  // Serve static files from dist
  app.use(express.static(DIST_DIR, { index: false }));

  // Fallback to index.html for SPA routing
  app.use((req, res) => {
    res.sendFile(path.join(DIST_DIR, 'index.html'));
  });

  return new Promise((resolve) => {
    const server = app.listen(PORT, () => resolve(server));
  });
}

async function run() {
  console.log('🚀 Starting static prerendering...');
  const server = await startServer();
  
  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  // Create a sitemap
  let sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

  for (const route of routesToPrerender) {
    console.log(`Prerendering ${route}...`);
    try {
      await page.goto(`${BASE_URL}${route}`, { waitUntil: 'networkidle0', timeout: 30000 });
      
      // Get full HTML
      const html = await page.content();
      
      // Save to appropriate path
      let fileDir = path.join(DIST_DIR, route);
      if (route === '/') {
         fileDir = DIST_DIR;
         // index.html at root is already there, we just overwrite it with the fully populated one
         fs.writeFileSync(path.join(fileDir, 'index.html'), html);
      } else {
         if (!fs.existsSync(fileDir)) {
           fs.mkdirSync(fileDir, { recursive: true });
         }
         fs.writeFileSync(path.join(fileDir, 'index.html'), html);
      }

      // Add to sitemap
      const priority = route === '/' ? '1.0' : '0.8';
      sitemapXml += `  <url>\n    <loc>${PUBLIC_URL}${route}</loc>\n    <priority>${priority}</priority>\n  </url>\n`;

    } catch (e) {
      console.error(`❌ Failed to prerender ${route}:`, e);
    }
  }

  sitemapXml += `</urlset>`;
  fs.writeFileSync(path.join(DIST_DIR, 'sitemap.xml'), sitemapXml);
  console.log('✅ Created sitemap.xml');

  await browser.close();
  server.close();
  console.log('✅ Static prerendering complete!');
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
