import { execSync } from 'child_process';
import { renameSync, rmSync, existsSync, readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';

try {
  console.log('[BUILD] Starting frontend build process...');
  execSync('vite build', { stdio: 'inherit' });

  console.log('[BUILD] Running static prerendering for SEO...');
  execSync('node prerender.mjs', { stdio: 'inherit' });

  console.log('[BUILD] Inlining critical CSS...');
  const indexPath = join('./dist', 'index.html');
  const assetsDir = join('./dist', 'assets');
  if (existsSync(indexPath) && existsSync(assetsDir)) {
    let html = readFileSync(indexPath, 'utf-8');
    
    let combinedCss = '';
    const linkRegex = /<link[^>]*rel="stylesheet"[^>]*href="\/assets\/([^"]+)"[^>]*>/g;
    let match;
    const matches = [];
    while ((match = linkRegex.exec(html)) !== null) {
      matches.push(match);
    }
    
    for (const m of matches) {
      const fileName = m[1];
      const filePath = join(assetsDir, fileName);
      if (existsSync(filePath)) {
        combinedCss += readFileSync(filePath, 'utf-8');
        html = html.replace(m[0], '');
      }
    }
    
    if (combinedCss) {
      html = html.replace('</head>', `<style>${combinedCss}</style></head>`);
    }
    writeFileSync(indexPath, html);
    console.log('[BUILD] Critical CSS successfully inlined.');
  }

  if (existsSync('../admin/src')) {
    console.log('[BUILD] Starting admin build process...');
    execSync('bun run build', { cwd: '../admin', stdio: 'inherit' });

    console.log('[BUILD] Moving admin artifacts to frontend/dist/admin...');
    const dest = './dist/admin';
    if (existsSync(dest)) {
      rmSync(dest, { recursive: true, force: true });
    }
    renameSync('../admin/dist', dest);
  } else {
    console.log('[BUILD] Admin source not found; skipping admin build step.');
  }
  
  console.log('[BUILD] Monorepo build completed successfully.');
} catch (error) {
  console.error('[ERROR] Build failed:', error);
  process.exit(1);
}
// Trigger Vercel Build 10
