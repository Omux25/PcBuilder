import { getSql } from '../../../core/db/index.js';

/**
 * Loads all learned categories from the database.
 * Returns a Map of canonical_name -> category.
 */
export async function loadLearnedCategories(): Promise<Map<string, string>> {
    const sql = getSql();
    const rows = await sql`
        SELECT canonical_name, category
        FROM learned_categories
    ` as { canonical_name: string; category: string }[];
    
    const map = new Map<string, string>();
    for (const row of rows) {
        map.set(row.canonical_name, row.category);
    }
    return map;
}

/**
 * Saves a list of learned categories to the database.
 * Uses upsert to overwrite any existing learnings.
 */
export async function saveLearnedCategories(learnings: { canonical_name: string; category: string }[]): Promise<void> {
    if (learnings.length === 0) return;

    // Deduplicate learnings by canonical_name to prevent cardinality violation in PostgreSQL ON CONFLICT DO UPDATE
    const uniqueMap = new Map<string, { canonical_name: string; category: string }>();
    for (const item of learnings) {
        uniqueMap.set(item.canonical_name, item);
    }
    const uniqueLearnings = Array.from(uniqueMap.values());

    const sql = getSql();
    await sql`
        INSERT INTO learned_categories ${sql(uniqueLearnings)}
        ON CONFLICT (canonical_name) DO UPDATE SET
            category = EXCLUDED.category,
            created_at = NOW()
    `;
}
