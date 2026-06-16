/**
 * MarketTrends — shows components whose price has fluctuated recently.
 * Accessible at /market-trends
 */

import { useEffect, useState, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { 
  TrendingDown, 
  TrendingUp, 
  ShoppingCart, 
  BarChart3, 
  Share2, 
  Check, 
  RotateCcw, 
  SlidersHorizontal, 
  DollarSign, 
  Sparkles, 
  Calendar,
  ChevronDown
} from 'lucide-react';
import { getMarketTrends, getComponentById, type MarketTrend } from '../api';
import { CategoryIcon } from '../components/CategoryIcon';
import { Skeleton } from '../components/Skeleton';
import type { ComponentCategory } from '../types';
import { CATEGORY_LABELS, CATEGORY_ORDER } from '../types';
import { useBuild } from '../context/BuildContext';
import { UI } from '../ui-strings';
import { formatPrice } from '@shared/formatting/price.formatter';
import { LinkEngine } from '@shared/link-engine';
import { SEO } from '../components/SEO';
import styles from './MarketTrends.module.css';

const DAY_OPTIONS = [3, 7, 14, 30];

interface CustomSelectOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
}

interface CustomSelectProps {
  value: string;
  options: CustomSelectOption[];
  onChange: (val: string) => void;
}

function CustomSelect({ value, options, onChange }: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find(opt => opt.value === value) || options[0];

  return (
    <div className={styles.customSelectContainer} ref={containerRef}>
      <button
        type="button"
        className={`${styles.customSelectTrigger} ${isOpen ? styles.customSelectTriggerActive : ''}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className={styles.customSelectTriggerText}>
          {selectedOption.icon && <span className={styles.customSelectOptionIcon}>{selectedOption.icon}</span>}
          {selectedOption.label}
        </span>
        <ChevronDown size={14} className={`${styles.customSelectChevron} ${isOpen ? styles.customSelectChevronOpen : ''}`} />
      </button>
      {isOpen && (
        <div className={styles.customSelectDropdown}>
          {options.map(opt => (
            <button
              key={opt.value}
              type="button"
              className={`${styles.customSelectOption} ${opt.value === value ? styles.customSelectOptionSelected : ''}`}
              onClick={() => {
                onChange(opt.value);
                setIsOpen(false);
              }}
            >
              {opt.icon && <span className={styles.customSelectOptionIcon}>{opt.icon}</span>}
              <span className={styles.customSelectOptionLabel}>{opt.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function MarketTrends() {
  const { addToBuild } = useBuild();
  const [trends, setTrends] = useState<MarketTrend[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(7);
  const [category, setCategory] = useState('');
  const [trendType, setTrendType] = useState<'drops' | 'hikes'>('drops');
  const [showOutOfStock, setShowOutOfStock] = useState(false);
  const [added, setAdded] = useState<number | null>(null);
  const [adding, setAdding] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [sortBy, setSortBy] = useState<string>('pct');

  const isInitialLoad = useRef(true);

  useEffect(() => {
    let active = true;
    if (isInitialLoad.current) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }
    setError(null);

    getMarketTrends({
      days,
      limit: 40,
      category: category || undefined,
      type: trendType,
      in_stock: showOutOfStock ? 'all' : 'true'
    })
      .then(r => {
        if (active) {
          setTrends(r.trends);
          isInitialLoad.current = false;
        }
      })
      .catch((e: Error) => {
        if (active) {
          setError(e.message);
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
          setRefreshing(false);
        }
      });

    return () => {
      active = false;
    };
  }, [days, category, trendType, showOutOfStock]);

  const sortedTrends = useMemo(() => {
    return [...trends].sort((a, b) => {
      if (sortBy === 'pct') {
        return b.change_pct - a.change_pct;
      }
      if (sortBy === 'amount') {
        return b.diff_amount - a.diff_amount;
      }
      if (sortBy === 'price_asc') {
        return a.price_after - b.price_after;
      }
      if (sortBy === 'price_desc') {
        return b.price_after - a.price_after;
      }
      return 0;
    });
  }, [trends, sortBy]);

  const stats = useMemo(() => {
    if (trends.length === 0) {
      return { bestChangePct: 0, bestChangeComponent: null, maxSavings: 0, maxSavingsComponent: null };
    }
    const activeTrends = showOutOfStock ? trends : trends.filter(t => t.in_stock);
    if (activeTrends.length === 0) {
      return { bestChangePct: 0, bestChangeComponent: null, maxSavings: 0, maxSavingsComponent: null };
    }
    const bestPct = Math.max(...activeTrends.map(t => t.change_pct));
    const bestComp = activeTrends.find(t => t.change_pct === bestPct) || null;

    const bestSavings = Math.max(...activeTrends.map(t => t.diff_amount));
    const maxSavingsComp = activeTrends.find(t => t.diff_amount === bestSavings) || null;

    return {
      bestChangePct: bestPct,
      bestChangeComponent: bestComp,
      maxSavings: bestSavings,
      maxSavingsComponent: maxSavingsComp
    };
  }, [trends, showOutOfStock]);

  async function handleAdd(trend: MarketTrend) {
    setAdding(trend.component_id);
    try {
      const component = await getComponentById(trend.component_id);
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


  const categoryOptions = useMemo(() => {
    const base = [{ value: '', label: UI.trends.allCategories }];
    const cats = CATEGORY_ORDER.map(cat => ({
      value: cat,
      label: CATEGORY_LABELS[cat] || cat,
      icon: <CategoryIcon category={cat as ComponentCategory} size={13} />
    }));
    return [...base, ...cats];
  }, []);

  const sortOptions = useMemo(() => {
    return [
      {
        value: 'pct',
        label: trendType === 'drops' ? 'Remise la plus élevée (%)' : 'Hausse la plus élevée (%)'
      },
      {
        value: 'amount',
        label: trendType === 'drops' ? 'Économie la plus élevée (MAD)' : 'Impact le plus élevé (MAD)'
      },
      { value: 'price_asc', label: 'Prix : du moins cher au plus cher' },
      { value: 'price_desc', label: 'Prix : du plus cher au moins cher' }
    ];
  }, [trendType]);

  return (
    <div className={styles.page}>
      <SEO 
        title="Tendances des Prix des Composants PC au Maroc | PC Builder"
        description="Suivez les baisses et hausses de prix des composants PC au Maroc. Achetez votre matériel au meilleur moment."
      />
      <div className={styles.pageHeader}>
        <div className={styles.headerTop}>
          <div className={styles.titleRow}>
            <div className={styles.titleIconWrapper}>
              <BarChart3 size={24} className={styles.titleIcon} />
            </div>
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

        {!loading && trends.length > 0 && (
          <div className={styles.statsRow}>
            <div className={styles.statCard}>
              <div className={styles.statHeader}>
                <span className={styles.statLabel}>
                  {trendType === 'drops' ? 'Offres en baisse' : 'Hausses détectées'}
                </span>
                <div className={`${styles.statIconWrapper} ${trendType === 'drops' ? styles.statIconGreen : styles.statIconRed}`}>
                  {trendType === 'drops' ? <TrendingDown size={14} /> : <TrendingUp size={14} />}
                </div>
              </div>
              <span className={styles.statValue}>
                {trends.length} {trends.length > 1 ? 'produits' : 'produit'}
              </span>
              <span className={styles.statSub}>Actuellement analysés</span>
            </div>

            <div className={styles.statCard}>
              <div className={styles.statHeader}>
                <span className={styles.statLabel}>
                  {trendType === 'drops' ? 'Meilleure réduction' : 'Plus forte hausse'}
                </span>
                <div className={`${styles.statIconWrapper} ${trendType === 'drops' ? styles.statIconGreen : styles.statIconRed}`}>
                  {trendType === 'drops' ? <Sparkles size={14} /> : <TrendingUp size={14} />}
                </div>
              </div>
              <span className={`${styles.statValue} ${trendType === 'drops' ? styles.statGreen : styles.statRed}`}>
                {trendType === 'drops' ? '−' : '+'}{stats.bestChangePct}%
              </span>
              <span className={styles.statSub} title={stats.bestChangeComponent?.name}>
                {stats.bestChangeComponent ? `${stats.bestChangeComponent.brand || ''} ${stats.bestChangeComponent.name}` : '—'}
              </span>
            </div>

            <div className={styles.statCard}>
              <div className={styles.statHeader}>
                <span className={styles.statLabel}>
                  {trendType === 'drops' ? 'Économie maximale' : 'Impact maximal'}
                </span>
                <div className={`${styles.statIconWrapper} ${styles.statIconBlue}`}>
                  <DollarSign size={14} />
                </div>
              </div>
              <span className={styles.statValue}>
                {formatPrice(stats.maxSavings)}
              </span>
              <span className={styles.statSub} title={stats.maxSavingsComponent?.name}>
                {stats.maxSavingsComponent ? `${stats.maxSavingsComponent.brand || ''} ${stats.maxSavingsComponent.name}` : '—'}
              </span>
            </div>
          </div>
        )}

        <div className={styles.filtersWrapper}>
          <div className={styles.filtersHeader}>
            <SlidersHorizontal size={14} className={styles.filtersHeaderIcon} />
            <span className={styles.filtersHeaderTitle}>Filtres & Options</span>
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
              <CustomSelect
                value={category}
                options={categoryOptions}
                onChange={setCategory}
              />
            </div>

            <div className={styles.filterGroup}>
              <label className={styles.filterLabel}>Trier par</label>
              <CustomSelect
                value={sortBy}
                options={sortOptions}
                onChange={setSortBy}
              />
            </div>

            <div className={styles.filterGroup}>
              <span className={styles.filterLabel}>Stock</span>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={showOutOfStock}
                  onChange={e => setShowOutOfStock(e.target.checked)}
                  className={styles.checkboxInput}
                />
                <span className={styles.checkboxText}>{UI.trends.showOos}</span>
              </label>
            </div>
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
      ) : sortedTrends.length === 0 ? (
        <div className={`${styles.emptyContainer} ${refreshing ? styles.gridRefreshing : ''}`}>
          <div className={styles.emptyCard}>
            <div className={styles.emptyVisual}>
              <div className={styles.emptyIconCircle}>
                <BarChart3 size={24} />
              </div>
            </div>
            <h3 className={styles.emptyTitle}>Aucune variation détectée</h3>
            <p className={styles.emptyText}>
              {UI.trends.noResults(days)} Essayez de modifier vos filtres ou d'élargir la période.
            </p>
            <div className={styles.emptyActions}>
              {(category !== '' || showOutOfStock) && (
                <button 
                  className={styles.emptyResetBtn} 
                  onClick={() => {
                    setCategory('');
                    setShowOutOfStock(false);
                  }}
                >
                  <RotateCcw size={14} />
                  Réinitialiser les filtres
                </button>
              )}
              {days < 30 && (
                <button 
                  className={styles.emptyExpandBtn} 
                  onClick={() => setDays(30)}
                >
                  <Calendar size={14} />
                  Analyser sur 30 jours
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <>
          <p className={styles.resultCount}>{UI.trends.resultCount(sortedTrends.length, days)}</p>
          <div className={`${styles.grid} ${refreshing ? styles.gridRefreshing : ''}`}>
            {sortedTrends.map(trend => (
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
    navigator.clipboard.writeText(window.location.origin + LinkEngine.getProductUrl(trend));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const isOutOfStock = !trend.in_stock;

  return (
    <div 
      className={`
        ${styles.card} 
        ${isDrop ? styles.cardDrops : styles.cardHikes}
        ${isOutOfStock ? styles.cardOos : ''}
      `}
    >
      <div className={styles.cardImageWrap}>
        {trend.image_url ? (
          <img src={trend.image_url} alt={trend.name} className={styles.cardImage} referrerPolicy="no-referrer" />
        ) : (
          <div className={styles.cardImagePlaceholder}>
            <CategoryIcon category={trend.category as ComponentCategory} size={28} />
          </div>
        )}
        <div className={isDrop ? (trend.change_pct >= 15 ? styles.hotBadge : styles.dropBadge) : styles.hikeBadge}>
          {isDrop ? <TrendingDown size={11} /> : <TrendingUp size={11} />}
          {isDrop ? '−' : '+'}{trend.change_pct}%
        </div>
      </div>

      <div className={styles.cardBody}>
        <div className={styles.cardTop}>
          <div className={styles.cardTopLeft}>
            {trend.brand && <span className={styles.brand}>{trend.brand}</span>}
            <span className={styles.catBadge}>
              <CategoryIcon category={trend.category as ComponentCategory} size={11} />
              {CATEGORY_LABELS[trend.category as ComponentCategory] ?? trend.category}
            </span>
          </div>
          <span className={`${styles.stockBadge} ${trend.in_stock ? styles.inStock : styles.outStock}`}>
            {trend.in_stock ? UI.browse.inStock : UI.browse.outOfStock}
          </span>
        </div>

        <Link to={LinkEngine.getProductUrl(trend)} className={styles.cardName}>{trend.name}</Link>

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
        <Link to={LinkEngine.getProductUrl(trend)} className={styles.detailLink}>{UI.trends.viewDetails}</Link>
        <div className={styles.cardActions}>
          <button className={`${styles.shareIconBtn} ${copied ? styles.copiedIconBtn : ''}`} onClick={handleShare} title="Partager">
            {copied ? <Check size={14} /> : <Share2 size={14} />}
          </button>
          <button 
            className={`
              ${styles.addBtn} 
              ${isAdded ? styles.addBtnDone : ''}
              ${isOutOfStock ? styles.addBtnDisabled : ''}
            `} 
            onClick={onAdd}
            disabled={isAdding || isAdded || isOutOfStock}
            title={isOutOfStock ? 'Produit en rupture de stock' : 'Ajouter au configurateur'}
          >
            {isAdded ? '✓' : isAdding ? '...' : <ShoppingCart size={14} />}
          </button>
        </div>
      </div>
    </div>
  );
}