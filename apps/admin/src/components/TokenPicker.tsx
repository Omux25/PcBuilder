/**
 * TokenPicker — renders a scraped product name as clickable word chips.
 *
 * Noise tokens (colors, packaging words, single chars) are greyed out.
 * Meaningful tokens are blue and clickable — clicking one opens an inline
 * panel to create a keyword rule for that token.
 *
 * Requirements: 10.1–10.6, 11.1–11.9
 */

import { useState } from 'react';
import { CATEGORY_ORDER, CATEGORY_LABELS } from '@shared/types';
import type { ComponentCategory } from '@shared/types';
import { createKeywordRule, previewKeywordRule, getErrorMessage} from '../api';
import type { KeywordRuleResponse } from '../api';

// ── Token classification ──────────────────────────────────────────────────────

const COLOR_TOKENS = new Set([
    'noir', 'blanc', 'black', 'white', 'blanche', 'noire',
    'rouge', 'red', 'blue', 'bleu', 'silver', 'argent', 'gold', 'or',
    'pink', 'rose', 'green', 'vert', 'purple', 'violet', 'grey', 'gray', 'gris',
]);

const NOISE_TOKENS = new Set([
    'kit', 'bundle', 'pack', 'combo', 'oem', 'retail', 'box',
    'edition', 'version', 'de', 'le', 'la', 'les', 'du', 'des', 'un', 'une',
    'avec', 'pour', 'and', 'the', 'with', 'for',
]);

export function classifyToken(token: string): 'noise' | 'meaningful' {
    if (token.length <= 1) return 'noise';
    const lower = token.toLowerCase();
    if (COLOR_TOKENS.has(lower) || NOISE_TOKENS.has(lower)) return 'noise';
    return 'meaningful';
}

// ── Match type labels ─────────────────────────────────────────────────────────

const MATCH_TYPE_LABELS: Record<string, string> = {
    word: 'Mot exact',
    contains: 'Contenu dans le nom',
    starts_with: 'Nom commence par',
    number_before: 'Nombre avant (ex: 240ML)',
};

type MatchType = 'contains' | 'word' | 'starts_with' | 'number_before';

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
    scrapedName: string;
    existingRuleKeywords?: Set<string>;
    onRuleSaved?: (rule: KeywordRuleResponse) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function TokenPicker({ scrapedName, existingRuleKeywords, onRuleSaved }: Props) {
    const [activeToken, setActiveToken] = useState<string | null>(null);
    const [matchType, setMatchType] = useState<MatchType>('word');
    const [category, setCategory] = useState<string>('');
    const [preview, setPreview] = useState<{ count: number; samples: string[] } | null>(null);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [previewPage, setPreviewPage] = useState(0);
    const PREVIEW_PAGE_SIZE = 5;
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const tokens = scrapedName.split(/\s+/).filter(Boolean);

    function handleTokenClick(token: string) {
        if (activeToken === token) {
            // Close if clicking same token
            setActiveToken(null);
            resetPanel();
            return;
        }
        setActiveToken(token);
        resetPanel();
    }

    function resetPanel() {
        setMatchType('word');
        setCategory('');
        setPreview(null);
        setPreviewPage(0);
        setError(null);
    }

    async function handlePreview() {
        if (!activeToken || !matchType) return;
        setPreviewLoading(true);
        setError(null);
        setPreview(null);
        try {
            const result = await previewKeywordRule({ keyword: activeToken, match_type: matchType });
            setPreview({ count: result.match_count, samples: result.sample_names });
            setPreviewPage(0);
        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            setPreviewLoading(false);
        }
    }

    async function handleSave() {
        if (!activeToken || !matchType || !category || !preview) return;
        setSaving(true);
        setError(null);
        try {
            const rule = await createKeywordRule({
                keyword: activeToken,
                match_type: matchType,
                category,
            });
            setActiveToken(null);
            resetPanel();
            onRuleSaved?.(rule);
        } catch (err) {
            const msg = getErrorMessage(err);
            if (msg.includes('409') || msg.includes('DUPLICATE')) {
                setError('Une règle pour ce mot + type + catégorie existe déjà.');
            } else {
                setError(msg);
            }
        } finally {
            setSaving(false);
        }
    }

    return (
        <div style={{ marginBottom: '12px' }}>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                Cliquez sur un mot pour créer une règle de catégorisation :
            </p>

            {/* Token chips */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                {tokens.map((token, i) => {
                    const type = classifyToken(token);
                    const isActive = activeToken === token;
                    const hasRule = existingRuleKeywords?.has(token.toLowerCase());

                    if (type === 'noise') {
                        return (
                            <span
                                key={i}
                                style={{
                                    padding: '3px 8px',
                                    borderRadius: '4px',
                                    fontSize: '12px',
                                    background: 'var(--surface-3)',
                                    color: 'var(--text-dim)',
                                    cursor: 'default',
                                    opacity: 0.6,
                                }}
                            >
                                {token}
                            </span>
                        );
                    }

                    return (
                        <button
                            key={i}
                            onClick={() => handleTokenClick(token)}
                            style={{
                                padding: '3px 8px',
                                borderRadius: '4px',
                                fontSize: '12px',
                                background: isActive ? 'var(--accent)' : 'rgba(137, 180, 250, 0.15)',
                                color: isActive ? '#fff' : 'var(--accent-blue)',
                                border: `1px solid ${isActive ? 'var(--accent)' : 'var(--accent-blue)'}`,
                                cursor: 'pointer',
                                position: 'relative',
                            }}
                            title={`Créer une règle pour "${token}"`}
                        >
                            {token}
                            {hasRule && (
                                <span
                                    style={{
                                        position: 'absolute',
                                        top: '-3px',
                                        right: '-3px',
                                        width: '7px',
                                        height: '7px',
                                        borderRadius: '50%',
                                        background: 'var(--success)',
                                    }}
                                    title="Une règle existe déjà pour ce mot"
                                />
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Inline panel for active token */}
            {activeToken && (
                <div style={{
                    background: 'var(--surface-2)',
                    border: '1px solid var(--border-2)',
                    borderRadius: 'var(--radius)',
                    padding: '12px',
                    marginTop: '4px',
                }}>
                    <p style={{ fontSize: '13px', fontWeight: 600, marginBottom: '10px' }}>
                        Règle pour : <span style={{ color: 'var(--accent-blue)' }}>"{activeToken}"</span>
                    </p>

                    {/* Match type */}
                    <div style={{ marginBottom: '10px' }}>
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>Type de correspondance :</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {(Object.entries(MATCH_TYPE_LABELS) as [MatchType, string][]).map(([value, label]) => (
                                <label key={value} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
                                    <input
                                        type="radio"
                                        name="match_type"
                                        value={value}
                                        checked={matchType === value}
                                        onChange={() => { setMatchType(value); setPreview(null); }}
                                        style={{ cursor: 'pointer' }}
                                    />
                                    {label}
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Category */}
                    <div style={{ marginBottom: '10px' }}>
                        <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                            Catégorie :
                        </label>
                        <select
                            value={category}
                            onChange={e => { setCategory(e.target.value); setPreview(null); }}
                            style={{
                                background: 'var(--surface-3)',
                                border: '1px solid var(--border-2)',
                                color: 'var(--text)',
                                padding: '5px 8px',
                                borderRadius: 'var(--radius)',
                                fontSize: '13px',
                                width: '100%',
                            }}
                        >
                            <option value="">— Sélectionner —</option>
                            {CATEGORY_ORDER.map(cat => (
                                <option key={cat} value={cat}>
                                    {CATEGORY_LABELS[cat as ComponentCategory] ?? cat}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Preview */}
                    <button
                        onClick={handlePreview}
                        disabled={!category || previewLoading}
                        style={{
                            background: 'var(--surface-3)',
                            color: 'var(--text)',
                            padding: '6px 12px',
                            borderRadius: 'var(--radius)',
                            fontSize: '12px',
                            marginBottom: '8px',
                            opacity: !category ? 0.5 : 1,
                        }}
                    >
                        {previewLoading ? 'Calcul...' : 'Prévisualiser l\'impact'}
                    </button>

                    {preview && (
                        <div style={{
                            background: 'rgba(34, 197, 94, 0.08)',
                            border: '1px solid var(--success)',
                            borderRadius: '4px',
                            padding: '8px 10px',
                            fontSize: '12px',
                            marginBottom: '8px',
                        }}>
                            <strong style={{ color: 'var(--success)' }}>
                                {preview.count} listing{preview.count !== 1 ? 's' : ''} affecté{preview.count !== 1 ? 's' : ''}
                            </strong>
                            {preview.samples.length > 0 && (() => {
                                const totalPages = Math.ceil(preview.samples.length / PREVIEW_PAGE_SIZE);
                                const start = previewPage * PREVIEW_PAGE_SIZE;
                                const pageSamples = preview.samples.slice(start, start + PREVIEW_PAGE_SIZE);
                                return (
                                    <>
                                        <ul style={{ margin: '4px 0 0 12px', color: 'var(--text-muted)' }}>
                                            {pageSamples.map((s, i) => (
                                                <li key={i} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s}</li>
                                            ))}
                                        </ul>
                                        {totalPages > 1 && (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', marginLeft: '12px' }}>
                                                <button
                                                    onClick={() => setPreviewPage(p => Math.max(0, p - 1))}
                                                    disabled={previewPage === 0}
                                                    style={{ background: 'none', color: 'var(--accent-blue)', fontSize: '11px', padding: '1px 4px', border: '1px solid var(--border-2)', borderRadius: '3px', opacity: previewPage === 0 ? 0.4 : 1 }}
                                                >
                                                    ‹
                                                </button>
                                                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                                    {start + 1}–{Math.min(start + PREVIEW_PAGE_SIZE, preview.samples.length)} / {preview.samples.length}
                                                    {preview.count > preview.samples.length && ` (${preview.count} total)`}
                                                </span>
                                                <button
                                                    onClick={() => setPreviewPage(p => Math.min(totalPages - 1, p + 1))}
                                                    disabled={previewPage >= totalPages - 1}
                                                    style={{ background: 'none', color: 'var(--accent-blue)', fontSize: '11px', padding: '1px 4px', border: '1px solid var(--border-2)', borderRadius: '3px', opacity: previewPage >= totalPages - 1 ? 0.4 : 1 }}
                                                >
                                                    ›
                                                </button>
                                            </div>
                                        )}
                                    </>
                                );
                            })()}
                        </div>
                    )}

                    {error && (
                        <p style={{ color: 'var(--danger)', fontSize: '12px', marginBottom: '8px' }}>{error}</p>
                    )}

                    <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                            onClick={() => { setActiveToken(null); resetPanel(); }}
                            style={{ background: 'var(--surface-3)', color: 'var(--text)', padding: '6px 12px', borderRadius: 'var(--radius)', fontSize: '12px' }}
                        >
                            Annuler
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={!preview || saving || !category}
                            style={{
                                background: preview && category ? 'var(--accent)' : 'var(--surface-3)',
                                color: preview && category ? '#fff' : 'var(--text-muted)',
                                padding: '6px 12px',
                                borderRadius: 'var(--radius)',
                                fontSize: '12px',
                                fontWeight: 600,
                                opacity: (!preview || !category) ? 0.5 : 1,
                            }}
                        >
                            {saving ? 'Enregistrement...' : 'Enregistrer la règle'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
