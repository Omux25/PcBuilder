/**
 * PriceComparison — shows price offers for a selected component.
 *
 * In-stock offers are always shown.
 * Out-of-stock offers are collapsed by default — a toggle reveals them.
 * This keeps the table clean when most offers are sold out.
 */

import { useEffect, useState, Fragment } from 'react';
import { getPrices } from '../api';
import type { Component, PriceOffer } from '../types';
import { CATEGORY_LABELS } from '../types';
import { SkeletonText } from './Skeleton';
import { formatDate } from '../utils/date';
import { formatComponentName } from '@shared/component-utils';
import { UI } from '../ui-strings';
import styles from './PriceComparison.module.css';

interface Props {
  component: Component | null;
}

function getInitials(name: string) {
  const parts = name.trim().split(/[\s_-]+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export function PriceComparison({ component }: Props) {
  const [offers, setOffers] = useState<PriceOffer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showOos, setShowOos] = useState(false);

  useEffect(() => {
    if (!component) { setOffers([]); return; }
    setLoading(true);
    setError(null);
    setShowOos(false);
    getPrices(component.id)
      .then(setOffers)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [component]);

  if (!component) {
    return (
      <section className={styles.panel}>
        <h2 className={styles.title}>{UI.priceComparison.title}</h2>
        <p className={styles.empty}>{UI.priceComparison.selectPrompt}</p>
      </section>
    );
  }

  // Split in-stock vs out-of-stock
  const inStockOffers = offers.filter(o => o.in_stock);
  const oosOffers = offers.filter(o => !o.in_stock);
  const visibleOffers = showOos ? offers : inStockOffers;

  // Cheapest in-stock offer gets highlighted
  const cheapestUrl = inStockOffers[0]?.product_url ?? offers[0]?.product_url;

  // Group by retailer for rowspan
  const groupedOffers: { name: string; offers: PriceOffer[] }[] = [];
  for (const offer of visibleOffers) {
    let group = groupedOffers.find(g => g.name === offer.retailer_name);
    if (!group) { group = { name: offer.retailer_name, offers: [] }; groupedOffers.push(group); }
    group.offers.push(offer);
  }

  const variantLabels = offers.map(o => o.variant_label ?? '').filter(Boolean);
  const showVariant = variantLabels.length > 0 && new Set(variantLabels).size > 1;

  return (
    <section className={styles.panel}>
      <h2 className={styles.title}>{UI.priceComparison.title}</h2>

      <div className={styles.componentInfo}>
        <span className={styles.category}>{CATEGORY_LABELS[component.category]}</span>
        <span className={styles.name}>
          {formatComponentName(component)}
        </span>
      </div>

      {loading && <div style={{ marginTop: '1rem' }}><SkeletonText lines={3} /></div>}
      {error && <p className={styles.errorMsg}>{UI.priceComparison.error(error)}</p>}

      {!loading && !error && offers.length === 0 && (
        <p className={styles.empty}>{UI.priceComparison.noRetailer}</p>
      )}

      {!loading && !error && inStockOffers.length === 0 && oosOffers.length > 0 && (
        <p className={styles.allOos}>
          Aucune offre en stock actuellement.{' '}
          <button className={styles.oosToggle} onClick={() => setShowOos(v => !v)}>
            {showOos ? UI.priceComparison.hideOos : UI.priceComparison.showOos(oosOffers.length)}
          </button>
        </p>
      )}

      {!loading && !error && visibleOffers.length > 0 && (
        <table className={styles.table} aria-label={`Prix pour ${component.name}`}>
          <thead>
            <tr>
              <th>{UI.priceComparison.retailer}</th>
              {showVariant && <th>{UI.priceComparison.variant}</th>}
              <th>{UI.priceComparison.price}</th>
              <th>{UI.priceComparison.stock}</th>
              <th className={styles.dateCol}>{UI.priceComparison.updated}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {groupedOffers.map(group => (
              <Fragment key={group.name}>
                {group.offers.map((offer, index) => (
                  <tr
                    key={offer.product_url}
                    className={[
                      offer.product_url === cheapestUrl ? styles.cheapest : '',
                      !offer.in_stock ? styles.oosRow : '',
                    ].filter(Boolean).join(' ')}
                  >
                    {index === 0 && (
                      <td rowSpan={group.offers.length} className={styles.retailerCell}>
                        <div className={styles.retailerCellContent}>
                          <div className={styles.retailerAvatar}>{getInitials(offer.retailer_name)}</div>
                          <span>{offer.retailer_name}</span>
                        </div>
                      </td>
                    )}
                    {showVariant && (
                      <td className={styles.variant}>
                        {offer.variant_label ?? <span className={styles.noVariant}>—</span>}
                      </td>
                    )}
                    <td className={styles.price}>
                      {offer.price.toLocaleString('fr-MA', { style: 'currency', currency: 'MAD' })}
                    </td>
                    <td>
                      <span className={offer.in_stock ? styles.inStock : styles.outOfStock}>
                        {offer.in_stock ? UI.priceComparison.inStock : UI.priceComparison.outOfStock}
                      </span>
                    </td>
                    <td className={`${styles.date} ${styles.dateCol}`}>{formatDate(offer.last_updated)}</td>
                    <td>
                      <a
                        href={offer.product_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.buyBtn}
                        aria-label={`Acheter chez ${offer.retailer_name}${offer.variant_label ? ` — ${offer.variant_label}` : ''}`}
                      >
                        {UI.priceComparison.buy}
                      </a>
                    </td>
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      )}

      {/* OOS toggle — only shown when there are both in-stock AND out-of-stock offers */}
      {!loading && !error && inStockOffers.length > 0 && oosOffers.length > 0 && (
        <button className={styles.oosToggle} onClick={() => setShowOos(v => !v)}>
          {showOos
            ? UI.priceComparison.hideOos
            : UI.priceComparison.showOos(oosOffers.length)}
        </button>
      )}
    </section>
  );
}
