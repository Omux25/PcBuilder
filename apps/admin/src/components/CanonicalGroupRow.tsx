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
import { getErrorMessage, rejectUnmatchedListings, bulkUpdateUnmatchedCategory } from '../api';
import { fmtPriceRange } from '../utils/fmt';
import { CATEGORY_ORDER, CATEGORY_LABELS, type ComponentCategory } from '@shared/types';

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
                style={{ 
                    cursor: 'pointer',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                    transition: 'all 0.2s ease',
                }}
                onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)'; }}
                onMouseOut={(e) => { e.currentTarget.style.background = 'transparent'; }}
                onClick={onToggleExpand}
            >
                {/* Expand indicator */}
                <td style={{ width: '32px', color: 'var(--text-muted)', fontSize: '11px', textAlign: 'center', padding: '8px 0' }}>
                    {isExpanded ? '▼' : '▶'}
                </td>

                {/* Thumbnail */}
                <td style={{ width: '48px', padding: '8px 0' }}>
                    {(() => {
                        const listingWithImage = listings.find(l => l.image_url || (l.image_urls && l.image_urls.length > 0));
                        const imgUrl = listingWithImage?.image_url || (listingWithImage?.image_urls && listingWithImage.image_urls[0]);
                        return imgUrl ? (
                            <img
                                src={imgUrl}
                                alt=""
                                referrerPolicy="no-referrer"
                                style={{
                                    width: '40px',
                                    height: '40px',
                                    objectFit: 'contain',
                                    background: '#fff',
                                    borderRadius: '6px',
                                    border: '1px solid rgba(255, 255, 255, 0.1)',
                                    padding: '2px',
                                }}
                            />
                        ) : (
                            <div style={{
                                width: '40px',
                                height: '40px',
                                background: 'var(--surface-3)',
                                borderRadius: '6px',
                                border: '1px solid rgba(255, 255, 255, 0.05)',
                            }} />
                        );
                    })()}
                </td>

                {/* Canonical name + brand + count */}
                <td style={{ padding: '8px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <strong style={{ fontSize: '13.5px', color: 'var(--text)', letterSpacing: '0.01em' }}>{group.canonical_name}</strong>
                        {group.brand && (
                            <span style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{group.brand}</span>
                        )}
                        <span style={{ color: 'var(--text-dim)', fontSize: '11px', background: 'rgba(255, 255, 255, 0.04)', padding: '2px 8px', borderRadius: '12px', fontWeight: 500 }}>{listingCount} off{listingCount > 1 ? 'res' : 're'}</span>
                        {categoryBadge && (
                            <span style={{
                                fontSize: '10px',
                                fontWeight: 600,
                                color: 'var(--text-secondary)',
                                background: 'var(--surface-2)',
                                border: '1px solid rgba(255, 255, 255, 0.05)',
                                padding: '2px 8px',
                                borderRadius: '12px',
                                textTransform: 'uppercase',
                                letterSpacing: '0.04em',
                            }}>
                                {categoryBadge}
                            </span>
                        )}
                    </div>
                </td>

                {/* Confidence badge */}
                <td onClick={(e) => e.stopPropagation()} style={{ padding: '8px 14px' }}>
                    <ConfidenceBadge confidence={confidence} />
                </td>

                {/* Retailer count */}
                <td style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 500, padding: '8px 14px', textAlign: 'center' }}>
                    {group.retailer_count}
                </td>

                {/* Price range */}
                <td style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', fontVariantNumeric: 'tabular-nums', padding: '8px 14px', whiteSpace: 'nowrap' }}>
                    {fmtPriceRange(group.price_min, group.price_max)}
                </td>

                {/* Actions */}
                <td onClick={(e) => e.stopPropagation()} style={{ padding: '8px 14px', paddingRight: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                        <select
                            value={group.category || ''}
                            onChange={async (e) => {
                                const newCat = e.target.value || 'standby';
                                setRejecting(true);
                                setRowError(null);
                                try {
                                    const allIds = listings.map(l => l.id);
                                    await bulkUpdateUnmatchedCategory(allIds, newCat === 'standby' ? 'standby' : newCat);
                                    onGroupRejected(group.canonical_name);
                                } catch (err) {
                                    setRowError(getErrorMessage(err));
                                } finally {
                                    setRejecting(false);
                                }
                            }}
                            disabled={rejecting}
                            style={{
                                padding: '6px 12px',
                                paddingRight: '24px',
                                fontSize: '12px',
                                fontWeight: 500,
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                borderRadius: '6px',
                                background: 'rgba(255, 255, 255, 0.02)',
                                color: 'var(--text)',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                outline: 'none',
                                maxWidth: '160px',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden'
                            }}
                            onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'; e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)'; }}
                            onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)'; e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)'; }}
                        >
                            <option value="">— Standby / Aucun —</option>
                            {CATEGORY_ORDER.map((cat) => (
                                <option key={cat} value={cat}>
                                    {CATEGORY_LABELS[cat as ComponentCategory] || cat}
                                </option>
                            ))}
                        </select>
                        <button
                            onClick={() => onAssociate(group)}
                            title={group.existing_component_id ? 'Associer à l\'existant' : 'Créer et associer'}
                            aria-label={`${group.existing_component_id ? 'Associer' : 'Créer'} ${group.canonical_name}`}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '6px 14px',
                                background: group.existing_component_id ? 'rgba(79, 70, 229, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                                color: group.existing_component_id ? '#818cf8' : '#10b981',
                                border: group.existing_component_id ? '1px solid rgba(79, 70, 229, 0.3)' : '1px solid rgba(16, 185, 129, 0.3)',
                                borderRadius: '6px',
                                fontSize: '12px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                            onMouseOver={(e) => { 
                                e.currentTarget.style.background = group.existing_component_id ? 'rgba(79, 70, 229, 0.25)' : 'rgba(16, 185, 129, 0.25)'; 
                            }}
                            onMouseOut={(e) => { 
                                e.currentTarget.style.background = group.existing_component_id ? 'rgba(79, 70, 229, 0.15)' : 'rgba(16, 185, 129, 0.15)'; 
                            }}
                        >
                            {group.existing_component_id
                                ? <><Link2 size={14} /> Associer</>
                                : <><Plus size={14} /> Créer</>}
                        </button>
                        <button
                            onClick={handleGroupReject}
                            disabled={rejecting}
                            title="Rejeter tout le groupe"
                            aria-label={`Rejeter ${group.canonical_name}`}
                            style={{
                                background: 'rgba(255, 255, 255, 0.02)',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                borderRadius: '6px',
                                padding: '6px 8px',
                                cursor: rejecting ? 'not-allowed' : 'pointer',
                                color: 'var(--text-dim)',
                                opacity: rejecting ? 0.5 : 1,
                                display: 'inline-flex',
                                alignItems: 'center',
                                transition: 'all 0.2s',
                            }}
                            onMouseOver={(e) => {
                                if (!rejecting) {
                                    e.currentTarget.style.color = '#ef4444';
                                    e.currentTarget.style.borderColor = '#ef4444';
                                    e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
                                }
                            }}
                            onMouseOut={(e) => {
                                if (!rejecting) {
                                    e.currentTarget.style.color = 'var(--text-dim)';
                                    e.currentTarget.style.borderColor = 'var(--border)';
                                    e.currentTarget.style.background = 'none';
                                }
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
                    <td colSpan={7} style={{ padding: '4px 8px 4px 40px' }}>
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
