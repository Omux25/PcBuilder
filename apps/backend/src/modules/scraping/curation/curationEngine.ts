import { type SqlFn } from '../../../core/db/index.js';
import { logger } from '../engine/utils/logger.js';

// Curation tasks
import { cleanMotherboardMpns } from './tasks/cleanMotherboardMpns.js';
import { rescueGpus } from './tasks/rescueGpus.js';
import { purgeFakeCases } from './tasks/purgeFakeCases.js';
import { fixStorageCapacities } from './tasks/fixStorageCapacities.js';
import { fixStragglers } from './tasks/fixStragglers.js';
import { remediateCategories } from './tasks/remediateCategories.js';
import { cleanupLegacyMatches } from './tasks/cleanupLegacyMatches.js';
import { globalBackfill } from './tasks/globalBackfill.js';
import { recleanCases } from './tasks/recleanCases.js';
import { fixPollutions } from './tasks/fixPollutions.js';

export interface TaskResult {
  success: boolean;
  mutatedCount: number;
  message?: string;
}

export interface PipelineTask {
  id: string;
  name: string;
  description: string;
  run: (sql: SqlFn) => Promise<TaskResult>;
}

const CURATION_TASKS: PipelineTask[] = [
  {
    id: 'motherboard_mpns',
    name: 'Motherboard MPN Sanitizer',
    description: 'Purging generic manufacturer MPNs and duplicate barcode collisions',
    run: cleanMotherboardMpns
  },
  {
    id: 'gpu_rescue',
    name: 'GPU RAM-Category Rescue',
    description: 'Moving misclassified GPU items out of the RAM category',
    run: rescueGpus
  },
  {
    id: 'fake_cases',
    name: 'Fake Case Purger',
    description: 'Re-routing cooling/fans/paste out of the case catalog',
    run: purgeFakeCases
  },
  {
    id: 'storage_capacities',
    name: 'Storage Capacity Normalizer',
    description: 'Correcting TB/GB factor-of-1000 capacity errors',
    run: fixStorageCapacities
  },
  {
    id: 'stragglers',
    name: 'Category Stragglers & Brand Normalizer',
    description: 'Fixing Cougar/Hybrok stragglers and cleaning Setup Game branding',
    run: fixStragglers
  },
  {
    id: 'category_remediation',
    name: 'Weighted Category Remediation',
    description: 'Performing multi-identifier weighted voting category check',
    run: remediateCategories
  },
  {
    id: 'legacy_sanitation',
    name: 'Legacy Match Sanitizer',
    description: 'Pruning low-confidence scraper mappings (<95% hardware score)',
    run: cleanupLegacyMatches
  },
  {
    id: 'global_backfill',
    name: 'GPU Spec Knowledge Backfill',
    description: 'Healing missing GPU physical clearances using knowledge base',
    run: globalBackfill
  },
  {
    id: 'case_name_cleaning',
    name: 'Case Name Recleaner',
    description: 'Standardizing case catalog names using master clean rules',
    run: recleanCases
  },
  {
    id: 'catalog_splitting',
    name: 'Catalog Price-Variance Splitter',
    description: 'Splitting polluted master components using pricing deltas',
    run: fixPollutions
  }
];

export async function runCurationPipeline(sql: SqlFn, targetTaskId?: string): Promise<void> {
  console.log('\n🏁 Starting Unified In-Process Database Curation Pipeline...');
  await logger.info('[CURATION] Starting Unified In-Process Database Curation Pipeline...');

  const startTime = Date.now();
  let totalMutated = 0;

  const tasksToRun = targetTaskId
    ? CURATION_TASKS.filter(t => t.id === targetTaskId)
    : CURATION_TASKS;

  if (targetTaskId && tasksToRun.length === 0) {
    console.error(`❌ Targeted task ID "${targetTaskId}" not found in Pipeline Registry.`);
    return;
  }

  for (let i = 0; i < tasksToRun.length; i++) {
    const task = tasksToRun[i];
    const prefix = `  [${i + 1}/${tasksToRun.length}]`;
    console.log(`${prefix} Running: ${task.name}...`);
    
    const start = Date.now();
    try {
      const result = await task.run(sql);
      const elapsed = ((Date.now() - start) / 1000).toFixed(2);
      
      if (result.success) {
        console.log(`     ✅ Completed | Mutated rows: ${result.mutatedCount} | Time: ${elapsed}s`);
        if (result.message) console.log(`     ↳ ${result.message}`);
        
        await logger.info(`[CURATION] ${task.name} succeeded. Mutated: ${result.mutatedCount} | Duration: ${elapsed}s`);
        totalMutated += result.mutatedCount;
      } else {
        console.warn(`     ⚠️ Completed with warning: ${result.message}`);
        await logger.warn(`[CURATION] ${task.name} finished with warnings: ${result.message}`);
      }
    } catch (err: any) {
      console.error(`     ❌ Execution failed: ${err.message}`);
      await logger.error(`[CURATION] Task ${task.name} failed: ${err.message}`);
      throw err;
    }
  }

  const elapsedTotal = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n🎉 Pipeline execution completed successfully!`);
  console.log(`   Total execution time: ${elapsedTotal}s`);
  console.log(`   Total mutated rows:   ${totalMutated}\n`);
  
  await logger.info(`[CURATION] Pipeline execution completed successfully in ${elapsedTotal}s. Total mutated: ${totalMutated}`);
}
