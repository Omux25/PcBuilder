/**
 * ComponentDetail page — shows full specs, current prices, and price history.
 * Accessible at /components/:slug
 */

import { useEffect, useState, useCallback } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import { GitCompare, ShoppingCart, ArrowLeft, Share2, Check, TrendingDown, ChevronDown } from 'lucide-react';
import { getComponentBySlug, getComponentByIdentifier, getPrices, getPriceHistory, getMarketTrends } from '../api';
import { PriceHistoryChart } from '../components/PriceHistoryChart';
import type { HistoryPeriod } from '../constants/periods';
import { PERIOD_DAYS } from '../constants/periods';
import { CategoryIcon } from '../components/CategoryIcon';
import { Skeleton, SkeletonText } from '../components/Skeleton';
import { useCompare } from '../context/CompareContext';
import type { Component, PriceOffer, PriceHistoryEntry, ComponentCategory } from '../types';
import { CATEGORY_LABELS, SLUG_TO_CATEGORY, CATEGORY_SLUGS } from '../types';
import { UI } from '../ui-strings';
import { formatPrice } from '@shared/formatting/price.formatter';
import { formatComponentName } from '@shared/formatting/component-name.formatter';
import { SEO } from '../components/SEO';
import { useClipboard } from '../hooks/useClipboard';
import styles from './ComponentDetail.module.css';

interface Props {
  onAddToBuild?: (component: Component) => void;
}

export function ComponentDetail({ onAddToBuild }: Props = {}) {
  const { slug, category: rawCategory, identifier } = useParams<{ slug?: string; category?: string; identifier?: string }>();
  const category = (SLUG_TO_CATEGORY[rawCategory || ''] || rawCategory) as ComponentCategory;
  const navigate = useNavigate();
  const location = useLocation();  const { addToCompare, removeFromCompare, isInCompare, compareIds, compareCategory } = useCompare();
  const [component, setComponent] = useState<Component | null>(null);
  const [prices, setPrices] = useState<PriceOffer[]>([]);
  const [history, setHistory] = useState<PriceHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [period, setPeriod] = useState<HistoryPeriod>('30d');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addedToBuild, setAddedToBuild] = useState(false);
  const [showOos, setShowOos] = useState(false);
  const [componentId, setComponentId] = useState<number | null>(null);
  const [selectedImgIdx, setSelectedImgIdx] = useState(0);
  const { copied, copy } = useClipboard();
  const [isTrending, setIsTrending] = useState(false);

  // Fetch history separately so period changes don't reload the whole page
  const fetchHistory = useCallback(async (id: number, p: HistoryPeriod) => {
    setHistoryLoading(true);
    try {
      const data = await getPriceHistory(id, { days: PERIOD_DAYS[p] });
      setHistory(data);
    } catch { /* non-critical */ }
    finally { setHistoryLoading(false); }
  }, []);

  function handlePeriodChange(p: HistoryPeriod) {
    setPeriod(p);
    if (componentId) fetchHistory(componentId, p);
  }

  useEffect(() => {
    if (!slug && (!category || !identifier)) return;
    setLoading(true);
    setError(null);

    const fetchPromise = slug
      ? getComponentBySlug(slug)
      : getComponentByIdentifier(category!, identifier!);

    fetchPromise
      .then(async (found) => {
        setComponent(found);
        setComponentId(found.id);
        const [priceData, historyData, trendsData] = await Promise.all([
          getPrices(found.id),
          getPriceHistory(found.id, { days: PERIOD_DAYS[period] }),
          getMarketTrends({ days: 3, limit: 100 }).catch(() => ({ trends: [] }))
        ]);
        setPrices(priceData);
        setHistory(historyData);
        setIsTrending(trendsData.trends.some(t => t.component_id === found.id));
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [slug, category, identifier]);

  function handleAddToBuild() {
    if (!component) return;
    if (onAddToBuild) {
      onAddToBuild(component);
    } else {
      // Navigate to home with this component pre-selected via URL
      navigate(`/configurateur?${component.category}=${component.id}`);
    }
    setAddedToBuild(true);
    setTimeout(() => setAddedToBuild(false), 2000);
  }

  // Go back to wherever the user came from (preserves filters/page/scroll).
  // Falls back to the category browse page if there's no history entry.
  function goBack() {
    if (location.key !== 'default') {
      navigate(-1);
    } else if (component) {
      navigate(`/parcourir/${CATEGORY_SLUGS[component.category as ComponentCategory] || component.category}`);
    } else {
      navigate('/components');
    }
  }

  if (loading) {
    return (
      <div className={styles.page}>
        <SEO title="Chargement..." description="Chargement du composant." />
        <button onClick={goBack} className={styles.back}><ArrowLeft size={14} /> Retour</button>
        <div className={styles.heroLayout}>
          <Skeleton height={160} width={160} style={{ borderRadius: '12px', flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <Skeleton height={24} width={120} style={{ marginBottom: '0.75rem' }} />
            <Skeleton height={40} width="70%" style={{ marginBottom: '0.5rem' }} />
            <SkeletonText lines={2} />
          </div>
        </div>
        <div className={styles.grid}>
          <div className={styles.card}><Skeleton height={30} width={200} style={{ marginBottom: '1.5rem' }} /><SkeletonText lines={4} /></div>
          <div className={styles.card}><Skeleton height={30} width={200} style={{ marginBottom: '1.5rem' }} /><Skeleton height={150} /></div>
        </div>
      </div>
    );
  }

  if (error || !component) {
    return (
      <div className={styles.error}>
        <SEO title="Erreur" description="Composant introuvable." />
        <p>{error ?? UI.detail.notFound}</p>
        <button onClick={goBack} className={styles.back}>{UI.detail.backToConfigurator}</button>
      </div>
    );
  }

  let parsedSpecs: Record<string, unknown> | undefined = undefined;
  if (component.specs) {
    if (typeof component.specs === 'string') {
      try {
        parsedSpecs = JSON.parse(component.specs);
      } catch (e) {
        console.error('Failed to parse component specs:', e);
      }
    } else {
      parsedSpecs = component.specs as Record<string, unknown>;
    }
  }
  const specs = parsedSpecs;  // Simulated gallery images (fallback to product image)
  const images = component?.image_urls && component.image_urls.length > 0
    ? component.image_urls
    : component?.image_url
      ? [component.image_url]
      : [];
  const allSpecs = specs ? Object.entries(specs) : [];

  // Gallery logic — always show thumbnails if we have at least one image
  const showGallery = images.length > 0;

  const compName = formatComponentName(component);

  return (
    <div className={styles.page}>
      <SEO
        title={`Prix ${compName} Maroc`}
        description={`Achetez le ${compName} au meilleur prix au Maroc. Spécifications, avis et compatibilité PC Gamer.`}
        image={images[0]}
      />
      {/* ── Anchor Header ────────────────────────────────────────────── */}
      <header className={styles.headerSection}>
        <nav className={styles.breadcrumbs}>
          <Link to="/" className={styles.breadcrumbLink}>Accueil</Link>
          <span className={styles.breadcrumbSep}>/</span>
          <Link to="/composants" className={styles.breadcrumbLink}>Composants</Link>
          <span className={styles.breadcrumbSep}>/</span>
          <Link to={`/parcourir/${CATEGORY_SLUGS[component.category as ComponentCategory] || component.category}`} className={styles.breadcrumbLink}>
            {CATEGORY_LABELS[component.category as ComponentCategory]}
          </Link>
          {component.brand && (
            <>
              <span className={styles.breadcrumbSep}>/</span>
              <span className={styles.brand}>{component.brand}</span>
            </>
          )}
        </nav>
        <div className={styles.titleRow}>
          <h1 className={styles.pageTitle}>
            {compName}
          </h1>
          <button className={`${styles.shareBtn} ${copied ? styles.copied : ''}`} onClick={() => copy(window.location.href)}>
            {copied ? <Check size={16} /> : <Share2 size={16} />}
            <span className={styles.shareText}>{copied ? 'Copié !' : 'Partager'}</span>
          </button>
        </div>
        {isTrending && (
          <div className={styles.trendingBadge}>
            <TrendingDown size={14} />
            Prix en baisse récente (3 derniers jours)
          </div>
        )}
      </header>

      {/* ── Unified Dashboard Layout ────────────────────────────────────── */}
      <div className={styles.dashboard}>
        {/* Left Column: Visuals & Quick Context (Sticky) */}
        <div className={styles.dashboardLeft}>
          <div className={styles.displayCase}>
            {/* Subtle background blur for a premium look */}
            {images.length > 0 && (
              <div
                className={styles.displayBlur}
                style={{ backgroundImage: `url(${images[selectedImgIdx]})` }}
                />
            )}
            {images.length > 0 ? (
              <img
                src={images[selectedImgIdx]}
                alt={component.name}
                className={styles.productImg}
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className={styles.productImgPlaceholder}>
                <CategoryIcon category={component.category as ComponentCategory} size={40} />
              </div>
            )}
          </div>

          {showGallery && (
            <div className={styles.thumbnails}>
              {images.map((img, idx) => (
                <button
                  key={idx}
                  className={`${styles.thumbBtn} ${selectedImgIdx === idx ? styles.thumbActive : ''}`}
                  onClick={() => setSelectedImgIdx(idx)}
                >
                  <img src={img} alt={`${compName} image ${idx + 1}`} referrerPolicy="no-referrer" className={styles.productImg} />
                </button>
              ))}
            </div>
          )}

          {allSpecs.length > 0 && (
            <div className={styles.quickSpecsList}>
              {allSpecs.map(([key, val]) => (
                <div key={key} className={styles.quickSpecItem}>
                  <span className={styles.quickSpecKey}>{formatSpecKey(key)}</span>
                  <span className={styles.quickSpecVal}>{formatSpecValue(val)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Market, Actions, History & Full Specs */}
        <div className={styles.dashboardRight}>
          <section className={styles.marketSection}>
            {prices.length === 0 ? (
              <p className={styles.empty}>{UI.detail.noRetailer}</p>
            ) : (
              <div className={styles.pricesContainer}>
                {(() => {
                  const inStock = prices.filter(p => p.in_stock);
                  const oos = prices.filter(p => !p.in_stock);
                  const visible = (showOos || inStock.length === 0) ? prices : inStock;

                  return (
                    <>
                      <table className={styles.pricesTable}>
                        <thead>
                          <tr>
                            <th>Marchand</th>
                            <th>État</th>
                            <th>Prix</th>
                            <th></th>
                          </tr>
                        </thead>
                        <tbody>
                          {visible.map((offer, i) => (
                            <tr key={`${offer.retailer_id}-${i}`}>
                              <td>
                                <div className={styles.retailerCell}>
                                  <span className={styles.retailerName}>{offer.retailer_name}</span>
                                  {offer.variant_label && (
                                    <span className={styles.variantBadge}>{offer.variant_label}</span>
                                  )}
                                </div>
                              </td>
                              <td>
                                <span className={offer.in_stock ? styles.stockStatus : styles.oosStatus}>
                                  {offer.in_stock ? 'En Stock' : 'Rupture'}
                                </span>
                              </td>
                              <td>
                                <span className={styles.priceVal}>{formatPrice(Number(offer.price))}</span>
                              </td>
                              <td style={{ textAlign: 'right' }}>
                                <a href={offer.product_url} target="_blank" rel="noopener noreferrer" className={styles.buyBtn}>
                                  Acheter
                                </a>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>

                      {inStock.length > 0 && oos.length > 0 && (
                        <button className={styles.oosToggleBtn} onClick={() => setShowOos(v => !v)}>
                          <span>{showOos ? UI.priceComparison.hideOos : UI.priceComparison.showOos(oos.length)}</span>
                          <ChevronDown
                            size={14}
                            style={{
                              transform: showOos ? 'rotate(180deg)' : 'rotate(0deg)',
                              transition: 'transform 0.2s'
                            }}
                          />
                        </button>
                      )}
                    </>
                  );
                })()}
              </div>
            )}
          </section>

          {/* Action Center */}
          <div className={styles.mainActions}>
            <button
              className={`${styles.addToBuildBtn} ${addedToBuild ? styles.addToBuildBtnDone : ''}`}
              onClick={handleAddToBuild}
            >
              {addedToBuild ? UI.detail.added : <><ShoppingCart size={22} /> {UI.detail.addToConfig}</>}
            </button>

            <button
              className={`${styles.compareBtn} ${isInCompare(component.id) ? styles.compareBtnActive : ''}`}
              onClick={() => {
                if (isInCompare(component.id)) {
                  removeFromCompare(component.id);
                } else {
                  const compName = formatComponentName(component);
                  addToCompare(component.id, component.category, compName);
                  if (!compareCategory || compareCategory === component.category) {
                    const newIds = compareIds.includes(component.id)
                      ? compareIds
                      : [...compareIds, component.id].slice(0, 4);
                    navigate(`/compare?ids=${newIds.join(',')}`);
                  }
                }
              }}
            >
              <GitCompare size={20} /> {isInCompare(component.id) ? 'Retirer du comparateur' : 'Comparer ce produit'}
            </button>
          </div>

          {/* Pricing History */}
          <section className={styles.chartContainerCard}>
            <h3 className={styles.cardTitle}>Historique des prix</h3>
            <PriceHistoryChart
              history={history}
              loading={historyLoading}
              period={period}
              onPeriodChange={handlePeriodChange}
            />
          </section>


        </div>
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const SPEC_KEY_LABELS: Record<string, string> = {
  socket: 'Socket',
  cores: 'Cœurs',
  threads: 'Threads',
  base_clock_ghz: 'Fréquence de base (GHz)',
  boost_clock_ghz: 'Fréquence boost (GHz)',
  tdp: 'TDP (W)',
  chipset: 'Chipset',
  vram_gb: 'VRAM (Go)',
  length_mm: 'Longueur (mm)',
  pcie_version: 'PCIe',
  ram_type: 'Type de RAM',
  capacity_gb: 'Capacité (Go)',
  frequency_mhz: 'Fréquence (MHz)',
  cas_latency: 'Latence CAS',
  voltage: 'Tension (V)',
  kit: 'Kit',
  type: 'Type',
  interface: 'Interface',
  read_speed_mbps: 'Lecture (Mo/s)',
  write_speed_mbps: 'Écriture (Mo/s)',
  wattage: 'Puissance (W)',
  efficiency_rating: 'Certification',
  modular: 'Modulaire',
  form_factor: 'Format',
  max_gpu_length_mm: 'Longueur GPU max (mm)',
  max_cooler_height_mm: 'Hauteur ventirad max (mm)',
  drive_bays: 'Baies de stockage',
  supported_ram_types: 'Types RAM supportés',
  max_ram_gb: 'RAM max (Go)',
  max_ram_frequency: 'Fréquence RAM max (MHz)',
  ram_slots: 'Emplacements RAM',
};

function formatSpecKey(key: string): string {
  return SPEC_KEY_LABELS[key] ?? key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatSpecValue(value: unknown): string {
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'boolean') return value ? 'Oui' : 'Non';
  return String(value ?? '—');
}
