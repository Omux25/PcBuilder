
import { buildFromUnmatched } from '../modules/scraping/engine/catalogBuilder.js';

async function rebuild() {
  console.log('--- RUNNING CATALOG BUILDER ---');
  await buildFromUnmatched((done, total) => {
    if (done % 10 === 0 || done === total) {
      console.log(`Progress: ${done}/${total}`);
    }
  });
}

rebuild().catch(console.error);
