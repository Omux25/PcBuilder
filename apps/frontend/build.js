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
    const files = readdirSync(assetsDir);
    const cssFiles = files.filter(f => f.endsWith('.css'));
    
    let combinedCss = '';
    for (const file of cssFiles) {
      combinedCss += readFileSync(join(assetsDir, file), 'utf-8');
      const linkRegex = new RegExp(`<link[^>]*href="/assets/${file}"[^>]*>`, 'g');
      html = html.replace(linkRegex, '');
    }
    html = html.replace('</head>', `<style>${combinedCss}</style></head>`);
    writeFileSync(indexPath, html);
    console.log('✨ CSS inlined successfully.');
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
