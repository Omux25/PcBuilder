/**
 * ScrapedListingRow — individual scraped listing inside an expanded CanonicalGroupRow.
 *
 * Shows: scraped name (link to retailer), retailer name, price, individual reject button.
 * Optimistic update: removes row immediately on reject, re-inserts on failure.
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4
 */

import { useState } from 'react';
import { X } from 'lucide-react';
import type { CanonicalGroupListing } from '../api';
import { getErrorMessage } from '../api';
import { fmtPrice } from '../utils/fmt';

interface Props {
    listing: CanonicalGroupListing;
    onReject: (id: number) => Promise<void>;
}

export function ScrapedListingRow({ listing, onReject }: Props) {
    const [error, setError] = useState<string | null>(null);
    const [rejecting, setRejecting] = useState(false);

    async function handleReject() {
        setError(null);
        setRejecting(true);
        try {
            await onReject(listing.id);
            // Parent removes this row from its list on success
        } catch (err) {
            setError(getErrorMessage(err));
            setRejecting(false);
        }
    }

    return (
        <>
            <tr style={{ background: 'var(--surface-2)', fontSize: '13px' }}>
                <td style={{ width: '32px' }} />
                <td style={{ width: '48px', padding: '4px 0' }}>
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
                <td style={{ paddingLeft: '8px' }}>
                    <a
                        href={listing.product_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: 'var(--accent)', textDecoration: 'none', fontSize: '13px' }}
                    >
                        {listing.scraped_name}
                    </a>
                </td>
                <td style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                    {listing.retailer_name}
                </td>
                <td style={{ fontSize: '12px', fontVariantNumeric: 'tabular-nums' }}>
                    {fmtPrice(listing.scraped_price)}
                </td>
                <td />
                <td style={{ textAlign: 'right' }}>
                    <button
                        onClick={handleReject}
                        disabled={rejecting}
                        title="Rejeter ce listing"
                        aria-label={`Rejeter ${listing.scraped_name}`}
                        style={{
                            background: 'none',
                            border: '1px solid var(--border)',
                            borderRadius: 'var(--radius)',
                            padding: '2px 6px',
                            cursor: rejecting ? 'not-allowed' : 'pointer',
                            color: 'var(--text-dim)',
                            opacity: rejecting ? 0.5 : 1,
                            display: 'inline-flex',
                            alignItems: 'center',
                        }}
                    >
                        <X size={12} />
                    </button>
                </td>
            </tr>
            {error && (
                <tr style={{ background: 'var(--surface-2)' }}>
                    <td colSpan={6} style={{ paddingLeft: '32px', paddingBottom: '4px' }}>
                        <span style={{ color: 'var(--danger, #e05252)', fontSize: '11px' }}>
                            ⚠ {error}
                        </span>
                    </td>
                </tr>
            )}
        </>
    );
}
