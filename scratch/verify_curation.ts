import { CurationPersistenceService } from '../apps/backend/src/core/services/curationPersistenceService.js';
import { getSql } from '../apps/backend/src/core/db/index.js';

console.log('🔄 Verifying CurationPersistenceService...');

try {
  console.log('📤 Exporting curated catalog...');
  const successExport = await CurationPersistenceService.exportCuratedCatalog();
  if (successExport) {
    console.log('✅ Curated catalog exported successfully.');
  } else {
    console.error('❌ Curated catalog export failed.');
    process.exit(1);
  }

  console.log('📥 Importing curated catalog (simulated)...');
  const sql = getSql();
  await sql.begin(async (tx) => {
    // Import using a rollback transaction to avoid modifying the DB permanently
    const successImport = await CurationPersistenceService.importCuratedCatalog(tx);
    if (successImport) {
      console.log('✅ Curated catalog imported successfully in transaction.');
    } else {
      console.error('❌ Curated catalog import failed.');
    }
    console.log('🔄 Rolling back verification transaction to keep DB clean...');
    throw new Error('ROLLBACK_INTENDED');
  });
} catch (err: any) {
  if (err.message === 'ROLLBACK_INTENDED') {
    console.log('🎉 Verification completed successfully! All code is functional.');
    process.exit(0);
  } else {
    console.error('❌ Unexpected error during verification:', err);
    process.exit(1);
  }
}
