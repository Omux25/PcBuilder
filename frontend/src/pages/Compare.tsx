/**
 * Compare page — side-by-side spec comparison for 2–3 components.
 * Accessible at /compare?ids=1,2,3
 *
 * Users can also reach this from the CategoryBrowse page via "Add to compare".
 * The comparison state is stored in the URL so it's shareable.
 */

import { useEffect, useState, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { X, Plus, ExternalLink, TrendingDown, Zap, BarChart3 } from 'lucide-react';
import { getComponentById, getPrices } from '../api';
import { CategoryIcon } from '../components/CategoryIcon';
import type { Component, PriceOffer, ComponentCategory } from '../types';
import { CATEGORY_LABELS } from '../types';
import { MAX_COMPARE } from '../context/CompareContext';
import styles from './Compare.module.css';

// Helper for external links
function getExternalLinks(name: string, category: string) {
  const q = encodeURIComponent(name);
  return [
    { label: 'UserBenchmark', url: `https://www.userbenchmark.com/Search?searchTerm=${q}` },
    { label: 'PassMark', url: `https://www.google.com/search?q=${q}+passmark+score` },
    { label: 'TechPowerUp', url: `https://www.techpowerup.com/gpu-specs/?search=${q}` },
  ].filter(link => category === 'gpu' || link.label !== 'TechPowerUp');
}

// All spec keys we know how to display, in display order
const SPEC_ROWS: { key: string; label: string; unit?: string; highlight?: 'higher' | 'lower' }[] = [
  { key: 'benchmark_score',     label: 'Score de performance', highlight: 'higher' },
  { key: 'socket',              label: 'Socket' },
  { key: 'cores',               label: 'Cœurs',              highlight: 'higher' },
  { key: 'threads',             label: 'Threads',            highlight: 'higher' },
  { key: 'base_clock_ghz',      label: 'Fréq. base',  unit: 'GHz', highlight: 'higher' },
  { key: 'boost_clock_ghz',     label: 'Fréq. boost', unit: 'GHz', highlight: 'higher' },
  { key: 'chipset',             label: 'Chipset' },
  { key: 'vram_gb',             label: 'VRAM',        unit: 'Go',  highlight: 'higher' },
  { key: 'pcie_version',        label: 'PCIe' },
  { key: 'ram_type',            label: 'Type RAM' },
  { key: 'supported_ram_types', label: 'RAM supportée' },
  { key: 'max_ram_frequency',   label: 'Fréq. RAM max', unit: 'MHz', highlight: 'higher' },
  { key: 'ram_slots',           label: 'Slots RAM',    highlight: 'higher' },
  { key: 'max_ram_gb',          label: 'RAM max',      unit: 'Go',  highlight: 'higher' },
  { key: 'frequency_mhz',       label: 'Fréquence',    unit: 'MHz', highlight: 'higher' },
  { key: 'cas_latency',         label: 'Latence CAS',  highlight: 'lower' },
  { key: 'capacity_gb',         label: 'Capacité',     unit: 'Go',  highlight: 'higher' },
  { key: 'type',                label: 'Type' },
  { key: 'interface',           label: 'Interface' },
  { key: 'read_speed_mbps',     label: 'Lecture',      unit: 'Mo/s', highlight: 'higher' },
  { key: 'write_speed_mbps',    label: 'Écriture',     unit: 'Mo/s', highlight: 'higher' },
  { key: 'wattage',             label: 'Puissance',    unit: 'W',   highlight: 'higher' },
  { key: 'efficiency_rating',   label: 'Certification' },
  { key: 'modular',             label: 'Modulaire' },
  { key: 'form_factor',         label: 'Format' },
  { key: 'length_mm',           label: 'Longueur GPU', unit: 'mm',  highlight: 'lower' },
  { key: 'max_gpu_length_mm',   label: 'GPU max',      unit: 'mm',  highlight: 'higher' },
  { key: 'tdp',                 label: 'TDP',          unit: 'W',   highlight: 'lower' },
];

interface ComponentWithPrices {
  component: Component;
  prices: PriceOffer[];
  lowestPrice: number | null;
}

export function Compare() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Parse IDs from URL
  const idsParam = searchParams.get('ids') ?? '';
  const ids = useMemo(() => idsParam ? idsParam.split(',').map(Number).filter(Boolean) : [], [idsParam]);

  const [items, setItems] = useState<(ComponentWithPrices | null)[]>(Array(MAX_COMPARE).fill(null));
  const [loading, setLoading] = useState(ids.length > 0);

  // Load components whenever URL ids change
  useEffect(() => {
    if (ids.length === 0) {
      setItems(Array(MAX_COMPARE).fill(null));
      setLoading(false);
      return;
    }

    setLoading(true);
    Promise.all(
      ids.map(async (id): Promise<ComponentWithPrices | null> => {
        try {
          const [component, prices] = await Promise.all([
            getComponentById(id),
            getPrices(id).catch(() => [] as PriceOffer[]),
          ]);
          const inStockPrices = prices.filter(p => p.in_stock);
          const lowestPrice = inStockPrices.length > 0
            ? Math.min(...inStockPrices.map(p => Number(p.price)))
            : prices.length > 0 ? Math.min(...prices.map(p => Number(p.price))) : null;
          return { component, prices, lowestPrice };
        } catch {
          return null;
        }
      })
    ).then(results => {
      // Pad to MAX_COMPARE slots
      const padded = [...results];
      while (padded.length < MAX_COMPARE) padded.push(null);
      setItems(padded);
    }).finally(() => setLoading(false));
  }, [idsParam]); // eslint-disable-line react-hooks/exhaustive-deps



  function removeComponent(index: number) {
    const newIds = ids.filter((_, i) => i !== index);
    if (newIds.length === 0) {
      setSearchParams({});
    } else {
      setSearchParams({ ids: newIds.join(',') });
    }
  }

  // Determine which spec rows have at least one non-null value across all items
  const activeRows = SPEC_ROWS.filter(row =>
    items.some(item => {
      if (!item) return false;
      const val = getSpecValue(item.component, row.key);
      return val !== null && val !== undefined && val !== '';
    })
  );

  // For numeric highlight: find best value per row
  function getBestValue(row: typeof SPEC_ROWS[0]): number | null {
    if (!row.highlight) return null;
    const nums = items
      .filter(Boolean)
      .map(item => {
        const v = getSpecValue(item!.component, row.key);
        return typeof v === 'number' ? v : null;
      })
      .filter((v): v is number => v !== null);
    if (nums.length < 2) return null;
    return row.highlight === 'higher' ? Math.max(...nums) : Math.min(...nums);
  }

  const filledCount = items.filter(Boolean).length;
  const canAddMore = filledCount < MAX_COMPARE && ids.length < MAX_COMPARE;

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.pageHeader}>
        <Link to="/" className={styles.back}>← Retour</Link>
        <h1 className={styles.title}>Comparaison de composants</h1>
        <p className={styles.subtitle}>
          Comparez jusqu'à {MAX_COMPARE} composants côte à côte.
        </p>
      </div>

      {loading && <div className={styles.loadingBar} />}

      {/* Performance Summary Card */}
      {items.filter(Boolean).length === 2 && (
        <div className={styles.summaryCard}>
          <div className={styles.summaryHeader}>
            <Zap size={18} className={styles.summaryIcon} />
            <h2 className={styles.summaryTitle}>Duel de Performance</h2>
          </div>
          <div className={styles.duelContent}>
            {(() => {
              const [a, b] = items.filter(Boolean);
              const sA = a!.component.benchmark_score || 0;
              const sB = b!.component.benchmark_score || 0;
              
              if (!sA || !sB) return <p className={styles.noDataMsg}>Données de performance insuffisantes pour un duel.</p>;
              
              const winner = sA > sB ? a : b;
              const loser  = sA > sB ? b : a;
              const diff   = Math.abs(((sA - sB) / Math.min(sA, sB)) * 100).toFixed(0);

              return (
                <div className={styles.duelVerdict}>
                  <div className={styles.verdictText}>
                    <span className={styles.winnerName}>{winner!.component.name}</span>
                    {" est "}
                    <span className={styles.highlightPct}>{diff}%</span>
                    {" plus performant que "}
                    <span className={styles.loserName}>{loser!.component.name}</span>
                  </div>
                  <div className={styles.duelBar}>
                    <div className={styles.duelBarFill} style={{ 
                      width: `${(Math.min(sA, sB) / Math.max(sA, sB)) * 100}%`,
                      marginLeft: sA > sB ? '0' : 'auto',
                      marginRight: sA > sB ? 'auto' : '0',
                    }} />
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Comparison table */}
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          {/* Component headers */}
          <thead>
            <tr>
              <th className={styles.labelCol}>Spécification</th>
              {items.map((item, i) => (
                <th key={i} className={styles.componentCol}>
                  {item ? (
                    <div className={styles.componentHeader}>
                      {item.component.image_url && (
                        <img
                          src={item.component.image_url}
                          alt={item.component.name}
                          className={styles.componentImg}
                        />
                      )}
                      <div className={styles.componentHeaderInfo}>
                        <span className={styles.componentBrand}>{item.component.brand}</span>
                        <Link
                          to={`/product/${item.component.slug}`}
                          className={styles.componentName}
                        >
                          {item.component.name}
                        </Link>
                        <div className={styles.componentMeta}>
                          <span className={styles.catBadge}>
                            <CategoryIcon category={item.component.category as ComponentCategory} size={11} />
                            {CATEGORY_LABELS[item.component.category as ComponentCategory] ?? item.component.category}
                          </span>
                          {item.component.release_year && (
                            <span className={styles.year}>{item.component.release_year}</span>
                          )}
                        </div>
                        {item.lowestPrice !== null && (
                          <div className={styles.componentPrice}>
                            <TrendingDown size={12} />
                            {item.lowestPrice.toLocaleString('fr-MA')} MAD
                          </div>
                        )}

                        {/* External Review Links */}
                        <div className={styles.externalLinks}>
                          {getExternalLinks(item.component.name, item.component.category).map(link => (
                            <a
                              key={link.label}
                              href={link.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={styles.externalLink}
                              title={`Voir sur ${link.label}`}
                            >
                              {link.label} <ExternalLink size={10} />
                            </a>
                          ))}
                        </div>
                      </div>
                      <button
                        className={styles.removeBtn}
                        onClick={() => removeComponent(i)}
                        title="Retirer de la comparaison"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <div className={styles.emptySlot}>
                      <Plus size={20} className={styles.emptySlotIcon} />
                      <span>Ajouter un composant</span>
                      <Link to="/components" className={styles.browseLink}>
                        Parcourir →
                      </Link>
                    </div>
                  )}
                </th>
              ))}
              {canAddMore && (
                <th className={styles.componentCol}>
                  <div className={styles.emptySlot}>
                    <Plus size={20} className={styles.emptySlotIcon} />
                    <span>Ajouter</span>
                    <Link to="/components" className={styles.browseLink}>
                      Parcourir →
                    </Link>
                  </div>
                </th>
              )}
            </tr>
          </thead>

          <tbody>
            {/* Price row */}
            <tr className={styles.sectionHeader}>
              <td colSpan={1 + items.length + (canAddMore ? 1 : 0)}>Prix</td>
            </tr>
            <tr>
              <td className={styles.specLabel}>Meilleur prix</td>
              {items.map((item, i) => (
                <td key={i} className={styles.specValue}>
                  {item ? (
                    item.lowestPrice !== null ? (
                      <span className={styles.priceHighlight}>
                        {item.lowestPrice.toLocaleString('fr-MA')} MAD
                      </span>
                    ) : '—'
                  ) : '—'}
                </td>
              ))}
              {canAddMore && <td />}
            </tr>
            <tr>
              <td className={styles.specLabel}>Offres disponibles</td>
              {items.map((item, i) => (
                <td key={i} className={styles.specValue}>
                  {item ? (
                    <div className={styles.offersCell}>
                      {item.prices.slice(0, 3).map(offer => (
                        <a
                          key={offer.product_url}
                          href={offer.product_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`${styles.offerChip} ${!offer.in_stock ? styles.offerChipOos : ''}`}
                        >
                          {offer.retailer_name}
                          <span className={styles.offerPrice}>
                            {Number(offer.price).toLocaleString('fr-MA')} MAD
                          </span>
                          <ExternalLink size={10} />
                        </a>
                      ))}
                    </div>
                  ) : '—'}
                </td>
              ))}
              {canAddMore && <td />}
            </tr>

            {/* Spec rows */}
            <tr className={styles.sectionHeader}>
              <td colSpan={1 + items.length + (canAddMore ? 1 : 0)}>Analyse de Performance</td>
            </tr>
            <tr>
              <td className={styles.specLabel}>Rapport Performance/Prix</td>
              {items.map((item, i) => {
                if (!item || item.lowestPrice === null || !item.component.benchmark_score) {
                  return <td key={i} className={styles.specValue}>—</td>;
                }
                const value = (item.component.benchmark_score / item.lowestPrice).toFixed(2);
                return (
                  <td key={i} className={styles.specValue}>
                    <span className={styles.valueScore}>{value} pts / MAD</span>
                    <div className={styles.valueSub}>Plus c'est haut, mieux c'est</div>
                  </td>
                );
              })}
              {canAddMore && <td />}
            </tr>

            <tr className={styles.sectionHeader}>
              <td colSpan={1 + items.length + (canAddMore ? 1 : 0)}>Spécifications</td>
            </tr>
            {activeRows.map(row => {
              const bestVal = getBestValue(row);
              return (
                <tr key={row.key} className={styles.specRow}>
                  <td className={styles.specLabel}>{row.label}</td>
                  {items.map((item, i) => {
                    const raw = item ? getSpecValue(item.component, row.key) : null;
                    const display = formatSpecVal(raw, row.unit);
                    const isBest = bestVal !== null && typeof raw === 'number' && raw === bestVal;
                    
                    let bar = null;
                    if (row.key === 'benchmark_score' && bestVal !== null && typeof raw === 'number') {
                      const pct = Math.round((raw / bestVal) * 100);
                      bar = (
                        <div style={{ marginTop: 8, height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: isBest ? 'var(--accent)' : 'var(--text-muted)', transition: 'width 0.5s ease' }} />
                        </div>
                      );
                    }

                    return (
                      <td
                        key={i}
                        className={`${styles.specValue} ${isBest ? styles.specBest : ''}`}
                      >
                        {display}
                        {isBest && <span className={styles.bestBadge}>✓</span>}
                        {bar}
                      </td>
                    );
                  })}
                  {canAddMore && <td />}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Empty state */}
      {filledCount === 0 && !loading && (
        <div className={styles.emptyState}>
          <div className={styles.emptyIconWrap}>
            <BarChart3 size={48} strokeWidth={1.5} />
          </div>
          <h2 className={styles.emptyTitle}>Prêt pour un duel ?</h2>
          <p className={styles.emptyText}>
            Ajoutez des composants depuis le catalogue pour comparer leurs caractéristiques et performances.
          </p>
          <Link to="/components" className={styles.browseBtn}>
            Parcourir le catalogue
          </Link>
        </div>
      )}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getSpecValue(component: Component, key: string): unknown {
  // Check flat columns first
  const flat = (component as unknown as Record<string, unknown>)[key];
  if (flat !== undefined && flat !== null) return flat;
  // Then check specs JSONB
  const specs = component.specs as Record<string, unknown> | undefined;
  return specs?.[key] ?? null;
}

function formatSpecVal(value: unknown, unit?: string): string {
  if (value === null || value === undefined || value === '') return '—';
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'boolean') return value ? 'Oui' : 'Non';
  const str = String(value);
  return unit ? `${str} ${unit}` : str;
}
