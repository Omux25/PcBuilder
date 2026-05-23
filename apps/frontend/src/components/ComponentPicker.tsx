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
import { formatComponentName } from '@shared/formatting/component-name.formatter';
import { CATEGORY_LABELS } from '../types';
import { CategoryIcon } from './CategoryIcon';
import { UI } from '../ui-strings';
import { formatPrice } from '@shared/formatting/price.formatter';
import styles from './ComponentPicker.module.css';

interface Props {
  category: ComponentCategory;
  slotKey: string;
  selected: Component | null;
  build: BuildConfig;
  onSelect: (component: Component | null) => void;
}

const DEBOUNCE_MS = 300;
const PAGE_SIZE = 20;

type SortOption = 'smart' | 'price_asc' | 'price_desc' | 'name_asc';

const SORT_LABELS: Record<SortOption, string> = {
  smart: 'Recommandé',
  price_asc: 'Prix ↑',
  price_desc: 'Prix ↓',
  name_asc: 'Nom A→Z',
};

const SOCKET_CATEGORIES = new Set<ComponentCategory>(['cpu', 'motherboard']);
const RAM_TYPE_CATEGORIES = new Set<ComponentCategory>(['ram', 'motherboard']);

export function ComponentPicker({ category, slotKey, selected, build, onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [brand, setBrand] = useState('');
  const [socket, setSocket] = useState('');
  const [ramType, setRamType] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [sort, setSort] = useState<SortOption>('smart');
  const [showFilters, setShowFilters] = useState(false);
  const [compatibleOnly, setCompatibleOnly] = useState(true);

  const [allComponents, setAllComponents] = useState<SmartComponent[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);


  // Available filter options (derived from first full fetch)
  const [availableBrands, setAvailableBrands] = useState<string[]>([]);
  const [availableSockets, setAvailableSockets] = useState<string[]>([]);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // ── Stable build context (without current slot) ──────────────────────────
  // Exclude the current slot key (not just the category) so the smart-search
  // compatibility check doesn't count the slot being filled against itself.
  const buildContextKey = useMemo(
    () => JSON.stringify(
      Object.fromEntries(
        Object.entries(build)
          .filter(([k]) => k !== slotKey)
          .map(([k, v]) => [k, v?.id])
      )
    ),
    [build, slotKey]
  );

  const buildContext: BuildConfig = useMemo(() => {
    const ctx = { ...build };
    delete ctx[slotKey];
    return ctx;
  }, [buildContextKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchComponents = useCallback(async (
    searchTerm: string,
    brandFilter: string,
    socketFilter: string,
    ramTypeFilter: string,
    pageNum: number,
    compatOnly: boolean,
  ) => {
    if (allComponents.length === 0) setLoading(true);
    setError(null);

    smartSearch({
      category,
      search: searchTerm || undefined,
      brand: brandFilter || undefined,
      socket: socketFilter || undefined,
      ram_type: ramTypeFilter || undefined,
      compatible_only: compatOnly,
      build: buildContext,
      page: pageNum,
      limit: PAGE_SIZE,
      sort: sort,
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
  }, [category, buildContextKey, sort]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Client-side sort + price filter ──────────────────────────────────────
  const components = useMemo(() => {
    let list = [...allComponents];

    // Price range filter
    if (minPrice) list = list.filter(c => c.lowest_price != null && c.lowest_price >= Number(minPrice));
    if (maxPrice) list = list.filter(c => c.lowest_price != null && c.lowest_price <= Number(maxPrice));

    // Compatibility filter override
    if (compatibleOnly) {
      list = list.filter(c => c.compatibility !== 'incompatible');
    }

    return list;
  }, [allComponents, minPrice, maxPrice, compatibleOnly]);

  // ── Debounced search + filter changes ─────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    
    if (debounceRef.current) clearTimeout(debounceRef.current);
    
    // Determine debounce delay: only debounce for search input
    // Using a ref to track previous search to see if it changed
    const isSearchChange = search !== prevSearchRef.current;
    prevSearchRef.current = search;
    
    debounceRef.current = setTimeout(() => {
      fetchComponents(search, brand, socket, ramType, page, compatibleOnly);
    }, isSearchChange ? DEBOUNCE_MS : 0);
    
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search, brand, socket, ramType, compatibleOnly, open, sort, page, fetchComponents]);

  // Track previous search to only debounce on search changes
  const prevSearchRef = useRef(search);

  // ── Load on open ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (open) {
      setTimeout(() => searchRef.current?.focus(), 50);
    }
  }, [open]);

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
    setPage(1);
  }

  function handlePageChange(newPage: number) {
    setPage(newPage);
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
              <img src={selected.image_url} alt={selected.name} className={styles.thumbnail} referrerPolicy="no-referrer" />
            ) : (
              <CategoryIcon category={category} size={20} className={styles.iconSvg} />
            )}
            <span className={styles.selectedName}>
              {formatComponentName(selected)}
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
                onChange={e => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                aria-label="Rechercher un composant"
              />
              {search && (
                <button className={styles.clearSearch} onClick={() => {
                  setSearch('');
                  setPage(1);
                }}>
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
                onChange={e => {
                  setSort(e.target.value as SortOption);
                  setPage(1);
                }}
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
              <div className={styles.filterGroup}>
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={compatibleOnly}
                    onChange={e => {
                      setCompatibleOnly(e.target.checked);
                      setPage(1);
                    }}
                  />
                  Compatible uniquement
                </label>
              </div>

              {/* Brand */}
              {availableBrands.length > 0 && (
                <div className={styles.filterGroup}>
                  <label className={styles.filterLabel}>{UI.picker.filterBrand}</label>
                  <select
                    className={styles.filterSelect}
                    value={brand}
                    onChange={e => {
                      setBrand(e.target.value);
                      setPage(1);
                    }}
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
                    onChange={e => {
                      setSocket(e.target.value);
                      setPage(1);
                    }}
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
                    onChange={e => {
                      setRamType(e.target.value);
                      setPage(1);
                    }}
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
            {loading && allComponents.length === 0 && (
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
            <div className={loading && allComponents.length > 0 ? styles.listFading : undefined}>
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
            </div>
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
  const { addToCompare, isInCompare, removeFromCompare, compareCategory } = useCompare();
  const isIncompatible = component.compatibility === 'incompatible';
  const hasPrice = component.lowest_price !== null && component.lowest_price !== undefined && component.lowest_price > 0;
  const isCompared = isInCompare(component.id);
  const isCategoryMismatch = !!compareCategory && compareCategory !== component.category;

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
          <span>{formatComponentName(component)}</span>
        </div>

        <div className={styles.itemMeta}>
          {/* Compare Toggle */}
          <button
            className={`${styles.compareToggle} ${isCompared ? styles.compareToggleActive : ''} ${isCategoryMismatch ? styles.compareToggleDisabled : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              if (isCompared) removeFromCompare(component.id);
              else if (!isCategoryMismatch) addToCompare(component.id, component.category);
            }}
            disabled={isCategoryMismatch && !isCompared}
            title={isCompared ? "Retirer" : isCategoryMismatch ? `Déjà en comparaison: ${CATEGORY_LABELS[compareCategory as ComponentCategory]}` : "Comparer"}
          >
            <GitCompare size={14} />
          </button>

          {hasPrice ? (
            <div className={styles.priceContainer}>
              {component.total_offers && component.total_offers > 1 ? (
                <div className={styles.aggregatedPrice}>
                  <span className={styles.pricePrefix}>À partir de</span>
                  <span className={styles.price}>
                    {formatPrice(component.primary_price ?? component.lowest_price!)}
                  </span>
                  <span className={styles.offersCount}>
                    {component.total_offers} offres
                  </span>
                </div>
              ) : (
                <span className={styles.price}>
                  {formatPrice(component.lowest_price!)}
                </span>
              )}
            </div>
          ) : (
            <span className={styles.noPrice}>—</span>
          )}

          {hasPrice && (
            <span className={`${styles.stockBadge} ${component.in_stock ? styles.inStock : styles.outStock}`}>
              <span className={component.in_stock ? styles.stockDotActive : styles.stockDotInactive} />
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
