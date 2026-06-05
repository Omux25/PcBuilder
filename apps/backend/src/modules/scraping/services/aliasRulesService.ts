/**
 * aliasRulesService.ts — Database-backed catalog alias & typo correction rules.
 *
 * Provides database query functions to load dynamic string/regex replacement rules
 * used by the Suggestion Engine during batch pre-processing.
 */

import { getSql } from '../../../core/db/index.js';

export interface AliasRule {
    id: number;
    pattern: string;
    replacement: string;
    category: string | null;
    is_regex: boolean;
    created_at: string;
}

/**
 * Loads all active alias rules from the database, sorted chronologically.
 * Called once per batch run by suggestionPreprocessor and passed down to
 * the Suggestion Engine.
 */
export async function loadAliasRules(): Promise<AliasRule[]> {
    const sql = getSql();
    return sql`
        SELECT id, pattern, replacement, category, is_regex, created_at
        FROM alias_rules
        ORDER BY created_at ASC
    ` as Promise<AliasRule[]>;
}
