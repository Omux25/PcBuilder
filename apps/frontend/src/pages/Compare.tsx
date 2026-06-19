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
import { useShare } from '../hooks/useShare';
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
import { BarChart, Bar, XAxis, YAxis, Tooltip, Cell, ResponsiveContainer, Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from 'recharts';
import { CategoryIcon } from '../components/CategoryIcon';
import { FadeImage } from '../components/FadeImage';
import { SEO } from '../components/SEO';
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

const SPEC_GROUPS = [
  {
    title: 'Performance',
    keys: ['benchmark_score', 'core_count', 'thread_count', 'base_clock_ghz', 'boost_clock_ghz', 'frequency_mhz', 'read_speed_mbps', 'write_speed_mbps']
  },
  {
    title: 'Spécifications Principales',
    keys: ['socket', 'chipset', 'vram_gb', 'capacity_gb', 'wattage', 'efficiency_rating', 'modular']
  },
  {
    title: 'Mémoire & Interfaces',
    keys: ['ram_type', 'supported_ram_types', 'max_ram_frequency', 'ram_slots', 'm2_slots', 'cas_latency', 'interface_type']
  },
  {
    title: 'Physique & Compatibilité',
    keys: ['tdp', 'max_tdp', 'form_factor', 'length_mm', 'max_gpu_length_mm', 'max_cooler_height_mm', 'height_mm', 'supported_motherboards', 'supported_sockets']
  }
];

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
  const { copied, handleShare } = useShare();
  const { compareIds, syncCompareIds, removeFromCompare } = useCompare();

  // Show only differences toggle state
  const [showOnlyDifferences, setShowOnlyDifferences] = useState(false);

  // Parse IDs from URL
  const idsParam = searchParams.get('ids');
  const ids = useMemo(() => idsParam ? idsParam.split(',').map(Number).filter(Boolean) : [], [idsParam]);

  const [items, setItems] = useState<ComponentWithPrices[]>([]);
  const [loading, setLoading] = useState(ids.length > 0);

  const category = items[0]?.component.category;
  const specKeys = category ? CATEGORY_SPECS[category] || Object.keys(ALL_SPEC_ROWS) : [];

  // Recover state from global context if URL is empty
  useEffect(() => {
    if (!idsParam && compareIds.length > 0) {
      setSearchParams({ ids: compareIds.join(',') }, { replace: true });
    }
  }, [idsParam, compareIds, setSearchParams]);

  // Load components whenever URL ids change
  useEffect(() => {
    if (ids.length === 0) {
      setItems([]);
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
        <SEO title="Comparateur" description="Comparez les composants PC." />
        <div className={styles.emptyIconWrap}><BarChart3 size={48} strokeWidth={1.5} /></div>
        <h2 className={styles.emptyTitle}>{UI.compare.emptyTitle}</h2>
        <p className={styles.emptyText}>{UI.compare.emptyText}</p>
        <Link to="/composants" className={styles.browseBtn}>{UI.compare.browseCatalog}</Link>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <SEO 
        title="Comparateur"
        description="Comparez les spécifications, performances et prix des composants PC au Maroc. Trouvez le meilleur rapport qualité/prix."
      />
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
          <div className={styles.vsHeader}>Versus Mode</div>
          <div className={styles.vsBody}>
            {/* Item 0 Pros & Cons */}
            <div className={styles.vsItem}>
               <h3 className={styles.vsItemName}>{formatComponentName(items[0].component)}</h3>
               <div className={styles.vsPrice}>{items[0].lowestPrice ? formatPrice(items[0].lowestPrice) : 'Rupture'}</div>
               {(() => {
                 const { pros, cons } = generateProsCons(items[0], items, displayedSpecKeys);
                 return (
                   <div className={styles.vsProsCons}>
                     {pros.map((p, i) => <div key={`pro-${i}`} className={styles.proItem}><CheckCircle2 size={14} className={styles.proIcon}/> {p}</div>)}
                     {cons.map((c, i) => <div key={`con-${i}`} className={styles.conItem}><X size={14} className={styles.conIcon}/> {c}</div>)}
                   </div>
                 );
               })()}
            </div>

            {/* Radar Chart */}
            <div className={styles.vsRadarContainer}>
               {(() => {
                  const radarAxes = displayedSpecKeys.filter(k => ALL_SPEC_ROWS[k]?.highlight).slice(0, 5);
                  if (radarAxes.length < 3) return <div style={{opacity: 0.5, textAlign: 'center', fontSize: 12}}>Pas assez de données</div>;

                  const radarData = radarAxes.map(key => {
                     const row = ALL_SPEC_ROWS[key];
                     const valA = Number(getSpecValue(items[0].component, key)) || 0;
                     const valB = Number(getSpecValue(items[1].component, key)) || 0;
                     const maxVal = Math.max(valA, valB);
                     
                     let normA = 0, normB = 0;
                     if (maxVal > 0) {
                        if (row.highlight === 'higher') {
                           normA = (valA / maxVal) * 100;
                           normB = (valB / maxVal) * 100;
                        } else {
                           const minVal = Math.min(valA || Infinity, valB || Infinity);
                           normA = valA ? (minVal / valA) * 100 : 0;
                           normB = valB ? (minVal / valB) * 100 : 0;
                        }
                     }
                     return { 
                        subject: row.label, 
                        A: normA, 
                        B: normB, 
                        fullMark: 100,
                        realA: valA,
                        realB: valB,
                        unit: row.unit || ''
                     };
                  });

                  return (
                    <ResponsiveContainer width="100%" height={220}>
                      <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData} margin={{top: 10, right: 10, bottom: 10, left: 10}}>
                        <PolarGrid stroke="var(--border-subtle)" />
                        <PolarAngleAxis dataKey="subject" tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} />
                        <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                        <Radar name={formatComponentName(items[0].component)} dataKey="A" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.4} />
                        <Radar name={formatComponentName(items[1].component)} dataKey="B" stroke="#a855f7" fill="#a855f7" fillOpacity={0.4} />
                        <Tooltip 
                          contentStyle={{ background: 'var(--bg-surface-2)', border: '1px solid var(--border-subtle)', borderRadius: 8, fontSize: '11px', color: 'var(--text-primary)' }}
                          formatter={(value: any, name: string, props: any) => {
                            // Find the original real value from the data payload
                            const realVal = props.dataKey === 'A' ? props.payload.realA : props.payload.realB;
                            const unit = props.payload.unit ? ` ${props.payload.unit}` : '';
                            return [`${realVal}${unit}`, name];
                          }}
                        />
                      </RadarChart>
                    </ResponsiveContainer>
                  );
               })()}
            </div>

            {/* Item 1 Pros & Cons */}
            <div className={styles.vsItem}>
               <h3 className={styles.vsItemName}>{formatComponentName(items[1].component)}</h3>
               <div className={styles.vsPrice}>{items[1].lowestPrice ? formatPrice(items[1].lowestPrice) : 'Rupture'}</div>
               {(() => {
                 const { pros, cons } = generateProsCons(items[1], items, displayedSpecKeys);
                 return (
                   <div className={styles.vsProsCons}>
                     {pros.map((p, i) => <div key={`pro-${i}`} className={styles.proItem}><CheckCircle2 size={14} className={styles.proIcon}/> {p}</div>)}
                     {cons.map((c, i) => <div key={`con-${i}`} className={styles.conItem}><X size={14} className={styles.conIcon}/> {c}</div>)}
                   </div>
                 );
               })()}
            </div>
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
                <FadeImage src={item.component.image_url} alt={item.component.name} referrerPolicy="no-referrer" loading="lazy" fetchpriority="low" />
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
             <Link to={category ? `/parcourir/${category}` : "/composants"} className={styles.addSlot}>
                <Plus size={28} />
                <span>Ajouter un composant</span>
             </Link>
          )}
        </div>

        {/* Comparison Body */}
        <div className={styles.tableBody}>
            {/* Purchase & Value Section */}
            <div className={styles.specGroup}>
                <div className={styles.groupHeader}>Achat & Offres</div>
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
                    <div className={styles.labelCol}>Détaillants</div>
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
            </div>

            {/* Specifications Groups */}
            {SPEC_GROUPS.map(group => {
                const groupKeys = displayedSpecKeys.filter(k => group.keys.includes(k));
                if (groupKeys.length === 0) return null;

                return (
                    <div key={group.title} className={styles.specGroup}>
                        <div className={styles.groupHeader}>{group.title}</div>
                        {groupKeys.map(key => {
                            const row = ALL_SPEC_ROWS[key] || { label: key };
                            const bestVal = getBestValue(key);
                            return (
                                <div key={key} className={styles.specRow}>
                                    <div className={styles.labelCol}>{row.label}</div>
                                    {items.map(item => {
                                        const raw = getSpecValue(item.component, key);
                                        const rawNum = Number(raw);
                                        const isNumeric = raw !== null && raw !== '' && typeof raw !== 'boolean' && !isNaN(rawNum) && rawNum > 0;
                                        const isRanked = typeof raw === 'string' && !!SPEC_RANKINGS[key]?.[raw];
                                        const isIdentical = identicalKeys.has(key);
                                        const valToCompare = isNumeric ? rawNum : (isRanked ? SPEC_RANKINGS[key][raw as string] : null);
                                        const isBest = !isIdentical && bestVal !== null && valToCompare !== null && valToCompare === bestVal;
                                        const showChart = !isIdentical && row.highlight && (isNumeric || isRanked);

                                        let pct = 0;
                                        let diffText = '';

                                        if (showChart && bestVal) {
                                          const currentVal = isNumeric ? rawNum : (isRanked ? SPEC_RANKINGS[key][raw as string] : 0);
                                          const isHigherBetter = row.highlight === 'higher';
                                          
                                          // For exact difference display (+X%)
                                          const numericVals = items.map(i => {
                                             const v = getSpecValue(i.component, key);
                                             return Number(v) || (typeof v === 'string' ? SPEC_RANKINGS[key]?.[v] || 0 : 0);
                                          }).filter(Boolean);

                                          const worstVal = isHigherBetter ? Math.min(...numericVals) : Math.max(...numericVals);
                                            
                                          if (worstVal && currentVal !== worstVal) {
                                             const pctDiff = isHigherBetter 
                                                ? ((currentVal - worstVal) / worstVal) * 100
                                                : ((worstVal - currentVal) / currentVal) * 100;
                                             
                                             if (pctDiff > 0) {
                                                diffText = `+${Math.round(pctDiff)}%`;
                                             }
                                          }

                                          // For Progress bar scaling
                                          const maxVal = isHigherBetter ? bestVal : Math.max(...numericVals);
                                          
                                          if (isHigherBetter) {
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
                                                          <span className={styles.chartPct} style={{ color: diffText && isBest ? 'var(--success)' : 'inherit' }}>
                                                            {diffText}
                                                          </span>
                                                      </div>
                                                      <div className={styles.progressBarTrack}>
                                                          <div className={styles.progressBarFill} style={{ width: `${pct}%`, background: diffText && isBest ? 'var(--success)' : undefined }} />
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
                );
            })}
        </div>
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function generateProsCons(item: ComponentWithPrices, allItems: ComponentWithPrices[], specKeys: string[]) {
  const pros: string[] = [];
  const cons: string[] = [];

  if (allItems.length < 2) return { pros, cons };

  const myPrice = item.lowestPrice;
  const others = allItems.filter(i => i.component.id !== item.component.id);
  
  // Benchmark
  const myPerf = Number(getSpecValue(item.component, 'benchmark_score'));
  if (myPerf) {
    const avgOtherPerf = others.reduce((acc, curr) => acc + (Number(getSpecValue(curr.component, 'benchmark_score')) || 0), 0) / others.length;
    if (avgOtherPerf > 0) {
      const diff = Math.round(((myPerf - avgOtherPerf) / avgOtherPerf) * 100);
      const absDiff = Math.round(Math.abs(myPerf - avgOtherPerf));
      if (diff >= 5) pros.push(`+${absDiff} pts de perf. (+${diff}%)`);
      else if (diff <= -5) cons.push(`-${absDiff} pts de perf. (${diff}%)`);
    }
  }

  // Price
  if (myPrice) {
    const minOtherPrice = Math.min(...others.map(o => o.lowestPrice || Infinity));
    if (minOtherPrice !== Infinity && myPrice !== minOtherPrice) {
      const diff = Math.round(((myPrice - minOtherPrice) / minOtherPrice) * 100);
      const absDiff = Math.abs(myPrice - minOtherPrice);
      if (diff <= -5) pros.push(`${formatPrice(absDiff)} moins cher (${Math.abs(diff)}%)`);
      else if (diff >= 5) cons.push(`${formatPrice(absDiff)} plus cher (${diff}%)`);
    }
  }

  // Other Specs
  specKeys.forEach(key => {
    if (key === 'benchmark_score') return;
    const row = ALL_SPEC_ROWS[key];
    if (!row?.highlight) return;

    const myVal = Number(getSpecValue(item.component, key));
    if (!myVal) return;

    const otherVals = others.map(o => Number(getSpecValue(o.component, key))).filter(v => v);
    if (otherVals.length === 0) return;

    const avgOther = otherVals.reduce((a, b) => a + b, 0) / otherVals.length;
    const diff = ((myVal - avgOther) / avgOther) * 100;
    
    const isHigherBetter = row.highlight === 'higher';
    
    if (Math.abs(diff) >= 8) {
      const formattedDiff = Math.abs(Math.round(diff));
      const absDiff = Math.abs(myVal - avgOther);
      let formattedAbsDiff = absDiff % 1 === 0 ? absDiff.toString() : absDiff.toFixed(1);
      if (row.unit) formattedAbsDiff += ` ${row.unit}`;
      
      const labelText = row.label.toLowerCase();

      if (isHigherBetter) {
        if (diff > 0) pros.push(`+${formattedAbsDiff} ${labelText} (+${formattedDiff}%)`);
        else cons.push(`-${formattedAbsDiff} ${labelText} (-${formattedDiff}%)`);
      } else {
        if (diff < 0) pros.push(`-${formattedAbsDiff} ${labelText} (-${formattedDiff}%)`);
        else cons.push(`+${formattedAbsDiff} ${labelText} (+${formattedDiff}%)`);
      }
    }
  });

  return { pros: pros.slice(0, 4), cons: cons.slice(0, 3) };
}

function getSpecValue(component: Component, key: string): unknown {
  const flat = (component as unknown as Record<string, unknown>)[key];
  if (flat !== undefined && flat !== null) return flat;
  let parsedSpecs: Record<string, unknown> | undefined = undefined;
  if (component.specs) {
    if (typeof component.specs === 'string') {
      try { parsedSpecs = JSON.parse(component.specs); } catch (e) {}
    } else {
      parsedSpecs = component.specs as Record<string, unknown>;
    }
  }
  const specs = parsedSpecs;
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
