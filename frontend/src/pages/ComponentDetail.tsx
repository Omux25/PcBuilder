/**
 * ComponentDetail page — shows full specs, current prices, and price history.
 * Accessible at /components/:slug
 */

import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getComponents, getPrices, getPriceHistory } from '../api';
import { PriceHistoryChart } from '../components/PriceHistoryChart';
import type { Component, PriceOffer, PriceHistoryEntry } from '../types';
import { CATEGORY_LABELS, CATEGORY_ICONS } from '../types';
import styles from './ComponentDetail.module.css';

export function ComponentDetail() {
  const { slug } = useParams<{ slug: string }>();
  const [component, setComponent] = useState<Component | null>(null);
  const [prices, setPrices] = useState<PriceOffer[]>([]);
  const [history, setHistory] = useState<PriceHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    setError(null);

    // Find component by slug via search
    getComponents({ search: slug, limit: 1 })
      .then(async ({ components }) => {
        const found = components.find((c) => c.slug === slug);
        if (!found) throw new Error('Composant introuvable');
        setComponent(found);

        // Fetch prices and history in parallel
        const [priceData, historyData] = await Promise.all([
          getPrices(found.id),
          getPriceHistory(found.id, { days: 30 }),
        ]);
        setPrices(priceData);
        setHistory(historyData);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return <div className={styles.loading}>Chargement…</div>;
  }

  if (error || !component) {
    return (
      <div className={styles.error}>
        <p>{error ?? 'Composant introuvable'}</p>
        <Link to="/" className={styles.back}>← Retour au configurateur</Link>
      </div>
    );
  }

  const specs = component.specs as Record<string, unknown> | undefined;

  return (
    <div className={styles.page}>
      <Link to="/" className={styles.back}>← Retour au configurateur</Link>

      {/* Hero */}
      <div className={styles.hero}>
        <div className={styles.heroIcon}>
          {CATEGORY_ICONS[component.category]}
        </div>
        <div className={styles.heroInfo}>
          <div className={styles.categoryBadge}>
            {CATEGORY_LABELS[component.category]}
          </div>
          <h1 className={styles.name}>
            {component.brand && <span className={styles.brand}>{component.brand} </span>}
            {component.name}
          </h1>
          {component.release_year && (
            <span className={styles.year}>{component.release_year}</span>
          )}
          {component.description && (
            <p className={styles.description}>{component.description}</p>
          )}
        </div>
      </div>

      <div className={styles.grid}>
        {/* Specs */}
        {specs && Object.keys(specs).length > 0 && (
          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Spécifications</h2>
            <table className={styles.specsTable}>
              <tbody>
                {Object.entries(specs).map(([key, value]) => (
                  <tr key={key}>
                    <td className={styles.specKey}>{formatSpecKey(key)}</td>
                    <td className={styles.specValue}>{formatSpecValue(value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {/* Prices */}
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Prix actuels</h2>
          {prices.length === 0 ? (
            <p className={styles.empty}>
              Ce composant n'est disponible chez aucun revendeur référencé.
            </p>
          ) : (
            <table className={styles.pricesTable}>
              <thead>
                <tr>
                  <th>Revendeur</th>
                  <th>Prix</th>
                  <th>Stock</th>
                  <th>Mis à jour</th>
                </tr>
              </thead>
              <tbody>
                {prices.map((offer) => (
                  <tr key={offer.retailer_id}>
                    <td>
                      <a
                        href={offer.product_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.retailerLink}
                      >
                        {offer.retailer_name} ↗
                      </a>
                    </td>
                    <td className={styles.price}>
                      {offer.price.toLocaleString('fr-MA')} MAD
                    </td>
                    <td>
                      <span className={offer.in_stock ? styles.inStock : styles.outStock}>
                        {offer.in_stock ? 'En stock' : 'Rupture'}
                      </span>
                    </td>
                    <td className={styles.updated}>
                      {new Date(offer.last_updated).toLocaleDateString('fr-MA')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {/* Price history */}
        <section className={`${styles.card} ${styles.fullWidth}`}>
          <h2 className={styles.cardTitle}>Historique des prix (30 jours)</h2>
          <PriceHistoryChart history={history} />
        </section>
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatSpecKey(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatSpecValue(value: unknown): string {
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'boolean') return value ? 'Oui' : 'Non';
  return String(value ?? '—');
}
