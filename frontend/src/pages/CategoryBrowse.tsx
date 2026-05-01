/**
 * CategoryBrowse — full-page component catalog for a single category.
 * Accessible at /components/cpu, /components/gpu, etc.
 *
 * Features:
 * - Text search (debounced)
 * - Brand filter (multi-select checkboxes)
 * - Price range filter (min/max inputs)
 * - Category-specific spec filters (socket for CPU/MB, RAM type for RAM/MB)
 * - Sort: price asc/desc, name A-Z, newest
 * - Pagination
 * - "Add to build" button that loads the configurator with this component
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Search, SlidersHorizontal, X, ChevronLeft, ChevronRight, ArrowUpDown, ExternalLink, GitCompare } from 'lucide-react';
import { getComponents, smartSearch } from '../api';
import { CategoryIcon } from '../components/CategoryIcon';
import { Skeleton } from '../components/Skeleton';
import type { Component, ComponentCategory } from '../types';
import { CATEGORY_LABELS, CATEGORY_ORDER } from '../types';
import { useBuild } from '../context/BuildContext';
import { useCompare } from '../context/CompareContext';
import styles from './CategoryBrowse.module.css';

const LIMIT = 24;
const DEBOUNCE_MS = 350;

type SortOption = 'price_asc' | 'price_desc' | 'name_asc' | 'newest';

const SORT_LABELS: Record<SortOption, string> = {
  price_asc:  'Prix croissant',
  price_desc: 'Prix décroissant',
  name_asc:   'Nom A → Z',
  newest:     'Plus récent',
};

const SOCKET_CATEGORIES = new Set<ComponentCategory>(['cpu', 'motherboard']);
const RAM_TYPE_CATEGORIES = new Set<ComponentCategory>(['ram', 'motherboard']);

export function CategoryBrowse() {
  const { category } = useParams<{ category: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { build, addToBuild } = useBuild();

  const cat = category as ComponentCategory;

  // ── Filter state (synced with URL) ────────────────────────────────────────
  const [search, setSearch]       = useState(searchParams.get('q') ?? '');
  const [brand, setBrand]         = useState(searchParams.get('brand') ?? '');
  const [socket, setSocket]       = useState(searchParams.get('socket') ?? '');
  const [ramType, setRamType]     = useState(searchParams.get('ram_type') ?? '');
  const [minPrice, setMinPrice]   = useState(searchParams.get('min_price') ?? '');
  const [maxPrice, setMaxPrice]   = useState(searchParams.get('max_price') ?? '');
  const [inStockOnly, setInStockOnly] = useState(searchParams.get('in_stock') === 'true');
  const [sort, setSort]           = useState<SortOption>((searchParams.get('sort') as SortOption) ?? 'price_asc');
  const [page, setPage]           = useState(Number(searchParams.get('page') ?? '1'));

  // ── Data state ────────────────────────────────────────────────────────────
  const [components, setComponents] = useState<(Component & { lowest_price?: number | null; in_stock?: boolean })[]>([]);
  const [total, setTotal]           = useState(0);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [brands, setBrands]         = useState<string[]>([]);
  const [sockets, setSockets]       = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef    = useRef<AbortController | null>(null);

  // Validate category
  const isValidCategory = CATEGORY_ORDER.includes(cat);

  // ── Fetch components ──────────────────────────────────────────────────────
  const fetchComponents = useCallback(async (
    searchTerm: string,
    brandFilter: string,
    socketFilter: string,
    ramTypeFilter: string,
    pageNum: number,
    inStock: boolean,
  ) => {
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    setLoading(true);
    setError(null);

    try {
      const { components: list, total: t } = await getComponents({
        category: cat,
        search:   searchTerm   || undefined,
        brand:    brandFilter  || undefined,
        socket:   socketFilter || undefined,
        ram_type: ramTypeFilter || undefined,
        page:     pageNum,
        limit:    LIMIT,
        in_stock: inStock || undefined,
      });

      // Client-side price enrichment via smart-search prices endpoint
      // We fetch prices separately to keep the browse page fast
      const enriched = await enrichWithPrices(list, cat);

      // Client-side sort
      const sorted = sortComponents(enriched, sort, minPrice, maxPrice);

      setComponents(sorted);
      setTotal(t);
    } catch (e: unknown) {
      if (e instanceof Error && e.name !== 'AbortError') {
        setError(e.message);
      }
    } finally {
      setLoading(false);
    }
  }, [cat, sort, minPrice, maxPrice]);  

  // ── Fetch available brands and sockets for filter dropdowns ──────────────
  useEffect(() => {
    getComponents({ category: cat, limit: 100 }).then(({ components: list }) => {
      const uniqueBrands = [...new Set(list.map(c => c.brand).filter(Boolean) as string[])].sort();
      setBrands(uniqueBrands);
      if (SOCKET_CATEGORIES.has(cat)) {
        const uniqueSockets = [...new Set(list.map(c => c.socket).filter(Boolean) as string[])].sort();
        setSockets(uniqueSockets);
      }
    }).catch(() => {});
  }, [cat]);

  // ── Debounced search ──────────────────────────────────────────────────────
  useEffect(() => {
    const timeout = setTimeout(() => {
      setPage(1);
      fetchComponents(search, brand, socket, ramType, 1, inStockOnly);
      // Sync URL
      const params: Record<string, string> = {};
      if (search)  params.q        = search;
      if (brand)   params.brand    = brand;
      if (socket)  params.socket   = socket;
      if (ramType) params.ram_type = ramType;
      if (minPrice) params.min_price = minPrice;
      if (maxPrice) params.max_price = maxPrice;
      if (inStockOnly) params.in_stock = 'true';
      if (sort !== 'price_asc') params.sort = sort;
      setSearchParams(params, { replace: true });
    }, DEBOUNCE_MS);
    debounceRef.current = timeout;
    return () => clearTimeout(timeout);
  }, [search, brand, socket, ramType, minPrice, maxPrice, sort, inStockOnly]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Page change ───────────────────────────────────────────────────────────
  useEffect(() => {
    fetchComponents(search, brand, socket, ramType, page, inStockOnly);
  }, [page]); // eslint-disable-line react-hooks/exhaustive-deps

  const totalPages = Math.ceil(total / LIMIT);
  const activeFilters = [brand, socket, ramType, minPrice, maxPrice].filter(Boolean).length;

  function clearFilters() {
    setBrand(''); setSocket(''); setRamType(''); setMinPrice(''); setMaxPrice('');
  }

  const isInBuild = (c: Component) => Object.values(build).some(b => b?.id === c.id);

  if (!isValidCategory) {
    return (
      <div className={styles.error}>
        <p>Catégorie inconnue : {category}</p>
        <Link to="/" className={styles.back}>← Retour</Link>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {/* ── Breadcrumb ──────────────────────────────────────────────────── */}
      <nav className={styles.breadcrumb}>
        <Link to="/" className={styles.breadcrumbLink}>Accueil</Link>
        <span className={styles.breadcrumbSep}>›</span>
        <Link to="/components" className={styles.breadcrumbLink}>Composants</Link>
        <span className={styles.breadcrumbSep}>›</span>
        <span className={styles.breadcrumbCurrent}>{CATEGORY_LABELS[cat]}</span>
      </nav>

      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className={styles.pageHeader}>
        <div className={styles.pageHeaderLeft}>
          <span className={styles.catIconWrap}>
            <CategoryIcon category={cat} size={22} />
          </span>
          <div>
            <h1 className={styles.title}>{CATEGORY_LABELS[cat]}</h1>
            <p className={styles.subtitle}>
              {loading ? '…' : `${total} composant${total !== 1 ? 's' : ''}`}
            </p>
          </div>
        </div>

        {/* Category nav pills */}
        <div className={styles.catNav}>
          {CATEGORY_ORDER.map(c => (
            <Link
              key={c}
              to={`/browse/${c}`}
              className={`${styles.catPill} ${c === cat ? styles.catPillActive : ''}`}
              title={CATEGORY_LABELS[c]}
            >
              <CategoryIcon category={c} size={14} />
              <span className={styles.catPillLabel}>{CATEGORY_LABELS[c].split(' ')[0]}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      <div className={styles.toolbar}>
        {/* Search */}
        <div className={styles.searchWrap}>
          <Search size={15} className={styles.searchIcon} />
          <input
            type="search"
            className={styles.searchInput}
            placeholder={`Rechercher ${CATEGORY_LABELS[cat].toLowerCase()}…`}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button className={styles.clearSearch} onClick={() => setSearch('')}>
              <X size={13} />
            </button>
          )}
        </div>

        {/* Filter toggle */}
        <button
          className={`${styles.filterBtn} ${showFilters ? styles.filterBtnActive : ''}`}
          onClick={() => setShowFilters(v => !v)}
        >
          <SlidersHorizontal size={15} />
          Filtres
          {activeFilters > 0 && <span className={styles.filterCount}>{activeFilters}</span>}
        </button>

        {/* In Stock toggle */}
        <label className={styles.stockToggle}>
          <input
            type="checkbox"
            checked={inStockOnly}
            onChange={e => setInStockOnly(e.target.checked)}
          />
          <span>En stock</span>
        </label>

        {/* Sort */}
        <div className={styles.sortWrap}>
          <ArrowUpDown size={14} className={styles.sortIcon} />
          <select
            className={styles.sortSelect}
            value={sort}
            onChange={e => setSort(e.target.value as SortOption)}
          >
            {(Object.entries(SORT_LABELS) as [SortOption, string][]).map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Filter panel ────────────────────────────────────────────────── */}
      {showFilters && (
        <div className={styles.filterPanel}>
          <div className={styles.filterGrid}>
            {/* Brand */}
            {brands.length > 0 && (
              <div className={styles.filterGroup}>
                <label className={styles.filterLabel}>Marque</label>
                <select
                  className={styles.filterSelect}
                  value={brand}
                  onChange={e => setBrand(e.target.value)}
                >
                  <option value="">Toutes les marques</option>
                  {brands.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
            )}

            {/* Socket (CPU / Motherboard) */}
            {SOCKET_CATEGORIES.has(cat) && sockets.length > 0 && (
              <div className={styles.filterGroup}>
                <label className={styles.filterLabel}>Socket</label>
                <select
                  className={styles.filterSelect}
                  value={socket}
                  onChange={e => setSocket(e.target.value)}
                >
                  <option value="">Tous les sockets</option>
                  {sockets.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            )}

            {/* RAM type (RAM / Motherboard) */}
            {RAM_TYPE_CATEGORIES.has(cat) && (
              <div className={styles.filterGroup}>
                <label className={styles.filterLabel}>Type de RAM</label>
                <select
                  className={styles.filterSelect}
                  value={ramType}
                  onChange={e => setRamType(e.target.value)}
                >
                  <option value="">DDR4 + DDR5</option>
                  <option value="DDR4">DDR4</option>
                  <option value="DDR5">DDR5</option>
                </select>
              </div>
            )}

            {/* Price range */}
            <div className={styles.filterGroup}>
              <label className={styles.filterLabel}>Prix (MAD)</label>
              <div className={styles.priceRange}>
                <input
                  type="number"
                  className={styles.priceInput}
                  placeholder="Min"
                  value={minPrice}
                  min={0}
                  onChange={e => setMinPrice(e.target.value)}
                />
                <span className={styles.priceSep}>–</span>
                <input
                  type="number"
                  className={styles.priceInput}
                  placeholder="Max"
                  value={maxPrice}
                  min={0}
                  onChange={e => setMaxPrice(e.target.value)}
                />
              </div>
            </div>
          </div>

          {activeFilters > 0 && (
            <button className={styles.clearFiltersBtn} onClick={clearFilters}>
              <X size={13} /> Effacer les filtres
            </button>
          )}
        </div>
      )}

      {/* ── Results ─────────────────────────────────────────────────────── */}
      {error && <div className={styles.errorMsg}>{error}</div>}

      {loading ? (
        <div className={styles.grid}>
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className={styles.cardSkeleton}>
              <Skeleton height={16} width="60%" style={{ marginBottom: '0.5rem' }} />
              <Skeleton height={22} width="85%" style={{ marginBottom: '0.75rem' }} />
              <Skeleton height={14} width="40%" style={{ marginBottom: '0.5rem' }} />
              <Skeleton height={32} style={{ marginTop: 'auto' }} />
            </div>
          ))}
        </div>
      ) : components.length === 0 ? (
        <div className={styles.empty}>
          <p>Aucun composant trouvé.</p>
          {(search || activeFilters > 0) && (
            <button className={styles.clearFiltersBtn} onClick={() => { setSearch(''); clearFilters(); }}>
              Effacer la recherche et les filtres
            </button>
          )}
        </div>
      ) : (
        <div className={styles.grid}>
          {components.map(c => (
            <ComponentCard
              key={c.id}
              component={c}
              category={cat}
              inBuild={isInBuild(c)}
              onAddToBuild={() => { addToBuild(c); navigate('/'); }}
            />
          ))}
        </div>
      )}

      {/* ── Pagination ──────────────────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className={styles.pagination}>
          <button
            className={styles.pageBtn}
            disabled={page <= 1}
            onClick={() => setPage(p => p - 1)}
          >
            <ChevronLeft size={16} />
          </button>
          <div className={styles.pageNumbers}>
            {buildPageNumbers(page, totalPages).map((p, i) =>
              p === '…' ? (
                <span key={`ellipsis-${i}`} className={styles.ellipsis}>…</span>
              ) : (
                <button
                  key={p}
                  className={`${styles.pageNum} ${p === page ? styles.pageNumActive : ''}`}
                  onClick={() => setPage(p as number)}
                >
                  {p}
                </button>
              )
            )}
          </div>
          <button
            className={styles.pageBtn}
            disabled={page >= totalPages}
            onClick={() => setPage(p => p + 1)}
          >
            <ChevronRight size={16} />
          </button>
          <span className={styles.pageInfo}>
            {(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, total)} sur {total}
          </span>
        </div>
      )}
    </div>
  );
}

// ── Component card ────────────────────────────────────────────────────────────

function ComponentCard({
  component,
  category,
  inBuild,
  onAddToBuild,
}: {
  component: Component & { lowest_price?: number | null; in_stock?: boolean };
  category: ComponentCategory;
  inBuild: boolean;
  onAddToBuild: () => void;
}) {
  const { addToCompare, isInCompare, removeFromCompare } = useCompare();
  const hasPrice = component.lowest_price != null;
  const isCompared = isInCompare(component.id);

  return (
    <div className={`${styles.card} ${inBuild ? styles.cardInBuild : ''}`}>
      {/* Category badge */}
      <div className={styles.cardTop}>
        {component.brand && (
          <span className={styles.cardBrand}>{component.brand}</span>
        )}
        {inBuild && <span className={styles.inBuildBadge}>Dans la config</span>}
      </div>

      {/* Name */}
      <Link to={`/product/${component.slug}`} className={styles.cardName}>
        {component.name}
      </Link>

      {/* Key specs */}
      <div className={styles.cardSpecs}>
        {getKeySpecs(component, category).map(({ label, value }) => (
          <span key={label} className={styles.specChip}>
            <span className={styles.specChipLabel}>{label}</span>
            <span className={styles.specChipValue}>{value}</span>
          </span>
        ))}
      </div>

      {/* Price + actions */}
      <div className={styles.cardFooter}>
        <div className={styles.cardPrice}>
          {hasPrice ? (
            <>
              <span className={styles.priceVal}>
                {component.lowest_price!.toLocaleString('fr-MA')} MAD
              </span>
              <span className={component.in_stock ? styles.inStock : styles.outStock}>
                {component.in_stock ? 'En stock' : 'Rupture'}
              </span>
            </>
          ) : (
            <span className={styles.noPrice}>Prix non disponible</span>
          )}
        </div>
        <div className={styles.cardActions}>
          <Link
            to={`/product/${component.slug}`}
            className={styles.detailBtn}
            title="Voir les détails"
          >
            <ExternalLink size={14} />
          </Link>
          <button
            className={`${styles.compareBtn} ${isCompared ? styles.compareBtnActive : ''}`}
            title={isCompared ? "Retirer de la comparaison" : "Ajouter à la comparaison"}
            onClick={(e) => {
              e.preventDefault();
              if (isCompared) removeFromCompare(component.id);
              else addToCompare(component.id);
            }}
          >
            <GitCompare size={14} />
          </button>
          <button
            className={`${styles.addBtn} ${inBuild ? styles.addBtnActive : ''}`}
            onClick={onAddToBuild}
            title={inBuild ? 'Déjà dans la configuration' : 'Ajouter à la configuration'}
          >
            {inBuild ? '✓ Ajouté' : '+ Config'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Fetch lowest prices for a list of components using the smart-search POST endpoint. */
async function enrichWithPrices(
  components: Component[],
  category: string,
): Promise<(Component & { lowest_price?: number | null; in_stock?: boolean })[]> {
  if (components.length === 0) return components;
  try {
    const { components: enriched } = await smartSearch({
      category: category as ComponentCategory,
      limit: 100,
    });
    const priceMap = new Map(enriched.map(c => [c.id, { lowest_price: c.lowest_price, in_stock: c.in_stock }]));
    return components.map(c => ({ ...c, ...priceMap.get(c.id) }));
  } catch {
    return components;
  }
}

/** Sort components client-side after price enrichment. */
function sortComponents(
  components: (Component & { lowest_price?: number | null; in_stock?: boolean })[],
  sort: SortOption,
  minPrice: string,
  maxPrice: string,
) {
  let list = [...components];

  // Price range filter (client-side since prices come from enrichment)
  if (minPrice) list = list.filter(c => c.lowest_price != null && c.lowest_price >= Number(minPrice));
  if (maxPrice) list = list.filter(c => c.lowest_price != null && c.lowest_price <= Number(maxPrice));

  switch (sort) {
    case 'price_asc':
      return list.sort((a, b) => {
        if (a.lowest_price == null && b.lowest_price == null) return 0;
        if (a.lowest_price == null) return 1;
        if (b.lowest_price == null) return -1;
        return a.lowest_price - b.lowest_price;
      });
    case 'price_desc':
      return list.sort((a, b) => {
        if (a.lowest_price == null && b.lowest_price == null) return 0;
        if (a.lowest_price == null) return 1;
        if (b.lowest_price == null) return -1;
        return b.lowest_price - a.lowest_price;
      });
    case 'name_asc':
      return list.sort((a, b) => a.name.localeCompare(b.name));
    case 'newest':
      return list.sort((a, b) => (b.release_year ?? 0) - (a.release_year ?? 0));
    default:
      return list;
  }
}

/** Extract 2-3 key specs to show on the card based on category. */
function getKeySpecs(c: Component, cat: ComponentCategory): { label: string; value: string }[] {
  const specs = c.specs as Record<string, unknown> | undefined;
  const get = (key: string) => specs?.[key] ?? (c as Record<string, unknown>)[key];

  switch (cat) {
    case 'cpu':
      return [
        get('socket')          ? { label: 'Socket', value: String(get('socket')) }          : null,
        get('cores')           ? { label: 'Cœurs',  value: String(get('cores')) }           : null,
        get('boost_clock_ghz') ? { label: 'Boost',  value: `${get('boost_clock_ghz')} GHz` } : null,
        c.tdp                  ? { label: 'TDP',    value: `${c.tdp}W` }                    : null,
      ].filter(Boolean) as { label: string; value: string }[];

    case 'motherboard':
      return [
        get('socket')           ? { label: 'Socket',  value: String(get('socket')) }           : null,
        get('chipset')          ? { label: 'Chipset', value: String(get('chipset')) }          : null,
        c.supported_ram_types?.length ? { label: 'RAM', value: c.supported_ram_types.join('/') } : null,
      ].filter(Boolean) as { label: string; value: string }[];

    case 'gpu':
      return [
        get('vram_gb')    ? { label: 'VRAM',   value: `${get('vram_gb')} Go` }    : null,
        c.length_mm       ? { label: 'Long.',  value: `${c.length_mm}mm` }        : null,
        c.tdp             ? { label: 'TDP',    value: `${c.tdp}W` }               : null,
      ].filter(Boolean) as { label: string; value: string }[];

    case 'ram':
      return [
        c.ram_type      ? { label: 'Type',  value: c.ram_type }                    : null,
        c.frequency_mhz ? { label: 'Fréq.', value: `${c.frequency_mhz} MHz` }     : null,
        get('capacity_gb') ? { label: 'Capa.', value: `${get('capacity_gb')} Go` } : null,
      ].filter(Boolean) as { label: string; value: string }[];

    case 'storage':
      return [
        get('type')            ? { label: 'Type',     value: String(get('type')) }            : null,
        get('capacity_gb')     ? { label: 'Capa.',    value: `${get('capacity_gb')} Go` }     : null,
        get('read_speed_mbps') ? { label: 'Lecture',  value: `${get('read_speed_mbps')} Mo/s` } : null,
      ].filter(Boolean) as { label: string; value: string }[];

    case 'psu':
      return [
        c.wattage                  ? { label: 'Puissance',  value: `${c.wattage}W` }                  : null,
        get('efficiency_rating')   ? { label: 'Certif.',    value: String(get('efficiency_rating')) }  : null,
        get('modular')             ? { label: 'Modulaire',  value: get('modular') ? 'Oui' : 'Non' }   : null,
      ].filter(Boolean) as { label: string; value: string }[];

    case 'case':
      return [
        get('form_factor')       ? { label: 'Format',    value: String(get('form_factor')) }       : null,
        c.max_gpu_length_mm      ? { label: 'GPU max',   value: `${c.max_gpu_length_mm}mm` }       : null,
      ].filter(Boolean) as { label: string; value: string }[];

    case 'cooling':
      return [
        c.tdp ? { label: 'TDP max', value: `${c.tdp}W` } : null,
        get('type') ? { label: 'Type', value: String(get('type')) } : null,
      ].filter(Boolean) as { label: string; value: string }[];

    default:
      return [];
  }
}

/** Build a compact page number array with ellipsis. */
function buildPageNumbers(current: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | '…')[] = [1];
  if (current > 3) pages.push('…');
  for (let p = Math.max(2, current - 1); p <= Math.min(total - 1, current + 1); p++) pages.push(p);
  if (current < total - 2) pages.push('…');
  pages.push(total);
  return pages;
}
