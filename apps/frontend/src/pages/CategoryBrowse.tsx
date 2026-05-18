import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Link, useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Search, ChevronLeft, ChevronRight, GitCompare, Filter, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { smartSearch, type SmartComponent } from '../api';
import { CategoryIcon } from '../components/CategoryIcon';
import { Skeleton } from '../components/Skeleton';
import type { Component, ComponentCategory } from '../types';
import { CATEGORY_LABELS, CATEGORY_ORDER } from '../types';
import { useBuild } from '../context/BuildContext';
import { useCompare } from '../context/CompareContext';
import { formatComponentName } from '@shared/formatting/component-name.formatter';
import { formatPrice } from '@shared/formatting/price.formatter';
import styles from './CategoryBrowse.module.css';

const LIMIT = 20;
const DEBOUNCE_MS = 350;

type SortOption = string;


const SOCKET_CATEGORIES = new Set<ComponentCategory>(['cpu', 'motherboard']);
const RAM_TYPE_CATEGORIES = new Set<ComponentCategory>(['ram', 'motherboard']);

// ── Per-category column definitions ──────────────────────────────────────────

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
        { header: 'Cœurs', width: '60px', sortKey: 'core_count', render: c => str(c.core_count) },
        { header: 'Fréq. base', width: '85px', sortKey: 'base_clock_ghz', render: c => c.base_clock_ghz ? `${c.base_clock_ghz} GHz` : '—' },
        { header: 'Fréq. boost', width: '85px', sortKey: 'boost_clock_ghz', render: c => c.boost_clock_ghz ? `${c.boost_clock_ghz} GHz` : '—' },
        { header: 'Socket', width: '75px', sortKey: 'socket', render: c => str(c.socket) },
        { header: 'TDP', width: '55px', sortKey: 'tdp', render: c => c.tdp ? `${c.tdp}W` : '—' },
      ];
    case 'motherboard':
      return [
        { header: 'Socket', width: '80px', sortKey: 'socket', render: c => str(c.socket) },
        { header: 'Chipset', width: '80px', sortKey: 'chipset', render: c => str(c.chipset) },
        { header: 'Format', width: '80px', sortKey: 'form_factor', render: c => str(c.form_factor) },
        { header: 'RAM', width: '70px', render: c => c.supported_ram_types?.join('/') || '—' },
        { header: 'Slots RAM', width: '80px', sortKey: 'ram_slots', render: c => c.ram_slots ? String(c.ram_slots) : '—' },
      ];
    case 'gpu':
      return [
        { header: 'Chipset', width: '130px', sortKey: 'chipset', render: c => str(c.chipset) },
        { header: 'VRAM', width: '70px', sortKey: 'vram_gb', render: c => c.vram_gb ? `${c.vram_gb} Go` : '—' },
        { header: 'TDP', width: '60px', sortKey: 'tdp', render: c => c.tdp ? `${c.tdp}W` : '—' },
        { header: 'Longueur', width: '80px', sortKey: 'length_mm', render: c => c.length_mm ? `${c.length_mm}mm` : '—' },
      ];
    case 'ram':
      return [
        { header: 'Type', width: '60px', sortKey: 'ram_type', render: c => str(c.ram_type) },
        { header: 'Capacité', width: '80px', sortKey: 'capacity_gb', render: c => c.capacity_gb ? `${c.capacity_gb} Go` : '—' },
        { header: 'Fréquence', width: '90px', sortKey: 'frequency_mhz', render: c => c.frequency_mhz ? `${c.frequency_mhz} MHz` : '—' },
        { header: 'Kit', width: '50px', sortKey: 'kit_count', render: c => c.kit_count && c.kit_count > 1 ? `${c.kit_count}×` : '1×' },
        { header: 'Latence', width: '70px', sortKey: 'cas_latency', render: c => c.cas_latency ? `CL${c.cas_latency}` : '—' },
        {
          header: 'Prix/Go',
          width: '80px',
          render: c => {
            if (!c.lowest_price || !c.capacity_gb) return '—';
            return `${Math.round(c.lowest_price / c.capacity_gb)} MAD`;
          },
        },
      ];
    case 'storage':
      return [
        { header: 'Capacité', width: '80px', sortKey: 'capacity_gb', render: c => { const v = c.capacity_gb; if (!v) return '—'; return v >= 1000 ? `${v / 1000} To` : `${v} Go`; } },
        { header: 'Interface', width: '80px', sortKey: 'interface_type', render: c => str(c.interface_type) },
        { header: 'Lecture', width: '90px', sortKey: 'read_speed_mbps', render: c => c.read_speed_mbps ? `${c.read_speed_mbps} Mo/s` : '—' },
        { header: 'Écriture', width: '90px', sortKey: 'write_speed_mbps', render: c => c.write_speed_mbps ? `${c.write_speed_mbps} Mo/s` : '—' },
      ];
    case 'psu':
      return [
        { header: 'Puissance', width: '80px', sortKey: 'wattage', render: c => c.wattage ? `${c.wattage}W` : '—' },
        { header: 'Certification', width: '100px', sortKey: 'efficiency_rating', render: c => str(c.efficiency_rating) },
        { header: 'Modulaire', width: '90px', sortKey: 'modular', render: c => str(c.modular) },
      ];
    case 'case':
      return [
        { header: 'Format MB', width: '100px', render: c => c.supported_motherboards?.join('/') || '—' },
        { header: 'GPU max', width: '80px', sortKey: 'max_gpu_length_mm', render: c => c.max_gpu_length_mm ? `${c.max_gpu_length_mm}mm` : '—' },
        { header: 'Ventirad max', width: '100px', sortKey: 'max_cooler_height_mm', render: c => c.max_cooler_height_mm ? `${c.max_cooler_height_mm}mm` : '—' },
      ];
    case 'cooling':
      return [
        { header: 'Type', width: '80px', render: c => { const n = c.name.toLowerCase(); return n.includes('aio') || n.includes('liquid') || n.includes('watercooler') ? 'AIO' : 'Air'; } },
        { header: 'Hauteur', width: '70px', sortKey: 'height_mm', render: c => c.height_mm ? `${c.height_mm}mm` : '—' },
        { header: 'TDP max', width: '70px', sortKey: 'max_tdp', render: c => c.max_tdp ? `${c.max_tdp}W` : '—' },
      ];
    case 'fan':
      return [
        { header: 'Taille', width: '70px', sortKey: 'height_mm', render: c => c.height_mm ? `${c.height_mm}mm` : '—' },
        { header: 'Flux d\'air', width: '80px', sortKey: 'airflow_cfm', render: c => c.airflow_cfm ? `${c.airflow_cfm} CFM` : '—' },
        { header: 'Bruit', width: '70px', sortKey: 'noise_db', render: c => (c as any).noise_db ? `${(c as any).noise_db} dB` : '—' },
        { header: 'Pack', width: '60px', sortKey: 'pack_size', render: c => (c as any).pack_size ? `${(c as any).pack_size}×` : '1×' },
      ];
    case 'thermal_paste':
      return [
        { header: 'Poids', width: '70px', sortKey: 'weight_grams', render: c => (c as any).weight_grams ? `${(c as any).weight_grams}g` : '—' },
        { header: 'Conductivité', width: '90px', sortKey: 'thermal_conductivity', render: c => (c as any).thermal_conductivity ? `${(c as any).thermal_conductivity} W/mK` : '—' },
      ];
    default:
      return [];
  }
}

export function CategoryBrowse() {
  const { category, slotKey } = useParams<{ category: string; slotKey?: string }>();
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
  const [brand, setBrand] = useState(searchParams.get('brand') ?? '');
  const [socket, setSocket] = useState(searchParams.get('socket') ?? '');
  const [ramType, setRamType] = useState(searchParams.get('ram_type') ?? '');
  const [vramGb, setVramGb] = useState(searchParams.get('vram_gb') ? Number(searchParams.get('vram_gb')) : 0);
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
  const [chipset, setChipset] = useState(searchParams.get('chipset') ?? '');
  const [formFactor, setFormFactor] = useState(searchParams.get('form_factor') ?? '');
  const [interfaceType, setInterfaceType] = useState(searchParams.get('interface_type') ?? '');
  const [efficiency, setEfficiency] = useState(searchParams.get('efficiency') ?? '');
  const [modular, setModular] = useState(searchParams.get('modular') ?? '');
  const [coreCount, setCoreCount] = useState(searchParams.get('core_count') ?? '');
  const [sort, setSort] = useState<SortOption>((searchParams.get('sort') as SortOption) ?? 'smart');
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
  const filterResetPageRef = useRef(false);
  const brandsPopulated = useRef(false);
  const prevPageRef = useRef(page);

  useEffect(() => {
    hasDataRef.current = false;
    filterMountedRef.current = false;
    filterResetPageRef.current = false;
    brandsPopulated.current = false;
    prevPageRef.current = Number(searchParams.get('page') ?? '1');
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
    searchTerm: string, brandFilter: string, socketFilter: string,
    ramTypeFilter: string, pageNum: number, sortOption: SortOption,
    minPriceVal: string, maxPriceVal: string, inStockVal: boolean, compatOnlyVal: boolean, vramGbVal: number,
    minWatt: string, maxWatt: string, minCap: string, maxCap: string, minF: string, maxF: string,
    chipsetVal: string, formFactorVal: string, interfaceVal: string, efficiencyVal: string, modularVal: string, coreVal: string
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
        category: cat, search: searchTerm || undefined, brand: brandFilter || undefined,
        socket: socketFilter || undefined, ram_type: ramTypeFilter || undefined,
        vram_gb: vramGbVal || undefined, sort: sortOption,
        min_price: minPriceVal ? Number(minPriceVal) : undefined,
        max_price: maxPriceVal ? Number(maxPriceVal) : undefined,
        min_wattage: minWatt ? Number(minWatt) : undefined,
        max_wattage: maxWatt ? Number(maxWatt) : undefined,
        min_capacity_gb: minCap ? Number(minCap) : undefined,
        max_capacity_gb: maxCap ? Number(maxCap) : undefined,
        min_frequency_mhz: minF ? Number(minF) : undefined,
        max_frequency_mhz: maxF ? Number(maxF) : undefined,
        chipset: chipsetVal || undefined,
        form_factor: formFactorVal || undefined,
        interface_type: interfaceVal || undefined,
        efficiency_rating: efficiencyVal || undefined,
        modular: modularVal || undefined,
        core_count: coreVal ? Number(coreVal) : undefined,
        in_stock: inStockVal || undefined, 
        compatible_only: compatOnlyVal,
        build: buildContext, page: pageNum, limit: LIMIT,
      });
      setComponents(list); setTotal(t); setInStockTotal(ist);
      hasDataRef.current = true;
      setAvailableBrands(ab); setAvailableSockets(as_); setAvailableVram(av ?? []);
      setAvailableChipsets(ac ?? []); setAvailableFormFactors(aff ?? []);
      brandsPopulated.current = true;
    } catch (e: unknown) {
      if (e instanceof Error && e.name !== 'AbortError') setError(e.message);
    } finally { setLoading(false); setFetching(false); }
  }, [cat, buildContext]);

  const fetchRef = useRef(fetchComponents);
  useEffect(() => { fetchRef.current = fetchComponents; }, [fetchComponents]);

  useEffect(() => {
    if (!filterMountedRef.current) {
      filterMountedRef.current = true;
      fetchRef.current(search, brand, socket, ramType, page, sort, minPrice, maxPrice, inStockOnly, compatibleOnly, vramGb, minWattage, maxWattage, minCapacity, maxCapacity, minFreq, maxFreq, chipset, formFactor, interfaceType, efficiency, modular, coreCount);
      return () => { filterMountedRef.current = false; };
    }
    const timeout = setTimeout(() => {
      filterResetPageRef.current = true;
      setPage(1);
      fetchRef.current(search, brand, socket, ramType, 1, sort, minPrice, maxPrice, inStockOnly, compatibleOnly, vramGb, minWattage, maxWattage, minCapacity, maxCapacity, minFreq, maxFreq, chipset, formFactor, interfaceType, efficiency, modular, coreCount);
      const params: Record<string, string> = {};
      if (search) params.q = search;
      if (brand) params.brand = brand;
      if (socket) params.socket = socket;
      if (ramType) params.ram_type = ramType;
      if (vramGb) params.vram_gb = String(vramGb);
      if (minWattage) params.min_wattage = minWattage;
      if (maxWattage) params.max_wattage = maxWattage;
      if (minCapacity) params.min_capacity = minCapacity;
      if (maxCapacity) params.max_capacity = maxCapacity;
      if (minFreq) params.min_freq = minFreq;
      if (maxFreq) params.max_freq = maxFreq;
      if (chipset) params.chipset = chipset;
      if (formFactor) params.form_factor = formFactor;
      if (interfaceType) params.interface_type = interfaceType;
      if (efficiency) params.efficiency = efficiency;
      if (modular) params.modular = modular;
      if (coreCount) params.core_count = coreCount;
      if (minPrice) params.min_price = minPrice;
      if (maxPrice) params.max_price = maxPrice;
      if (inStockOnly) params.in_stock = 'true';
      if (!compatibleOnly) params.compatible_only = 'false';
      if (sort !== 'smart') params.sort = sort;
      setSearchParams(params, { replace: true });
    }, DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [search, brand, socket, ramType, vramGb, minWattage, maxWattage, minCapacity, maxCapacity, minFreq, maxFreq, chipset, formFactor, interfaceType, efficiency, modular, coreCount, minPrice, maxPrice, sort, inStockOnly, compatibleOnly, setSearchParams]);

  useEffect(() => {
    if (filterResetPageRef.current) { filterResetPageRef.current = false; prevPageRef.current = page; return; }
    if (prevPageRef.current === page) return;
    prevPageRef.current = page;
    fetchRef.current(search, brand, socket, ramType, page, sort, minPrice, maxPrice, inStockOnly, compatibleOnly, vramGb, minWattage, maxWattage, minCapacity, maxCapacity, minFreq, maxFreq, chipset, formFactor, interfaceType, efficiency, modular, coreCount);
  }, [page]);


  const totalPages = Math.ceil(total / LIMIT);

  const handleAdd = (c: SmartComponent) => { addToBuild(c, slotKey); navigate('/build'); };

  const toggleSort = (key: string) => {
    let newSort: string = 'smart';
    if (sort === `${key}_asc`) newSort = `${key}_desc`;
    else newSort = `${key}_asc`;
    setSort(newSort as SortOption);
  };

  const getSortIcon = (key: string) => {
    const isAsc = sort === `${key}_asc`;
    const isDesc = sort === `${key}_desc`;
    if (isAsc) return <ArrowUp size={12} className={styles.activeSortIcon} />;
    if (isDesc) return <ArrowDown size={12} className={styles.activeSortIcon} />;
    return <ArrowUpDown size={12} className={styles.sortIcon} />;
  };

  const changePage = (newPage: number) => {
    setPage(newPage);
    const params: Record<string, string> = {};
    if (search) params.q = search;
    if (brand) params.brand = brand;
    if (socket) params.socket = socket;
    if (ramType) params.ram_type = ramType;
    if (minPrice) params.min_price = minPrice;
    if (maxPrice) params.max_price = maxPrice;
    if (inStockOnly) params.in_stock = 'true';
    if (sort !== 'smart') params.sort = sort;
    if (newPage > 1) params.page = String(newPage);
    setSearchParams(params, { replace: true });
    setTimeout(() => { tableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 50);
  };

  const clearFilters = () => { 
    setBrand(''); setSocket(''); setRamType(''); setVramGb(0); 
    setMinPrice(''); setMaxPrice('');
    setMinWattage(''); setMaxWattage('');
    setMinCapacity(''); setMaxCapacity('');
    setMinFreq(''); setMaxFreq('');
    setChipset(''); setFormFactor(''); setInterfaceType(''); setEfficiency(''); setModular(''); setCoreCount('');
    setInStockOnly(false); setCompatibleOnly(true);
  };
  const activeFilters = [
    brand, socket, ramType, vramGb ? String(vramGb) : '', 
    minPrice, maxPrice, minWattage, maxWattage, minCapacity, maxCapacity, minFreq, maxFreq,
    chipset, formFactor, interfaceType, efficiency, modular, coreCount
  ].filter(Boolean).length;

  if (!CATEGORY_ORDER.includes(cat)) {
    return <div className={styles.error}><p>Catégorie inconnue.</p></div>;
  }

  return (
    <div className={styles.page}>
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
          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}><Filter size={12} /> Filtres</label>
            {activeFilters > 0 && (
              <button className={styles.clearFiltersBtn} onClick={clearFilters}>Réinitialiser</button>
            )}
          </div>

          <label className={styles.stockToggle}>
            <input type="checkbox" checked={compatibleOnly} onChange={e => setCompatibleOnly(e.target.checked)} />
            Compatible uniquement
          </label>

          <label className={styles.stockToggle}>
            <input type="checkbox" checked={inStockOnly} onChange={e => setInStockOnly(e.target.checked)} />
            En stock uniquement
          </label>

          <div className={styles.divider} />

          {availableBrands.length > 0 && (
            <div className={styles.filterGroup}>
              <label className={styles.filterLabel}>Marque</label>
              <select className={styles.filterSelect} value={brand} onChange={e => setBrand(e.target.value)}>
                <option value="">Toutes</option>
                {availableBrands.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
          )}

          {SOCKET_CATEGORIES.has(cat) && availableSockets.length > 0 && (
            <div className={styles.filterGroup}>
              <label className={styles.filterLabel}>Socket</label>
              <select className={styles.filterSelect} value={socket} onChange={e => setSocket(e.target.value)}>
                <option value="">Tous</option>
                {availableSockets.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          )}

          {RAM_TYPE_CATEGORIES.has(cat) && (
            <div className={styles.filterGroup}>
              <label className={styles.filterLabel}>Type RAM</label>
              <select className={styles.filterSelect} value={ramType} onChange={e => setRamType(e.target.value)}>
                <option value="">Tous</option>
                <option value="DDR4">DDR4</option>
                <option value="DDR5">DDR5</option>
              </select>
            </div>
          )}

          {(cat === 'gpu' || cat === 'motherboard') && availableChipsets.length > 0 && (
            <div className={styles.filterGroup}>
              <label className={styles.filterLabel}>Chipset</label>
              <select className={styles.filterSelect} value={chipset} onChange={e => setChipset(e.target.value)}>
                <option value="">Tous</option>
                {availableChipsets.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          )}

          {(cat === 'motherboard' || cat === 'case') && availableFormFactors.length > 0 && (
            <div className={styles.filterGroup}>
              <label className={styles.filterLabel}>Format</label>
              <select className={styles.filterSelect} value={formFactor} onChange={e => setFormFactor(e.target.value)}>
                <option value="">Tous</option>
                {availableFormFactors.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
          )}

          {cat === 'storage' && (
            <div className={styles.filterGroup}>
              <label className={styles.filterLabel}>Interface</label>
              <select className={styles.filterSelect} value={interfaceType} onChange={e => setInterfaceType(e.target.value)}>
                <option value="">Toutes</option>
                <option value="NVMe">NVMe</option>
                <option value="SATA">SATA</option>
                <option value="HDD">HDD</option>
              </select>
            </div>
          )}

          {cat === 'psu' && (
            <>
              <div className={styles.filterGroup}>
                <label className={styles.filterLabel}>Certification</label>
                <select className={styles.filterSelect} value={efficiency} onChange={e => setEfficiency(e.target.value)}>
                  <option value="">Toutes</option>
                  <option value="80+ Titanium">Titanium</option>
                  <option value="80+ Platinum">Platinum</option>
                  <option value="80+ Gold">Gold</option>
                  <option value="80+ Silver">Silver</option>
                  <option value="80+ Bronze">Bronze</option>
                  <option value="80+">80+</option>
                </select>
              </div>
              <div className={styles.filterGroup}>
                <label className={styles.filterLabel}>Modularité</label>
                <select className={styles.filterSelect} value={modular} onChange={e => setModular(e.target.value)}>
                  <option value="">Toutes</option>
                  <option value="Full">Modulaire</option>
                  <option value="Semi">Semi-modulaire</option>
                  <option value="Non">Non-modulaire</option>
                </select>
              </div>
            </>
          )}

          {cat === 'gpu' && availableVram.length > 0 && (
            <div className={styles.filterGroup}>
              <label className={styles.filterLabel}>VRAM</label>
              <select className={styles.filterSelect} value={vramGb || ''} onChange={e => setVramGb(e.target.value ? Number(e.target.value) : 0)}>
                <option value="">Toutes</option>
                {availableVram.map(v => <option key={v} value={v}>{v} Go</option>)}
              </select>
            </div>
          )}

          {cat === 'psu' && (
            <div className={styles.filterGroup}>
              <label className={styles.filterLabel}>Puissance (W)</label>
              <div className={styles.priceRange}>
                <input type="number" className={styles.priceInput} placeholder="Min" value={minWattage} onChange={e => setMinWattage(e.target.value)} />
                <input type="number" className={styles.priceInput} placeholder="Max" value={maxWattage} onChange={e => setMaxWattage(e.target.value)} />
              </div>
            </div>
          )}

          {cat === 'storage' && (
            <div className={styles.filterGroup}>
              <label className={styles.filterLabel}>Capacité (Go)</label>
              <div className={styles.priceRange}>
                <input type="number" className={styles.priceInput} placeholder="Min" value={minCapacity} onChange={e => setMinCapacity(e.target.value)} />
                <input type="number" className={styles.priceInput} placeholder="Max" value={maxCapacity} onChange={e => setMaxCapacity(e.target.value)} />
              </div>
            </div>
          )}

          {cat === 'ram' && (
            <div className={styles.filterGroup}>
              <label className={styles.filterLabel}>Fréquence (MHz)</label>
              <div className={styles.priceRange}>
                <input type="number" className={styles.priceInput} placeholder="Min" value={minFreq} onChange={e => setMinFreq(e.target.value)} />
                <input type="number" className={styles.priceInput} placeholder="Max" value={maxFreq} onChange={e => setMaxFreq(e.target.value)} />
              </div>
            </div>
          )}

          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>Prix (MAD)</label>
            <div className={styles.priceRange}>
              <input type="number" className={styles.priceInput} placeholder="Min" value={minPrice} onChange={e => setMinPrice(e.target.value)} />
              <input type="number" className={styles.priceInput} placeholder="Max" value={maxPrice} onChange={e => setMaxPrice(e.target.value)} />
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
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className={styles.tableWrap} ref={tableRef}>
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
              <tbody className={fetching && components.length > 0 ? styles.tbodyFading : undefined}>
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
                      <tr key={c.id} className={[
                        styles.dataRow,
                        isIncompatible ? styles.incompatibleRow : '',
                      ].filter(Boolean).join(' ')}>
                        <td className={styles.tdImg}>
                          <div className={styles.thumbWrapper}>
                            {c.image_url
                              ? <img src={c.image_url} alt="" className={styles.compThumb} referrerPolicy="no-referrer" />
                              : <div className={styles.compThumbPlaceholder}><CategoryIcon category={cat} size={16} /></div>
                            }
                          </div>
                        </td>
                        <td className={styles.tdName}>
                          <div className={styles.nameWrap}>
                            <span className={styles.compBrand}>{c.brand}</span>
                            <Link to={`/product/${c.slug}`} className={styles.compName} title={formatComponentName(c)}>{formatComponentName(c, { excludeBrand: true })}</Link>
                          </div>
                        </td>
                        {colDefs.map(col => (
                          <td key={col.header} className={styles.tdSpec}>
                            {col.render(c)}
                          </td>
                        ))}
                        <td className={styles.tdPrice}>
                          <span className={styles.priceVal}>
                            {c.lowest_price ? formatPrice(c.lowest_price) : '—'}
                          </span>
                          <span className={`${styles.stockBadge} ${c.in_stock ? styles.inStock : styles.outStock}`}>
                            {c.in_stock ? 'En stock' : 'Rupture'}
                          </span>
                        </td>
                        <td className={styles.tdAction}>
                          <div className={styles.btnGroup}>
                            <button
                              className={`${styles.iconBtn} ${isCompared ? styles.iconBtnActive : ''}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                isCompared ? removeFromCompare(c.id) : addToCompare(c.id, c.category);
                              }}
                              title="Comparer"
                            >
                              <GitCompare size={14} />
                            </button>
                            <button
                              className={`${styles.addBtn} ${isIncompatible ? styles.addBtnDisabled : ''}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!isIncompatible) handleAdd(c);
                              }}
                              disabled={isIncompatible}
                            >
                              {isIncompatible ? 'Incompatible' : isSelecting ? 'Choisir' : 'Ajouter'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
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
