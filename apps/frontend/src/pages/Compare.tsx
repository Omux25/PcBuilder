/**
 * Compare page — side-by-side spec comparison for 2–4 components.
 * Accessible at /compare?ids=1,2,3,4
 *
 * Requirements:
 * - Category locking (only same-category items).
 * - Responsive grid (variable columns).
 * - "Best in class" highlighting.
 */

import { useEffect, useState, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { X, Plus, ArrowLeft, BarChart3, CheckCircle2, Share2, Check } from 'lucide-react';
import { getComponentById, getPrices, smartSearch } from '../api';
import type { Component, PriceOffer, ComponentCategory } from '../types';
import { CATEGORY_LABELS } from '../types';
import { MAX_COMPARE, useCompare } from '../context/CompareContext';
import { formatComponentName } from '@shared/formatting/component-name.formatter';
import { formatPrice } from '@shared/formatting/price.formatter';
import { LinkEngine } from '@shared/link-engine';
import { UI } from '../ui-strings';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Cell, ResponsiveContainer } from 'recharts';
import styles from './Compare.module.css';

// Ranks for non-numeric specs
const SPEC_RANKINGS: Record<string, Record<string, number>> = {
  efficiency_rating: {
    'Titanium': 6, '80+ Titanium': 6,
    'Platinum': 5, '80+ Platinum': 5,
    'Gold': 4, '80+ Gold': 4,
    'Silver': 3, '80+ Silver': 3,
    'Bronze': 2, '80+ Bronze': 2,
    'White': 1, '80+ White': 1, 'Standard': 1, '80+ Standard': 1,
  },
  modular: {
    'Full': 3, 'Full-Modulaire': 3, 'Oui': 3,
    'Semi': 2, 'Semi-Modulaire': 2,
    'Non': 1, 'Non-Modulaire': 1,
  },
  interface_type: {
    'NVMe': 3, 'PCIe': 3, 'SATA': 2, 'HDD': 1,
  }
};

// All spec rows we know how to display
const ALL_SPEC_ROWS: Record<string, { label: string; unit?: string; highlight?: 'higher' | 'lower' }> = {
  benchmark_score: { label: 'Score de performance', highlight: 'higher' },
  socket: { label: 'Socket' },
  core_count: { label: 'Cœurs', highlight: 'higher' },
  thread_count: { label: 'Threads', highlight: 'higher' },
  base_clock_ghz: { label: 'Fréq. base', unit: 'GHz', highlight: 'higher' },
  boost_clock_ghz: { label: 'Fréq. boost', unit: 'GHz', highlight: 'higher' },
  chipset: { label: 'Chipset' },
  vram_gb: { label: 'VRAM', unit: 'Go', highlight: 'higher' },
  ram_type: { label: 'Type RAM' },
  supported_ram_types: { label: 'RAM supportée' },
  max_ram_frequency: { label: 'Fréq. RAM max', unit: 'MHz', highlight: 'higher' },
  ram_slots: { label: 'Slots RAM', highlight: 'higher' },
  frequency_mhz: { label: 'Fréquence', unit: 'MHz', highlight: 'higher' },
  cas_latency: { label: 'Latence CAS', highlight: 'lower' },
  capacity_gb: { label: 'Capacité', unit: 'Go', highlight: 'higher' },
  interface_type: { label: 'Interface', highlight: 'higher' },
  read_speed_mbps: { label: 'Lecture', unit: 'Mo/s', highlight: 'higher' },
  write_speed_mbps: { label: 'Écriture', unit: 'Mo/s', highlight: 'higher' },
  wattage: { label: 'Puissance', unit: 'W', highlight: 'higher' },
  efficiency_rating: { label: 'Certification', highlight: 'higher' },
  modular: { label: 'Modulaire', highlight: 'higher' },
  form_factor: { label: 'Format' },
  length_mm: { label: 'Longueur', unit: 'mm', highlight: 'lower' },
  max_gpu_length_mm: { label: 'GPU max', unit: 'mm', highlight: 'higher' },
  max_cooler_height_mm: { label: 'Ventirad max', unit: 'mm', highlight: 'higher' },
  height_mm: { label: 'Hauteur', unit: 'mm', highlight: 'lower' },
  tdp: { label: 'TDP', unit: 'W', highlight: 'lower' },
  max_tdp: { label: 'TDP max', unit: 'W', highlight: 'higher' },
  m2_slots: { label: 'Slots M.2', highlight: 'higher' },
  supported_motherboards: { label: 'Cartes mères supportées' },
  supported_sockets: { label: 'Sockets supportés' },
};

const CATEGORY_SPECS: Record<string, string[]> = {
  cpu: ['benchmark_score', 'socket', 'core_count', 'thread_count', 'base_clock_ghz', 'boost_clock_ghz', 'tdp'],
  gpu: ['benchmark_score', 'chipset', 'vram_gb', 'length_mm', 'tdp'],
  motherboard: ['socket', 'chipset', 'form_factor', 'supported_ram_types', 'max_ram_frequency', 'ram_slots', 'm2_slots'],
  ram: ['capacity_gb', 'ram_type', 'frequency_mhz', 'cas_latency'],
  storage: ['capacity_gb', 'interface_type', 'read_speed_mbps', 'write_speed_mbps'],
  psu: ['wattage', 'efficiency_rating', 'modular'],
  case: ['form_factor', 'supported_motherboards', 'max_gpu_length_mm', 'max_cooler_height_mm'],
  cooling: ['height_mm', 'max_tdp', 'supported_sockets'],
};

interface ComponentWithPrices {
  component: Component;
  prices: PriceOffer[];
  lowestPrice: number | null;
}

export function Compare() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [copied, setCopied] = useState(false);
  const { syncCompareIds, removeFromCompare } = useCompare();

  // Show only differences toggle state
  const [showOnlyDifferences, setShowOnlyDifferences] = useState(false);

  // Quick Add states
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickAddSearch, setQuickAddSearch] = useState('');
  const [quickAddResults, setQuickAddResults] = useState<Component[]>([]);
  const [quickAddLoading, setQuickAddLoading] = useState(false);

  // Parse IDs from URL
  const idsParam = searchParams.get('ids') ?? '';
  const ids = useMemo(() => idsParam ? idsParam.split(',').map(Number).filter(Boolean) : [], [idsParam]);

  const [items, setItems] = useState<ComponentWithPrices[]>([]);
  const [loading, setLoading] = useState(ids.length > 0);

  const category = items[0]?.component.category;
  const specKeys = category ? CATEGORY_SPECS[category] || Object.keys(ALL_SPEC_ROWS) : [];

  function handleShare() {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // Load components whenever URL ids change
  useEffect(() => {
    if (ids.length === 0) {
      setItems([]);
      setLoading(false);
      syncCompareIds([], null);
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
      const filtered = results.filter((r): r is ComponentWithPrices => r !== null);
      setItems(filtered);
      
      // Synchroniser avec l'état global
      if (filtered.length > 0) {
        const cat = filtered[0].component.category;
        syncCompareIds(filtered.map(x => x.component.id), cat);
      } else {
        syncCompareIds([], null);
      }
    }).finally(() => setLoading(false));
  }, [idsParam]); // eslint-disable-line react-hooks/exhaustive-deps

  // Quick Add Search suggestions effect
  useEffect(() => {
    if (!showQuickAdd || !category) return;
    if (!quickAddSearch.trim()) {
      setQuickAddResults([]);
      return;
    }
    setQuickAddLoading(true);
    const delayDebounce = setTimeout(() => {
      smartSearch({
        category: category as ComponentCategory,
        search: quickAddSearch,
        limit: 5,
        compatible_only: false
      }).then(res => {
        // Filter out components already in the comparison
        setQuickAddResults(res.components.filter(c => !ids.includes(c.id)));
      }).catch(() => {
        setQuickAddResults([]);
      }).finally(() => {
        setQuickAddLoading(false);
      });
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [quickAddSearch, showQuickAdd, category, ids]);

  function removeComponent(id: number) {
    const newIds = ids.filter(i => i !== id);
    if (newIds.length === 0) setSearchParams({});
    else setSearchParams({ ids: newIds.join(',') });
    removeFromCompare(id);
  }

  // Identify tech specs whose values are identical across all compared components
  const identicalKeys = useMemo(() => {
    if (items.length < 2) return new Set<string>();
    const set = new Set<string>();
    specKeys.forEach(key => {
      const firstVal = String(getSpecValue(items[0].component, key) ?? '');
      const allSame = items.every(item => 
        String(getSpecValue(item.component, key) ?? '') === firstVal
      );
      if (allSame) {
        set.add(key);
      }
    });
    return set;
  }, [items, specKeys]);

  const displayedSpecKeys = useMemo(() => {
    if (!showOnlyDifferences) return specKeys;
    return specKeys.filter(key => !identicalKeys.has(key));
  }, [specKeys, identicalKeys, showOnlyDifferences]);

  const totalCols = items.length + (items.length < MAX_COMPARE ? 1 : 0);

  const lowestPrices = items.map(item => item.lowestPrice).filter((p): p is number => p !== null);
  const absoluteLowest = lowestPrices.length > 1 ? Math.min(...lowestPrices) : null;

  // Find best value per row (handles numbers and ranked strings)
  function getBestValue(key: string): number | null {
    const row = ALL_SPEC_ROWS[key];
    if (!row?.highlight) return null;

    const nums = items
      .map(item => {
        const v = getSpecValue(item.component, key);
        if (typeof v === 'number') return v;
        if (typeof v === 'string' && SPEC_RANKINGS[key]?.[v]) return SPEC_RANKINGS[key][v];
        return null;
      })
      .filter((v): v is number => v !== null);

    if (nums.length < 2) return null;
    return row.highlight === 'higher' ? Math.max(...nums) : Math.min(...nums);
  }

  if (ids.length === 0 && !loading) {
    return (
      <div className={styles.emptyState}>
        <div className={styles.emptyIconWrap}><BarChart3 size={48} strokeWidth={1.5} /></div>
        <h2 className={styles.emptyTitle}>{UI.compare.emptyTitle}</h2>
        <p className={styles.emptyText}>{UI.compare.emptyText}</p>
        <Link to="/components" className={styles.browseBtn}>{UI.compare.browseCatalog}</Link>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div className={styles.headerContent}>
          <div className={styles.headerLeft}>
            <Link to="/" className={styles.back}><ArrowLeft size={16} /> {UI.compare.back}</Link>
            <h1 className={styles.title}>{UI.compare.title}</h1>
            {category && <div className={styles.categoryBadge}>{CATEGORY_LABELS[category as ComponentCategory]}</div>}
          </div>
          <div className={styles.headerActions}>
            {items.length >= 2 && (
              <button 
                className={`${styles.toggleDiffBtn} ${showOnlyDifferences ? styles.toggleDiffBtnActive : ''}`}
                onClick={() => setShowOnlyDifferences(prev => !prev)}
              >
                <span>{showOnlyDifferences ? 'Afficher similitudes' : 'Masquer similitudes'}</span>
              </button>
            )}
            <button className={`${styles.shareBtn} ${copied ? styles.copied : ''}`} onClick={handleShare}>
              {copied ? <Check size={16} /> : <Share2 size={16} />}
              <span>{copied ? 'Copié !' : 'Partager'}</span>
            </button>
          </div>
        </div>
      </header>

      {loading && <div className={styles.loadingBar} />}

      {/* Versus Split Hero Card (Exactly 2 items) */}
      {items.length === 2 && (
        <div className={styles.vsContainer}>
          <div className={styles.vsHeroInfo}>
            <div className={styles.vsTitle}>
              <span className={styles.vsBadge}>Versus Mode</span>
              {formatComponentName(items[0].component)} <span style={{ opacity: 0.5 }}>vs</span> {formatComponentName(items[1].component)}
            </div>
            <div className={styles.vsSubtext}>
              {(() => {
                const scoreA = Number(getSpecValue(items[0].component, 'benchmark_score')) || 0;
                const scoreB = Number(getSpecValue(items[1].component, 'benchmark_score')) || 0;
                const priceA = items[0].lowestPrice || 0;
                const priceB = items[1].lowestPrice || 0;

                if (scoreA && scoreB) {
                  const perfDiff = Math.round(((scoreA - scoreB) / scoreB) * 100);
                  const priceDiff = priceA && priceB ? Math.round(((priceA - priceB) / priceB) * 100) : 0;

                  if (perfDiff > 0 && priceDiff < 0) {
                    return `Le ${formatComponentName(items[0].component)} est ${Math.abs(perfDiff)}% plus puissant et ${Math.abs(priceDiff)}% moins cher. C'est l'option recommandée de loin !`;
                  }
                  if (perfDiff < 0 && priceDiff > 0) {
                    return `Le ${formatComponentName(items[1].component)} est ${Math.abs(perfDiff)}% plus puissant et ${Math.abs(priceDiff)}% moins cher. C'est l'option recommandée de loin !`;
                  }
                  if (perfDiff > 0 && priceDiff > 0) {
                    return `Le ${formatComponentName(items[0].component)} est ${Math.abs(perfDiff)}% plus performant, mais coûte ${Math.abs(priceDiff)}% de plus.`;
                  }
                  if (perfDiff < 0 && priceDiff < 0) {
                    return `Le ${formatComponentName(items[0].component)} est ${Math.abs(priceDiff)}% moins cher, mais offre ${Math.abs(perfDiff)}% de performances en moins.`;
                  }
                }
                
                // Fallback price-only comparison
                if (priceA && priceB) {
                  const priceDiff = Math.round(((priceA - priceB) / priceB) * 100);
                  if (priceDiff < 0) return `Le ${formatComponentName(items[0].component)} est ${Math.abs(priceDiff)}% moins cher que son concurrent.`;
                  if (priceDiff > 0) return `Le ${formatComponentName(items[1].component)} est ${Math.abs(priceDiff)}% moins cher que son concurrent.`;
                }

                return "Comparez les caractéristiques techniques détaillées et les prix en temps réel ci-dessous.";
              })()}
            </div>
            {(() => {
              const scoreA = Number(getSpecValue(items[0].component, 'benchmark_score')) || 0;
              const scoreB = Number(getSpecValue(items[1].component, 'benchmark_score')) || 0;
              const nameA = items[0].component.brand || 'Produit A';
              const nameB = items[1].component.brand || 'Produit B';
              
              if (!scoreA || !scoreB) return null;

              const chartData = [
                { name: nameA, Score: scoreA, fill: '#3b82f6' },
                { name: nameB, Score: scoreB, fill: '#a855f7' }
              ];

              return (
                <div className={styles.vsChartContainer}>
                  <div className={styles.vsChartLabel}>Indice de puissance brute (Benchmark)</div>
                  <ResponsiveContainer width="100%" height={90}>
                    <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 15, left: -25, bottom: 5 }}>
                      <XAxis type="number" hide />
                      <YAxis dataKey="name" type="category" stroke="var(--text-muted)" fontSize={11} axisLine={false} tickLine={false} />
                      <Tooltip 
                        contentStyle={{ 
                          background: 'var(--bg-surface-2)', 
                          border: '1px solid var(--border-subtle)', 
                          borderRadius: 8,
                          fontSize: '11px',
                          color: 'var(--text-primary)'
                        }} 
                      />
                      <Bar dataKey="Score" radius={[0, 99, 99, 0]} barSize={12}>
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              );
            })()}
          </div>
          {(() => {
            const scoreA = Number(getSpecValue(items[0].component, 'benchmark_score')) || 0;
            const scoreB = Number(getSpecValue(items[1].component, 'benchmark_score')) || 0;
            const priceA = items[0].lowestPrice || 0;
            const priceB = items[1].lowestPrice || 0;

            if (scoreA && scoreB && priceA && priceB) {
              const valA = scoreA / priceA;
              const valB = scoreB / priceB;
              const ratio = valA > valB ? Math.round((valA / valB - 1) * 100) : Math.round((valB / valA - 1) * 100);
              const winner = valA > valB ? formatComponentName(items[0].component) : formatComponentName(items[1].component);
              return (
                <div className={styles.vsSummaryCard}>
                  <span className={styles.vsSummaryLabel}>Meilleur Rapport Perf/Prix</span>
                  <span className={styles.vsSummaryValue}>{winner}</span>
                  <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>+{ratio}% d'efficacité d'achat</span>
                </div>
              );
            }
            return null;
          })()}
        </div>
      )}

      <div className={styles.compareGrid} style={{ '--cols': totalCols } as any}>
        {/* Row 1: Headers */}
        <div className={styles.rowSticky}>
          <div className={styles.cornerCol}>
             {items.length > 0 && <span className={styles.compareCount}>{items.length} / {MAX_COMPARE}</span>}
          </div>
          {items.map(item => (
            <div key={item.component.id} className={styles.headerCol}>
              <button className={styles.removeBtn} onClick={() => removeComponent(item.component.id)}>
                <X size={16} />
              </button>
              <div className={styles.imgWrap}>
                <img src={item.component.image_url} alt="" referrerPolicy="no-referrer" />
              </div>
              <div className={styles.compInfo}>
                <span className={styles.brand}>{item.component.brand}</span>
                <Link to={LinkEngine.getProductUrl(item.component)} className={styles.name}>{formatComponentName(item.component)}</Link>
                <div className={styles.price}>
                   {item.lowestPrice ? formatPrice(item.lowestPrice) : 'Rupture'}
                </div>
              </div>
            </div>
          ))}
          {items.length < MAX_COMPARE && (
             <div className={`${styles.addSlot} ${showQuickAdd ? styles.addSlotActive : ''}`}>
                {!showQuickAdd ? (
                   <button className={styles.addBtnEmptySlot} onClick={() => setShowQuickAdd(true)}>
                      <Plus size={24} />
                      <span>Ajouter</span>
                   </button>
                ) : (
                   <div className={styles.quickAddContainer}>
                      <div className={styles.quickAddHeader}>
                         <input
                            type="text"
                            className={styles.quickAddInput}
                            placeholder="Rechercher…"
                            value={quickAddSearch}
                            onChange={e => setQuickAddSearch(e.target.value)}
                            autoFocus
                         />
                         <button className={styles.quickAddClose} onClick={() => { setShowQuickAdd(false); setQuickAddSearch(''); }}>
                            <X size={14} />
                         </button>
                      </div>
                      <div className={styles.quickAddBody}>
                         {quickAddLoading && <div className={styles.quickAddLoading}>Chargement…</div>}
                         {!quickAddLoading && quickAddResults.length === 0 && quickAddSearch.trim() !== '' && (
                            <div className={styles.quickAddNoResults}>Aucun résultat</div>
                         )}
                         {!quickAddLoading && quickAddSearch.trim() === '' && (
                            <div className={styles.quickAddPrompt}>Rechercher un produit...</div>
                         )}
                         <div className={styles.quickAddList}>
                            {quickAddResults.map(prod => (
                               <div 
                                  key={prod.id} 
                                  className={styles.quickAddRow}
                                  title={formatComponentName(prod)}
                                  onClick={() => {
                                     const newIds = [...ids, prod.id];
                                     setSearchParams({ ids: newIds.join(',') });
                                     setShowQuickAdd(false);
                                     setQuickAddSearch('');
                                  }}
                               >
                                  {prod.image_url ? (
                                    <img src={prod.image_url} alt="" className={styles.quickAddThumb} referrerPolicy="no-referrer" />
                                  ) : (
                                    <div className={styles.quickAddThumbPlaceholder}><Plus size={12} /></div>
                                  )}
                                  <div className={styles.quickAddInfo}>
                                     <span className={styles.quickAddBrand}>{prod.brand}</span>
                                     <span className={styles.quickAddName}>
                                        {formatComponentName(prod)}
                                     </span>
                                  </div>
                                  <Plus size={14} className={styles.quickAddPlusIcon} />
                               </div>
                            ))}
                         </div>
                      </div>
                   </div>
                )}
             </div>
          )}
        </div>

        {/* Comparison Body */}
        <div className={styles.tableBody}>
            {/* Price Section */}
            <div className={styles.sectionDivider}>Prix et Offres</div>
            <div className={styles.specRow}>
                <div className={styles.labelCol}>Meilleur prix</div>
                {items.map(item => {
                    const isLowest = absoluteLowest !== null && item.lowestPrice === absoluteLowest;
                    return (
                        <div key={item.component.id} className={`${styles.valCol} ${isLowest ? styles.isBest : ''}`}>
                            <span className={styles.primaryPrice}>{item.lowestPrice ? formatPrice(item.lowestPrice) : '—'}</span>
                            {isLowest && <CheckCircle2 size={14} className={styles.bestIcon} />}
                        </div>
                    );
                })}
            </div>
            <div className={styles.specRow}>
                <div className={styles.labelCol}>Offres</div>
                {items.map(item => (
                    <div key={item.component.id} className={styles.valCol}>
                        <div className={styles.offersList}>
                            {item.prices.slice(0, 3).map(p => (
                                <a key={p.product_url} href={p.product_url} target="_blank" className={styles.offerLink}>
                                    {p.retailer_name} <span>{formatPrice(p.price)}</span>
                                </a>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            {/* Value for Money Row */}
            {(() => {
              const hasBenchmarks = items.some(item => Number(getSpecValue(item.component, 'benchmark_score')) > 0);
              if (!hasBenchmarks) return null;

              const valueScores = items.map(item => {
                const score = Number(getSpecValue(item.component, 'benchmark_score')) || 0;
                const price = item.lowestPrice || 0;
                return score && price ? (score / price) : 0;
              });
              const maxScore = Math.max(...valueScores);

              return (
                <div className={styles.specRow}>
                  <div className={styles.labelCol}>Rapport Perf/Prix</div>
                  {items.map((item, idx) => {
                    const currentScore = valueScores[idx];
                    const isWinner = maxScore > 0 && currentScore === maxScore;
                    const scorePct = maxScore > 0 ? Math.round((currentScore / maxScore) * 100) : 0;

                    return (
                      <div key={item.component.id} className={`${styles.valCol} ${isWinner ? styles.isBest : ''}`}>
                        {isWinner && <CheckCircle2 size={14} className={styles.bestIcon} />}
                        <div className={styles.performanceChartWrapper}>
                          <div className={styles.chartValueRow}>
                            <span style={{ fontWeight: isWinner ? 800 : 600 }}>
                              {currentScore > 0 ? `${Math.round(currentScore * 10) / 10} pts/DH` : '—'}
                            </span>
                            <span className={styles.chartPct}>{scorePct}%</span>
                          </div>
                          <div className={styles.progressBarTrack}>
                            <div 
                              className={styles.progressBarFill} 
                              style={{ 
                                width: `${scorePct}%`,
                                background: isWinner ? 'linear-gradient(90deg, #10b981, #34d399)' : undefined
                              }} 
                            />
                          </div>
                          {isWinner && (
                            <span className={`${styles.valueBadge} ${styles.gagnant}`}>
                              Meilleur Choix
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {/* Specs Section */}
            <div className={styles.sectionDivider}>Caractéristiques</div>
            {displayedSpecKeys.map(key => {
                const row = ALL_SPEC_ROWS[key] || { label: key };
                const bestVal = getBestValue(key);
                return (
                    <div key={key} className={styles.specRow}>
                        <div className={styles.labelCol}>{row.label}</div>
                        {items.map(item => {
                            const raw = getSpecValue(item.component, key);
                            const valToCompare = typeof raw === 'number' ? raw : (typeof raw === 'string' ? SPEC_RANKINGS[key]?.[raw] : null);
                            const isBest = bestVal !== null && valToCompare !== null && valToCompare === bestVal;

                            const isNumeric = typeof raw === 'number' && raw > 0;
                            const isRanked = typeof raw === 'string' && SPEC_RANKINGS[key]?.[raw];
                            const showChart = row.highlight && (isNumeric || isRanked);

                            let pct = 0;
                            if (showChart && bestVal) {
                              const currentVal = isNumeric ? raw : (isRanked ? SPEC_RANKINGS[key][raw as string] : 0);
                              const maxVal = row.highlight === 'higher' 
                                ? bestVal 
                                : Math.max(...items.map(i => {
                                    const r = getSpecValue(i.component, key);
                                    return typeof r === 'number' ? r : (typeof r === 'string' ? SPEC_RANKINGS[key]?.[r] : 0);
                                  }).filter(Boolean) as number[]);
                              
                              if (row.highlight === 'higher') {
                                pct = maxVal > 0 ? Math.round((currentVal / maxVal) * 100) : 0;
                              } else {
                                const minVal = bestVal;
                                pct = currentVal > 0 ? Math.round((minVal / currentVal) * 100) : 0;
                              }
                            }

                            return (
                                <div key={item.component.id} className={`${styles.valCol} ${isBest ? styles.isBest : ''}`}>
                                    {isBest && <CheckCircle2 size={14} className={styles.bestIcon} />}
                                    
                                    {showChart ? (
                                      <div className={styles.performanceChartWrapper}>
                                          <div className={styles.chartValueRow}>
                                              <span>{formatSpecVal(raw, row.unit)}</span>
                                              <span className={styles.chartPct}>{pct}%</span>
                                          </div>
                                          <div className={styles.progressBarTrack}>
                                              <div className={styles.progressBarFill} style={{ width: `${pct}%` }} />
                                          </div>
                                      </div>
                                    ) : (
                                      formatSpecVal(raw, row.unit)
                                    )}
                                </div>
                            );
                        })}
                    </div>
                );
            })}
        </div>
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getSpecValue(component: Component, key: string): unknown {
  const flat = (component as unknown as Record<string, unknown>)[key];
  if (flat !== undefined && flat !== null) return flat;
  const specs = component.specs as Record<string, unknown> | undefined;
  return specs?.[key] ?? null;
}

function formatSpecVal(value: unknown, unit?: string): React.ReactNode {
  if (value === null || value === undefined || value === '') return <span className={styles.emptySpec}>—</span>;
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'boolean') return value ? 'Oui' : <span className={styles.emptySpec}>Non</span>;
  const str = String(value);
  if (str === 'None' || str === 'Non' || str === '—') {
    return <span className={styles.emptySpec}>{str === 'None' ? 'Non' : str}</span>;
  }
  return unit ? `${str} ${unit}` : str;
}
