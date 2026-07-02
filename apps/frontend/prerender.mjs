import puppeteer from 'puppeteer';
import chromium from '@sparticuz/chromium';
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
  console.log('[PRERENDER] Starting static prerendering...');
  const server = await startServer();
  
  const isVercel = process.env.VERCEL === '1';

  let executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || undefined;
  let args = ['--no-sandbox', '--disable-setuid-sandbox'];

  if (isVercel) {
    // Vercel build environment requires the sparticuz chromium binary
    executablePath = await chromium.executablePath();
    args = chromium.args;
  }

  const browser = await puppeteer.launch({
    headless: isVercel ? chromium.headless : "new",
    executablePath,
    args
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
      console.error(`[ERROR] Failed to prerender ${route}:`, e);
    }
  }

  sitemapXml += `</urlset>`;
  fs.writeFileSync(path.join(DIST_DIR, 'sitemap.xml'), sitemapXml);
  console.log('[PRERENDER] Created sitemap.xml.');
  console.log('[PRERENDER] Submitting URLs to IndexNow...');
  const indexNowKey = '0f85b8823f6e492f8087fcda8cb080b0';
  let urlList = routesToPrerender.map(route => `${PUBLIC_URL}${route}`);
  
  try {
    console.log('[PRERENDER] Fetching dynamic sitemap from backend to include all URLs...');
    const sitemapRes = await fetch('https://pcbuilder-m2nf.onrender.com/api/sitemap.xml');
    if (sitemapRes.ok) {
      const sitemapText = await sitemapRes.text();
      const matches = sitemapText.match(/<loc>(.*?)<\/loc>/g);
      if (matches) {
        const dynamicUrls = matches.map(m => m.replace(/<\/?loc>/g, ''));
        // Merge and deduplicate URLs
        urlList = [...new Set([...urlList, ...dynamicUrls])];
        console.log(`[PRERENDER] Found ${dynamicUrls.length} URLs in live sitemap. Total unique URLs to submit: ${urlList.length}`);
      }
    } else {
      console.warn('[WARNING] Failed to fetch dynamic sitemap, submitting only static URLs.');
    }
  } catch (err) {
    console.warn('[WARNING] Error fetching dynamic sitemap:', err.message);
  }

  // Submit in chunks of 10,000 (IndexNow limit)
  const chunkSize = 10000;
  for (let i = 0; i < urlList.length; i += chunkSize) {
    const chunk = urlList.slice(i, i + chunkSize);
    try {
      const response = await fetch('https://www.bing.com/indexnow', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify({
          host: 'pcbuilder.ma',
          key: indexNowKey,
          keyLocation: `https://pcbuilder.ma/${indexNowKey}.txt`,
          urlList: chunk
        })
      });
      
      if (response.ok) {
        console.log(`[PRERENDER] IndexNow submission successful for ${chunk.length} URLs.`);
      } else {
        console.error(`[ERROR] IndexNow submission failed: ${response.status} ${response.statusText}`);
      }
    } catch (e) {
      console.error('[ERROR] Failed to submit to IndexNow:', e);
    }
  }

  await browser.close();
  server.close();
  console.log('[PRERENDER] Static prerendering complete.');
}

run().catch(err => {
  console.error('[ERROR]', err);
  process.exit(1);
});
