/**
 * MarketTrends — shows components whose price has fluctuated recently.
 * Accessible at /market-trends
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { TrendingDown, TrendingUp, ShoppingCart, BarChart3 } from 'lucide-react';
import { getMarketTrends, type MarketTrend } from '../api';
import { CategoryIcon } from '../components/CategoryIcon';
import { Skeleton } from '../components/Skeleton';
import type { ComponentCategory } from '../types';
import { CATEGORY_LABELS, CATEGORY_ORDER } from '../types';
import { useBuild } from '../context/BuildContext';
import styles from './MarketTrends.module.css';

const DAY_OPTIONS = [3, 7, 14, 30];

export function MarketTrends() {
  const { addToBuild } = useBuild();
  const [trends, setTrends]     = useState<MarketTrend[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [days, setDays]         = useState(7);
  const [category, setCategory] = useState('');
  const [trendType, setTrendType] = useState<'drops' | 'hikes'>('drops');
  const [added, setAdded]       = useState<number | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    getMarketTrends({ days, limit: 40, category: category || undefined, type: trendType })
      .then(r => setTrends(r.trends))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [days, category, trendType]);

  function handleAdd(trend: MarketTrend) {
    addToBuild({
      id: trend.component_id,
      slug: trend.slug,
      name: trend.name,
      brand: trend.brand ?? undefined,
      category: trend.category as ComponentCategory,
      image_url: trend.image_url ?? undefined,
      is_active: true,
      created_at: '',
      updated_at: '',
    });
    setAdded(trend.component_id);
    setTimeout(() => setAdded(null), 2000);
  }

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.pageHeader}>
        <div className={styles.titleRow}>
          <BarChart3 size={24} className={styles.titleIcon} />
          <div>
            <h1 className={styles.title}>Tendances du Marché</h1>
            <p className={styles.subtitle}>
              Analyse des variations de prix réelles pour les produits en stock.
            </p>
          </div>
        </div>

        {/* Trend Type Tabs */}
        <div className={styles.trendTabs}>
          <button
            className={`${styles.trendTab} ${trendType === 'drops' ? styles.trendTabActiveDrops : ''}`}
            onClick={() => setTrendType('drops')}
          >
            <TrendingDown size={16} />
            Bons Plans (Baisses)
          </button>
          <button
            className={`${styles.trendTab} ${trendType === 'hikes' ? styles.trendTabActiveHikes : ''}`}
            onClick={() => setTrendType('hikes')}
          >
            <TrendingUp size={16} />
            Inflations (Hausses)
          </button>
        </div>

        {/* Filters */}
        <div className={styles.filters}>
          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>Période</label>
            <div className={styles.dayPills}>
              {DAY_OPTIONS.map(d => (
                <button
                  key={d}
                  className={`${styles.dayPill} ${days === d ? styles.dayPillActive : ''}`}
                  onClick={() => setDays(d)}
                >
                  {d}j
                </button>
              ))}
            </div>
          </div>

          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>Catégorie</label>
            <select
              className={styles.catSelect}
              value={category}
              onChange={e => setCategory(e.target.value)}
            >
              <option value="">Toutes</option>
              {CATEGORY_ORDER.map(cat => (
                <option key={cat} value={cat}>{CATEGORY_LABELS[cat]}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {error ? (
        <div className={styles.error}>
          <p>{error}</p>
          <button className={styles.retryBtn} onClick={() => window.location.reload()}>
            Réessayer
          </button>
        </div>
      ) : loading ? (
        <div className={styles.grid}>
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className={styles.cardSkeleton}>
              <Skeleton height={14} width="50%" style={{ marginBottom: '0.5rem' }} />
              <Skeleton height={20} width="85%" style={{ marginBottom: '0.75rem' }} />
              <Skeleton height={32} style={{ marginTop: 'auto' }} />
            </div>
          ))}
        </div>
      ) : trends.length === 0 ? (
        <div className={styles.empty}>
          <BarChart3 size={40} className={styles.emptyIcon} />
          <p>Aucune variation significative détectée sur les {days} derniers jours.</p>
        </div>
      ) : (
        <>
          <p className={styles.resultCount}>
            {trends.length} variation{trends.length > 1 ? 's' : ''} détectée{trends.length > 1 ? 's' : ''} sur {days} jours
          </p>
          <div className={styles.grid}>
            {trends.map(trend => (
              <TrendCard
                key={trend.component_id}
                trend={trend}
                isAdded={added === trend.component_id}
                onAdd={() => handleAdd(trend)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Trend card ─────────────────────────────────────────────────────────────────

function TrendCard({
  trend,
  isAdded,
  onAdd,
}: {
  trend: MarketTrend;
  isAdded: boolean;
  onAdd: () => void;
}) {
  const isDrop = trend.type === 'drops';
  
  return (
    <div className={styles.card}>
      {/* Image */}
      <div className={styles.cardImageWrap}>
        {trend.image_url ? (
          <img src={trend.image_url} alt={trend.name} className={styles.cardImage} />
        ) : (
          <div className={styles.cardImagePlaceholder}>
            <CategoryIcon category={trend.category as ComponentCategory} size={28} />
          </div>
        )}
        {/* Trend badge */}
        <div className={isDrop ? styles.dropBadge : styles.hikeBadge}>
          {isDrop ? <TrendingDown size={11} /> : <TrendingUp size={11} />}
          {isDrop ? '−' : '+'}{trend.change_pct}%
        </div>
      </div>

      {/* Info */}
      <div className={styles.cardBody}>
        <div className={styles.cardTop}>
          {trend.brand && <span className={styles.brand}>{trend.brand}</span>}
          <span className={styles.catBadge}>
            <CategoryIcon category={trend.category as ComponentCategory} size={11} />
            {CATEGORY_LABELS[trend.category as ComponentCategory] ?? trend.category}
          </span>
        </div>

        <Link to={`/product/${trend.slug}`} className={styles.cardName}>
          {trend.name}
        </Link>

        {/* Price comparison */}
        <div className={styles.priceRow}>
          <span className={styles.priceBefore}>
            {trend.price_before.toLocaleString('fr-MA')} MAD
          </span>
          <span className={styles.priceArrow}>→</span>
          <span className={isDrop ? styles.priceAfter : styles.priceAfterUp}>
            {trend.price_after.toLocaleString('fr-MA')} MAD
          </span>
        </div>

        <div className={styles.savingsRow}>
          <span className={styles.savings}>
            {isDrop ? 'Économie' : 'Hausse'} : {trend.diff_amount.toLocaleString('fr-MA')} MAD
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className={styles.cardFooter}>
        <Link to={`/product/${trend.slug}`} className={styles.detailLink}>
          Voir les détails
        </Link>
        <button
          className={`${styles.addBtn} ${isAdded ? styles.addBtnDone : ''}`}
          onClick={onAdd}
        >
          {isAdded ? '✓' : <ShoppingCart size={14} />}
        </button>
      </div>
    </div>
  );
}
