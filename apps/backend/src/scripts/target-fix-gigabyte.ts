import { getSql } from '../core/db/index.js';
import { scrapeProductPage } from '../modules/scraping/utils/deepScraper.js';
import { normalizeEfficiencyRating, normalizeModularity, normalizePsuFormFactor } from '@shared/hardware/specs/psu';

async function main() {
  const sql = getSql();

  const targets = [
    {
      id: 5675,
      urls: [
        "https://www.ultrapc.ma/entre-500-w-et-599-w/10030-gigabyte-p550ss-550w-silver.html",
        "https://nextlevelpc.ma/alimentation-pc-psu/94761-gigabyte-p550ss-550w-silver.html"
      ]
    },
    {
      id: 5677,
      urls: [
        "https://www.ultrapc.ma/entre-600-w-et-699-w/10024-gigabyte-p650ss-650w-silver.html",
        "https://nextlevelpc.ma/alimentation-pc-psu/94759-gigabyte-p650ss-650w-silver.html"
      ]
    }
  ];

  for (const target of targets) {
    console.log(`\n======================================================`);
    console.log(`Processing Component ID: ${target.id}`);
    
    let resolvedSpecs: any = null;
    for (const url of target.urls) {
      console.log(`Attempting to scrape URL: ${url}`);
      try {
        const specs = await scrapeProductPage(url, 'psu');
        if (specs) {
          console.log(`Scraped successfully from: ${url}`);
          console.log('Raw scraped specs:', specs);
          resolvedSpecs = specs;
          break;
        }
      } catch (err) {
        console.error(`Failed to scrape ${url}:`, err);
      }
    }

    if (resolvedSpecs) {
      const updates: Record<string, any> = {};
      
      const wattage = resolvedSpecs.wattage || null;
      const efficiency = normalizeEfficiencyRating(resolvedSpecs.efficiency || resolvedSpecs.efficiency_rating);
      const modularity = normalizeModularity(resolvedSpecs.modularity || resolvedSpecs.modular);
      const formFactor = normalizePsuFormFactor(resolvedSpecs.form_factor || resolvedSpecs.psu_form_factor);

      if (wattage) updates.wattage = wattage;
      if (efficiency) updates.efficiency_rating = efficiency;
      if (modularity) updates.modular = modularity;
      if (formFactor) updates.psu_form_factor = formFactor;

      console.log('Prepared database updates:', updates);

      if (Object.keys(updates).length > 0) {
        await sql`
          UPDATE components 
          SET ${sql(updates)}, updated_at = NOW() 
          WHERE id = ${target.id}
        `;
        console.log(`Successfully updated component ${target.id}!`);
      } else {
        console.log('No updates prepared.');
      }
    } else {
      console.log(`Could not scrape any specs for component ${target.id}`);
    }
  }

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
