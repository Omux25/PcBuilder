// Probe script: inspect what spec data is embedded in PrestaShop product pages
// Run: bun run src/scripts/_probe_prestashop_specs.ts

const URLS = [
  'https://www.ultrapc.ma/boitier-pc/8049-deepcool-sc790.html',
  'https://pcgamercasa.ma/mid-tower/1788-corsair-icue-4000x.html',
];

async function probe(url: string) {
  console.log(`\n=== ${url} ===`);
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept-Language': 'fr-MA,fr;q=0.9',
    },
    signal: AbortSignal.timeout(15_000),
  });
  console.log('Status:', res.status);
  if (!res.ok) return;

  const html = await res.text();

  // Extract PrestaShop data-product blob
  const m = html.match(/data-product="([^"]+)"/);
  if (m) {
    const decoded = m[1]
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/&#39;/g, "'");
    try {
      const data = JSON.parse(decoded);
      const features: { name: string; value: string }[] = data.features || [];
      console.log('PrestaShop features:', features.length);
      for (const f of features.slice(0, 40)) {
        console.log(`  - ${f.name}: ${f.value}`);
      }
    } catch (e) {
      console.log('JSON parse error:', e);
    }
  } else {
    console.log('No data-product blob found');
  }

  // Check if there is any readable text with mm or ATX on the page
  const stripped = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  const up = stripped.toUpperCase();
  for (const kw of ['ATX', 'ITX', 'VENTIRAD', 'COOLER', 'HAUTEUR', 'MM']) {
    const i = up.indexOf(kw);
    if (i >= 0) {
      console.log(`  [TEXT] ${kw}: ...${stripped.substring(Math.max(0, i - 30), i + 80).trim()}...`);
    }
  }
}

for (const url of URLS) {
  await probe(url);
}
