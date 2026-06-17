import { execSync } from 'child_process';
import { renameSync, rmSync, existsSync, readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';

try {
  console.log('🚀 Building frontend...');
  execSync('vite build', { stdio: 'inherit' });

  console.log('🎨 Inlining CSS to remove render-blocking requests...');
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
    console.log('✨ Critical CSS inlined successfully.');
  }

  if (existsSync('../admin/src')) {
    console.log('🚀 Building admin...');
    execSync('bun run build', { cwd: '../admin', stdio: 'inherit' });

    console.log('📦 Moving admin build to frontend/dist/admin...');
    const dest = './dist/admin';
    if (existsSync(dest)) {
      rmSync(dest, { recursive: true, force: true });
    }
    renameSync('../admin/dist', dest);
  } else {
    console.log('⚠️ admin source not found at ../admin/src, skipping admin build');
  }
  
  console.log('✅ Monorepo build complete! Frontend and Admin successfully bundled.');
} catch (error) {
  console.error('❌ Build failed:', error);
  process.exit(1);
}
// Trigger Vercel Build 6
