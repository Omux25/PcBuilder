import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Link, useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Search, ChevronLeft, ChevronRight, GitCompare, Filter, ArrowUpDown, ArrowUp, ArrowDown, X, ChevronDown } from 'lucide-react';
import { smartSearch, type SmartComponent } from '../api';
import { CategoryIcon } from '../components/CategoryIcon';
import { Skeleton } from '../components/Skeleton';
import type { Component, ComponentCategory } from '../types';
import { CATEGORY_LABELS, CATEGORY_ORDER, SLUG_TO_CATEGORY } from '../types';
import { useBuild } from '../context/BuildContext';
import { useCompare } from '../context/CompareContext';
import { formatComponentName } from '@shared/formatting/component-name.formatter';
import { LinkEngine } from '@shared/link-engine';
import { SEO } from '../components/SEO';
import { FadeImage } from '../components/FadeImage';
import styles from './CategoryBrowse.module.css';

const LIMIT = 20;
const DEBOUNCE_MS = 350;


const SOCKET_CATEGORIES = new Set<ComponentCategory>(['cpu', 'motherboard']);
const RAM_TYPE_CATEGORIES = new Set<ComponentCategory>(['ram', 'motherboard']);

const AccordionCheckboxFilterGroup = <T extends string | number>({
  label,
  options,
  values,
  onChange,
  formatLabel = (v: T) => String(v),
  unit = '',
  searchable = false,
  defaultOpen = false
}: {
  label: string;
  options: T[];
  values: T[];
  onChange: (newValues: T[]) => void;
  formatLabel?: (v: T) => string;
  unit?: string;
  searchable?: boolean;
  defaultOpen?: boolean;
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [search, setSearch] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);

  const cleanOptions = useMemo(() => {
    return options.filter(opt => opt !== null && opt !== undefined && String(opt).trim() !== '');
  }, [options]);

  const filteredOptions = useMemo(() => {
    if (!search) return cleanOptions;
    const lower = search.toLowerCase();
    return cleanOptions.filter(opt => formatLabel(opt).toLowerCase().includes(lower));
  }, [cleanOptions, search, formatLabel]);

  const handleToggle = (opt: T) => {
    if (values.includes(opt)) {
      onChange(values.filter(v => v !== opt));
    } else {
      onChange([...values, opt]);
    }
  };

  const displayedOptions = search
    ? filteredOptions
    : (isExpanded ? cleanOptions : cleanOptions.slice(0, 6));

  const showToggleButton = !search && cleanOptions.length > 6;

  return (
    <div className={styles.accordionGroup}>
      <button 
        type="button"
        className={styles.accordionHeader} 
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
      >
        <span className={styles.accordionLabel}>
          {label}
          <span className={`${styles.accordionBadge} ${values.length > 0 ? styles.accordionBadgeVisible : styles.accordionBadgeHidden}`}>
            {values.length > 0 ? values.length : '0'}
          </span>
        </span>
        <ChevronDown size={14} className={`${styles.accordionIcon} ${isOpen ? styles.accordionIconOpen : ''}`} />
      </button>
      <div className={`${styles.accordionContentWrap} ${isOpen ? styles.accordionContentWrapOpen : ''}`}>
        <div className={styles.accordionContentInner}>
          {searchable && cleanOptions.length > 5 && (
            <div className={styles.accordionSearchWrap}>
              <input
                type="text"
                className={styles.accordionSearchInput}
                placeholder="Rechercher..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          )}
          <div className={styles.scrollContainer}>
            {displayedOptions.map(opt => {
              const isChecked = values.includes(opt);
              return (
                <label key={opt} className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    className={styles.checkboxInput}
                    checked={isChecked}
                    onChange={() => handleToggle(opt)}
                  />
                  <span className={styles.checkboxText}>
                    {formatLabel(opt)}{unit ? ` ${unit}` : ''}
                  </span>
                </label>
              );
            })}
            {filteredOptions.length === 0 && (
              <div className={styles.accordionNoResults}>
                {search ? 'Aucun résultat' : 'Aucune option disponible'}
              </div>
            )}
            {showToggleButton && (
              <button
                type="button"
                className={styles.showMoreBtn}
                onClick={() => setIsExpanded(!isExpanded)}
              >
                {isExpanded ? '- Voir moins' : `+ ${cleanOptions.length - 6} autres`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};// ── Per-category column definitions ──────────────────────────────────────────

interface ColDef {
  header: string;
  width?: string;
  sortKey?: string;
  render: (c: Component) => React.ReactNode;
}

function getColDefs(cat: ComponentCategory): ColDef[] {
  const str = (v: unknown) => (v != null && v !== '' ? String(v) : '—');

  switch (cat) {
    case 'cpu':
      return [
        { header: 'Cœurs', width: '42px', sortKey: 'core_count', render: c => str(c.core_count) },
        { header: 'Fréq. base', width: '68px', sortKey: 'base_clock_ghz', render: c => c.base_clock_ghz ? `${c.base_clock_ghz} GHz` : '—' },
        { header: 'Fréq. boost', width: '68px', sortKey: 'boost_clock_ghz', render: c => c.boost_clock_ghz ? `${c.boost_clock_ghz} GHz` : '—' },
        { header: 'Socket', width: '65px', sortKey: 'socket', render: c => str(c.socket) },
        { header: 'TDP', width: '45px', sortKey: 'tdp', render: c => c.tdp ? `${c.tdp}W` : '—' },
      ];
    case 'motherboard':
      return [
        { header: 'Socket', width: '65px', sortKey: 'socket', render: c => str(c.socket) },
        { header: 'Chipset', width: '65px', sortKey: 'chipset', render: c => str(c.chipset) },
        { header: 'Format', width: '60px', sortKey: 'form_factor', render: c => str(c.form_factor) },
        {
          header: 'RAM',
          width: '75px',
          render: c => {
            if (!c.supported_ram_types || c.supported_ram_types.length === 0) return '—';
            return c.supported_ram_types.join(', ');
          }
        },
        { header: 'Slots RAM', width: '55px', sortKey: 'ram_slots', render: c => c.ram_slots ? String(c.ram_slots) : '—' },
      ];
    case 'gpu':
      return [
        { header: 'Chipset', width: '95px', sortKey: 'chipset', render: c => str(c.chipset) },
        { header: 'VRAM', width: '55px', sortKey: 'vram_gb', render: c => c.vram_gb ? `${c.vram_gb} Go` : '—' },
        { header: 'TDP', width: '48px', sortKey: 'tdp', render: c => c.tdp ? `${c.tdp}W` : '—' },
        { header: 'Longueur', width: '68px', sortKey: 'length_mm', render: c => c.length_mm ? `${c.length_mm}mm` : '—' },
      ];
    case 'ram':
      return [
        { header: 'Type', width: '45px', sortKey: 'ram_type', render: c => str(c.ram_type) },
        { header: 'Capacité', width: '55px', sortKey: 'capacity_gb', render: c => c.capacity_gb ? `${c.capacity_gb} Go` : '—' },
        { header: 'Fréquence', width: '68px', sortKey: 'frequency_mhz', render: c => c.frequency_mhz ? `${c.frequency_mhz} MHz` : '—' },
        { header: 'Kit', width: '30px', sortKey: 'kit_count', render: c => c.kit_count && c.kit_count > 1 ? `${c.kit_count}×` : '1×' },
        { header: 'Latence', width: '45px', sortKey: 'cas_latency', render: c => c.cas_latency ? `CL${c.cas_latency}` : '—' },
        {
          header: 'PRIX/GO',
          width: '55px',
          sortKey: 'price_per_gb',
          render: c => {
            if (!c.lowest_price || !c.capacity_gb) return '—';
            return `${Math.round(c.lowest_price / c.capacity_gb)} MAD`;
          },
        },
      ];
    case 'storage':
      return [
        { header: 'Capacité', width: '55px', sortKey: 'capacity_gb', render: c => { const v = c.capacity_gb; if (!v) return '—'; return v >= 1000 ? `${v / 1000} To` : `${v} Go`; } },
        { header: 'Interface', width: '75px', sortKey: 'interface_type', render: c => str(c.interface_type) },
        { header: 'Lecture', width: '65px', sortKey: 'read_speed_mbps', render: c => c.read_speed_mbps ? `${c.read_speed_mbps} Mo/s` : '—' },
        { header: 'Écriture', width: '65px', sortKey: 'write_speed_mbps', render: c => c.write_speed_mbps ? `${c.write_speed_mbps} Mo/s` : '—' },
        {
          header: 'PRIX/GO',
          width: '55px',
          sortKey: 'price_per_gb',
          render: c => {
            if (!c.lowest_price || !c.capacity_gb) return '—';
            return `${Math.round(c.lowest_price / c.capacity_gb)} MAD`;
          },
        },
      ];
    case 'psu':
      return [
        { header: 'Puissance', width: '60px', sortKey: 'wattage', render: c => c.wattage ? `${c.wattage}W` : '—' },
        {
          header: 'Certification',
          width: '85px',
          sortKey: 'efficiency_rating',
          render: c => {
            const val = str(c.efficiency_rating);
            if (val === '—') return val;
            const valLower = val.toLowerCase();
            let displayVal = val;
            if (valLower.includes('titanium')) displayVal = 'Titanium';
            else if (valLower.includes('platinum')) displayVal = 'Platinum';
            else if (valLower.includes('gold')) displayVal = 'Gold';
            else if (valLower.includes('silver')) displayVal = 'Silver';
            else if (valLower.includes('bronze')) displayVal = 'Bronze';
            else if (valLower.includes('80+')) displayVal = '80+';
            else if (valLower.includes('80plus') || valLower.includes('80 plus')) displayVal = '80+';
            return displayVal;
          }
        },
        {
          header: 'Modulaire',
          width: '75px',
          sortKey: 'modular',
          render: c => {
            const val = str(c.modular);
            if (val === '—') return val;
            const valLower = val.toLowerCase();
            let displayVal: string;
            if (valLower.includes('full')) {
              displayVal = 'Modulaire';
            } else if (valLower.includes('semi')) {
              displayVal = 'Semi';
            } else {
              displayVal = 'Non';
            }
            return displayVal;
          }
        },
      ];
    case 'case':
      return [
        {
          header: 'Format MB',
          width: '80px',
          render: c => {
            if (!c.supported_motherboards || c.supported_motherboards.length === 0) return '—';
            return c.supported_motherboards.join(', ');
          }
        },
        { header: 'GPU max', width: '65px', sortKey: 'max_gpu_length_mm', render: c => c.max_gpu_length_mm ? `${c.max_gpu_length_mm}mm` : '—' },
        { header: 'Ventirad max', width: '80px', sortKey: 'max_cooler_height_mm', render: c => c.max_cooler_height_mm ? `${c.max_cooler_height_mm}mm` : '—' },
      ];
    case 'cooling':
      return [
        {
          header: 'Type',
          width: '55px',
          render: c => {
            const n = c.name.toLowerCase();
            const isAio = c.tags?.includes('aio') ||
                          c.height_mm === 52 ||
                          n.includes('aio') || 
                          n.includes('liquid') || 
                          n.includes('watercooler') || 
                          n.includes('water cooling');
            return isAio ? 'AIO' : 'Air';
          }
        },
        { header: 'Hauteur', width: '52px', sortKey: 'height_mm', render: c => c.height_mm ? `${c.height_mm}mm` : '—' },
        { header: 'TDP max', width: '52px', sortKey: 'max_tdp', render: c => c.max_tdp ? `${c.max_tdp}W` : '—' },
      ];
    case 'fan':
      return [
        { header: 'Taille', width: '52px', sortKey: 'height_mm', render: c => c.height_mm ? `${c.height_mm}mm` : '—' },
        { header: 'Flux d\'air', width: '60px', sortKey: 'airflow_cfm', render: c => c.airflow_cfm ? `${c.airflow_cfm} CFM` : '—' },
        { header: 'Bruit', width: '52px', sortKey: 'noise_db', render: c => (c as Component & { noise_db?: number }).noise_db ? `${(c as Component & { noise_db?: number }).noise_db} dB` : '—' },
        { header: 'Pack', width: '42px', sortKey: 'pack_size', render: c => (c as Component & { pack_size?: number }).pack_size ? `${(c as Component & { pack_size?: number }).pack_size}×` : '1×' },
      ];
    case 'thermal_paste':
      return [
        { header: 'Poids', width: '52px', sortKey: 'weight_grams', render: c => (c as Component & { weight_grams?: number }).weight_grams ? `${(c as Component & { weight_grams?: number }).weight_grams}g` : '—' },
        { header: 'Conductivité', width: '68px', sortKey: 'thermal_conductivity', render: c => (c as Component & { thermal_conductivity?: number }).thermal_conductivity ? `${(c as Component & { thermal_conductivity?: number }).thermal_conductivity} W/mK` : '—' },
      ];
    default:
      return [];
  }
}



export function CategoryBrowse() {
  const { category: rawCategory, slotKey } = useParams<{ category: string; slotKey?: string }>();
  const category = (SLUG_TO_CATEGORY[rawCategory || ''] || rawCategory) as ComponentCategory;
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { build, addToBuild } = useBuild();
  const { addToCompare, isInCompare, removeFromCompare } = useCompare();

  const cat = category as ComponentCategory;
  const isCore = CATEGORY_ORDER.slice(0, 9).includes(cat); 
  const isSelecting = !!slotKey || isCore;

  const colDefs = useMemo(() => getColDefs(cat), [cat]);
  const totalCols = 2 + colDefs.length + 2;

  // ── Filter state ──
  const [search, setSearch] = useState(searchParams.get('q') ?? '');
  const [selectedBrands, setSelectedBrands] = useState<string[]>(() => {
    const brandsParam = searchParams.get('brands');
    if (brandsParam) return brandsParam.split(',').filter(Boolean);
    const brandParam = searchParams.get('brand');
    return brandParam ? [brandParam] : [];
  });
  const [selectedSockets, setSelectedSockets] = useState<string[]>(() => {
    const socketsParam = searchParams.get('sockets');
    if (socketsParam) return socketsParam.split(',').filter(Boolean);
    const socketParam = searchParams.get('socket');
    return socketParam ? [socketParam] : [];
  });
  const [selectedRamTypes, setSelectedRamTypes] = useState<string[]>(() => {
    const ramTypesParam = searchParams.get('ram_types');
    if (ramTypesParam) return ramTypesParam.split(',').filter(Boolean);
    const ramTypeParam = searchParams.get('ram_type');
    return ramTypeParam ? [ramTypeParam] : [];
  });
  const [selectedVram, setSelectedVram] = useState<number[]>(() => {
    const vramsParam = searchParams.get('vrams') || searchParams.get('vram_gbs');
    if (vramsParam) return vramsParam.split(',').map(Number).filter(n => !isNaN(n));
    const vramParam = searchParams.get('vram_gb');
    return vramParam ? [Number(vramParam)].filter(n => !isNaN(n)) : [];
  });
  const [minWattage, setMinWattage] = useState(searchParams.get('min_wattage') ?? '');
  const [maxWattage, setMaxWattage] = useState(searchParams.get('max_wattage') ?? '');
  const [minCapacity, setMinCapacity] = useState(searchParams.get('min_capacity') ?? '');
  const [maxCapacity, setMaxCapacity] = useState(searchParams.get('max_capacity') ?? '');
  const [minFreq, setMinFreq] = useState(searchParams.get('min_freq') ?? '');
  const [maxFreq, setMaxFreq] = useState(searchParams.get('max_freq') ?? '');
  const [minPrice, setMinPrice] = useState(searchParams.get('min_price') ?? '');
  const [maxPrice, setMaxPrice] = useState(searchParams.get('max_price') ?? '');
  const [inStockOnly, setInStockOnly] = useState(searchParams.get('in_stock') === 'true');
  const [compatibleOnly, setCompatibleOnly] = useState(searchParams.get('compatible_only') !== 'false'); // Default true
  const [selectedChipsets, setSelectedChipsets] = useState<string[]>(() => {
    const chipsetsParam = searchParams.get('chipsets');
    if (chipsetsParam) return chipsetsParam.split(',').filter(Boolean);
    const chipsetParam = searchParams.get('chipset');
    return chipsetParam ? [chipsetParam] : [];
  });
  const [selectedFormFactors, setSelectedFormFactors] = useState<string[]>(() => {
    const formFactorsParam = searchParams.get('form_factors');
    if (formFactorsParam) return formFactorsParam.split(',').filter(Boolean);
    const formFactorParam = searchParams.get('form_factor');
    return formFactorParam ? [formFactorParam] : [];
  });
  const [selectedInterfaces, setSelectedInterfaces] = useState<string[]>(() => {
    const interfacesParam = searchParams.get('interfaces');
    if (interfacesParam) return interfacesParam.split(',').filter(Boolean);
    const interfaceParam = searchParams.get('interface_type') || searchParams.get('interface');
    return interfaceParam ? [interfaceParam] : [];
  });
  const [selectedEfficiencies, setSelectedEfficiencies] = useState<string[]>(() => {
    const efficienciesParam = searchParams.get('efficiencies');
    if (efficienciesParam) return efficienciesParam.split(',').filter(Boolean);
    const efficiencyParam = searchParams.get('efficiency_rating') || searchParams.get('efficiency');
    return efficiencyParam ? [efficiencyParam] : [];
  });
  const [selectedModulars, setSelectedModulars] = useState<string[]>(() => {
    const modularsParam = searchParams.get('modulars');
    if (modularsParam) return modularsParam.split(',').filter(Boolean);
    const modularParam = searchParams.get('modular');
    return modularParam ? [modularParam] : [];
  });
  const [selectedCoolingTypes, setSelectedCoolingTypes] = useState<string[]>(() => {
    const param = searchParams.get('cooling_types');
    if (param) return param.split(',').filter(Boolean);
    const singleParam = searchParams.get('cooling_type');
    return singleParam ? [singleParam] : [];
  });
  const [coreCount, setCoreCount] = useState(searchParams.get('core_count') ?? '');

  const initialSortBy = useMemo(() => {
    const paramSortBy = searchParams.get('sortBy');
    if (paramSortBy) return paramSortBy;
    const paramSort = searchParams.get('sort');
    if (paramSort && paramSort !== 'smart') {
      const parts = paramSort.split('_');
      if (parts.length > 1) {
        const orderPart = parts[parts.length - 1];
        if (['asc', 'desc', 'ASC', 'DESC'].includes(orderPart)) {
          return parts.slice(0, parts.length - 1).join('_');
        }
      }
    }
    return '';
  }, [searchParams]);

  const initialSortOrder = useMemo(() => {
    const paramSortOrder = searchParams.get('sortOrder');
    if (paramSortOrder) return paramSortOrder.toUpperCase() as 'ASC' | 'DESC';
    const paramSort = searchParams.get('sort');
    if (paramSort && paramSort !== 'smart') {
      const parts = paramSort.split('_');
      if (parts.length > 1) {
        const orderPart = parts[parts.length - 1];
        if (['asc', 'desc', 'ASC', 'DESC'].includes(orderPart)) {
          return orderPart.toUpperCase() as 'ASC' | 'DESC';
        }
      }
    }
    return 'ASC';
  }, [searchParams]);

  const [sortBy, setSortBy] = useState<string>(initialSortBy);
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>(initialSortOrder);
  const [page, setPage] = useState(Number(searchParams.get('page') ?? '1'));

  // ── Data state ──
  const [components, setComponents] = useState<SmartComponent[]>([]);
  const [total, setTotal] = useState(0);
  const [inStockTotal, setInStockTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableBrands, setAvailableBrands] = useState<string[]>([]);
  const [availableSockets, setAvailableSockets] = useState<string[]>([]);
  const [availableVram, setAvailableVram] = useState<number[]>([]);
  const [availableChipsets, setAvailableChipsets] = useState<string[]>([]);
  const [availableFormFactors, setAvailableFormFactors] = useState<string[]>([]);

  const abortRef = useRef<AbortController | null>(null);
  const hasDataRef = useRef(false);
  const tableRef = useRef<HTMLDivElement>(null);
  const filterMountedRef = useRef(false);

  useEffect(() => {
    hasDataRef.current = false;
    filterMountedRef.current = false;
    setLoading(true);
    setComponents([]);
    setTotal(0);
  }, [cat]);

  const buildContext = useMemo(() => {
    if (!slotKey) return build;
    const ctx = { ...build };
    delete ctx[slotKey];
    return ctx;
  }, [build, slotKey]);

  const fetchComponents = useCallback(async (
    searchTerm: string, brandFilter: string | string[], socketFilter: string | string[],
    ramTypeFilter: string | string[], pageNum: number, sortByVal: string, sortOrderVal: 'ASC' | 'DESC',
    minPriceVal: string, maxPriceVal: string, inStockVal: boolean, compatOnlyVal: boolean, vramGbVal: number | number[],
    minWatt: string, maxWatt: string, minCap: string, maxCap: string, minF: string, maxF: string,
    chipsetVal: string | string[], formFactorVal: string | string[], interfaceVal: string | string[], efficiencyVal: string | string[], modularVal: string | string[], coolingTypeVal: string | string[], coreVal: string
  ) => {
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();
    setFetching(true);
    if (!hasDataRef.current) setLoading(true);
    setError(null);
    try {
      const { 
        components: list, total: t, in_stock_total: ist, 
        available_brands: ab, available_sockets: as_, available_vram: av,
        available_chipsets: ac, available_form_factors: aff
      } = await smartSearch({
        category: cat, search: searchTerm || undefined, 
        brand: (Array.isArray(brandFilter) && brandFilter.length > 0) ? brandFilter : (typeof brandFilter === 'string' && brandFilter) ? brandFilter : undefined,
        socket: (Array.isArray(socketFilter) && socketFilter.length > 0) ? socketFilter : (typeof socketFilter === 'string' && socketFilter) ? socketFilter : undefined,
        ram_type: (Array.isArray(ramTypeFilter) && ramTypeFilter.length > 0) ? ramTypeFilter : (typeof ramTypeFilter === 'string' && ramTypeFilter) ? ramTypeFilter : undefined,
        vram_gb: (Array.isArray(vramGbVal) && vramGbVal.length > 0) ? vramGbVal : (typeof vramGbVal === 'number' && vramGbVal > 0) ? vramGbVal : undefined,
        sortBy: sortByVal || undefined,
        sortOrder: sortOrderVal || undefined,
        min_price: minPriceVal ? Number(minPriceVal) : undefined,
        max_price: maxPriceVal ? Number(maxPriceVal) : undefined,
        min_wattage: minWatt ? Number(minWatt) : undefined,
        max_wattage: maxWatt ? Number(maxWatt) : undefined,
        min_capacity_gb: minCap ? Number(minCap) : undefined,
        max_capacity_gb: maxCap ? Number(maxCap) : undefined,
        min_frequency_mhz: minF ? Number(minF) : undefined,
        max_frequency_mhz: maxF ? Number(maxF) : undefined,
        chipset: (Array.isArray(chipsetVal) && chipsetVal.length > 0) ? chipsetVal : (typeof chipsetVal === 'string' && chipsetVal) ? chipsetVal : undefined,
        form_factor: (Array.isArray(formFactorVal) && formFactorVal.length > 0) ? formFactorVal : (typeof formFactorVal === 'string' && formFactorVal) ? formFactorVal : undefined,
        interface_type: (Array.isArray(interfaceVal) && interfaceVal.length > 0) ? interfaceVal : (typeof interfaceVal === 'string' && interfaceVal) ? interfaceVal : undefined,
        efficiency_rating: (Array.isArray(efficiencyVal) && efficiencyVal.length > 0) ? efficiencyVal : (typeof efficiencyVal === 'string' && efficiencyVal) ? efficiencyVal : undefined,
        modular: (Array.isArray(modularVal) && modularVal.length > 0) ? modularVal : (typeof modularVal === 'string' && modularVal) ? modularVal : undefined,
        cooling_type: (Array.isArray(coolingTypeVal) && coolingTypeVal.length > 0) ? coolingTypeVal : (typeof coolingTypeVal === 'string' && coolingTypeVal) ? coolingTypeVal : undefined,
        core_count: coreVal ? Number(coreVal) : undefined,
        in_stock: inStockVal || undefined, 
        compatible_only: compatOnlyVal,
        build: buildContext, page: pageNum, limit: LIMIT,
      });
      setComponents(list); setTotal(t); setInStockTotal(ist);
      hasDataRef.current = true;
      setAvailableVram(av ?? []); // Always sync smart VRAM options
      setAvailableBrands(ab ?? []); 
      setAvailableSockets(as_ ?? []); 
      setAvailableChipsets(ac ?? []); 
      setAvailableFormFactors(aff ?? []);
    } catch (e: unknown) {
      if (e instanceof Error && e.name !== 'AbortError') setError(e.message);
    } finally { setLoading(false); setFetching(false); }
  }, [cat, buildContext]);

  const fetchRef = useRef(fetchComponents);
  useEffect(() => { fetchRef.current = fetchComponents; }, [fetchComponents]);

  // Track previous search to only debounce on search changes
  const prevSearchRef = useRef(search);

  useEffect(() => {
    if (!filterMountedRef.current) {
      filterMountedRef.current = true;
      fetchRef.current(search, selectedBrands, selectedSockets, selectedRamTypes, page, sortBy, sortOrder, minPrice, maxPrice, inStockOnly, compatibleOnly, selectedVram, minWattage, maxWattage, minCapacity, maxCapacity, minFreq, maxFreq, selectedChipsets, selectedFormFactors, selectedInterfaces, selectedEfficiencies, selectedModulars, selectedCoolingTypes, coreCount);
      return;
    }
    
    // Determine debounce delay: only debounce for search input
    const isSearchChange = search !== prevSearchRef.current;
    prevSearchRef.current = search;

    const timeout = setTimeout(() => {
      fetchRef.current(search, selectedBrands, selectedSockets, selectedRamTypes, page, sortBy, sortOrder, minPrice, maxPrice, inStockOnly, compatibleOnly, selectedVram, minWattage, maxWattage, minCapacity, maxCapacity, minFreq, maxFreq, selectedChipsets, selectedFormFactors, selectedInterfaces, selectedEfficiencies, selectedModulars, selectedCoolingTypes, coreCount);
      
      const params: Record<string, string> = {};
      if (search) params.q = search;
      if (selectedBrands.length > 0) params.brands = selectedBrands.join(',');
      if (selectedSockets.length > 0) params.sockets = selectedSockets.join(',');
      if (selectedRamTypes.length > 0) params.ram_types = selectedRamTypes.join(',');
      if (selectedVram.length > 0) params.vrams = selectedVram.join(',');
      if (minWattage) params.min_wattage = minWattage;
      if (maxWattage) params.max_wattage = maxWattage;
      if (minCapacity) params.min_capacity = minCapacity;
      if (maxCapacity) params.max_capacity = maxCapacity;
      if (minFreq) params.min_freq = minFreq;
      if (maxFreq) params.max_freq = maxFreq;
      if (selectedChipsets.length > 0) params.chipsets = selectedChipsets.join(',');
      if (selectedFormFactors.length > 0) params.form_factors = selectedFormFactors.join(',');
      if (selectedInterfaces.length > 0) params.interfaces = selectedInterfaces.join(',');
      if (selectedEfficiencies.length > 0) params.efficiencies = selectedEfficiencies.join(',');
      if (selectedModulars.length > 0) params.modulars = selectedModulars.join(',');
      if (selectedCoolingTypes.length > 0) params.cooling_types = selectedCoolingTypes.join(',');
      if (coreCount) params.core_count = coreCount;
      if (minPrice) params.min_price = minPrice;
      if (maxPrice) params.max_price = maxPrice;
      if (inStockOnly) params.in_stock = 'true';
      if (!compatibleOnly) params.compatible_only = 'false';
      if (sortBy) {
        params.sortBy = sortBy;
        params.sortOrder = sortOrder;
      }
      if (page > 1) params.page = String(page);

      setSearchParams(params, { replace: true });
    }, isSearchChange ? DEBOUNCE_MS : 0);
    
    return () => clearTimeout(timeout);
  }, [search, selectedBrands, selectedSockets, selectedRamTypes, selectedVram, minWattage, maxWattage, minCapacity, maxCapacity, minFreq, maxFreq, selectedChipsets, selectedFormFactors, selectedInterfaces, selectedEfficiencies, selectedModulars, selectedCoolingTypes, coreCount, minPrice, maxPrice, sortBy, sortOrder, inStockOnly, compatibleOnly, page, setSearchParams]);

  const totalPages = Math.ceil(total / LIMIT);

  const handleAdd = (c: SmartComponent) => { addToBuild(c, slotKey); navigate('/build'); };

  const toggleSort = (key: string) => {
    setPage(1);
    if (sortBy === key) {
      if (sortOrder === 'ASC') {
        setSortOrder('DESC');
      } else {
        setSortBy('');
        setSortOrder('ASC');
      }
    } else {
      setSortBy(key);
      setSortOrder('ASC');
    }
  };

  const getSortIcon = (key: string) => {
    const isActive = sortBy === key;
    if (isActive) {
      return sortOrder === 'ASC' 
        ? <ArrowUp size={12} className={styles.activeSortIcon} />
        : <ArrowDown size={12} className={styles.activeSortIcon} />;
    }
    return <ArrowUpDown size={12} className={styles.sortIcon} />;
  };

  const changePage = (newPage: number) => {
    setPage(newPage);
    setTimeout(() => { tableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 50);
  };

  const clearFilters = () => { 
    setPage(1);
    setSearch('');
    setSelectedBrands([]); setSelectedSockets([]); setSelectedRamTypes([]); setSelectedVram([]); 
    setMinPrice(''); setMaxPrice('');
    setMinWattage(''); setMaxWattage('');
    setMinCapacity(''); setMaxCapacity('');
    setMinFreq(''); setMaxFreq('');
    setSelectedChipsets([]); setSelectedFormFactors([]); setSelectedInterfaces([]); setSelectedEfficiencies([]); setSelectedModulars([]); setCoreCount('');
    setSelectedCoolingTypes([]);
    setInStockOnly(false); setCompatibleOnly(true);
    setSortBy(''); setSortOrder('ASC');
  };

  const onFilterChange = <T,>(setter: (val: T) => void) => (val: T) => {
    setPage(1);
    setter(val);
  };

  const activeFilters = [
    search, selectedBrands.length ? '1' : '', selectedSockets.length ? '1' : '', selectedRamTypes.length ? '1' : '', selectedVram.length ? '1' : '', 
    minPrice, maxPrice, minWattage, maxWattage, minCapacity, maxCapacity, minFreq, maxFreq,
    selectedChipsets.length ? '1' : '', selectedFormFactors.length ? '1' : '', selectedInterfaces.length ? '1' : '', selectedEfficiencies.length ? '1' : '', selectedModulars.length ? '1' : '', selectedCoolingTypes.length ? '1' : '', coreCount, sortBy
  ].filter(Boolean).length;

  if (!CATEGORY_ORDER.includes(cat)) {
    return <div className={styles.error}><p>Catégorie inconnue.</p></div>;
  }

  return (
    <div className={styles.page}>
      <SEO 
        title={CATEGORY_LABELS[cat] as string}
        description={`Parcourez et comparez les meilleurs ${CATEGORY_LABELS[cat].toLowerCase()} pour votre configuration PC Gamer ou bureautique au Maroc. Prix, spécifications et compatibilité.`}
      />
      <nav className={styles.breadcrumb}>
        <Link to="/" className={styles.breadcrumbLink}>Accueil</Link>
        <span className={styles.breadcrumbSep}>›</span>
        <span className={styles.breadcrumbCurrent}>{CATEGORY_LABELS[cat]}</span>
      </nav>

      <div className={styles.pageHeader}>
        <div className={styles.pageHeaderLeft}>
          <span className={styles.catIconWrap}>
            <CategoryIcon category={cat} size={20} />
          </span>
          <h1 className={styles.title}>
            {isSelecting ? 'Sélectionner ' : 'Parcourir '}{CATEGORY_LABELS[cat]}
          </h1>
        </div>
      </div>

      {error && <div className={styles.errorMsg}>{error}</div>}

      <div className={styles.layout}>
        <aside className={styles.sidebar}>
          <div className={styles.sidebarHeader}>
            <label className={styles.filterLabel}><Filter size={13} /> Filtres</label>
            <button 
              className={`${styles.clearFiltersBtn} ${activeFilters > 0 ? styles.clearFiltersBtnVisible : styles.clearFiltersBtnHidden}`} 
              onClick={clearFilters}
            >
              Réinitialiser
            </button>
          </div>

          <label className={styles.toggleRow}>
            <span className={styles.toggleLabel}>Compatible uniquement</span>
            <div className={styles.switch}>
              <input 
                type="checkbox" 
                checked={compatibleOnly} 
                onChange={e => onFilterChange(setCompatibleOnly)(e.target.checked)} 
              />
              <span className={styles.slider} />
            </div>
          </label>

          <label className={styles.toggleRow}>
            <span className={styles.toggleLabel}>En stock uniquement</span>
            <div className={styles.switch}>
              <input 
                type="checkbox" 
                checked={inStockOnly} 
                onChange={e => onFilterChange(setInStockOnly)(e.target.checked)} 
              />
              <span className={styles.slider} />
            </div>
          </label>

          <div className={styles.divider} />

          {availableBrands.length > 0 && (
            <AccordionCheckboxFilterGroup
              label="Marque"
              options={availableBrands}
              values={selectedBrands}
              onChange={onFilterChange(setSelectedBrands)}
              defaultOpen={true}
              searchable={true}
            />
          )}

          {cat === 'cooling' && (
            <AccordionCheckboxFilterGroup
              label="Type"
              options={['Air', 'AIO']}
              values={selectedCoolingTypes}
              onChange={onFilterChange(setSelectedCoolingTypes)}
              defaultOpen={true}
            />
          )}

          {SOCKET_CATEGORIES.has(cat) && availableSockets.length > 0 && (
            <AccordionCheckboxFilterGroup
              label="Socket"
              options={availableSockets}
              values={selectedSockets}
              onChange={onFilterChange(setSelectedSockets)}
              searchable={availableSockets.length > 8}
            />
          )}

          {RAM_TYPE_CATEGORIES.has(cat) && (
            <AccordionCheckboxFilterGroup
              label="Type RAM"
              options={['DDR4', 'DDR5']}
              values={selectedRamTypes}
              onChange={onFilterChange(setSelectedRamTypes)}
            />
          )}

          {(cat === 'gpu' || cat === 'motherboard') && availableChipsets.length > 0 && (
            <AccordionCheckboxFilterGroup
              label="Chipset"
              options={availableChipsets}
              values={selectedChipsets}
              onChange={onFilterChange(setSelectedChipsets)}
              searchable={true}
            />
          )}

          {(cat === 'motherboard' || cat === 'case') && availableFormFactors.length > 0 && (
            <AccordionCheckboxFilterGroup
              label="Format"
              options={availableFormFactors}
              values={selectedFormFactors}
              onChange={onFilterChange(setSelectedFormFactors)}
              searchable={availableFormFactors.length > 8}
            />
          )}

          {cat === 'storage' && (
            <AccordionCheckboxFilterGroup
              label="Interface"
              options={['NVMe', 'SATA', 'HDD']}
              values={selectedInterfaces}
              onChange={onFilterChange(setSelectedInterfaces)}
            />
          )}

          {cat === 'psu' && (
            <>
              <AccordionCheckboxFilterGroup
                label="Certification"
                options={['80+ Titanium', '80+ Platinum', '80+ Gold', '80+ Silver', '80+ Bronze', '80+']}
                values={selectedEfficiencies}
                onChange={onFilterChange(setSelectedEfficiencies)}
                formatLabel={v => v.replace('80+ ', '')}
              />
              <AccordionCheckboxFilterGroup
                label="Modularité"
                options={['Full', 'Semi', 'Non']}
                values={selectedModulars}
                onChange={onFilterChange(setSelectedModulars)}
                formatLabel={v => v === 'Full' ? 'Modulaire' : v === 'Semi' ? 'Semi-modulaire' : 'Non-modulaire'}
              />
            </>
          )}

          {cat === 'gpu' && availableVram.length > 0 && (
            <AccordionCheckboxFilterGroup
              label="VRAM"
              options={availableVram}
              values={selectedVram}
              onChange={onFilterChange(setSelectedVram)}
              unit="Go"
            />
          )}

          {cat === 'psu' && (
            <div className={styles.filterGroup}>
              <label className={styles.filterLabel}>Puissance (W)</label>
              <div className={styles.priceRange}>
                <input type="number" className={styles.priceInput} placeholder="Min" value={minWattage} onChange={e => onFilterChange(setMinWattage)(e.target.value)} />
                <input type="number" className={styles.priceInput} placeholder="Max" value={maxWattage} onChange={e => onFilterChange(setMaxWattage)(e.target.value)} />
              </div>
            </div>
          )}

          {cat === 'storage' && (
            <div className={styles.filterGroup}>
              <label className={styles.filterLabel}>Capacité (Go)</label>
              <div className={styles.priceRange}>
                <input type="number" className={styles.priceInput} placeholder="Min" value={minCapacity} onChange={e => onFilterChange(setMinCapacity)(e.target.value)} />
                <input type="number" className={styles.priceInput} placeholder="Max" value={maxCapacity} onChange={e => onFilterChange(setMaxCapacity)(e.target.value)} />
              </div>
            </div>
          )}

          {cat === 'ram' && (
            <div className={styles.filterGroup}>
              <label className={styles.filterLabel}>Fréquence (MHz)</label>
              <div className={styles.priceRange}>
                <input type="number" className={styles.priceInput} placeholder="Min" value={minFreq} onChange={e => onFilterChange(setMinFreq)(e.target.value)} />
                <input type="number" className={styles.priceInput} placeholder="Max" value={maxFreq} onChange={e => onFilterChange(setMaxFreq)(e.target.value)} />
              </div>
            </div>
          )}

          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>Prix (MAD)</label>
            <div className={styles.priceRange}>
              <input type="number" className={styles.priceInput} placeholder="Min" value={minPrice} onChange={e => onFilterChange(setMinPrice)(e.target.value)} />
              <input type="number" className={styles.priceInput} placeholder="Max" value={maxPrice} onChange={e => onFilterChange(setMaxPrice)(e.target.value)} />
            </div>
          </div>
        </aside>


        <section className={styles.mainSection}>
          <div className={styles.toolbar}>
            <div className={styles.searchWrap}>
              <Search size={16} className={styles.searchIcon} />
              <input
                type="search"
                className={styles.searchInput}
                placeholder={`Rechercher ${CATEGORY_LABELS[cat].toLowerCase()}...`}
                value={search}
                onChange={e => onFilterChange(setSearch)(e.target.value)}
              />
              {search && (
                <button
                  className={styles.clearSearch}
                  onClick={() => onFilterChange(setSearch)('')}
                  title="Effacer la recherche"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          <div className={`${styles.tableWrap} ${fetching ? styles.tableWrapFetching : ''}`} ref={tableRef}>
            {total > 0 && (
              <div className={styles.resultsCount}>
                <span>
                  {total} composant{total > 1 ? 's' : ''}
                  {inStockTotal > 0 && ` · ${inStockTotal} en stock`}
                </span>
              </div>
            )}

            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.thImg}></th>
                  <th 
                    className={`${styles.thName} ${styles.sortableHeader}`}
                    onClick={() => toggleSort('name')}
                  >
                    <div className={styles.thContent}>
                      Composant {getSortIcon('name')}
                    </div>
                  </th>
                  {colDefs.map(col => (
                    <th 
                      key={col.header} 
                      className={`${styles.thSpec} ${col.sortKey ? styles.sortableHeader : ''}`} 
                      style={{ width: col.width }}
                      onClick={() => col.sortKey && toggleSort(col.sortKey)}
                    >
                      <div className={styles.thContent} style={{ justifyContent: 'flex-end' }}>
                        {col.header} {col.sortKey && getSortIcon(col.sortKey)}
                      </div>
                    </th>
                  ))}
                  <th 
                    className={`${styles.thPrice} ${styles.sortableHeader}`}
                    onClick={() => toggleSort('price')}
                  >
                    <div className={styles.thContent} style={{ justifyContent: 'flex-end' }}>
                      Prix {getSortIcon('price')}
                    </div>
                  </th>
                  <th className={styles.thAction}></th>
                </tr>
              </thead>
              <tbody>
                {loading && components.length === 0 ? (
                  Array.from({ length: 10 }).map((_, i) => (
                    <tr key={i} className={styles.skeletonRow}>
                      <td colSpan={totalCols}><Skeleton height={44} /></td>
                    </tr>
                  ))
                ) : components.length === 0 ? (
                  <tr>
                    <td colSpan={totalCols} className={styles.emptyCell}>Aucun résultat trouvé.</td>
                  </tr>
                ) : (
                  components.map(c => {
                    const isIncompatible = c.compatibility === 'incompatible';
                    const isCompared = isInCompare(c.id);
                    return (
                      <React.Fragment key={c.id}>
                        <tr 
                          className={`${styles.dataRow} ${isIncompatible ? styles.incompatibleRow : ''}`}
                          onClick={() => {
                            navigate(LinkEngine.getProductUrl(c));
                          }}
                          style={{ cursor: 'pointer' }}
                        >
                          <td className={styles.tdImg}>
                            <Link 
                              to={LinkEngine.getProductUrl(c)} 
                              className={styles.thumbWrapper}
                              style={{ display: 'block' }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              {c.image_url
                                ? <FadeImage src={c.image_url} alt={c.name} className={styles.compThumb} referrerPolicy="no-referrer" loading="lazy" fetchpriority="low" />
                                : <div className={styles.compThumbPlaceholder}><CategoryIcon category={cat} size={16} /></div>
                              }
                            </Link>
                          </td>
                          <td className={styles.tdName}>
                            <div className={styles.nameWrap}>
                              <span className={styles.compBrand}>{c.brand}</span>
                              <Link 
                                to={LinkEngine.getProductUrl(c)} 
                                className={styles.compName} 
                                title={formatComponentName(c)}
                                onClick={(e) => e.stopPropagation()}
                              >
                                {formatComponentName(c, { excludeBrand: true })}
                              </Link>
                            </div>
                          </td>
                          {colDefs.map(col => {
                            const val = col.render(c);
                            if (val === '—') {
                              return (
                                <td key={col.header} className={styles.tdSpec}>
                                  <span className={styles.emptySpec}>—</span>
                                </td>
                              );
                            }
                            if (val === 'None' || val === 'Non') {
                              return (
                                <td key={col.header} className={styles.tdSpec}>
                                  <span className={styles.emptySpec}>Non</span>
                                </td>
                              );
                            }
                            return (
                              <td key={col.header} className={styles.tdSpec}>
                                {val}
                              </td>
                            );
                          })}
                          <td className={styles.tdPrice}>
                            <div className={styles.priceWrap}>
                              {/* Line 1: inline prefix + price */}
                              <div className={styles.priceLine}>
                                <span
                                  className={styles.pricePrefix}
                                  style={{ visibility: c.total_offers && c.total_offers > 1 ? 'visible' : 'hidden' }}
                                >
                                  À partir de
                                </span>
                                <span className={styles.priceVal}>
                                  {Math.floor(c.primary_price ?? c.lowest_price ?? 0)} MAD
                                </span>
                              </div>
                              {/* Line 2: stock status */}
                              <div className={styles.stockLine}>
                                <span className={`${styles.stockBadge} ${c.in_stock ? styles.inStock : styles.outStock}`}>
                                  <span className={c.in_stock ? styles.stockDotActive : styles.stockDotInactive} />
                                  {c.in_stock ? 'En stock' : 'Rupture'}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className={styles.tdAction} onClick={(e) => e.stopPropagation()}>
                            <div className={styles.btnGroup}>
                              {/* Compare Button */}
                              <button 
                                className={`${styles.iconBtn} ${isCompared ? styles.iconBtnActive : ''}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (isCompared) removeFromCompare(c.id);
                                  else addToCompare(c.id, c.category, formatComponentName(c));
                                }}
                                title="Comparer"
                              >
                                <GitCompare size={16} />
                              </button>

                              <button 
                                className={`${styles.addBtn} ${isIncompatible ? styles.addBtnDisabled : ''}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (!isIncompatible) handleAdd(c);
                                }}
                                disabled={isIncompatible}
                                title={isIncompatible ? (c as any).compatibility_issues?.join(' | ') : undefined}
                              >
                                {isIncompatible ? 'Incompatible' : isSelecting ? 'Choisir' : 'Ajouter'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards View */}
          <div className={`${styles.mobileCards} ${fetching ? styles.mobileCardsFetching : ''}`}>
            {loading && components.length === 0 ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className={styles.mobileCardSkeleton}>
                  <Skeleton height={130} />
                </div>
              ))
            ) : components.length === 0 ? (
              <div className={styles.emptyMobile}>Aucun résultat trouvé.</div>
            ) : (
              components.map(c => {
                const isIncompatible = c.compatibility === 'incompatible';
                const isCompared = isInCompare(c.id);
                return (
                  <div 
                    key={c.id} 
                    className={`${styles.mobileCard} ${isIncompatible ? styles.incompatibleCard : ''}`}
                    onClick={() => navigate(LinkEngine.getProductUrl(c))}
                  >
                    <div className={styles.mobileCardTop}>
                      <div className={styles.mobileCardImg}>
                        {c.image_url
                          ? <FadeImage src={c.image_url} alt={c.name} referrerPolicy="no-referrer" loading="lazy" fetchpriority="low" />
                          : <div className={styles.compThumbPlaceholder}><CategoryIcon category={cat} size={20} /></div>
                        }
                      </div>
                      <div className={styles.mobileCardInfo}>
                        <span className={styles.mobileCardBrand}>{c.brand}</span>
                        <h3 className={styles.mobileCardName}>
                          {formatComponentName(c, { excludeBrand: true })}
                        </h3>
                        <div className={styles.mobileCardSpecs}>
                          {colDefs.map(col => {
                            const val = col.render(c);
                            if (val === '—' || val === 'None' || val === 'Non') return null;
                            return (
                              <span key={col.header} className={styles.mobileSpecTag}>
                                <strong>{col.header}:</strong> {val}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    <div className={styles.mobileCardBottom} onClick={e => e.stopPropagation()}>
                      <div className={styles.mobileCardPriceWrap}>
                        <span className={styles.mobileCardPricePrefix} style={{ visibility: c.total_offers && c.total_offers > 1 ? 'visible' : 'hidden' }}>
                          À partir de
                        </span>
                        <span className={styles.mobileCardPrice}>
                          {Math.floor(c.primary_price ?? c.lowest_price ?? 0)} MAD
                        </span>
                        <span className={`${styles.mobileStockBadge} ${c.in_stock ? styles.mobileInStock : styles.mobileOutStock}`}>
                          <span className={c.in_stock ? styles.stockDotActive : styles.stockDotInactive} />
                          {c.in_stock ? 'En stock' : 'Rupture'}
                        </span>
                      </div>
                      <div className={styles.mobileCardActions}>
                        <button 
                          className={`${styles.mobileIconBtn} ${isCompared ? styles.mobileIconBtnActive : ''}`}
                          onClick={() => {
                            if (isCompared) removeFromCompare(c.id);
                            else addToCompare(c.id, c.category, formatComponentName(c));
                          }}
                          title="Comparer"
                        >
                          <GitCompare size={16} />
                        </button>
                        <button 
                          className={`${styles.mobileAddBtn} ${isIncompatible ? styles.mobileAddBtnDisabled : ''}`}
                          onClick={() => {
                            if (!isIncompatible) handleAdd(c);
                          }}
                          disabled={isIncompatible}
                          title={isIncompatible ? (c as any).compatibility_issues?.join(' | ') : undefined}
                        >
                          {isIncompatible ? 'Incom.' : isSelecting ? 'Choisir' : 'Ajouter'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {totalPages > 1 && (
            <div className={styles.pagination}>
              <button className={styles.pageBtn} disabled={page <= 1} onClick={() => changePage(page - 1)}><ChevronLeft size={16} /></button>
              {Array.from({ length: totalPages }).map((_, i) => {
                const p = i + 1;
                if (p === 1 || p === totalPages || (p >= page - 2 && p <= page + 2))
                  return <button key={p} className={`${styles.pageNum} ${p === page ? styles.pageNumActive : ''}`} onClick={() => changePage(p)}>{p}</button>;
                if (p === page - 3 || p === page + 3) return <span key={p}>...</span>;
                return null;
              })}
              <button className={styles.pageBtn} disabled={page >= totalPages} onClick={() => changePage(page + 1)}><ChevronRight size={16} /></button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
