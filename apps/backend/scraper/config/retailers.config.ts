/**
 * Retailer scraper configuration — single source of truth.
 *
 * Each entry maps a retailer by NAME to its scraper implementation.
 * The session runner resolves the actual DB id at runtime by querying
 * the retailers table — so IDs never need to be hardcoded here.
 *
 * To add a new retailer:
 *   1. Add a row to the `retailers` table (via admin panel)
 *   2. Create a scraper class in scrapers/ (or reuse an existing adapter)
 *   3. Add an entry here using the exact name from the DB
 *
 * The session runner reads this config — no changes to session.ts needed.
 */

import { UltraPcScraper } from '../scrapers/ultrapcScraper.js';
import { NextLevelScraper } from '../scrapers/nextlevelScraper.js';
import { SetupGameScraper } from '../scrapers/setupgameScraper.js';
import type { ScrapedPrice } from '../scrapers/baseScraper.js';

export interface RetailerScraperConfig {
    /**
     * The retailer's base URL — must match the `base_url` column in the `retailers` table.
     * Used to look up the actual DB id at runtime. More stable than name since it's
     * tied to the domain the scraper was written for.
     */
    baseUrl: string;
    /** Human-readable name — used in log messages */
    name: string;
    /** Factory function that runs the scraper and returns all scraped prices */
    run: (retailer_id: number) => Promise<ScrapedPrice[]>;
}

/** Resolved config — same as RetailerScraperConfig but with the actual DB id attached */
export interface ResolvedRetailerScraperConfig extends RetailerScraperConfig {
    retailer_id: number;
}

/**
 * All active retailer scrapers, keyed by base URL.
 * IDs are resolved dynamically from the DB at session start.
 */
export const RETAILER_SCRAPERS: RetailerScraperConfig[] = [
    {
        baseUrl: 'https://www.ultrapc.ma',
        name: 'UltraPC',
        run: (retailer_id: number) => new UltraPcScraper().scrapeAllCategories(retailer_id),
    },
    {
        baseUrl: 'https://nextlevelpc.ma',
        name: 'NextLevel PC',
        run: (retailer_id: number) => new NextLevelScraper().scrapeAllCategories(retailer_id),
    },
    {
        baseUrl: 'https://setupgame.ma',
        name: 'SetupGame',
        run: (retailer_id: number) => new SetupGameScraper().scrapeAllCategories(retailer_id),
    },
];
