import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Link, useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Search, ChevronLeft, ChevronRight, GitCompare, Filter } from 'lucide-react';
import { smartSearch, type SmartComponent } from '../api';
import { CategoryIcon } from '../components/CategoryIcon';
import { Skeleton } from '../components/Skeleton';
import type { Component, ComponentCategory } from '../types';
import { CATEGORY_LABELS, CATEGORY_ORDER } from '../types';
import { useBuild } from '../context/BuildContext';
import { useCompare } from '../context/CompareContext';
import styles from './CategoryBrowse.module.css';

const LIMIT = 20;
const DEBOUNCE_MS = 350;

type SortOption = 'smart' | 'price_asc' | 'price_desc' | 'name_asc';

const SORT_LABELS: Record<SortOption, string> = {
  smart: 'Pertinence',
  price_asc: 'Prix croissant',
  price_desc: 'Prix décroissant',
  name_asc: 'Nom A → Z',
};

const SOCKET_CATEGORIES = new Set<ComponentCategory>(['cpu', 'motherboard']);
const RAM_TYPE_CATEGORIES = new Set<ComponentCategory>(['ram', 'motherboard']);

export function CategoryBrowse() {
  const { category, slotKey } = useParams<{ category: string; slotKey?: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { build, addToBuild } = useBuild();
  const { addToCompare, isInCompare, removeFromCompare } = useCompare();

  const cat = category as ComponentCategory;

  // ── Filter state (synced with URL) ────────────────────────────────────────
  const [search, setSearch] = useState(searchParams.get('q') ?? '');
  const [brand, setBrand] = useState(searchParams.get('brand') ?? '');
  const [socket, setSocket] = useState(searchParams.get('socket') ?? '');
  const [ramType, setRamType] = useState(searchParams.get('ram_type') ?? '');
  const [minPrice, setMinPrice] = useState(searchParams.get('min_price') ?? '');
  const [maxPrice, setMaxPrice] = useState(searchParams.get('max_price') ?? '');
  const [inStockOnly, setInStockOnly] = useState(searchParams.get('in_stock') === 'true');
  const [sort, setSort] = useState<SortOption>((searchParams.get('sort') as SortOption) ?? 'smart');
  const [page, setPage] = useState(Number(searchParams.get('page') ?? '1'));

  // ── Data state ────────────────────────────────────────────────────────────
  const [components, setComponents] = useState<SmartComponent[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [availableBrands, setAvailableBrands] = useState<string[]>([]);
  const [availableSockets, setAvailableSockets] = useState<string[]>([]);

  const abortRef = useRef<AbortController | null>(null);

  // ── Build Context (for smartSearch compatibility) ─────────────────────────
  const buildContext = useMemo(() => {
    if (!slotKey) return build;
    const ctx = { ...build };
    delete ctx[slotKey];
    return ctx;
  }, [build, slotKey]);

  // ── Fetch components ──────────────────────────────────────────────────────
  // Track whether filter options have been populated (only needed once)
  const brandsPopulated = useRef(false);

  const fetchComponents = useCallback(async (
    searchTerm: string,
    brandFilter: string,
    socketFilter: string,
    ramTypeFilter: string,
    pageNum: number,
  ) => {
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    setLoading(true);
    setError(null);

    try {
      const { components: list, total: t } = await smartSearch({
        category: cat,
        search: searchTerm || undefined,
        brand: brandFilter || undefined,
        socket: socketFilter || undefined,
        ram_type: ramTypeFilter || undefined,
        build: buildContext,
        page: pageNum,
        limit: LIMIT,
      });

      setComponents(list);
      setTotal(t);

      // Populate filter options once from the first unfiltered fetch
      if (!brandsPopulated.current) {
        brandsPopulated.current = true;
        const brands = [...new Set(list.map(c => c.brand).filter(Boolean) as string[])].sort();
        setAvailableBrands(brands);
        if (SOCKET_CATEGORIES.has(cat)) {
          const sockets = [...new Set(list.map(c => c.socket).filter(Boolean) as string[])].sort();
          setAvailableSockets(sockets);
        }
      }
    } catch (e: unknown) {
      if (e instanceof Error && e.name !== 'AbortError') {
        setError(e.message);
      }
    } finally {
      setLoading(false);
    }
  }, [cat, buildContext]); // removed availableBrands.length — use ref instead

  // ── Sync URL & Fetch on filter change ────────────────────────────────────
  // Debounced so rapid typing doesn't fire on every keystroke.
  // Uses a ref to track the latest fetchComponents without adding it to deps
  // (avoids the double-fetch loop where fetchComponents recreation triggers this effect).
  const fetchRef = useRef(fetchComponents);
  useEffect(() => { fetchRef.current = fetchComponents; }, [fetchComponents]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setPage(1);
      fetchRef.current(search, brand, socket, ramType, 1);

      const params: Record<string, string> = {};
      if (search) params.q = search;
      if (brand) params.brand = brand;
      if (socket) params.socket = socket;
      if (ramType) params.ram_type = ramType;
      if (minPrice) params.min_price = minPrice;
      if (maxPrice) params.max_price = maxPrice;
      if (inStockOnly) params.in_stock = 'true';
      if (sort !== 'smart') params.sort = sort;
      setSearchParams(params, { replace: true });
    }, DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [search, brand, socket, ramType, minPrice, maxPrice, sort, inStockOnly, setSearchParams]);
  // Note: fetchComponents intentionally excluded — using fetchRef to avoid double-fetch

  // ── Fetch on page change only ─────────────────────────────────────────────
  const prevPageRef = useRef(page);
  useEffect(() => {
    if (prevPageRef.current === page) return; // skip on initial mount / filter resets
    prevPageRef.current = page;
    fetchRef.current(search, brand, socket, ramType, page);
  }, [page]); // eslint-disable-line react-hooks/exhaustive-deps

  const totalPages = Math.ceil(total / LIMIT);
  const activeFilters = [brand, socket, ramType, minPrice, maxPrice].filter(Boolean).length;

  const handleAdd = (c: SmartComponent) => {
    addToBuild(c, slotKey);
    navigate('/');
  };

  const clearFilters = () => {
    setBrand(''); setSocket(''); setRamType(''); setMinPrice(''); setMaxPrice('');
  };

  if (!CATEGORY_ORDER.includes(cat)) {
    return <div className={styles.error}><p>Catégorie inconnue.</p></div>;
  }

  return (
    <div className={styles.page}>
      {/* ── Breadcrumb ──────────────────────────────────────────────────── */}
      <nav className={styles.breadcrumb}>
        <Link to="/" className={styles.breadcrumbLink}>Accueil</Link>
        <span className={styles.breadcrumbSep}>›</span>
        <span className={styles.breadcrumbCurrent}>{CATEGORY_LABELS[cat]}</span>
      </nav>

      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className={styles.pageHeader}>
        <div className={styles.pageHeaderLeft}>
          <span className={styles.catIconWrap}>
            <CategoryIcon category={cat} size={20} />
          </span>
          <h1 className={styles.title}>
            {slotKey ? "Sélectionner " : "Parcourir "}{CATEGORY_LABELS[cat]}
          </h1>
        </div>
      </div>

      {/* ── Results ─────────────────────────────────────────────────────── */}
      {error && <div className={styles.errorMsg}>{error}</div>}

      <div className={styles.layout}>
        {/* ── Sidebar ──────────────────────────────────────────────────── */}
        <aside className={styles.sidebar}>
          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}><Filter size={12} /> Filtres</label>
            {activeFilters > 0 && (
              <button className={styles.clearFiltersBtn} onClick={clearFilters}>
                Réinitialiser
              </button>
            )}
          </div>

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

          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>Prix (MAD)</label>
            <div className={styles.priceRange}>
              <input type="number" className={styles.priceInput} placeholder="Min" value={minPrice} onChange={e => setMinPrice(e.target.value)} />
              <input type="number" className={styles.priceInput} placeholder="Max" value={maxPrice} onChange={e => setMaxPrice(e.target.value)} />
            </div>
          </div>

          <label className={styles.stockToggle}>
            <input type="checkbox" checked={inStockOnly} onChange={e => setInStockOnly(e.target.checked)} />
            En stock uniquement
          </label>
        </aside>

        {/* ── Main Section ─────────────────────────────────────────────── */}
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
            <div className={styles.sortWrap}>
              <span className={styles.sortLabel}>Trier par:</span>
              <select className={styles.sortSelect} value={sort} onChange={e => setSort(e.target.value as SortOption)}>
                {(Object.entries(SORT_LABELS) as [SortOption, string][]).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className={styles.tableWrap}>
            {!loading && total > 0 && (
              <div className={styles.resultsCount}>
                {total} composant{total > 1 ? 's' : ''}
                {inStockOnly
                  ? ' en stock'
                  : ` · ${components.filter(c => c.in_stock).length > 0
                    ? `${components.filter(c => c.in_stock).length} en stock sur cette page`
                    : 'aucun en stock sur cette page'}`
                }
                {totalPages > 1 && ` · page ${page}/${totalPages}`}
              </div>
            )}
            <table className={styles.table}>
              <thead>
                <tr>
                  <th colSpan={2}>Composant</th>
                  <th>Spécifications</th>
                  <th className={styles.priceCell}>Prix</th>
                  <th className={styles.actionCell}></th>
                </tr>
              </thead>
              <tbody className={loading && components.length > 0 ? styles.tbodyFading : undefined}>
                {loading && components.length === 0 ? (
                  Array.from({ length: 10 }).map((_, i) => (
                    <tr key={i} className={styles.skeletonRow}>
                      <td colSpan={5}><Skeleton height={40} /></td>
                    </tr>
                  ))
                ) : components.length === 0 ? (
                  <tr>
                    <td colSpan={5} className={styles.empty}>Aucun résultat trouvé.</td>
                  </tr>
                ) : (
                  components.map(c => {
                    const isIncompatible = c.compatibility === 'incompatible';
                    const isCompared = isInCompare(c.id);
                    const specs = getKeySpecs(c, cat);

                    return (
                      <tr key={c.id} className={isIncompatible ? styles.incompatibleRow : ''}>
                        <td className={styles.imgCell}>
                          {c.image_url && <img src={c.image_url} alt="" className={styles.compThumb} referrerPolicy="no-referrer" />}
                        </td>
                        <td className={styles.nameCell}>
                          <span className={styles.compBrand}>{c.brand}</span>
                          <Link to={`/product/${c.slug}`} className={styles.compName}>{c.name}</Link>
                        </td>
                        <td>
                          <div className={styles.specList}>
                            {specs.map(s => (
                              <div key={s.label} className={styles.specItem}>
                                <span className={styles.specLabel}>{s.label}</span>
                                <span className={styles.specVal}>{s.value}</span>
                              </div>
                            ))}
                          </div>
                        </td>
                        <td className={styles.priceCell}>
                          <span className={styles.priceVal}>
                            {c.lowest_price ? `${c.lowest_price.toLocaleString('fr-MA')} MAD` : '—'}
                          </span>
                          <span className={`${styles.stockStatus} ${c.in_stock ? styles.inStock : styles.outStock}`}>
                            {c.in_stock ? 'En stock' : 'Rupture'}
                          </span>
                        </td>
                        <td className={styles.actionCell}>
                          <div className={styles.btnGroup}>
                            <button
                              className={`${styles.iconBtn} ${isCompared ? styles.iconBtnActive : ''}`}
                              onClick={() => isCompared ? removeFromCompare(c.id) : addToCompare(c.id)}
                              title="Comparer"
                            >
                              <GitCompare size={14} />
                            </button>
                            <button
                              className={`${styles.addBtn} ${isIncompatible ? styles.addBtnDisabled : ''}`}
                              onClick={() => !isIncompatible && handleAdd(c)}
                              disabled={isIncompatible}
                            >
                              {isIncompatible ? 'Incompatible' : slotKey ? 'Choisir' : 'Ajouter'}
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
              <button className={styles.pageBtn} disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft size={16} />
              </button>
              {Array.from({ length: totalPages }).map((_, i) => {
                const p = i + 1;
                if (p === 1 || p === totalPages || (p >= page - 2 && p <= page + 2)) {
                  return (
                    <button
                      key={p}
                      className={`${styles.pageNum} ${p === page ? styles.pageNumActive : ''}`}
                      onClick={() => setPage(p)}
                    >
                      {p}
                    </button>
                  );
                }
                if (p === page - 3 || p === page + 3) return <span key={p}>...</span>;
                return null;
              })}
              <button className={styles.pageBtn} disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

/** Extract 2 key specs for the table. */
function getKeySpecs(c: Component, cat: ComponentCategory): { label: string; value: string }[] {
  const specs = c.specs as Record<string, unknown> | undefined;
  const get = (key: string) => specs?.[key] ?? (c as unknown as Record<string, unknown>)[key];

  switch (cat) {
    case 'cpu':
      return [
        { label: 'Socket', value: String(get('socket') || '—') },
        { label: 'Boost', value: get('boost_clock_ghz') ? `${get('boost_clock_ghz')} GHz` : '—' },
      ];
    case 'motherboard':
      return [
        { label: 'Socket', value: String(get('socket') || '—') },
        { label: 'RAM', value: c.supported_ram_types?.join('/') || '—' },
      ];
    case 'gpu':
      return [
        { label: 'VRAM', value: get('vram_gb') ? `${get('vram_gb')} Go` : '—' },
        { label: 'TDP', value: c.tdp ? `${c.tdp}W` : '—' },
      ];
    case 'ram':
      return [
        { label: 'Type', value: c.ram_type || '—' },
        { label: 'Fréq.', value: c.frequency_mhz ? `${c.frequency_mhz} MHz` : '—' },
      ];
    default:
      return [];
  }
}
