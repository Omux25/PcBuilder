/**
 * ComponentPicker — searchable component selector with debounced API calls.
 * Replaces the old dropdown selects in the Configurator.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { getComponents } from '../api';
import type { Component, ComponentCategory } from '../types';
import { CATEGORY_ICONS } from '../types';
import styles from './ComponentPicker.module.css';

interface Props {
  category: ComponentCategory;
  selected: Component | null;
  onSelect: (component: Component | null) => void;
  compatibleOnly?: boolean;
}

const DEBOUNCE_MS = 300;
const PAGE_SIZE = 20;

export function ComponentPicker({ category, selected, onSelect, compatibleOnly: _compatibleOnly }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [components, setComponents] = useState<Component[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchComponents = useCallback((searchTerm: string, pageNum: number) => {
    setLoading(true);
    setError(null);
    getComponents({ category, search: searchTerm || undefined, page: pageNum, limit: PAGE_SIZE })
      .then(({ components: list, total: t }) => {
        setComponents(list);
        setTotal(t);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [category]);

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

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  function handlePageChange(newPage: number) {
    setPage(newPage);
    fetchComponents(search, newPage);
  }

  return (
    <div className={styles.picker} ref={containerRef}>
      {/* Trigger button */}
      <button
        type="button"
        className={`${styles.trigger} ${selected ? styles.hasValue : ''}`}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        {selected ? (
          <span className={styles.selectedLabel}>
            <span className={styles.icon}>{CATEGORY_ICONS[category]}</span>
            <span className={styles.selectedName}>{selected.brand ? `${selected.brand} ` : ''}{selected.name}</span>
          </span>
        ) : (
          <span className={styles.placeholder}>
            <span className={styles.icon}>{CATEGORY_ICONS[category]}</span>
            Sélectionner…
          </span>
        )}
        <span className={styles.chevron}>{open ? '▲' : '▼'}</span>
      </button>

      {/* Clear button */}
      {selected && (
        <button
          type="button"
          className={styles.clear}
          onClick={(e) => { e.stopPropagation(); onSelect(null); }}
          aria-label="Retirer ce composant"
        >
          ✕
        </button>
      )}

      {/* Dropdown */}
      {open && (
        <div className={styles.dropdown} role="listbox">
          {/* Search input */}
          <div className={styles.searchWrap}>
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Rechercher…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
              aria-label="Rechercher un composant"
            />
          </div>

          {/* Results */}
          <ul className={styles.list}>
            {loading && <li className={styles.hint}>Chargement…</li>}
            {error   && <li className={styles.errorItem}>Erreur: {error}</li>}
            {!loading && !error && components.length === 0 && (
              <li className={styles.hint}>Aucun résultat</li>
            )}
            {!loading && components.map((c) => (
              <li
                key={c.id}
                role="option"
                aria-selected={selected?.id === c.id}
                className={`${styles.item} ${selected?.id === c.id ? styles.itemSelected : ''}`}
                onClick={() => { onSelect(c); setOpen(false); setSearch(''); }}
              >
                <span className={styles.itemName}>
                  {c.brand && <span className={styles.brand}>{c.brand}</span>}
                  {c.name}
                </span>
                {c.specs && typeof (c.specs as Record<string, unknown>).tdp === 'number' && (
                  <span className={styles.spec}>{(c.specs as Record<string, unknown>).tdp as number}W</span>
                )}
              </li>
            ))}
          </ul>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className={styles.pagination}>
              <button
                className={styles.pageBtn}
                disabled={page <= 1}
                onClick={() => handlePageChange(page - 1)}
              >
                ‹
              </button>
              <span className={styles.pageInfo}>{page} / {totalPages}</span>
              <button
                className={styles.pageBtn}
                disabled={page >= totalPages}
                onClick={() => handlePageChange(page + 1)}
              >
                ›
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
