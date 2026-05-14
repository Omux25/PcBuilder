/**
 * MarketTrends — shows components whose price has fluctuated recently.
 * Accessible at /market-trends
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { TrendingDown, TrendingUp, ShoppingCart, BarChart3, Share2, Check } from 'lucide-react';
import { getMarketTrends, getComponentById, type MarketTrend } from '../api';
import { CategoryIcon } from '../components/CategoryIcon';
import { Skeleton } from '../components/Skeleton';
import type { ComponentCategory } from '../types';
import { CATEGORY_LABELS, CATEGORY_ORDER } from '../types';
import { useBuild } from '../context/BuildContext';
import { UI } from '../ui-strings';
import { formatPrice } from '../utils/format';
import styles from './MarketTrends.module.css';

const DAY_OPTIONS = [3, 7, 14, 30];

export function MarketTrends() {
  const { addToBuild } = useBuild();
  const [trends, setTrends] = useState<MarketTrend[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(7);
  const [category, setCategory] = useState('');
  const [trendType, setTrendType] = useState<'drops' | 'hikes'>('drops');
  const [added, setAdded] = useState<number | null>(null);
  const [adding, setAdding] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(null);
    getMarketTrends({ days, limit: 40, category: category || undefined, type: trendType })
      .then(r => setTrends(r.trends))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [days, category, trendType]);

  async function handleAdd(trend: MarketTrend) {
    setAdding(trend.component_id);
    try {
      const component = await getComponentById(trend.component_id);
      // Guarantee the price is available, falling back to the trend's current price
      component.lowest_price = component.lowest_price || trend.price_after;
      addToBuild(component);
      setAdded(trend.component_id);
      setTimeout(() => setAdded(null), 2000);
    } catch (e) {
      console.error('Failed to add component from trends:', e);
    } finally {
      setAdding(null);
    }
  }

  function handleShare() {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div className={styles.headerTop}>
          <div className={styles.titleRow}>
            <BarChart3 size={24} className={styles.titleIcon} />
            <div>
              <h1 className={styles.title}>{UI.trends.title}</h1>
              <p className={styles.subtitle}>{UI.trends.subtitle}</p>
              <p className={styles.description}>
                Cette section analyse les fluctuations de prix sur le marché marocain. 
                Les opportunités sont détectées en comparant le prix actuel au prix moyen des 
                derniers jours pour les produits en stock.
              </p>
            </div>
          </div>
          <button className={`${styles.shareBtn} ${copied ? styles.copied : ''}`} onClick={handleShare}>
            {copied ? <Check size={16} /> : <Share2 size={16} />}
            <span className={styles.shareText}>{copied ? 'Copié !' : 'Partager'}</span>
          </button>
        </div>

        <div className={styles.trendTabs}>
          <button
            className={`${styles.trendTab} ${trendType === 'drops' ? styles.trendTabActiveDrops : ''}`}
            onClick={() => setTrendType('drops')}
          >
            <TrendingDown size={16} />
            {UI.trends.drops}
          </button>
          <button
            className={`${styles.trendTab} ${trendType === 'hikes' ? styles.trendTabActiveHikes : ''}`}
            onClick={() => setTrendType('hikes')}
          >
            <TrendingUp size={16} />
            {UI.trends.hikes}
          </button>
        </div>

        <div className={styles.filters}>
          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>{UI.trends.period}</label>
            <div className={styles.dayPills}>
              {DAY_OPTIONS.map(d => (
                <button
                  key={d}
                  className={`
                    ${styles.dayPill} 
                    ${trendType === 'drops' ? styles.dayPillHoverDrops : styles.dayPillHoverHikes}
                    ${days === d ? (trendType === 'drops' ? styles.dayPillActiveDrops : styles.dayPillActiveHikes) : ''}
                  `}
                  onClick={() => setDays(d)}
                >
                  {UI.trends.dayUnit(d)}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>{UI.trends.category}</label>
            <select className={styles.catSelect} value={category} onChange={e => setCategory(e.target.value)}>
              <option value="">{UI.trends.allCategories}</option>
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
            {UI.trends.retry}
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
          <p>{UI.trends.noResults(days)}</p>
        </div>
      ) : (
        <>
          <p className={styles.resultCount}>{UI.trends.resultCount(trends.length, days)}</p>
          <div className={styles.grid}>
            {trends.map(trend => (
              <TrendCard
                key={trend.component_id}
                trend={trend}
                isAdded={added === trend.component_id}
                isAdding={adding === trend.component_id}
                onAdd={() => handleAdd(trend)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function TrendCard({ trend, isAdded, isAdding, onAdd }: { trend: MarketTrend; isAdded: boolean; isAdding: boolean; onAdd: () => void }) {
  const isDrop = trend.type === 'drops';
  const [copied, setCopied] = useState(false);

  function handleShare(e: React.MouseEvent) {
    e.preventDefault();
    navigator.clipboard.writeText(`${window.location.origin}/product/${trend.slug}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className={`${styles.card} ${isDrop ? styles.cardDrops : styles.cardHikes}`}>
      <div className={styles.cardImageWrap}>
        {trend.image_url ? (
          <img src={trend.image_url} alt={trend.name} className={styles.cardImage} referrerPolicy="no-referrer" />
        ) : (
          <div className={styles.cardImagePlaceholder}>
            <CategoryIcon category={trend.category as ComponentCategory} size={28} />
          </div>
        )}
        <div className={isDrop ? styles.dropBadge : styles.hikeBadge}>
          {isDrop ? <TrendingDown size={11} /> : <TrendingUp size={11} />}
          {isDrop ? '−' : '+'}{trend.change_pct}%
        </div>
      </div>

      <div className={styles.cardBody}>
        <div className={styles.cardTop}>
          {trend.brand && <span className={styles.brand}>{trend.brand}</span>}
          <span className={styles.catBadge}>
            <CategoryIcon category={trend.category as ComponentCategory} size={11} />
            {CATEGORY_LABELS[trend.category as ComponentCategory] ?? trend.category}
          </span>
        </div>

        <Link to={`/product/${trend.slug}`} className={styles.cardName}>{trend.name}</Link>

        <div className={styles.priceRow}>
          <span className={styles.priceBefore}>{formatPrice(trend.price_before)}</span>
          <span className={styles.priceArrow}>→</span>
          <span className={isDrop ? styles.priceAfter : styles.priceAfterUp}>
            {formatPrice(trend.price_after)}
          </span>
        </div>

        <div className={styles.savingsRow}>
          <span className={isDrop ? styles.savings : styles.hike}>
            {isDrop ? UI.trends.savings : UI.trends.hike} : {formatPrice(trend.diff_amount)}
          </span>
        </div>
      </div>

      <div className={styles.cardFooter}>
        <Link to={`/product/${trend.slug}`} className={styles.detailLink}>{UI.trends.viewDetails}</Link>
        <div className={styles.cardActions}>
          <button className={`${styles.shareIconBtn} ${copied ? styles.copiedIconBtn : ''}`} onClick={handleShare} title="Partager">
            {copied ? <Check size={14} /> : <Share2 size={14} />}
          </button>
          <button 
            className={`${styles.addBtn} ${isAdded ? styles.addBtnDone : ''}`} 
            onClick={onAdd}
            disabled={isAdding || isAdded}
          >
            {isAdded ? '✓' : isAdding ? '...' : <ShoppingCart size={14} />}
          </button>
        </div>
      </div>
    </div>
  );
}