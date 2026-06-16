import { readFile } from 'node:fs/promises';

async function main() {
  const content = (await readFile('C:/Headquarters/Projects/PcBuilder/scratch/test_run.log')).toString('utf-16le');
  const lines = content.split('\n');
  
  console.log('Extracting all file paths/headers from log...');
  
  const files = new Set<string>();
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].replace(/\u001b\[\d+m/g, '').trim();
    
    // In Bun test output, a file name is printed on a line ending with a colon, or containing path slashes
    if ((line.endsWith(':') || line.endsWith('.ts') || line.endsWith('.js')) && 
        (line.includes('\\') || line.includes('/')) && 
        !line.includes(' at ') && 
        !line.includes('[logger]') && 
        !line.includes('Failed page')) {
      files.add(line);
    }
  }
  
  console.log(`Found ${files.size} file entries:`);
  for (const f of Array.from(files).sort()) {
    console.log(`- ${f}`);
  }
}

main().catch(console.error);
