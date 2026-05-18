/**
 * InlinePrices — compact price list shown inline inside the Configurator table.
 *
 * In-stock offers are always shown.
 * Out-of-stock offers are collapsed by default — a small toggle reveals them.
 */

import { useEffect, useState } from 'react';
import { getPrices } from '../api';
import type { PriceOffer } from '../types';
import { UI } from '../ui-strings';
import { formatPrice } from '@shared/formatting/price.formatter';
import { ExternalLink } from 'lucide-react';
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
  const [showOos, setShowOos] = useState(false);

  useEffect(() => {
    setLoading(true);
    setShowOos(false);
    getPrices(componentId)
      .then(setOffers)
      .catch(() => setOffers([]))
      .finally(() => setLoading(false));
  }, [componentId]);

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner}></div>
        <span>{UI.inlinePrices.loading}</span>
      </div>
    );
  }
  if (offers.length === 0) return <div className={styles.empty}>{UI.inlinePrices.empty}</div>;

  const inStock = offers.filter(o => o.in_stock);
  const oos = offers.filter(o => !o.in_stock);
  const visible = showOos ? offers : inStock;
  const bestPrice = inStock[0]?.price;

  return (
    <div className={styles.container}>
      <div className={styles.listHeader}>
        <span className={styles.count}>
          {UI.inlinePrices.offerCount(inStock.length > 0 ? inStock.length : offers.length)}
        </span>
      </div>

      {/* All out of stock */}
      {inStock.length === 0 && oos.length > 0 && (
        <div className={styles.allOos}>
          <span className={styles.allOosText}>Aucune offre en stock</span>
          <button className={styles.oosToggle} onClick={() => setShowOos(v => !v)}>
            {showOos ? UI.priceComparison.hideOos : UI.priceComparison.showOos(oos.length)}
          </button>
        </div>
      )}

      {visible.length > 0 && (
        <div className={styles.list}>
          {visible.map(offer => {
            const isBest = offer.in_stock && offer.price === bestPrice;
            return (
              <div
                key={offer.product_url}
                className={[
                  styles.row,
                  isBest ? styles.best : '',
                  !offer.in_stock ? styles.oos : '',
                ].filter(Boolean).join(' ')}
              >
                <div className={styles.retailer}>
                  <div className={styles.avatar}>{getInitials(offer.retailer_name)}</div>
                  <div className={styles.retailerDetails}>
                    <span className={styles.retailerName}>{offer.retailer_name}</span>
                    {isBest && (
                      <span className={styles.bestBadge}>
                        Meilleur Prix
                      </span>
                    )}
                  </div>
                </div>
                
                {offer.variant_label && <span className={styles.variant}>{offer.variant_label}</span>}
                
                <span className={styles.price}>{formatPrice(offer.price)}</span>
                
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
                  <span>{UI.inlinePrices.buy}</span>
                  <ExternalLink size={12} className={styles.buyIcon} />
                </a>
              </div>
            );
          })}
        </div>
      )}

      {/* Toggle when there are both in-stock and OOS */}
      {inStock.length > 0 && oos.length > 0 && (
        <button className={styles.oosToggle} onClick={() => setShowOos(v => !v)}>
          {showOos ? UI.priceComparison.hideOos : UI.priceComparison.showOos(oos.length)}
        </button>
      )}
    </div>
  );
}
