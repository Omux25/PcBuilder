/**
 * PriceComparison — shows all price offers for a selected component,
 * including variant labels (AIB partner, BOX/Tray, color, etc.).
 * Opens the retailer's product page in a new tab on click.
 */

import { useEffect, useState, Fragment } from 'react';
import { getPrices } from '../api';
import type { Component, PriceOffer } from '../types';
import { CATEGORY_LABELS } from '../types';
import { SkeletonText } from './Skeleton';
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

  useEffect(() => {
    if (!component) {
      setOffers([]);
      return;
    }

    setLoading(true);
    setError(null);

    getPrices(component.id)
      .then(setOffers)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [component]);

  if (!component) {
    return (
      <section className={styles.panel}>
        <h2 className={styles.title}>Comparaison des prix</h2>
        <p className={styles.empty}>Sélectionnez un composant pour comparer les prix.</p>
      </section>
    );
  }

  const cheapestUrl = offers[0]?.product_url;

  // Group by retailer while preserving backend sort order (best offer first)
  const groupedOffers: { name: string; offers: PriceOffer[] }[] = [];
  for (const offer of offers) {
    let group = groupedOffers.find(g => g.name === offer.retailer_name);
    if (!group) {
      group = { name: offer.retailer_name, offers: [] };
      groupedOffers.push(group);
    }
    group.offers.push(offer);
  }

  // Determine if variant column is useful
  const variantLabels = offers.map(o => o.variant_label ?? '').filter(Boolean);
  const showVariant = variantLabels.length > 0 && new Set(variantLabels).size > 1;

  return (
    <section className={styles.panel}>
      <h2 className={styles.title}>Comparaison des prix</h2>

      <div className={styles.componentInfo}>
        <span className={styles.category}>{CATEGORY_LABELS[component.category]}</span>
        <span className={styles.name}>
          {component.brand && !component.name.toLowerCase().startsWith(component.brand.toLowerCase()) ? `${component.brand} ` : ''}
          {component.name}
        </span>
      </div>

      {loading && <div style={{ marginTop: '1rem' }}><SkeletonText lines={3} /></div>}
      {error   && <p className={styles.errorMsg}>Erreur : {error}</p>}

      {!loading && !error && offers.length === 0 && (
        <p className={styles.empty}>Ce composant n'est disponible chez aucun revendeur référencé.</p>
      )}

      {!loading && !error && offers.length > 0 && (
        <table className={styles.table} aria-label={`Prix pour ${component.name}`}>
          <thead>
            <tr>
              <th>Revendeur</th>
              {showVariant && <th>Variante</th>}
              <th>Prix</th>
              <th>Stock</th>
              <th className={styles.dateCol}>Mis à jour</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {groupedOffers.map((group) => (
              <Fragment key={group.name}>
                {group.offers.map((offer, index) => (
                  <tr
                    key={offer.product_url}
                    className={offer.product_url === cheapestUrl ? styles.cheapest : undefined}
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
                        {offer.in_stock ? 'En stock' : 'Épuisé'}
                      </span>
                    </td>
                    <td className={`${styles.date} ${styles.dateCol}`}>
                      {new Date(offer.last_updated).toLocaleDateString('fr-MA')}
                    </td>
                    <td>
                      <a
                        href={offer.product_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.buyBtn}
                        aria-label={`Acheter chez ${offer.retailer_name}${offer.variant_label ? ` — ${offer.variant_label}` : ''}`}
                      >
                        Voir →
                      </a>
                    </td>
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      )}

      {!loading && !error && offers.some(o => !o.in_stock) && offers.some(o => o.in_stock) && (
        <p className={styles.hint}>
          Certaines variantes affichées sont actuellement épuisées.
        </p>
      )}
    </section>
  );
}
