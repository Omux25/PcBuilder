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
import { getComponentById, getPrices } from '../api';
import type { Component, PriceOffer, ComponentCategory } from '../types';
import { CATEGORY_LABELS } from '../types';
import { MAX_COMPARE } from '../context/CompareContext';
import { formatComponentName } from '@shared/component-utils';
import { UI } from '../ui-strings';
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

  // Parse IDs from URL
  const idsParam = searchParams.get('ids') ?? '';
  const ids = useMemo(() => idsParam ? idsParam.split(',').map(Number).filter(Boolean) : [], [idsParam]);

  const [items, setItems] = useState<ComponentWithPrices[]>([]);
  const [loading, setLoading] = useState(ids.length > 0);

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
      setItems(results.filter((r): r is ComponentWithPrices => r !== null));
    }).finally(() => setLoading(false));
  }, [idsParam]); // eslint-disable-line react-hooks/exhaustive-deps

  function removeComponent(id: number) {
    const newIds = ids.filter(i => i !== id);
    if (newIds.length === 0) setSearchParams({});
    else setSearchParams({ ids: newIds.join(',') });
  }

  const category = items[0]?.component.category;
  const specKeys = category ? CATEGORY_SPECS[category] || Object.keys(ALL_SPEC_ROWS) : [];

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
          <button className={`${styles.shareBtn} ${copied ? styles.copied : ''}`} onClick={handleShare}>
            {copied ? <Check size={16} /> : <Share2 size={16} />}
            <span>{copied ? 'Copié !' : 'Partager'}</span>
          </button>
        </div>
      </header>

      {loading && <div className={styles.loadingBar} />}

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
                <Link to={`/product/${item.component.slug}`} className={styles.name}>{formatComponentName(item.component)}</Link>
                <div className={styles.price}>
                   {item.lowestPrice ? `${item.lowestPrice.toLocaleString('fr-MA')} MAD` : 'Rupture'}
                </div>
              </div>
            </div>
          ))}
          {items.length < MAX_COMPARE && (
             <Link to={`/browse/${category || ''}`} className={styles.addSlot}>
                <Plus size={24} />
                <span>Ajouter</span>
             </Link>
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
                            <span className={styles.primaryPrice}>{item.lowestPrice?.toLocaleString('fr-MA')} MAD</span>
                            {isLowest && <CheckCircle2 size={12} className={styles.bestIcon} />}
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
                                    {p.retailer_name} <span>{p.price.toLocaleString('fr-MA')} MAD</span>
                                </a>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            {/* Specs Section */}
            <div className={styles.sectionDivider}>Caractéristiques</div>
            {specKeys.map(key => {
                const row = ALL_SPEC_ROWS[key] || { label: key };
                const bestVal = getBestValue(key);
                return (
                    <div key={key} className={styles.specRow}>
                        <div className={styles.labelCol}>{row.label}</div>
                        {items.map(item => {
                            const raw = getSpecValue(item.component, key);
                            const valToCompare = typeof raw === 'number' ? raw : (typeof raw === 'string' ? SPEC_RANKINGS[key]?.[raw] : null);
                            const isBest = bestVal !== null && valToCompare !== null && valToCompare === bestVal;
                            return (
                                <div key={item.component.id} className={`${styles.valCol} ${isBest ? styles.isBest : ''}`}>
                                    {formatSpecVal(raw, row.unit)}
                                    {isBest && <CheckCircle2 size={12} className={styles.bestIcon} />}
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

function formatSpecVal(value: unknown, unit?: string): string {
  if (value === null || value === undefined || value === '') return '—';
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'boolean') return value ? 'Oui' : 'Non';
  const str = String(value);
  return unit ? `${str} ${unit}` : str;
}
