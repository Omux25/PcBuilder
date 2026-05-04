/**
 * keywordRulesService.ts — Admin-configurable keyword→category rules.
 *
 * The `matchesRule` function is the single source of truth for matching logic.
 * Both the suggestion engine and the preview endpoint use it, guaranteeing
 * that preview match_count is accurate.
 *
 * Admin rules are loaded once per batch run by suggestionPreprocessor and
 * passed to the suggestion engine — no per-listing DB queries.
 *
 * Requirements: 1.1–1.3, 7.1, 7.7
 */

import { getSql } from '../db/index.js';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface KeywordRule {
    id: number;
    keyword: string;
    match_type: 'contains' | 'word' | 'starts_with' | 'number_before';
    category: string;
    source: 'admin' | 'builtin';
    created_by: number | null;
    created_at: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Escapes all special regex characters in a string so it can be safely
 * embedded in a RegExp constructor without unintended pattern behavior.
 */
export function escapeRegex(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ── Core matching function ────────────────────────────────────────────────────

/**
 * Tests whether a scraped product name matches a keyword rule.
 *
 * This is the single source of truth for matching logic — used by both
 * the suggestion engine and the preview endpoint.
 *
 * Match types:
 *   contains      — keyword appears anywhere (case-insensitive substring)
 *   word          — keyword appears as a whole word (word boundaries)
 *   starts_with   — name starts with keyword (case-insensitive)
 *   number_before — a number immediately precedes the keyword (e.g. ML → 240ML)
 *
 * Returns false on any regex error (malformed keyword) rather than throwing.
 * Pure function — no side effects, no I/O.
 *
 * Requirements: 1.1, 1.2, 1.3
 */
export function matchesRule(
    rule: Pick<KeywordRule, 'keyword' | 'match_type'>,
    name: string,
): boolean {
    try {
        const { keyword, match_type } = rule;
        const escaped = escapeRegex(keyword);

        switch (match_type) {
            case 'contains':
                return name.toLowerCase().includes(keyword.toLowerCase());

            case 'word':
                return new RegExp(`\\b${escaped}\\b`, 'i').test(name);

            case 'starts_with':
                return name.toLowerCase().startsWith(keyword.toLowerCase());

            case 'number_before':
                // Matches when one or more digits immediately precede the keyword
                // e.g. keyword="ML" matches "240ML", "360ML" but NOT "ML" alone or "HTML"
                return new RegExp(`\\d+${escaped}\\b`, 'i').test(name);

            default:
                return false;
        }
    } catch {
        // Malformed keyword or regex error — fail safe, never crash the engine
        return false;
    }
}

// ── DB access ─────────────────────────────────────────────────────────────────

/**
 * Loads all admin-created keyword rules from the database.
 * Called once per batch run by suggestionPreprocessor.
 *
 * Only loads source='admin' rules — built-in rules are handled by the
 * hardcoded KEYWORD_SETS in suggestionEngine.ts (they are in the DB for
 * display purposes only, not for runtime use).
 *
 * Requirements: 7.1, 7.7
 */
export async function loadAdminRules(): Promise<KeywordRule[]> {
    const sql = getSql();
    return sql`
    SELECT id, keyword, match_type, category, source, created_by, created_at
    FROM keyword_rules
    WHERE source = 'admin'
    ORDER BY created_at DESC
  ` as Promise<KeywordRule[]>;
}
