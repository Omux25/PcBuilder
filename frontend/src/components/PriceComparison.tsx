/**
 * PriceComparison — shows all price offers for a selected component,
 * including variant labels (AIB partner, BOX/Tray, color, etc.).
 * Opens the retailer's product page in a new tab on click.
 */

import { useEffect, useState } from 'react';
import { getPrices } from '../api';
import type { Component, PriceOffer } from '../types';
import { CATEGORY_LABELS } from '../types';
import styles from './PriceComparison.module.css';

interface Props {
  component: Component | null;
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

  // Separate in-stock from out-of-stock for visual grouping
  const inStock    = offers.filter(o => o.in_stock);
  const outOfStock = offers.filter(o => !o.in_stock);
  const cheapestUrl = inStock.length > 0 ? inStock[0].product_url : offers[0]?.product_url;

  // Determine if variant column is useful (skip if all labels are empty or identical)
  const variantLabels = offers.map(o => o.variant_label ?? '').filter(Boolean);
  const showVariant = variantLabels.length > 0 && new Set(variantLabels).size > 1;

  return (
    <section className={styles.panel}>
      <h2 className={styles.title}>Comparaison des prix</h2>

      <div className={styles.componentInfo}>
        <span className={styles.category}>{CATEGORY_LABELS[component.category]}</span>
        <span className={styles.name}>{component.brand ? `${component.brand} ` : ''}{component.name}</span>
      </div>

      {loading && <p className={styles.hint}>Chargement des prix…</p>}
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
            {[...inStock, ...outOfStock].map((offer) => (
              <tr
                key={offer.product_url}
                className={offer.product_url === cheapestUrl ? styles.cheapest : undefined}
              >
                <td>{offer.retailer_name}</td>
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
          </tbody>
        </table>
      )}

      {!loading && !error && outOfStock.length > 0 && inStock.length > 0 && (
        <p className={styles.hint}>
          {outOfStock.length} offre{outOfStock.length > 1 ? 's' : ''} épuisée{outOfStock.length > 1 ? 's' : ''} affichée{outOfStock.length > 1 ? 's' : ''} en bas du tableau.
        </p>
      )}
    </section>
  );
}
