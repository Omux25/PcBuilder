/**
 * InlinePrices — compact price list shown inline inside the Configurator table.
 * Replaces the old sidebar PriceComparison for the main builder page.
 */

import { useEffect, useState } from 'react';
import { getPrices } from '../api';
import type { PriceOffer } from '../types';
import { UI } from '../ui-strings';
import styles from './InlinePrices.module.css';

interface Props {
  componentId: number;
}

function getInitials(name: string) {
  const parts = name.trim().split(/[\s_-]+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export function InlinePrices({ componentId }: Props) {
  const [offers, setOffers] = useState<PriceOffer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getPrices(componentId)
      .then(setOffers)
      .catch(() => setOffers([]))
      .finally(() => setLoading(false));
  }, [componentId]);

  if (loading) return <div className={styles.loading}>{UI.inlinePrices.loading}</div>;
  if (offers.length === 0) return <div className={styles.empty}>{UI.inlinePrices.empty}</div>;

  const bestPrice = offers.find(o => o.in_stock)?.price;

  return (
    <div className={styles.container}>
      <div className={styles.listHeader}>
        <span className={styles.count}>{UI.inlinePrices.offerCount(offers.length)}</span>
      </div>
      <div className={styles.list}>
        {offers.map(offer => {
          const isBest = offer.in_stock && offer.price === bestPrice;
          return (
            <div
              key={offer.product_url}
              className={`${styles.row} ${isBest ? styles.best : ''} ${!offer.in_stock ? styles.oos : ''}`}
            >
              <div className={styles.retailer}>
                <div className={styles.avatar}>{getInitials(offer.retailer_name)}</div>
                <span className={styles.retailerName}>{offer.retailer_name}</span>
              </div>
              {offer.variant_label && <span className={styles.variant}>{offer.variant_label}</span>}
              <span className={styles.price}>{offer.price.toLocaleString('fr-MA')} MAD</span>
              <span className={offer.in_stock ? styles.inStock : styles.outOfStock}>
                {offer.in_stock ? UI.inlinePrices.inStock : UI.inlinePrices.outOfStock}
              </span>
              <a
                href={offer.product_url}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.buyBtn}
                onClick={e => e.stopPropagation()}
              >
                {UI.inlinePrices.buy}
              </a>
            </div>
          );
        })}
      </div>
    </div>
  );
}
