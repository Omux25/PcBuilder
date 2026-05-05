/**
 * Shared Scraper & Matcher Configuration.
 */

export const SCRAPER_CONFIG = {
  // Categories where a partial DNA match (0.8) is acceptable.
  // Case and cooling have simpler DNA — model name tokens — so 0.8 is safe.
  // All other categories require a perfect 1.0 match to avoid false positives.
  PARTIAL_MATCH_CATEGORIES: ['case', 'cooling'],
  PARTIAL_THRESHOLD: 0.8,
  PERFECT_THRESHOLD: 1.0,

  // Retailer base URLs — used to look up IDs dynamically from the DB at runtime.
  // base_url has a UNIQUE constraint so it's a reliable identifier.
  // Never hardcode IDs — they differ between machines/environments.
  RETAILER_BASE_URLS: {
    ULTRAPC: 'https://www.ultrapc.ma',
    NEXTLEVEL: 'https://nextlevelpc.ma',
    SETUPGAME: 'https://setupgame.ma',
  }
};
