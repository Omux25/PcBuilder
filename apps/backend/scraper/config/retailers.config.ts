/**
 * Retailer scraper configuration — single source of truth.
 *
 * Each entry maps a retailer DB id to its scraper implementation.
 * To add a new retailer:
 *   1. Add a row to the `retailers` table (via migration or admin panel)
 *   2. Create a scraper class in scrapers/ (or reuse an existing adapter)
 *   3. Add an entry here
 *
 * The session runner reads this config — no changes to session.ts needed.
 */

import { UltraPcScraper } from '../scrapers/ultrapcScraper.js';
import { NextLevelScraper } from '../scrapers/nextlevelScraper.js';
import { SetupGameScraper } from '../scrapers/setupgameScraper.js';
import type { ScrapedPrice } from '../scrapers/baseScraper.js';

export interface RetailerScraperConfig {
    /** Must match the `id` column in the `retailers` table */
    retailer_id: number;
    /** Human-readable name — used in log messages */
    name: string;
    /** Factory function that runs the scraper and returns all scraped prices */
    run: () => Promise<ScrapedPrice[]>;
}

/**
 * All active retailer scrapers.
 * Retailer IDs match the actual rows in the `retailers` table.
 */
export const RETAILER_SCRAPERS: RetailerScraperConfig[] = [
    {
        retailer_id: 10,
        name: 'UltraPC',
        run: () => new UltraPcScraper().scrapeAllCategories(),
    },
    {
        retailer_id: 11,
        name: 'NextLevel PC',
        run: () => new NextLevelScraper().scrapeAllCategories(),
    },
    {
        retailer_id: 13,
        name: 'SetupGame',
        run: () => new SetupGameScraper().scrapeAllCategories(),
    },
];
