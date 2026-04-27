/**
 * ComponentPicker — smart component selector.
 *
 * Results are sorted by:
 *   1. Compatible + in stock + cheapest first
 *   2. Compatible + out of stock
 *   3. Incompatible (grayed out, with reason shown on hover)
 *
 * Each result shows: name, lowest price, stock badge, compatibility indicator.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { smartSearch, type SmartComponent } from '../api';
import type { Component, ComponentCategory, BuildConfig } from '../types';
import { CATEGORY_LABELS } from '../types';
import { CategoryIcon } from './CategoryIcon';
import styles from './ComponentPicker.module.css';

interface Props {
  category: ComponentCategory;
  selected: Component | null;
  build: BuildConfig;
  onSelect: (component: Component | null) => void;
}

const DEBOUNCE_MS = 300;
const PAGE_SIZE = 20;

export function ComponentPicker({ category, selected, build, onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [components, setComponents] = useState<SmartComponent[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Build context without the current category (so we check compatibility of candidates)
  const buildContext: BuildConfig = { ...build };
  delete buildContext[category];

  const fetchComponents = useCallback((searchTerm: string, pageNum: number) => {
    setLoading(true);
    setError(null);
    smartSearch({
      category,
      search: searchTerm || undefined,
      build: buildContext,
      page: pageNum,
      limit: PAGE_SIZE,
    })
      .then(({ components: list, total: t }) => {
        setComponents(list);
        setTotal(t);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [category, JSON.stringify(buildContext)]); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced search
  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPage(1);
      fetchComponents(search, 1);
    }, DEBOUNCE_MS);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search, open, fetchComponents]);

  // Load on open
  useEffect(() => {
    if (open) fetchComponents(search, page);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close on outside click or Escape
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

  function handlePageChange(newPage: number) {
    setPage(newPage);
    fetchComponents(search, newPage);
  }

  return (
    <div className={styles.picker} ref={containerRef}>
      {/* Trigger */}
      <button
        ref={triggerRef}
        type="button"
        className={`${styles.trigger} ${selected ? styles.hasValue : ''}`}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={`Selectionner ${CATEGORY_LABELS[category]}`}
      >
        {selected ? (
          <span className={styles.selectedLabel}>
            <CategoryIcon category={category} size={16} className={styles.iconSvg} />
            <span className={styles.selectedName}>
              {selected.brand ? `${selected.brand} ` : ''}{selected.name}
            </span>
          </span>
        ) : (
          <span className={styles.placeholder}>
            <CategoryIcon category={category} size={16} className={styles.iconSvg} />
            Selectionner...
          </span>
        )}
        <span className={styles.chevron}>{open ? '▲' : '▼'}</span>
      </button>

      {/* Clear */}
      {selected && (
        <button
          type="button"
          className={styles.clear}
          onClick={(e) => { e.stopPropagation(); onSelect(null); }}
          aria-label="Retirer ce composant"
        >
          x
        </button>
      )}

      {/* Dropdown */}
      {open && (
        <div className={styles.dropdown} role="listbox">
          <div className={styles.searchWrap}>
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Rechercher..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
              aria-label="Rechercher un composant"
            />
          </div>

          <ul className={styles.list}>
            {loading && (
              <>
                {[1, 2, 3].map((i) => (
                  <li key={i} className={styles.skeleton}>
                    <span className={styles.skeletonLine} />
                  </li>
                ))}
              </>
            )}
            {error && <li className={styles.errorItem}>Erreur: {error}</li>}
            {!loading && !error && components.length === 0 && (
              <li className={styles.hint}>Aucun resultat</li>
            )}
            {!loading && components.map((c) => (
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
  const isIncompatible = component.compatibility === 'incompatible';
  const hasPrice = component.lowest_price !== null;

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
          {component.brand && <span className={styles.brand}>{component.brand}</span>}
          <span>{component.name}</span>
        </div>

        <div className={styles.itemMeta}>
          {/* Price */}
          {hasPrice ? (
            <span className={styles.price}>
              {component.lowest_price!.toLocaleString('fr-MA')} MAD
            </span>
          ) : (
            <span className={styles.noPrice}>Prix non disponible</span>
          )}

          {/* Stock badge */}
          {hasPrice && (
            <span className={component.in_stock ? styles.inStock : styles.outStock}>
              {component.in_stock ? 'En stock' : 'Rupture'}
            </span>
          )}

          {/* Compatibility badge */}
          {isIncompatible && (
            <span className={styles.incompatibleBadge} title={component.compatibility_issues.join(' | ')}>
              Incompatible
            </span>
          )}
        </div>
      </div>

      {/* Incompatibility reason */}
      {isIncompatible && component.compatibility_issues.length > 0 && (
        <div className={styles.incompatibleReason}>
          {component.compatibility_issues[0]}
        </div>
      )}
    </li>
  );
}
