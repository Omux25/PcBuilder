/**
 * CanonicalGroupRow — one expandable row inside a CategoryAccordion.
 *
 * Shows: canonical name, confidence badge, listing count, Associer/Créer button,
 * group-level reject (✕), and expandable ScrapedListingRow children.
 *
 * Optimistic update on group reject: removes self immediately, re-inserts on failure.
 * Confidence recalculation: after individual listing rejection, recomputes badge
 * from remaining listings without an API call.
 *
 * Requirements: 3.1–3.7, 4.5, 4.6
 */

import { useState } from 'react';
import { X, Link2, Plus } from 'lucide-react';
import { ConfidenceBadge } from './ConfidenceBadge';
import { ScrapedListingRow } from './ScrapedListingRow';
import type { CanonicalGroup, CanonicalGroupListing } from '../api';
import { getErrorMessage, rejectUnmatchedListings } from '../api';
import { CATEGORY_LABELS } from '@shared/types';
import type { ComponentCategory } from '@shared/types';

type Confidence = 'high' | 'medium' | 'low' | 'unknown';

/**
 * Recalculates group confidence from remaining listings.
 * Pure function — no API call needed.
 *
 * Rules:
 *   all high          → 'high'
 *   any high/medium   → 'medium'
 *   all low           → 'low'
 *   empty/all unknown → 'unknown'
 *
 * Requirements: 4.5
 */
export function recalculateConfidence(listings: CanonicalGroupListing[]): Confidence {
    if (listings.length === 0) return 'unknown';
    const allHigh = listings.every((l) => l.confidence === 'high');
    if (allHigh) return 'high';
    const anyHighOrMedium = listings.some(
        (l) => l.confidence === 'high' || l.confidence === 'medium',
    );
    if (anyHighOrMedium) return 'medium';
    const anyLow = listings.some((l) => l.confidence === 'low');
    if (anyLow) return 'low';
    return 'unknown';
}

interface Props {
    group: CanonicalGroup;
    isExpanded: boolean;
    onToggleExpand: () => void;
    /** Called when the group is fully rejected (all listings sent to Unknown). */
    onGroupRejected: (canonicalName: string) => void;
    /** Opens CreateAndLinkModal pre-filled with this group. */
    onAssociate: (group: CanonicalGroup) => void;
    /** Optional category badge label — shown in SearchOverrideView. */
    categoryBadge?: string;
}

export function CanonicalGroupRow({
    group,
    isExpanded,
    onToggleExpand,
    onGroupRejected,
    onAssociate,
    categoryBadge,
}: Props) {
    // Local listings state — starts from group.listings, updated on individual rejects
    const [listings, setListings] = useState<CanonicalGroupListing[]>(group.listings);
    const [confidence, setConfidence] = useState<Confidence>(
        group.confidence as Confidence,
    );
    const [rowError, setRowError] = useState<string | null>(null);
    const [rejecting, setRejecting] = useState(false);

    // ── Group-level reject ────────────────────────────────────────────────────
    async function handleGroupReject(e: React.MouseEvent) {
        e.stopPropagation();
        setRowError(null);
        setRejecting(true);
        const allIds = listings.map((l) => l.id);
        try {
            await rejectUnmatchedListings(allIds);
            onGroupRejected(group.canonical_name);
        } catch (err) {
            setRowError(getErrorMessage(err));
            setRejecting(false);
        }
    }

    // ── Individual listing reject ─────────────────────────────────────────────
    async function handleListingReject(listingId: number) {
        const idx = listings.findIndex((l) => l.id === listingId);
        if (idx === -1) return;

        // Optimistic: remove from local list
        const removed = listings[idx];
        const next = listings.filter((l) => l.id !== listingId);
        setListings(next);
        setConfidence(recalculateConfidence(next));

        try {
            await rejectUnmatchedListings([listingId]);
            // If group is now empty, remove it entirely
            if (next.length === 0) {
                onGroupRejected(group.canonical_name);
            }
        } catch (err) {
            // Rollback: re-insert at original position
            const restored = [...next];
            restored.splice(idx, 0, removed);
            setListings(restored);
            setConfidence(recalculateConfidence(restored));
            throw err; // ScrapedListingRow will show the inline error
        }
    }

    const listingCount = listings.length;

    return (
        <>
            <tr
                style={{ cursor: 'pointer' }}
                onClick={onToggleExpand}
            >
                {/* Expand indicator */}
                <td style={{ width: '32px', color: 'var(--text-muted)', fontSize: '11px', textAlign: 'center' }}>
                    {isExpanded ? '▼' : '▶'}
                </td>

                {/* Thumbnail */}
                <td style={{ width: '48px', padding: '4px 0' }}>
                    {listings[0]?.image_url ? (
                        <img
                            src={listings[0].image_url}
                            alt=""
                            style={{
                                width: '40px',
                                height: '40px',
                                objectFit: 'contain',
                                background: '#fff',
                                borderRadius: '4px',
                                border: '1px solid var(--border)',
                            }}
                        />
                    ) : (
                        <div style={{
                            width: '40px',
                            height: '40px',
                            background: 'var(--surface-3)',
                            borderRadius: '4px',
                            border: '1px solid var(--border)',
                        }} />
                    )}
                </td>

                {/* Canonical name + brand + count */}
                <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <strong style={{ fontSize: '13px' }}>{group.canonical_name}</strong>
                        {group.brand && (
                            <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{group.brand}</span>
                        )}
                        <span style={{ color: 'var(--text-dim)', fontSize: '11px' }}>({listingCount})</span>
                        {categoryBadge && (
                            <span style={{
                                fontSize: '10px',
                                fontWeight: 600,
                                color: 'var(--text-secondary)',
                                background: 'var(--surface-2)',
                                border: '1px solid var(--border)',
                                padding: '1px 6px',
                                borderRadius: '999px',
                                textTransform: 'uppercase',
                                letterSpacing: '0.04em',
                            }}>
                                {categoryBadge}
                            </span>
                        )}
                    </div>
                </td>

                {/* Confidence badge */}
                <td onClick={(e) => e.stopPropagation()}>
                    <ConfidenceBadge confidence={confidence} category={group.category} />
                </td>

                {/* Retailer count */}
                <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    {group.retailer_count}
                </td>

                {/* Price range */}
                <td style={{ fontSize: '12px', fontVariantNumeric: 'tabular-nums' }}>
                    {group.price_min !== null && group.price_max !== null
                        ? group.price_min === group.price_max
                            ? `${group.price_min.toLocaleString('fr-MA')} MAD`
                            : `${group.price_min.toLocaleString('fr-MA')} – ${group.price_max.toLocaleString('fr-MA')} MAD`
                        : '—'}
                </td>

                {/* Actions */}
                <td onClick={(e) => e.stopPropagation()}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <button
                            onClick={() => onAssociate(group)}
                            title={group.existing_component_id ? 'Associer à l\'existant' : 'Créer et associer'}
                            aria-label={`${group.existing_component_id ? 'Associer' : 'Créer'} ${group.canonical_name}`}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '4px 10px',
                                background: 'var(--accent)',
                                color: '#fff',
                                border: 'none',
                                borderRadius: 'var(--radius)',
                                fontSize: '12px',
                                fontWeight: 600,
                                cursor: 'pointer',
                            }}
                        >
                            {group.existing_component_id
                                ? <><Link2 size={12} /> Associer</>
                                : <><Plus size={12} /> Créer</>}
                        </button>
                        <button
                            onClick={handleGroupReject}
                            disabled={rejecting}
                            title="Rejeter tout le groupe"
                            aria-label={`Rejeter ${group.canonical_name}`}
                            style={{
                                background: 'none',
                                border: '1px solid var(--border)',
                                borderRadius: 'var(--radius)',
                                padding: '4px 8px',
                                cursor: rejecting ? 'not-allowed' : 'pointer',
                                color: 'var(--text-dim)',
                                opacity: rejecting ? 0.5 : 1,
                                display: 'inline-flex',
                                alignItems: 'center',
                            }}
                        >
                            <X size={13} />
                        </button>
                    </div>
                </td>
            </tr>

            {/* Inline error on group reject failure */}
            {rowError && (
                <tr>
                    <td colSpan={6} style={{ padding: '4px 8px 4px 40px' }}>
                        <span style={{ color: 'var(--danger, #e05252)', fontSize: '11px' }}>
                            ⚠ {rowError}
                        </span>
                    </td>
                </tr>
            )}

            {/* Expanded: individual listing rows */}
            {isExpanded && listings.map((listing) => (
                <ScrapedListingRow
                    key={listing.id}
                    listing={listing}
                    onReject={handleListingReject}
                />
            ))}
        </>
    );
}
