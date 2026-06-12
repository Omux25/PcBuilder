import { execSync } from 'child_process';
import { renameSync, rmSync, existsSync } from 'fs';
import { join } from 'path';

try {
  console.log('🚀 Building frontend...');
  execSync('vite build', { stdio: 'inherit' });

  console.log('🚀 Building admin...');
  execSync('bun run build', { cwd: '../admin', stdio: 'inherit' });

  console.log('📦 Moving admin build to frontend/dist/admin...');
  const dest = './dist/admin';
  if (existsSync(dest)) {
    rmSync(dest, { recursive: true, force: true });
  }
  renameSync('../admin/dist', dest);
  
  console.log('✅ Monorepo build complete! Frontend and Admin successfully bundled.');
} catch (error) {
  console.error('❌ Build failed:', error);
  process.exit(1);
}
