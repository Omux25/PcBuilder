/**
 * CreateAndLinkModal — creates a new catalog component and links all
 * pending listings in the canonical group to it in one atomic action.
 *
 * When the group already has an existing_component_id (high-confidence match),
 * "Link to existing" is shown as the primary CTA.
 *
 * Requirements: 7.1, 7.2, 7.5, 7.6, 7.7, 12.1, 14.1
 */

import { useState, useEffect } from 'react';
import { CheckCircle } from 'lucide-react';
import { Modal } from './Modal';
import { ConfidenceBadge } from './ConfidenceBadge';
import { FanSpecFields } from './FanSpecFields';
import { ThermalPasteSpecFields } from './ThermalPasteSpecFields';
import { TokenPicker } from './TokenPicker';
import type { FanSpecValues } from './FanSpecFields';
import type { ThermalPasteSpecValues } from './ThermalPasteSpecFields';
import { CATEGORY_ORDER, CATEGORY_LABELS } from '@shared/types';
import type { ComponentCategory } from '@shared/types';
import { cleanName } from '@shared/hardware/cleaning';
import styles from './Form.module.css';
import { getKeywordRules, reprocessSuggestions, getErrorMessage, scrapeUrls, createAndLinkComponent } from '../api';
import type { CanonicalGroup, KeywordRuleResponse, CreateAndLinkPayload } from '../api';
import { fmtPriceRange, fmtPrice } from '../utils/fmt';

export interface CreateAndLinkResult {
    component_id: number;
    component_slug: string | null;
    linked_count: number;
    component_name: string;
}

interface Props {
    group: CanonicalGroup | null;
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (result: CreateAndLinkResult) => void;
}

export function CreateAndLinkModal({ group, isOpen, onClose, onSuccess }: Props) {
    const [name, setName] = useState('');
    const [brand, setBrand] = useState('');
    const [category, setCategory] = useState<string>('');
    const [originalCategory, setOriginalCategory] = useState<string>('');
    const [confirmCategoryOverride, setConfirmCategoryOverride] = useState(false);
    const [fanSpecs, setFanSpecs] = useState<FanSpecValues>({ size_mm: '', airflow_cfm: '', noise_db: '', rgb: false, pack_size: '' });
    const [thermalSpecs, setThermalSpecs] = useState<ThermalPasteSpecValues>({ weight_grams: '', thermal_conductivity: '', paste_type: '' });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [done, setDone] = useState<CreateAndLinkResult | null>(null);
    const [existingRuleKeywords, setExistingRuleKeywords] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (!group || !isOpen) return;
        setName(cleanName(group.canonical_name ?? '', group.brand ?? ''));
        setBrand(group.brand ?? '');
        const cat = group.category ?? '';
        setCategory(cat);
        setOriginalCategory(cat);
        setConfirmCategoryOverride(false);
        setError(null);
        setDone(null);

        // Fetch existing keyword rules to show dot indicators on token chips
        getKeywordRules().then(rules => {
            setExistingRuleKeywords(new Set(rules.map(r => r.keyword.toLowerCase())));
        }).catch(() => { });

        if (cat === 'fan' && group.specs_hint) {
            setFanSpecs({
                size_mm: (group.specs_hint.size_mm as number) ?? '',
                airflow_cfm: (group.specs_hint.airflow_cfm as number) ?? '',
                noise_db: (group.specs_hint.noise_db as number) ?? '',
                rgb: (group.specs_hint.rgb as boolean) ?? false,
                pack_size: (group.specs_hint.pack_size as number) ?? '',
            });
        } else {
            setFanSpecs({ size_mm: '', airflow_cfm: '', noise_db: '', rgb: false, pack_size: '' });
        }

        if (cat === 'thermal_paste' && group.specs_hint) {
            setThermalSpecs({
                weight_grams: (group.specs_hint.weight_grams as number) ?? '',
                thermal_conductivity: (group.specs_hint.thermal_conductivity as number) ?? '',
                paste_type: (group.specs_hint.paste_type as ThermalPasteSpecValues['paste_type']) ?? '',
            });
        } else {
            setThermalSpecs({ weight_grams: '', thermal_conductivity: '', paste_type: '' });
        }
    }, [group, isOpen]);

    function handleCategoryChange(newCat: string) {
        if (group?.confidence === 'high' && originalCategory && newCat !== originalCategory) {
            setConfirmCategoryOverride(true);
        }
        setCategory(newCat);
    }

    async function handleRuleSaved(_rule: KeywordRuleResponse) {
        // Re-process suggestions for this group after a new rule is saved
        try {
            await reprocessSuggestions();
        } catch { /* non-critical */ }
        // Refresh existing rule keywords
        getKeywordRules().then(rules => {
            setExistingRuleKeywords(new Set(rules.map(r => r.keyword.toLowerCase())));
        }).catch(() => { });
    }

    function buildSpecs(): Record<string, unknown> {
        if (category === 'fan') {
            return {
                size_mm: fanSpecs.size_mm !== '' ? Number(fanSpecs.size_mm) : undefined,
                airflow_cfm: fanSpecs.airflow_cfm !== '' ? Number(fanSpecs.airflow_cfm) : undefined,
                noise_db: fanSpecs.noise_db !== '' ? Number(fanSpecs.noise_db) : undefined,
                rgb: fanSpecs.rgb,
                pack_size: fanSpecs.pack_size !== '' ? Number(fanSpecs.pack_size) : undefined,
            };
        }
        if (category === 'thermal_paste') {
            return {
                weight_grams: thermalSpecs.weight_grams !== '' ? Number(thermalSpecs.weight_grams) : undefined,
                thermal_conductivity: thermalSpecs.thermal_conductivity !== '' ? Number(thermalSpecs.thermal_conductivity) : undefined,
                paste_type: thermalSpecs.paste_type || undefined,
            };
        }
        return group?.specs_hint ?? {};
    }

    async function submit(linkToExisting: boolean) {
        if (!group) return;
        if (!linkToExisting && (!name.trim() || !category)) {
            setError('Le nom et la catégorie sont requis.');
            return;
        }
        setLoading(true);
        setError(null);

        try {
            const listingIds = group.listings.map(l => l.id);

            const payload: CreateAndLinkPayload = {
                name: linkToExisting ? (group.existing_component_name ?? name) : name.trim(),
                brand: brand.trim() || null,
                category,
                specs: buildSpecs(),
                listing_ids: listingIds,
            };

            if (linkToExisting && group.existing_component_id) {
                payload.link_to_existing = true;
                payload.existing_component_id = group.existing_component_id;
            }

            const data = await createAndLinkComponent(payload);

            const result: CreateAndLinkResult = {
                component_id: data.component_id,
                component_slug: data.component_slug,
                linked_count: data.linked_count,
                component_name: linkToExisting ? (group.existing_component_name ?? name) : name.trim(),
            };
            setDone(result);
            onSuccess(result);
        } catch (err: unknown) {
            // Handle duplicate component error specifically
            const apiErr = err as { status?: number; code?: string; existing?: { name: string } };
            if (apiErr.status === 409) {
                setError(`Doublon: "${apiErr.existing?.name ?? 'composant'}" existe déjà dans cette catégorie.`);
            } else {
                setError(getErrorMessage(err));
            }
        } finally {
            setLoading(false);
        }
    }

    async function handleFetchPrices() {
        if (!group || !done) return;
        try {
            const urls = group.listings.map(l => ({ retailer_id: l.retailer_id, product_url: l.product_url }));
            await scrapeUrls(urls);
        } catch { /* non-critical */ }
        onClose();
    }

    if (!group) return null;

    const hasExistingMatch = !!group.existing_component_id;

    // ── Success state ──────────────────────────────────────────────────────────
    if (done) {
        return (
            <Modal title="Association réussie" isOpen={isOpen} onClose={onClose}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '8px 0 16px' }}>
                    <CheckCircle size={48} color="var(--success)" />
                    <div style={{ textAlign: 'center' }}>
                        <p style={{ fontWeight: 600, fontSize: '16px', marginBottom: '4px' }}>{done.component_name}</p>
                        <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                            {done.linked_count} listing{done.linked_count !== 1 ? 's' : ''} associé{done.linked_count !== 1 ? 's' : ''}
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                        <button
                            onClick={onClose}
                            style={{ background: 'var(--surface-3)', color: 'var(--text)', padding: '8px 20px', borderRadius: 'var(--radius)' }}
                        >
                            Fermer
                        </button>
                        <button
                            onClick={handleFetchPrices}
                            style={{ background: 'var(--accent)', color: '#fff', padding: '8px 20px', borderRadius: 'var(--radius)', fontWeight: 600 }}
                        >
                            Récupérer les prix maintenant
                        </button>
                    </div>
                </div>
            </Modal>
        );
    }

    // ── Form state ─────────────────────────────────────────────────────────────
    return (
        <Modal
            title={hasExistingMatch ? 'Associer à un composant existant' : 'Créer et associer'}
            isOpen={isOpen}
            onClose={onClose}
        >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

                {/* Meta info bar */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <ConfidenceBadge
                        confidence={group.confidence as 'high' | 'medium' | 'low' | 'unknown'}
                        category={group.category}
                    />
                    <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                        {group.listing_count} listing{group.listing_count !== 1 ? 's' : ''} ·{' '}
                        {group.retailer_count} revendeur{group.retailer_count !== 1 ? 's' : ''}
                    </span>
                    {group.price_min !== null && (
                        <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                            · {fmtPriceRange(group.price_min, group.price_max)}
                        </span>
                    )}
                </div>

                {/* Token Picker — shown for low/medium confidence groups */}
                {group.confidence !== 'high' && group.listings.length > 0 && (
                    <TokenPicker
                        scrapedName={group.listings[0].scraped_name}
                        existingRuleKeywords={existingRuleKeywords}
                        onRuleSaved={handleRuleSaved}
                    />
                )}

                {/* Existing match banner */}
                {hasExistingMatch && group.existing_component_name && (
                    <div style={{
                        background: 'rgba(34, 197, 94, 0.08)',
                        border: '1px solid var(--success)',
                        borderRadius: 'var(--radius)',
                        padding: '10px 14px',
                        fontSize: '13px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                    }}>
                        <CheckCircle size={15} color="var(--success)" />
                        <span>
                            <strong style={{ color: 'var(--success)' }}>Correspondance trouvée :</strong>{' '}
                            {group.existing_component_name}
                        </span>
                    </div>
                )}

                {/* Sample listings */}
                <div style={{
                    background: 'var(--surface-2)',
                    borderRadius: 'var(--radius)',
                    padding: '10px 12px',
                    fontSize: '12px',
                    color: 'var(--text-muted)',
                    maxHeight: '80px',
                    overflowY: 'auto',
                }}>
                    {group.listings.slice(0, 4).map(l => (
                        <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                            <a href={l.product_url} target="_blank" rel="noopener noreferrer"
                                style={{ color: 'var(--accent-blue)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>
                                {l.scraped_name}
                            </a>
                            <span style={{ flexShrink: 0 }}>{l.retailer_name} · {fmtPrice(l.scraped_price)}</span>
                        </div>
                    ))}
                    {group.listings.length > 4 && (
                        <div style={{ color: 'var(--text-dim)', marginTop: '2px' }}>+{group.listings.length - 4} autres</div>
                    )}
                </div>

                {/* Form fields — 2 column grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div className={styles.formGroup} style={{ gridColumn: '1 / -1' }}>
                        <label htmlFor="cal-name">Nom canonique</label>
                        <input
                            id="cal-name"
                            className={styles.input}
                            type="text"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder="ex: MAG CORELIQUID E240"
                            disabled={hasExistingMatch}
                        />
                    </div>

                    <div className={styles.formGroup}>
                        <label htmlFor="cal-brand">Marque</label>
                        <input
                            id="cal-brand"
                            className={styles.input}
                            type="text"
                            value={brand}
                            onChange={e => setBrand(e.target.value)}
                            placeholder="ex: MSI"
                            disabled={hasExistingMatch}
                        />
                    </div>

                    <div className={styles.formGroup}>
                        <label htmlFor="cal-category">Catégorie</label>
                        <select
                            id="cal-category"
                            className={styles.select}
                            value={category}
                            onChange={e => handleCategoryChange(e.target.value)}
                            disabled={hasExistingMatch}
                        >
                            <option value="">— Sélectionner —</option>
                            {CATEGORY_ORDER.map(cat => (
                                <option key={cat} value={cat}>
                                    {CATEGORY_LABELS[cat as ComponentCategory] ?? cat}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Category override warning */}
                {confirmCategoryOverride && (
                    <div style={{
                        background: 'rgba(245, 158, 11, 0.08)',
                        border: '1px solid var(--warning)',
                        borderRadius: 'var(--radius)',
                        padding: '10px 14px',
                        fontSize: '13px',
                        color: 'var(--warning)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '8px',
                    }}>
                        <span>⚠️ Vous modifiez une suggestion haute confiance. Confirmez le changement de catégorie.</span>
                        <button
                            onClick={() => setConfirmCategoryOverride(false)}
                            style={{ background: 'var(--warning)', color: '#0f1117', fontSize: '12px', padding: '4px 10px', borderRadius: '4px', flexShrink: 0 }}
                        >
                            Confirmer
                        </button>
                    </div>
                )}

                {/* Category-specific spec fields */}
                {!hasExistingMatch && category === 'fan' && (
                    <FanSpecFields values={fanSpecs} onChange={setFanSpecs} />
                )}
                {!hasExistingMatch && category === 'thermal_paste' && (
                    <ThermalPasteSpecFields values={thermalSpecs} onChange={setThermalSpecs} />
                )}

                {/* Error */}
                {error && (
                    <p style={{ color: 'var(--danger)', fontSize: '13px', margin: 0 }}>{error}</p>
                )}

                {/* Actions */}
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', paddingTop: '4px' }}>
                    <button
                        onClick={onClose}
                        disabled={loading}
                        style={{ background: 'var(--surface-3)', color: 'var(--text)', padding: '9px 18px', borderRadius: 'var(--radius)' }}
                    >
                        Annuler
                    </button>

                    {hasExistingMatch ? (
                        <>
                            <button
                                onClick={() => submit(false)}
                                disabled={loading || confirmCategoryOverride || !name.trim() || !category}
                                style={{ background: 'var(--surface-3)', color: 'var(--text)', padding: '9px 18px', borderRadius: 'var(--radius)' }}
                            >
                                Créer nouveau
                            </button>
                            <button
                                onClick={() => submit(true)}
                                disabled={loading}
                                style={{ background: 'var(--success)', color: '#0f1117', padding: '9px 18px', borderRadius: 'var(--radius)', fontWeight: 600 }}
                            >
                                {loading ? 'Association...' : 'Associer à l\'existant'}
                            </button>
                        </>
                    ) : (
                        <button
                            onClick={() => submit(false)}
                            disabled={loading || confirmCategoryOverride || !name.trim() || !category}
                            style={{ background: 'var(--accent)', color: '#fff', padding: '9px 18px', borderRadius: 'var(--radius)', fontWeight: 600 }}
                        >
                            {loading ? 'Création...' : 'Créer et associer'}
                        </button>
                    )}
                </div>
            </div>
        </Modal>
    );
}
