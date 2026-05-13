import { runScrapingSession } from './modules/scraping/engine/session.js';

console.log('🚀 Starting global scraping session...');
runScrapingSession()
  .then(() => {
    console.log('✅ Global scraping session complete');
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Global scraping session failed:', err);
    process.exit(1);
  });
