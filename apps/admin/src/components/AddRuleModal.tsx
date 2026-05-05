/**
 * AddRuleModal — standalone modal for creating keyword rules from the
 * Keyword Rules admin page.
 *
 * Contains: keyword input, match type radio buttons (plain-language labels),
 * category dropdown, Preview button, Save button (disabled until preview run).
 *
 * Requirements: 14.1–14.8
 */

import { useState } from 'react';
import { Modal } from './Modal';
import { CATEGORY_ORDER, CATEGORY_LABELS } from '@shared/types';
import type { ComponentCategory } from '@shared/types';
import { createKeywordRule, previewKeywordRule, reprocessSuggestions, getErrorMessage} from '../api';
import type { KeywordRuleResponse } from '../api';
import styles from './Form.module.css';

type MatchType = 'contains' | 'word' | 'starts_with' | 'number_before';

const MATCH_TYPE_LABELS: Record<MatchType, string> = {
    word: 'Mot exact — "AK400" correspond à "DeepCool AK400" mais pas "AK4000"',
    contains: 'Contenu dans le nom — "liquid" correspond à tout nom contenant ce mot',
    starts_with: 'Nom commence par — le nom du produit doit commencer par ce mot',
    number_before: 'Nombre avant — "ML" correspond à "240ML", "360ML" (tailles de radiateur)',
};

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (rule: KeywordRuleResponse) => void;
}

export function AddRuleModal({ isOpen, onClose, onSuccess }: Props) {
    const [keyword, setKeyword] = useState('');
    const [matchType, setMatchType] = useState<MatchType>('word');
    const [category, setCategory] = useState('');
    const [preview, setPreview] = useState<{ count: number; samples: string[] } | null>(null);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [previewPage, setPreviewPage] = useState(0);
    const PREVIEW_PAGE_SIZE = 5;
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    function reset() {
        setKeyword('');
        setMatchType('word');
        setCategory('');
        setPreview(null);
        setPreviewPage(0);
        setError(null);
    }

    function handleClose() {
        reset();
        onClose();
    }

    async function handlePreview() {
        const kw = keyword.trim();
        if (!kw || !matchType) return;
        setPreviewLoading(true);
        setError(null);
        setPreview(null);
        try {
            const result = await previewKeywordRule({ keyword: kw, match_type: matchType });
            setPreview({ count: result.match_count, samples: result.sample_names });
            setPreviewPage(0);
        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            setPreviewLoading(false);
        }
    }

    async function handleSave() {
        const kw = keyword.trim();
        if (!kw || !matchType || !category || !preview) return;
        setSaving(true);
        setError(null);
        try {
            const rule = await createKeywordRule({ keyword: kw, match_type: matchType, category });
            reset();
            onSuccess(rule);
            // Reprocess suggestions so existing listings immediately reflect the new rule
            reprocessSuggestions().catch(() => { /* non-critical */ });
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

    const canPreview = keyword.trim().length > 0 && !!matchType && !!category;
    const canSave = canPreview && !!preview && !saving;

    return (
        <Modal title="Ajouter une règle" isOpen={isOpen} onClose={handleClose}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

                {/* Keyword input */}
                <div className={styles.formGroup}>
                    <label htmlFor="rule-keyword">Mot-clé</label>
                    <input
                        id="rule-keyword"
                        className={styles.input}
                        type="text"
                        value={keyword}
                        onChange={e => { setKeyword(e.target.value); setPreview(null); }}
                        placeholder="ex: coreliquid, 3500x, ML..."
                        autoFocus
                    />
                </div>

                {/* Match type */}
                <div className={styles.formGroup}>
                    <label>Type de correspondance</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
                        {(Object.entries(MATCH_TYPE_LABELS) as [MatchType, string][]).map(([value, label]) => (
                            <label
                                key={value}
                                style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '13px', cursor: 'pointer' }}
                            >
                                <input
                                    type="radio"
                                    name="add-rule-match-type"
                                    value={value}
                                    checked={matchType === value}
                                    onChange={() => { setMatchType(value); setPreview(null); }}
                                    style={{ marginTop: '2px', cursor: 'pointer', flexShrink: 0 }}
                                />
                                <span>{label}</span>
                            </label>
                        ))}
                    </div>
                </div>

                {/* Category */}
                <div className={styles.formGroup}>
                    <label htmlFor="rule-category">Catégorie</label>
                    <select
                        id="rule-category"
                        className={styles.select}
                        value={category}
                        onChange={e => { setCategory(e.target.value); setPreview(null); }}
                    >
                        <option value="">— Sélectionner —</option>
                        {CATEGORY_ORDER.map(cat => (
                            <option key={cat} value={cat}>
                                {CATEGORY_LABELS[cat as ComponentCategory] ?? cat}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Preview button */}
                <button
                    onClick={handlePreview}
                    disabled={!canPreview || previewLoading}
                    style={{
                        background: 'var(--surface-3)',
                        color: canPreview ? 'var(--text)' : 'var(--text-dim)',
                        padding: '8px 16px',
                        borderRadius: 'var(--radius)',
                        fontSize: '13px',
                        alignSelf: 'flex-start',
                    }}
                >
                    {previewLoading ? 'Calcul en cours...' : 'Prévisualiser l\'impact'}
                </button>

                {/* Preview result */}
                {preview && (
                    <div style={{
                        background: 'rgba(34, 197, 94, 0.08)',
                        border: '1px solid var(--success)',
                        borderRadius: 'var(--radius)',
                        padding: '10px 14px',
                        fontSize: '13px',
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
                                    <ul style={{ margin: '6px 0 0 16px', color: 'var(--text-muted)' }}>
                                        {pageSamples.map((s, i) => (
                                            <li key={i} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s}</li>
                                        ))}
                                    </ul>
                                    {totalPages > 1 && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', marginLeft: '16px' }}>
                                            <button
                                                onClick={() => setPreviewPage(p => Math.max(0, p - 1))}
                                                disabled={previewPage === 0}
                                                style={{ background: 'none', color: 'var(--accent-blue)', fontSize: '12px', padding: '2px 6px', border: '1px solid var(--border-2)', borderRadius: '3px', opacity: previewPage === 0 ? 0.4 : 1 }}
                                            >
                                                ‹
                                            </button>
                                            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                                {start + 1}–{Math.min(start + PREVIEW_PAGE_SIZE, preview.samples.length)} / {preview.samples.length}
                                                {preview.count > preview.samples.length && ` (${preview.count} total)`}
                                            </span>
                                            <button
                                                onClick={() => setPreviewPage(p => Math.min(totalPages - 1, p + 1))}
                                                disabled={previewPage >= totalPages - 1}
                                                style={{ background: 'none', color: 'var(--accent-blue)', fontSize: '12px', padding: '2px 6px', border: '1px solid var(--border-2)', borderRadius: '3px', opacity: previewPage >= totalPages - 1 ? 0.4 : 1 }}
                                            >
                                                ›
                                            </button>
                                        </div>
                                    )}
                                </>
                            );
                        })()}
                        {preview.count > preview.samples.length && preview.samples.length === 0 && (
                            <p style={{ color: 'var(--text-dim)', fontSize: '12px', marginTop: '4px', marginLeft: '16px' }}>
                                {preview.count} listings affectés
                            </p>
                        )}
                    </div>
                )}

                {/* Error */}
                {error && (
                    <p style={{ color: 'var(--danger)', fontSize: '13px', margin: 0 }}>{error}</p>
                )}

                {/* Actions */}
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <button
                        onClick={handleClose}
                        style={{ background: 'var(--surface-3)', color: 'var(--text)', padding: '8px 18px', borderRadius: 'var(--radius)' }}
                    >
                        Annuler
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={!canSave}
                        style={{
                            background: canSave ? 'var(--accent)' : 'var(--surface-3)',
                            color: canSave ? '#fff' : 'var(--text-dim)',
                            padding: '8px 18px',
                            borderRadius: 'var(--radius)',
                            fontWeight: 600,
                        }}
                    >
                        {saving ? 'Enregistrement...' : 'Enregistrer'}
                    </button>
                </div>
            </div>
        </Modal>
    );
}
