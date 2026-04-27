/**
 * PriceComparison — shows price offers for a selected component.
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

  return (
    <section className={styles.panel}>
      <h2 className={styles.title}>Comparaison des prix</h2>

      <div className={styles.componentInfo}>
        <span className={styles.category}>{CATEGORY_LABELS[component.category]}</span>
        <span className={styles.name}>{component.brand ? `${component.brand} ` : ''}{component.name}</span>
      </div>

      {loading && <p className={styles.hint}>Chargement des prix…</p>}
      {error   && <p className={styles.errorMsg}>Erreur: {error}</p>}

      {!loading && !error && offers.length === 0 && (
        <p className={styles.empty}>Ce composant n'est disponible chez aucun revendeur référencé.</p>
      )}

      {!loading && !error && offers.length > 0 && (
        <table className={styles.table} aria-label={`Prix pour ${component.name}`}>
          <thead>
            <tr>
              <th>Revendeur</th>
              <th>Prix</th>
              <th>Stock</th>
              <th>Mis à jour</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {offers.map((offer) => (
              <tr key={offer.retailer_id} className={offers.indexOf(offer) === 0 ? styles.cheapest : undefined}>
                <td>{offer.retailer_name}</td>
                <td className={styles.price}>
                  {offer.price.toLocaleString('fr-MA', { style: 'currency', currency: 'MAD' })}
                </td>
                <td>
                  <span className={offer.in_stock ? styles.inStock : styles.outOfStock}>
                    {offer.in_stock ? 'En stock' : 'Épuisé'}
                  </span>
                </td>
                <td className={styles.date}>
                  {new Date(offer.last_updated).toLocaleDateString('fr-MA')}
                </td>
                <td>
                  <a
                    href={offer.product_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.buyBtn}
                    aria-label={`Acheter chez ${offer.retailer_name}`}
                  >
                    Voir →
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
