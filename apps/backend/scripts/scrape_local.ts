import { PrismaClient } from '@prisma/client';
import { PcGamerCasaScraper } from '../src/modules/scraping/engine/scrapers/pcgamercasaScraper';
import { syncCatalog } from '../src/modules/scraping/engine/sync';

const prisma = new PrismaClient();

async function main() {
    console.log('🚀 Starting Local Scraper for PC Gamer Casa...');
    console.log('⏳ Connecting directly via your local IP to bypass Cloudflare...');

    // 1. Get Retailer ID
    const retailer = await prisma.retailer.findUnique({
        where: { name: 'PC Gamer Casa' }
    });

    if (!retailer) {
        throw new Error('Retailer "PC Gamer Casa" not found in database.');
    }

    console.log(`✅ Found retailer ID: ${retailer.id}`);

    // 2. Scrape Prices
    const scraper = new PcGamerCasaScraper();
    console.log('📡 Scraping prices from pcgamercasa.ma...');
    const prices = await scraper.scrapeAllCategories(retailer.id);
    
    console.log(`✅ Scraped ${prices.length} products successfully!`);

    // 3. Sync to Database
    console.log('🔄 Syncing prices to live production database...');
    const result = await syncCatalog(prices, retailer.id);
    
    console.log('=============================================');
    console.log('🎉 SYNC COMPLETE!');
    console.log(`- Inserted/Updated: ${result.updated}`);
    console.log(`- Unmatched: ${result.unmatched}`);
    console.log(`- Errors: ${result.errors}`);
    console.log('=============================================');
}

main()
    .catch((e) => {
        console.error('❌ Scraping failed:', e.message);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
