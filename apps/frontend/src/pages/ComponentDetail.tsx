/**
 * ComponentDetail page — shows full specs, current prices, and price history.
 * Accessible at /components/:slug
 */

import { useEffect, useState, useCallback } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import { GitCompare, ShoppingCart, ArrowLeft } from 'lucide-react';
import { getComponentBySlug, getPrices, getPriceHistory } from '../api';
import { PriceHistoryChart, PERIOD_DAYS } from '../components/PriceHistoryChart';
import type { HistoryPeriod } from '../components/PriceHistoryChart';
import { CategoryIcon } from '../components/CategoryIcon';
import { Skeleton, SkeletonText } from '../components/Skeleton';
import { useCompare } from '../context/CompareContext';
import type { Component, PriceOffer, PriceHistoryEntry, ComponentCategory } from '../types';
import { CATEGORY_LABELS } from '../types';
import { UI } from '../ui-strings';
import styles from './ComponentDetail.module.css';

interface Props {
  onAddToBuild?: (component: Component) => void;
}

export function ComponentDetail({ onAddToBuild }: Props = {}) {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { addToCompare, removeFromCompare, isInCompare } = useCompare();
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
    if (!slug) return;
    setLoading(true);
    setError(null);

    getComponentBySlug(slug)
      .then(async (found) => {
        setComponent(found);
        setComponentId(found.id);
        const [priceData, historyData] = await Promise.all([
          getPrices(found.id),
          getPriceHistory(found.id, { days: PERIOD_DAYS[period] }),
        ]);
        setPrices(priceData);
        setHistory(historyData);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [slug]);

  function handleAddToBuild() {
    if (!component) return;
    if (onAddToBuild) {
      onAddToBuild(component);
    } else {
      // Navigate to home with this component pre-selected via URL
      navigate(`/?${component.category}=${component.id}`);
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
      navigate(`/browse/${component.category}`);
    } else {
      navigate('/components');
    }
  }

  if (loading) {
    return (
      <div className={styles.page}>
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
        <p>{error ?? UI.detail.notFound}</p>
        <button onClick={goBack} className={styles.back}>{UI.detail.backToConfigurator}</button>
      </div>
    );
  }

  const specs = component.specs as Record<string, unknown> | undefined;
  const inStockPrices = prices.filter(p => p.in_stock);
  const lowestPrice = inStockPrices.length > 0
    ? Math.min(...inStockPrices.map(p => Number(p.price)))
    : prices.length > 0 ? Math.min(...prices.map(p => Number(p.price))) : null;

  return (
    <div className={styles.page}>
      <button onClick={goBack} className={styles.back}>
        <ArrowLeft size={14} /> {CATEGORY_LABELS[component.category as ComponentCategory] ?? UI.detail.back}
      </button>

      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <div className={styles.heroLayout}>
        {/* Product image */}
        <div className={styles.heroImage}>
          {component.image_url ? (
            <img src={component.image_url} alt={component.name} className={styles.productImg} referrerPolicy="no-referrer" />
          ) : (
            <div className={styles.productImgPlaceholder}>
              <CategoryIcon category={component.category as ComponentCategory} size={48} />
            </div>
          )}
        </div>

        {/* Info */}
        <div className={styles.heroInfo}>
          <div className={styles.heroTopRow}>
            <span className={styles.categoryBadge}>
              <CategoryIcon category={component.category as ComponentCategory} size={12} />
              {CATEGORY_LABELS[component.category as ComponentCategory] ?? component.category}
            </span>
            {component.release_year && (
              <span className={styles.year}>{component.release_year}</span>
            )}
          </div>

          <h1 className={styles.name}>
            {component.brand && <span className={styles.brand}>{component.brand} </span>}
            {component.name}
          </h1>

          {component.description && (
            <p className={styles.description}>{component.description}</p>
          )}

          {/* Price + CTA */}
          <div className={styles.heroPriceRow}>
            {lowestPrice !== null && (
              <div className={styles.heroPrice}>
                <span className={styles.heroPriceLabel}>{UI.detail.fromPrice}</span>
                <span className={styles.heroPriceVal}>
                  {lowestPrice.toLocaleString('fr-MA')} MAD
                </span>
                {inStockPrices.length > 0 ? (
                  <span className={styles.inStockBadge}>
                    {UI.detail.inStock}
                    {inStockPrices.length < prices.length && (
                      <span className={styles.inStockRetailerCount}>
                        {' '}· {inStockPrices.length}/{prices.length} revendeur{inStockPrices.length > 1 ? 's' : ''}
                      </span>
                    )}
                  </span>
                ) : prices.length > 0 ? (
                  <span className={styles.outOfStockBadge}>{UI.detail.outOfStock}</span>
                ) : null}
              </div>
            )}

            <div className={styles.heroCtas}>
              <button
                className={`${styles.addToBuildBtn} ${addedToBuild ? styles.addToBuildBtnDone : ''}`}
                onClick={handleAddToBuild}
              >
                {addedToBuild ? UI.detail.added : <><ShoppingCart size={15} /> {UI.detail.addToConfig}</>}
              </button>
              <button
                className={`${styles.compareBtn} ${component && isInCompare(component.id) ? styles.compareBtnActive : ''}`}
                title={component && isInCompare(component.id) ? UI.detail.inCompare : UI.detail.compare}
                onClick={() => {
                  if (!component) return;
                  if (isInCompare(component.id)) {
                    removeFromCompare(component.id);
                  } else {
                    addToCompare(component.id);
                    navigate(`/compare?ids=${component.id}`);
                  }
                }}
              >
                <GitCompare size={15} />
                {component && isInCompare(component.id) ? UI.detail.inCompare : UI.detail.compare}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Content grid ──────────────────────────────────────────────── */}
      <div className={styles.grid}>
        {/* Specs */}
        {specs && Object.keys(specs).length > 0 && (
          <section className={styles.card}>
            <h2 className={styles.cardTitle}>{UI.detail.specs}</h2>
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

        <section className={styles.card}>
          <h2 className={styles.cardTitle}>{UI.detail.prices}</h2>
          {prices.length === 0 ? (
            <p className={styles.empty}>{UI.detail.noRetailer}</p>
          ) : (
            <>
              {(() => {
                const inStock = prices.filter(p => p.in_stock);
                const oos = prices.filter(p => !p.in_stock);
                const visible = showOos ? prices : inStock;
                // Staleness: warn if the most recent update is older than 24h
                const mostRecent = prices.reduce((latest, p) =>
                  new Date(p.last_updated) > new Date(latest) ? p.last_updated : latest,
                  prices[0].last_updated
                );
                const ageHours = (Date.now() - (mostRecent instanceof Date ? mostRecent : new Date(mostRecent)).getTime()) / 3_600_000;
                return (
                  <>
                    {ageHours > 24 && (
                      <div className={styles.staleWarning}>
                        ⚠️ Données mises à jour {formatRelativeTime(mostRecent)} — les disponibilités peuvent avoir changé.
                      </div>
                    )}
                    {inStock.length === 0 && oos.length > 0 && (
                      <p className={styles.allOosMsg}>
                        Aucune offre en stock.{' '}
                        <button className={styles.oosToggleBtn} onClick={() => setShowOos(v => !v)}>
                          {showOos ? UI.priceComparison.hideOos : UI.priceComparison.showOos(oos.length)}
                        </button>
                      </p>
                    )}
                    {visible.length > 0 && (
                      <table className={styles.pricesTable}>
                        <thead>
                          <tr>
                            <th>{UI.detail.retailer}</th>
                            <th>{UI.detail.variant}</th>
                            <th>{UI.detail.price}</th>
                            <th>{UI.detail.stock}</th>
                            <th>{UI.detail.updated}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {visible.map((offer, i) => (
                            <tr key={`${offer.retailer_id}-${i}`} className={!offer.in_stock ? styles.oosRow : undefined}>
                              <td>
                                <a href={offer.product_url} target="_blank" rel="noopener noreferrer" className={styles.retailerLink}>
                                  {offer.retailer_name} ↗
                                </a>
                              </td>
                              <td className={styles.variantCell}>{offer.variant_label ?? '—'}</td>
                              <td className={styles.price}>{Number(offer.price).toLocaleString('fr-MA')} MAD</td>
                              <td>
                                <span className={offer.in_stock ? styles.inStock : styles.outStock}>
                                  {offer.in_stock ? UI.detail.inStockBadge : UI.detail.outOfStock}
                                </span>
                              </td>
                              <td className={styles.updated}>{formatRelativeTime(offer.last_updated)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                    {inStock.length > 0 && oos.length > 0 && (
                      <button className={styles.oosToggleBtn} onClick={() => setShowOos(v => !v)}>
                        {showOos ? UI.priceComparison.hideOos : UI.priceComparison.showOos(oos.length)}
                      </button>
                    )}
                  </>
                );
              })()}
            </>
          )}
        </section>

        <section className={`${styles.card} ${styles.fullWidth}`}>
          <h2 className={styles.cardTitle}>{UI.detail.priceHistory}</h2>
          <PriceHistoryChart
            history={history}
            loading={historyLoading}
            period={period}
            onPeriodChange={handlePeriodChange}
          />
        </section>
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Returns a human-readable relative time string.
 * e.g. "il y a 6h", "il y a 2j", "il y a 3 min"
 */
function formatRelativeTime(dateStr: string | Date): string {
  const date = dateStr instanceof Date ? dateStr : new Date(dateStr);
  if (isNaN(date.getTime())) return '—';
  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);

  if (minutes < 2) return 'à l\'instant';
  if (minutes < 60) return `il y a ${minutes} min`;
  if (hours < 24) return `il y a ${hours}h`;
  if (days < 7) return `il y a ${days}j`;
  return date.toLocaleDateString('fr-MA');
}

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
