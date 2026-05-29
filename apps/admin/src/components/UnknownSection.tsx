/**
 * UnknownSection — dedicated section for listings with no category suggestion.
 *
 * Shows individual listings (not grouped) with:
 * - Scraped name as link to retailer
 * - Retailer name, price
 * - Inline category dropdown (immediate save on change → optimistic move to target accordion)
 * - "Ignorer" button (permanent dismiss)
 *
 * Requirements: 7.1–7.7
 */

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type { CanonicalGroupListing } from '../api';
import {
    getGroupedUnmatched,
    updateUnmatchedCategory,
    bulkDismissUnmatched,
    getErrorMessage,
} from '../api';
import { fmtPrice } from '../utils/fmt';
import { CATEGORY_ORDER, CATEGORY_LABELS } from '@shared/types';
import type { ComponentCategory } from '@shared/types';

interface UnknownListing extends CanonicalGroupListing {
    manual_category?: string | null;
}

interface Props {
    /** Called when a listing is assigned a category — parent refreshes that accordion. */
    onCategoryAssigned: (listingId: number, category: string) => void;
    refreshTrigger?: number;
}

export function UnknownSection({ onCategoryAssigned, refreshTrigger }: Props) {
    const [listings, setListings] = useState<UnknownListing[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [rowErrors, setRowErrors] = useState<Map<number, string>>(new Map());

    useEffect(() => {
        fetchListings();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [refreshTrigger]);

    async function fetchListings() {
        setLoading(true);
        setError(null);
        try {
            // category=none returns listings with no suggestion (null category)
            const data = await getGroupedUnmatched({ category: 'none', offset: '0', limit: '100' });
            // Flatten all groups' listings into a single list
            const flat: UnknownListing[] = (data.groups ?? []).flatMap((g) => g.listings as UnknownListing[]);
            setListings(flat);
        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            setLoading(false);
        }
    }

    function setRowError(id: number, msg: string | null) {
        setRowErrors((prev) => {
            const next = new Map(prev);
            if (msg === null) next.delete(id);
            else next.set(id, msg);
            return next;
        });
    }

    // ── Category assignment ───────────────────────────────────────────────────
    async function handleCategoryChange(listing: UnknownListing, category: string) {
        if (!category) return;
        const idx = listings.findIndex((l) => l.id === listing.id);
        setRowError(listing.id, null);

        if (category !== 'standby') {
            // Optimistic: remove from Unknown immediately
            setListings((prev) => prev.filter((l) => l.id !== listing.id));
        }

        try {
            await updateUnmatchedCategory(listing.id, category);
            if (category !== 'standby') {
                onCategoryAssigned(listing.id, category);
            } else {
                setListings((prev) => prev.map((l) => l.id === listing.id ? { ...l, manual_category: 'standby' } : l));
            }
        } catch (err) {
            if (category !== 'standby') {
                // Rollback: re-insert at original position
                setListings((prev) => {
                    const restored = [...prev];
                    restored.splice(idx, 0, listing);
                    return restored;
                });
            }
            setRowError(listing.id, getErrorMessage(err));
        }
    }

    // ── Dismiss ───────────────────────────────────────────────────────────────
    async function handleDismiss(listing: UnknownListing) {
        const idx = listings.findIndex((l) => l.id === listing.id);
        setRowError(listing.id, null);

        // Optimistic: remove immediately
        setListings((prev) => prev.filter((l) => l.id !== listing.id));

        try {
            await bulkDismissUnmatched([listing.id]);
        } catch (err) {
            // Rollback
            setListings((prev) => {
                const restored = [...prev];
                restored.splice(idx, 0, listing);
                return restored;
            });
            setRowError(listing.id, getErrorMessage(err));
        }
    }

    if (loading) {
        return (
            <div style={{ padding: '16px', color: 'var(--text-dim)', fontSize: '13px' }}>
                Chargement des éléments inconnus...
            </div>
        );
    }

    if (error) {
        return (
            <div style={{ padding: '16px', color: 'var(--danger, #e05252)', fontSize: '13px' }}>
                ⚠ {error}
            </div>
        );
    }

    return (
        <div style={{ marginTop: '8px' }}>
            {/* Header */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 14px',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: listings.length > 0 ? 'var(--radius) var(--radius) 0 0' : 'var(--radius)',
            }}>
                <span style={{ fontWeight: 600, fontSize: '14px', flex: 1 }}>
                    ⚠️ Inconnu / Non-PC
                </span>
                <span style={{ color: 'var(--text-dim)', fontSize: '12px' }}>
                    {listings.length} listing{listings.length !== 1 ? 's' : ''}
                </span>
            </div>

            {listings.length === 0 ? (
                <div style={{
                    padding: '16px',
                    color: 'var(--text-dim)',
                    fontSize: '13px',
                    border: '1px solid var(--border)',
                    borderTop: 'none',
                    borderRadius: '0 0 var(--radius) var(--radius)',
                }}>
                    Aucun listing inconnu.
                </div>
            ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid var(--border)', borderTop: 'none', borderRadius: '0 0 var(--radius) var(--radius)', overflow: 'hidden' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid var(--border)' }}>
                            <th style={{ width: '48px', padding: '8px 12px' }}></th>
                            <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: '11px', color: 'var(--text-dim)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Nom scrappé</th>
                            <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: '11px', color: 'var(--text-dim)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Revendeur</th>
                            <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: '11px', color: 'var(--text-dim)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Prix</th>
                            <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: '11px', color: 'var(--text-dim)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Catégorie</th>
                            <th style={{ textAlign: 'right', padding: '8px 12px', fontSize: '11px', color: 'var(--text-dim)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {listings.map((listing) => (
                            <>
                                <tr key={listing.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                    <td style={{ width: '48px', padding: '4px 12px' }}>
                                        <div style={{ display: 'flex', gap: '4px' }}>
                                            {(listing.image_urls && listing.image_urls.length > 0 ? listing.image_urls : [listing.image_url]).filter(Boolean).slice(0, 3).map((url, i) => (
                                                <img
                                                    key={i}
                                                    src={url!}
                                                    alt=""
                                                    style={{
                                                        width: i === 0 ? '40px' : '32px',
                                                        height: i === 0 ? '40px' : '32px',
                                                        objectFit: 'contain',
                                                        background: '#fff',
                                                        borderRadius: '4px',
                                                        border: '1px solid var(--border)',
                                                        alignSelf: 'center',
                                                        cursor: 'zoom-in',
                                                    }}
                                                    onClick={() => window.open(url!, '_blank')}
                                                />
                                            ))}
                                            {(!listing.image_url && (!listing.image_urls || listing.image_urls.length === 0)) && (
                                                <div style={{
                                                    width: '40px',
                                                    height: '40px',
                                                    background: 'var(--surface-3)',
                                                    borderRadius: '4px',
                                                    border: '1px solid var(--border)',
                                                }} />
                                            )}
                                        </div>
                                    </td>
                                    <td style={{ padding: '8px 12px' }}>
                                        <a
                                            href={listing.product_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            style={{ color: 'var(--accent)', textDecoration: 'none', fontSize: '13px' }}
                                        >
                                            {listing.scraped_name}
                                        </a>
                                    </td>
                                    <td style={{ padding: '8px 12px', fontSize: '12px', color: 'var(--text-muted)' }}>
                                        {listing.retailer_name}
                                    </td>
                                    <td style={{ padding: '8px 12px', fontSize: '12px', fontVariantNumeric: 'tabular-nums' }}>
                                        {fmtPrice(listing.scraped_price)}
                                    </td>
                                    <td style={{ padding: '8px 12px' }}>
                                        {/* Inline category dropdown — immediate save on change */}
                                        <select
                                            value={listing.manual_category || ''}
                                            onChange={(e) => {
                                                if (e.target.value) handleCategoryChange(listing, e.target.value);
                                            }}
                                            style={{
                                                padding: '3px 6px',
                                                fontSize: '12px',
                                                border: '1px solid var(--border)',
                                                borderRadius: 'var(--radius)',
                                                background: 'var(--surface-2)',
                                                color: 'var(--text)',
                                                cursor: 'pointer',
                                            }}
                                        >
                                            <option value="">Assigner...</option>
                                            <option value="standby">Standby (Aucune)</option>
                                            {CATEGORY_ORDER.map((cat) => (
                                                <option key={cat} value={cat}>
                                                    {CATEGORY_LABELS[cat as ComponentCategory]}
                                                </option>
                                            ))}
                                        </select>
                                    </td>
                                    <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                                        <button
                                            onClick={() => handleDismiss(listing)}
                                            title="Ignorer définitivement"
                                            aria-label={`Ignorer ${listing.scraped_name}`}
                                            style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '4px',
                                                padding: '4px 8px',
                                                background: 'none',
                                                border: '1px solid var(--border)',
                                                borderRadius: 'var(--radius)',
                                                fontSize: '11px',
                                                cursor: 'pointer',
                                                color: 'var(--text-dim)',
                                            }}
                                        >
                                            <X size={11} /> Ignorer
                                        </button>
                                    </td>
                                </tr>
                                {rowErrors.get(listing.id) && (
                                    <tr key={`${listing.id}-err`}>
                                        <td colSpan={5} style={{ padding: '4px 12px 8px' }}>
                                            <span style={{ color: 'var(--danger, #e05252)', fontSize: '11px' }}>
                                                ⚠ {rowErrors.get(listing.id)}
                                            </span>
                                        </td>
                                    </tr>
                                )}
                            </>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    );
}
