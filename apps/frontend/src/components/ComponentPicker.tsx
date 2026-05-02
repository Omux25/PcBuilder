/**
 * ComponentPicker — smart component selector with advanced filters.
 *
 * Results are sorted by:
 *   1. Compatible + in stock + cheapest first
 *   2. Compatible + out of stock
 *   3. Incompatible (grayed out, with reason shown on hover)
 *
 * Filters: text search, brand, price range, socket (CPU/MB), RAM type (RAM/MB), sort order.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { SlidersHorizontal, X, ArrowUpDown, GitCompare } from 'lucide-react';
import { smartSearch, type SmartComponent } from '../api';
import { useCompare } from '../context/CompareContext';
import type { Component, ComponentCategory, BuildConfig } from '../types';
import { CATEGORY_LABELS } from '../types';
import { CategoryIcon } from './CategoryIcon';
import { UI } from '../ui-strings';
import styles from './ComponentPicker.module.css';

interface Props {
  category: ComponentCategory;
  selected: Component | null;
  build: BuildConfig;
  onSelect: (component: Component | null) => void;
}

const DEBOUNCE_MS = 300;
const PAGE_SIZE = 20;

type SortOption = 'smart' | 'price_asc' | 'price_desc' | 'name_asc';

const SORT_LABELS: Record<SortOption, string> = {
  smart:      'Recommandé',
  price_asc:  'Prix ↑',
  price_desc: 'Prix ↓',
  name_asc:   'Nom A→Z',
};

const SOCKET_CATEGORIES = new Set<ComponentCategory>(['cpu', 'motherboard']);
const RAM_TYPE_CATEGORIES = new Set<ComponentCategory>(['ram', 'motherboard']);

export function ComponentPicker({ category, selected, build, onSelect }: Props) {
  const [open, setOpen]           = useState(false);
  const [search, setSearch]       = useState('');
  const [brand, setBrand]         = useState('');
  const [socket, setSocket]       = useState('');
  const [ramType, setRamType]     = useState('');
  const [minPrice, setMinPrice]   = useState('');
  const [maxPrice, setMaxPrice]   = useState('');
  const [sort, setSort]           = useState<SortOption>('smart');
  const [showFilters, setShowFilters] = useState(false);

  const [allComponents, setAllComponents] = useState<SmartComponent[]>([]);
  const [total, setTotal]         = useState(0);
  const [page, setPage]           = useState(1);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);

  // Available filter options (derived from first full fetch)
  const [availableBrands, setAvailableBrands]   = useState<string[]>([]);
  const [availableSockets, setAvailableSockets] = useState<string[]>([]);

  const debounceRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef   = useRef<HTMLButtonElement>(null);
  const searchRef    = useRef<HTMLInputElement>(null);

  // ── Stable build context (without current category) ──────────────────────
  // Use useMemo + JSON.stringify to avoid recreating on every render while
  // still reacting to actual build changes.
  const buildContextKey = useMemo(
    () => JSON.stringify(
      Object.fromEntries(
        Object.entries(build)
          .filter(([k]) => k !== category)
          .map(([k, v]) => [k, v?.id])
      )
    ),
    [build, category]
  );

  const buildContext: BuildConfig = useMemo(() => {
    const ctx = { ...build };
    delete ctx[category];
    return ctx;
  }, [buildContextKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchComponents = useCallback((
    searchTerm: string,
    brandFilter: string,
    socketFilter: string,
    ramTypeFilter: string,
    pageNum: number,
  ) => {
    setLoading(prev => prev || allComponents.length === 0);
    setError(null);

    smartSearch({
      category,
      search:   searchTerm   || undefined,
      brand:    brandFilter  || undefined,
      socket:   socketFilter || undefined,
      ram_type: ramTypeFilter || undefined,
      build:    buildContext,
      page:     pageNum,
      limit:    PAGE_SIZE,
    })
      .then(({ components: list, total: t }) => {
        setAllComponents(list);
        setTotal(t);

        // Populate filter options from first unfiltered fetch
        if (!searchTerm && !brandFilter && !socketFilter && !ramTypeFilter && pageNum === 1) {
          const brands = [...new Set(list.map(c => c.brand).filter(Boolean) as string[])].sort();
          if (brands.length > 0) setAvailableBrands(brands);
          if (SOCKET_CATEGORIES.has(category)) {
            const sockets = [...new Set(list.map(c => c.socket).filter(Boolean) as string[])].sort();
            if (sockets.length > 0) setAvailableSockets(sockets);
          }
        }
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [category, buildContextKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Client-side sort + price filter ──────────────────────────────────────
  const components = useMemo(() => {
    let list = [...allComponents];

    // Price range filter
    if (minPrice) list = list.filter(c => c.lowest_price != null && c.lowest_price >= Number(minPrice));
    if (maxPrice) list = list.filter(c => c.lowest_price != null && c.lowest_price <= Number(maxPrice));

    if (sort === 'smart') return list; // already sorted by backend

    return list.sort((a, b) => {
      if (sort === 'price_asc') {
        if (a.lowest_price == null && b.lowest_price == null) return 0;
        if (a.lowest_price == null) return 1;
        if (b.lowest_price == null) return -1;
        return a.lowest_price - b.lowest_price;
      }
      if (sort === 'price_desc') {
        if (a.lowest_price == null && b.lowest_price == null) return 0;
        if (a.lowest_price == null) return 1;
        if (b.lowest_price == null) return -1;
        return b.lowest_price - a.lowest_price;
      }
      if (sort === 'name_asc') return a.name.localeCompare(b.name);
      return 0;
    });
  }, [allComponents, sort, minPrice, maxPrice]);

  // ── Debounced search + filter changes ─────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPage(1);
      fetchComponents(search, brand, socket, ramType, 1);
    }, DEBOUNCE_MS);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search, brand, socket, ramType, open, fetchComponents]);

  // ── Load on open ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (open) {
      fetchComponents(search, brand, socket, ramType, page);
      setTimeout(() => searchRef.current?.focus(), 50);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Close on outside click / Escape ──────────────────────────────────────
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && open) {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const activeFilters = [brand, socket, ramType, minPrice, maxPrice].filter(Boolean).length;

  function clearFilters() {
    setBrand(''); setSocket(''); setRamType(''); setMinPrice(''); setMaxPrice('');
  }

  function handlePageChange(newPage: number) {
    setPage(newPage);
    fetchComponents(search, brand, socket, ramType, newPage);
  }

  return (
    <div className={styles.picker} ref={containerRef}>
      {/* ── Trigger ──────────────────────────────────────────────────────── */}
      <button
        ref={triggerRef}
        type="button"
        className={`${styles.trigger} ${selected ? styles.hasValue : ''}`}
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={`Sélectionner ${CATEGORY_LABELS[category]}`}
      >
        {selected ? (
          <span className={styles.selectedLabel}>
            {selected.image_url ? (
              <img src={selected.image_url} alt={selected.name} className={styles.thumbnail} />
            ) : (
              <CategoryIcon category={category} size={20} className={styles.iconSvg} />
            )}
            <span className={styles.selectedName}>
              {selected.brand && !selected.name.toLowerCase().startsWith(selected.brand.toLowerCase())
                ? `${selected.brand} ` : ''}
              {selected.name}
            </span>
          </span>
        ) : (
          <span className={styles.placeholder}>
            <span className={styles.plusIcon}>+</span> Choisir {CATEGORY_LABELS[category]}
          </span>
        )}
        <span className={styles.chevron}>{open ? '▲' : '▼'}</span>
      </button>

      {/* ── Dropdown ─────────────────────────────────────────────────────── */}
      {open && (
        <div className={styles.dropdown} role="listbox">
          {/* Search row */}
          <div className={styles.searchRow}>
            <div className={styles.searchWrap}>
              <input
                ref={searchRef}
                type="text"
                className={styles.searchInput}
                placeholder={UI.picker.searchPlaceholder}
                value={search}
                onChange={e => setSearch(e.target.value)}
                aria-label="Rechercher un composant"
              />
              {search && (
                <button className={styles.clearSearch} onClick={() => setSearch('')}>
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Filter toggle */}
            <button
              className={`${styles.filterToggle} ${showFilters ? styles.filterToggleActive : ''}`}
              onClick={() => setShowFilters(v => !v)}
              title="Filtres avancés"
            >
              <SlidersHorizontal size={14} />
              {activeFilters > 0 && <span className={styles.filterBadge}>{activeFilters}</span>}
            </button>

            {/* Sort */}
            <div className={styles.sortWrap}>
              <ArrowUpDown size={12} className={styles.sortIcon} />
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

          {/* Advanced filters */}
          {showFilters && (
            <div className={styles.filterPanel}>
              {/* Brand */}
              {availableBrands.length > 0 && (
                <div className={styles.filterGroup}>
                  <label className={styles.filterLabel}>{UI.picker.filterBrand}</label>
                  <select
                    className={styles.filterSelect}
                    value={brand}
                    onChange={e => setBrand(e.target.value)}
                  >
                    <option value="">{UI.picker.filterAllBrands}</option>
                    {availableBrands.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
              )}

              {/* Socket */}
              {SOCKET_CATEGORIES.has(category) && availableSockets.length > 0 && (
                <div className={styles.filterGroup}>
                  <label className={styles.filterLabel}>{UI.picker.filterSocket}</label>
                  <select
                    className={styles.filterSelect}
                    value={socket}
                    onChange={e => setSocket(e.target.value)}
                  >
                    <option value="">{UI.picker.filterAllSockets}</option>
                    {availableSockets.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              )}

              {/* RAM type */}
              {RAM_TYPE_CATEGORIES.has(category) && (
                <div className={styles.filterGroup}>
                  <label className={styles.filterLabel}>{UI.picker.filterRamType}</label>
                  <select
                    className={styles.filterSelect}
                    value={ramType}
                    onChange={e => setRamType(e.target.value)}
                  >
                    <option value="">{UI.picker.filterAllRam}</option>
                    <option value="DDR4">DDR4</option>
                    <option value="DDR5">DDR5</option>
                  </select>
                </div>
              )}

              {/* Price range */}
              <div className={styles.filterGroup}>
                <label className={styles.filterLabel}>{UI.picker.filterPrice}</label>
                <div className={styles.priceRange}>
                  <input
                    type="number"
                    className={styles.priceInput}
                    placeholder={UI.picker.filterPriceMin}
                    value={minPrice}
                    min={0}
                    onChange={e => setMinPrice(e.target.value)}
                  />
                  <span className={styles.priceSep}>–</span>
                  <input
                    type="number"
                    className={styles.priceInput}
                    placeholder={UI.picker.filterPriceMax}
                    value={maxPrice}
                    min={0}
                    onChange={e => setMaxPrice(e.target.value)}
                  />
                </div>
              </div>

              {activeFilters > 0 && (
                <button className={styles.clearFiltersBtn} onClick={clearFilters}>
                  <X size={11} /> {UI.picker.filterClear}
                </button>
              )}
            </div>
          )}

          {/* Results */}
          <ul className={styles.list}>
            {loading && components.length === 0 && (
              [1, 2, 3].map(i => (
                <li key={i} className={styles.skeleton}>
                  <span className={styles.skeletonLine} />
                </li>
              ))
            )}
            {error && <li className={styles.errorItem}>Erreur: {error}</li>}
            {!loading && !error && components.length === 0 && (
              <li className={styles.hint}>{UI.picker.noResults}</li>
            )}
            {components.map(c => (
              <ComponentRow
                key={c.id}
                component={c}
                isSelected={selected?.id === c.id}
                onSelect={() => {
                  if (c.compatibility !== 'incompatible') {
                    onSelect(c);
                    setOpen(false);
                    setSearch('');
                  }
                }}
              />
            ))}
          </ul>

          {totalPages > 1 && (
            <div className={styles.pagination}>
              <button className={styles.pageBtn} disabled={page <= 1} onClick={() => handlePageChange(page - 1)}>
                &lsaquo;
              </button>
              <span className={styles.pageInfo}>{page} / {totalPages}</span>
              <button className={styles.pageBtn} disabled={page >= totalPages} onClick={() => handlePageChange(page + 1)}>
                &rsaquo;
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Component row ─────────────────────────────────────────────────────────────

function ComponentRow({
  component,
  isSelected,
  onSelect,
}: {
  component: SmartComponent;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const { addToCompare, isInCompare, removeFromCompare } = useCompare();
  const isIncompatible = component.compatibility === 'incompatible';
  const hasPrice = component.lowest_price !== null;
  const isCompared = isInCompare(component.id);

  return (
    <li
      role="option"
      aria-selected={isSelected}
      aria-disabled={isIncompatible}
      className={[
        styles.item,
        isSelected ? styles.itemSelected : '',
        isIncompatible ? styles.itemIncompatible : '',
      ].join(' ')}
      onClick={onSelect}
      title={isIncompatible ? component.compatibility_issues.join(' | ') : undefined}
    >
      <div className={styles.itemMain}>
        <div className={styles.itemName}>
          {component.brand && !component.name.toLowerCase().startsWith(component.brand.toLowerCase()) && (
            <span className={styles.brand}>{component.brand}</span>
          )}
          <span>{component.name}</span>
        </div>

        <div className={styles.itemMeta}>
          {/* Compare Toggle */}
          <button
            className={`${styles.compareToggle} ${isCompared ? styles.compareToggleActive : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              if (isCompared) removeFromCompare(component.id);
              else addToCompare(component.id);
            }}
            title={isCompared ? "Retirer de la comparaison" : "Ajouter à la comparaison"}
          >
            <GitCompare size={14} />
          </button>

          {hasPrice ? (
            <span className={styles.price}>
              {component.lowest_price!.toLocaleString('fr-MA')} MAD
            </span>
          ) : (
            <span className={styles.noPrice}>—</span>
          )}

          {hasPrice && (
            <span className={component.in_stock ? styles.inStock : styles.outStock}>
              {component.in_stock ? UI.picker.inStock : UI.picker.outOfStock}
            </span>
          )}

          {isIncompatible && (
            <span className={styles.incompatibleBadge} title={component.compatibility_issues.join(' | ')}>
              ✗
            </span>
          )}
        </div>
      </div>

      {isIncompatible && component.compatibility_issues.length > 0 && (
        <div className={styles.incompatibleReason}>
          {component.compatibility_issues[0]}
        </div>
      )}
    </li>
  );
}
