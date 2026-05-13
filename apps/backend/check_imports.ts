import { readdir, readFile, stat } from 'node:fs/promises';
import { join, dirname, resolve } from 'node:path';

async function walk(dir: string, fileList: string[] = []): Promise<string[]> {
  const files = await readdir(dir);
  for (const file of files) {
    const path = join(dir, file);
    if ((await stat(path)).isDirectory()) {
      await walk(path, fileList);
    } else if (path.endsWith('.ts') && !path.endsWith('.d.ts')) {
      fileList.push(path);
    }
  }
  return fileList;
}

async function checkImports() {
  const srcDir = resolve('src');
  const files = await walk(srcDir);
  let totalErrors = 0;

  for (const file of files) {
    const content = await readFile(file, 'utf-8');
    const lines = content.split('\n');
    const dir = dirname(file);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Match relative imports: import ... from './...' or import ... from '../...'
      const match = line.match(/from\s+['"](\.\.?\/[^'"]+)['"]/);
      if (match) {
        let importPath = match[1];
        
        // Remove .js extension for checking .ts files
        if (importPath.endsWith('.js')) {
          importPath = importPath.slice(0, -3);
        }

        const fullPath = resolve(dir, importPath);
        const possiblePaths = [
          fullPath + '.ts',
          join(fullPath, 'index.ts'),
          fullPath // for directories or other extensions
        ];

        let found = false;
        for (const p of possiblePaths) {
          try {
            await stat(p);
            found = true;
            break;
          } catch {}
        }

        if (!found) {
          console.error(`ERROR: Cannot find module '${match[1]}' in ${file}:${i + 1}`);
          totalErrors++;
        }
      }
    }
  }

  if (totalErrors === 0) {
    console.log('SUCCESS: All relative imports resolved.');
  } else {
    console.log(`FAILED: Found ${totalErrors} broken imports.`);
    process.exit(1);
  }
}

checkImports().catch(console.error);
