import { getSql } from '../../../core/db/index.js';
import type { HardwareCache, ResolvedSpecs } from '@shared/hardware/services/dynamicEnrichment';

/**
 * Backend implementation of the HardwareCache interface using PostgreSQL.
 */
export const dbHardwareCache: HardwareCache = {
  async get(queryString: string): Promise<ResolvedSpecs | null> {
    const sql = getSql();
    try {
      const [row] = await sql`
        SELECT resolved_specs FROM hardware_knowledge_cache
        WHERE query_string = ${queryString}
      ` as { resolved_specs: ResolvedSpecs }[];
      return row?.resolved_specs || null;
    } catch (error) {
      console.error('Error fetching from hardware_knowledge_cache:', error);
      return null;
    }
  },

  async set(queryString: string, hardwareType: string, specs: ResolvedSpecs): Promise<void> {
    const sql = getSql();
    try {
      await sql`
        INSERT INTO hardware_knowledge_cache (hardware_type, query_string, resolved_specs)
        VALUES (${hardwareType}, ${queryString}, ${specs})
        ON CONFLICT (query_string) DO UPDATE 
        SET resolved_specs = EXCLUDED.resolved_specs,
            hardware_type = EXCLUDED.hardware_type
      `;
    } catch (error) {
      console.error('Error saving to hardware_knowledge_cache:', error);
    }
  }
};
