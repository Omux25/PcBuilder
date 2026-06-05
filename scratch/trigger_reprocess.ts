import { runSuggestionPreprocessing } from '../apps/backend/src/modules/scraping/services/suggestionPreprocessor';

async function run() {
  console.log("Starting forced preprocessor suggestion reprocessing in the database...");
  const result = await runSuggestionPreprocessing(true);
  console.log(`Success! Reprocessed results:`, result);
  process.exit(0);
}

run().catch((err) => {
  console.error("Reprocessing failed:", err);
  process.exit(1);
});
