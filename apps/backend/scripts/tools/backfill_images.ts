/**
 * Backfill images for all components that have prices but no image.
 * Scrapes UltraPC and SetupGame (fast JSON APIs) in parallel,
 * then NextLevel sequentially (HTML scraper, rate-limited).
 *
 * Run this whenever components are missing images:
 *   bun run scripts/tools/backfill_images.ts
 */
import { sql as bunSql } from 'bun';
import { UltraPcScraper } from '../../scraper/scrapers/ultrapcScraper.js';
import { SetupGameScraper } from '../../scraper/scrapers/setupgameScraper.js';
import { NextLevelScraper } from '../../scraper/scrapers/nextlevelScraper.js';
import { scoreImageQuality } from '@shared/image-utils';

console.log('🖼️  Image Backfill Tool\n');
const startTime = Date.now();

async function applyImages(imageByUrl: Map<string, string>, label: string) {
    if (imageByUrl.size === 0) return 0;

    // Load ALL mappings for components without images, then match in memory
    // (avoids passing huge URL arrays to PostgreSQL)
    const mappings = await bunSql`
    SELECT sm.component_id, sm.product_url, c.name as component_name
    FROM scraper_mappings sm
    JOIN components c ON c.id = sm.component_id
    WHERE c.image_url IS NULL AND c.is_active = true
  ` as { component_id: number; product_url: string; component_name: string }[];

    const bestImages = new Map<number, { url: string; score: number }>();
    for (const m of mappings) {
        const imageUrl = imageByUrl.get(m.product_url);
        if (!imageUrl) continue;
        const score = scoreImageQuality(imageUrl, m.component_name);
        if (score < 0) continue; // Skip only truly bad images (placeholders)
        const existing = bestImages.get(m.component_id);
        if (!existing || score > existing.score) bestImages.set(m.component_id, { url: imageUrl, score });
    }

    let updated = 0;
    for (const [id, img] of bestImages) {
        await bunSql`UPDATE components SET image_url = ${img.url} WHERE id = ${id} AND image_url IS NULL`;
        updated++;
    }

    const stats = await bunSql`SELECT COUNT(*) as total, COUNT(image_url) as with_images FROM components WHERE is_active = true` as any[];
    const pct = Math.round(parseInt(stats[0].with_images) / parseInt(stats[0].total) * 100);
    console.log(`   ${label}: +${updated} images → coverage now ${stats[0].with_images}/${stats[0].total} (${pct}%)`);
    return updated;
}

// Phase 1: UltraPC + SetupGame in parallel (fast JSON APIs)
console.log('🔄 Phase 1: UltraPC + SetupGame (parallel)...');
const [ultrapcPrices, setupgamePrices] = await Promise.all([
    new UltraPcScraper().scrapeAllCategories(1).then(p => { process.stdout.write(`   ✅ UltraPC: ${p.length} products\n`); return p; }),
    new SetupGameScraper().scrapeAllCategories(3).then(p => { process.stdout.write(`   ✅ SetupGame: ${p.length} products\n`); return p; }),
]);

const phase1Map = new Map<string, string>();
for (const p of [...ultrapcPrices, ...setupgamePrices]) {
    if (p.image_url && p.product_url) phase1Map.set(p.product_url, p.image_url);
}
await applyImages(phase1Map, 'UltraPC + SetupGame');

// Phase 2: NextLevel (sequential, rate-limited)
console.log('\n🔄 Phase 2: NextLevel (sequential, may take 2-3 min)...');
try {
    const nextlevelPrices = await new NextLevelScraper().scrapeAllCategories(2);
    console.log(`   ✅ NextLevel: ${nextlevelPrices.length} products`);
    const phase2Map = new Map<string, string>();
    for (const p of nextlevelPrices) {
        if (p.image_url && p.product_url) phase2Map.set(p.product_url, p.image_url);
    }
    await applyImages(phase2Map, 'NextLevel');
} catch (err) {
    console.error(`   ❌ NextLevel failed: ${err}`);
    console.log('   (UltraPC + SetupGame images were still applied)');
}

const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
console.log(`\n⏱️  Total time: ${elapsed}s`);
console.log('✅ Done!\n');
process.exit(0);
