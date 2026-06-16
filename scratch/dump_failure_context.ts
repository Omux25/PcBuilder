import { readFile } from 'node:fs/promises';

async function main() {
  const content = (await readFile('C:/Headquarters/Projects/PcBuilder/scratch/test_run.log')).toString('utf-16le');
  const lines = content.split('\n');
  
  console.log('Searching for "1 tests failed:" in log...');
  const idx = lines.findIndex(l => l.includes('1 tests failed:'));
  
  if (idx === -1) {
    console.log('Could not find the "1 tests failed:" line.');
    return;
  }
  
  console.log(`Found summary at line ${idx + 1}. Printing surrounding lines...`);
  for (let i = Math.max(0, idx - 80); i <= Math.min(lines.length - 1, idx + 20); i++) {
    const cleanLine = lines[i].replace(/\u001b\[\d+m/g, '').trim();
    console.log(`${i + 1}: ${cleanLine}`);
  }
}

main().catch(console.error);
