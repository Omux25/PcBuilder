import { extractDna, scoreDnaMatch } from '../src/utils/componentMatcher.js';

const tests = [
  { catalog: 'SSD Samsung EVO 1TB', scraped: 'TeamGroup T-FORCE CARDEA A440 M.2 PCIe 4.0 NVMe 1TB' },
  { catalog: 'SSD Samsung EVO 1TB', scraped: 'Lexar NS100 1TB' },
  { catalog: 'SSD Samsung EVO 1TB', scraped: 'PNY CS900 1TB' },
  { catalog: 'SSD Samsung EVO 1TB', scraped: 'WD Red NAS 3.5" 1TB' },
  { catalog: 'Samsung 870 EVO 1TB SATA SSD', scraped: 'Samsung 870 EVO 1TB SATA SSD' },
];

for (const t of tests) {
  const dna = extractDna(t.catalog, 'storage');
  const { score } = scoreDnaMatch(t.scraped, t.catalog, 'storage');
  console.log(`\nCatalog: "${t.catalog}"`);
  console.log(`DNA: ${JSON.stringify(dna)}`);
  console.log(`Scraped: "${t.scraped}"`);
  console.log(`Score: ${score}`);
}
process.exit(0);
