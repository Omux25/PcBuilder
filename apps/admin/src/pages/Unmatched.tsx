/**
 * Unmatched — category-accordion view for pending unmatched listings.
 *
 * Replaces the old grouped/flat toggle entirely.
 *
 * Layout:
 *   - Global search bar (overrides accordions when active)
 *   - One CategoryAccordion per category (collapsed by default, lazy-loaded)
 *   - UnknownSection at the bottom (listings with no suggestion)
 *
 * State:
 *   - categorySummary: lightweight counts from /by-category
 *   - categoryState: Map<category, CategoryState> — per-category lazy-load cache
 *   - accordionOpen: Map<category, boolean> — preserved across search override
 *
 * Toast: last-write-wins — new toast replaces previous immediately.
 *
 * Known limitation: concurrent admin sessions may cause offset drift on "Load More"
 * if another admin dismisses items between fetches. Acceptable for internal tool.
 *
 * Requirements: 1.1–1.6, 5.6–5.8, 6.1–6.5, 8.1, 10.1–10.6, 11.1–11.4
 */

import { useEffect, useRef, useState } from 'react';
import { RefreshCw, Search, X } from 'lucide-react';
import { CategoryAccordion } from '../components/CategoryAccordion';
import { UnknownSection } from '../components/UnknownSection';
import { SearchOverrideView } from '../components/SearchOverrideView';
import type {
  CategorySummaryEntry,
  CategoryState,
  CanonicalGroup,
  ToastState,
} from '../api';
import {
  getCategoryUnmatchedSummary,
  bulkAssociateUnmatched,
  reprocessSuggestions,
  getErrorMessage,
} from '../api';
import { CATEGORY_ORDER } from '@shared/types';

export function Unmatched() {
  // ── Summary (lightweight initial load) ───────────────────────────────────
  const [categorySummary, setCategorySummary] = useState<CategorySummaryEntry[]>([]);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  // ── Per-category lazy-load cache ──────────────────────────────────────────
  const [categoryState, setCategoryState] = useState<Map<string, CategoryState>>(new Map());

  // ── Accordion open/closed state (preserved across search) ────────────────
  const [accordionOpen, setAccordionOpen] = useState<Map<string, boolean>>(new Map());

  // ── Global search ─────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  // ── Toast (last-write-wins) ───────────────────────────────────────────────
  const [toast, setToast] = useState<ToastState | null>(null);
  const [toastExpanded, setToastExpanded] = useState(false);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Reprocess ─────────────────────────────────────────────────────────────
  const [reprocessing, setReprocessing] = useState(false);

  // ── Unknown section refresh trigger ──────────────────────────────────────
  const [unknownRefresh, setUnknownRefresh] = useState(0);

  // ── Load category summary on mount ───────────────────────────────────────
  useEffect(() => {
    loadSummary();
  }, []);

  async function loadSummary() {
    setSummaryLoading(true);
    setSummaryError(null);
    try {
      const data = await getCategoryUnmatchedSummary();
      // Sort by CATEGORY_ORDER; null (Unknown) always last
      const sorted = [...(data.categories ?? [])].sort((a, b) => {
        if (a.category === null) return 1;
        if (b.category === null) return -1;
        const ai = CATEGORY_ORDER.indexOf(a.category as any);
        const bi = CATEGORY_ORDER.indexOf(b.category as any);
        return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
      });
      setCategorySummary(sorted);
    } catch (err) {
      setSummaryError(getErrorMessage(err));
    } finally {
      setSummaryLoading(false);
    }
  }

  // ── Toast helper (last-write-wins) ────────────────────────────────────────
  function showToast(t: ToastState) {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast(t);
    setToastExpanded(false);
    toastTimerRef.current = setTimeout(() => setToast(null), 8000);
  }

  // ── Per-category state helpers ────────────────────────────────────────────
  function patchCategoryState(category: string, patch: Partial<CategoryState>) {
    setCategoryState((prev) => {
      const next = new Map(prev);
      const existing = next.get(category) ?? {
        groups: [],
        offset: 0,
        hasMore: false,
        loading: false,
        error: null,
        expandedGroups: new Set<string>(),
      };
      next.set(category, { ...existing, ...patch });
      return next;
    });
  }

  function toggleAccordion(category: string) {
    setAccordionOpen((prev) => {
      const next = new Map(prev);
      next.set(category, !prev.get(category));
      return next;
    });
  }

  // ── "Associer tout" handler ───────────────────────────────────────────────
  async function handleAssociateTout(canonicalNames: string[]) {
    try {
      const result = await bulkAssociateUnmatched(canonicalNames);
      const n = result.successful.length;
      const m = result.failed.length;
      showToast({
        message: `${n} associé${n !== 1 ? 's' : ''} · ${m} erreur${m !== 1 ? 's' : ''}`,
        type: m > 0 ? 'error' : 'success',
        failures: m > 0 ? result.failed : undefined,
      });
      // Remove successfully linked groups from their category state
      if (result.successful.length > 0) {
        const linkedNames = new Set(result.successful.map((s) => s.canonical_name));
        setCategoryState((prev) => {
          const next = new Map(prev);
          for (const [cat, state] of next) {
            const filtered = state.groups.filter((g) => !linkedNames.has(g.canonical_name));
            if (filtered.length !== state.groups.length) {
              next.set(cat, { ...state, groups: filtered });
            }
          }
          return next;
        });
        // Refresh summary counts
        loadSummary();
      }
    } catch (err) {
      showToast({ message: getErrorMessage(err), type: 'error' });
    }
  }

  // ── Group removed (reject or associate) ──────────────────────────────────
  function handleGroupRemoved(canonicalName: string) {
    // Remove from all category states (it could be in any)
    setCategoryState((prev) => {
      const next = new Map(prev);
      for (const [cat, state] of next) {
        const filtered = state.groups.filter((g) => g.canonical_name !== canonicalName);
        if (filtered.length !== state.groups.length) {
          next.set(cat, { ...state, groups: filtered });
        }
      }
      return next;
    });
  }

  // ── Category assigned from Unknown section ────────────────────────────────
  function handleCategoryAssigned(listingId: number, category: string) {
    // Invalidate that category's state so it re-fetches on next open
    setCategoryState((prev) => {
      const next = new Map(prev);
      next.delete(category);
      return next;
    });
    // Also close the accordion so it re-fetches fresh data on next open
    setAccordionOpen((prev) => {
      const next = new Map(prev);
      next.set(category, false);
      return next;
    });
    // Refresh summary
    loadSummary();
  }

  // ── Reprocess ─────────────────────────────────────────────────────────────
  async function handleReprocess() {
    if (reprocessing) return;
    setReprocessing(true);
    try {
      await reprocessSuggestions();
      showToast({ message: '✓ Recalcul lancé. La liste se mettra à jour dans ~15 secondes.', type: 'success' });
      setTimeout(() => {
        loadSummary();
        setUnknownRefresh((n) => n + 1);
        // Invalidate all category states to force re-fetch on next open
        setCategoryState(new Map());
        setAccordionOpen(new Map());
      }, 15000);
    } catch (err) {
      showToast({ message: getErrorMessage(err), type: 'error' });
    } finally {
      setReprocessing(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  // Known categories (non-null) sorted by CATEGORY_ORDER
  const knownCategories = categorySummary.filter((e) => e.category !== null);
  // Unknown entry (null category)
  const unknownEntry = categorySummary.find((e) => e.category === null);

  const totalGroups = categorySummary.reduce((sum, e) => sum + e.group_count, 0);
  const totalListings = 0; // not tracked at summary level

  return (
    <div className="admin-page">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 700 }}>Produits non associés</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '13px' }}>
            {summaryLoading
              ? 'Chargement...'
              : `${totalGroups} groupe${totalGroups !== 1 ? 's' : ''} en attente`}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* Global search bar */}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Search size={14} style={{ position: 'absolute', left: '8px', color: 'var(--text-dim)', pointerEvents: 'none' }} />
            <input
              ref={searchRef}
              type="search"
              placeholder="Rechercher..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                paddingLeft: '28px',
                paddingRight: searchQuery ? '28px' : '8px',
                paddingTop: '6px',
                paddingBottom: '6px',
                fontSize: '13px',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                background: 'var(--surface-2)',
                color: 'var(--text)',
                width: '200px',
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{ position: 'absolute', right: '6px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', display: 'flex', alignItems: 'center' }}
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Reprocess button */}
          <button
            onClick={handleReprocess}
            disabled={reprocessing}
            title="Recalculer les suggestions et créer automatiquement les composants reconnus"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              padding: '6px 12px',
              fontSize: '12px',
              cursor: reprocessing ? 'not-allowed' : 'pointer',
              opacity: reprocessing ? 0.6 : 1,
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              color: 'var(--text-muted)',
            }}
          >
            <RefreshCw size={13} style={{ animation: reprocessing ? 'spin 1s linear infinite' : 'none' }} />
            {reprocessing ? 'Traitement...' : 'Tout Traiter'}
          </button>
        </div>
      </div>

      {/* ── Toast (last-write-wins) ──────────────────────────────────────── */}
      {toast && (
        <div style={{
          background: toast.type === 'success' ? 'var(--success)' : 'var(--surface)',
          color: toast.type === 'success' ? '#0f1117' : 'var(--text)',
          border: toast.type === 'error' ? '1px solid var(--danger, #e05252)' : 'none',
          padding: '10px 16px',
          borderRadius: 'var(--radius)',
          marginBottom: '12px',
          fontSize: '13px',
          fontWeight: 500,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{toast.message}</span>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {toast.failures && toast.failures.length > 0 && (
                <button
                  onClick={() => setToastExpanded((v) => !v)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '11px', color: 'inherit', textDecoration: 'underline' }}
                >
                  {toastExpanded ? 'Masquer' : 'Voir les erreurs'}
                </button>
              )}
              <button
                onClick={() => setToast(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', display: 'flex', alignItems: 'center' }}
              >
                <X size={14} />
              </button>
            </div>
          </div>
          {toastExpanded && toast.failures && (
            <ul style={{ margin: '8px 0 0', paddingLeft: '16px', fontSize: '12px' }}>
              {toast.failures.map((f) => (
                <li key={f.canonical_name}>
                  <strong>{f.canonical_name}</strong>: {f.error}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* ── Error banner ────────────────────────────────────────────────── */}
      {summaryError && (
        <p className="admin-error">{summaryError}</p>
      )}

      {/* ── Search override ──────────────────────────────────────────────── */}
      {searchQuery ? (
        <SearchOverrideView
          query={searchQuery}
          onGroupRemoved={(canonicalName, category) => {
            handleGroupRemoved(canonicalName);
          }}
          onToast={showToast}
        />
      ) : summaryLoading ? (
        <p className="admin-loading">Chargement...</p>
      ) : categorySummary.length === 0 ? (
        /* ── Empty state ──────────────────────────────────────────────── */
        <div style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>🎉</div>
          <p style={{ fontSize: '16px', fontWeight: 600, margin: '0 0 8px' }}>Tout est à jour</p>
          <p style={{ fontSize: '13px', margin: 0 }}>Aucun produit en attente d'association.</p>
        </div>
      ) : (
        /* ── Accordion layout ─────────────────────────────────────────── */
        <>
          {knownCategories.map((entry) => (
            <CategoryAccordion
              key={entry.category!}
              category={entry.category!}
              summary={entry}
              state={categoryState.get(entry.category!)}
              isOpen={accordionOpen.get(entry.category!) ?? false}
              onToggle={() => toggleAccordion(entry.category!)}
              onStateChange={(patch) => patchCategoryState(entry.category!, patch)}
              onAssociateTout={handleAssociateTout}
              onGroupRemoved={handleGroupRemoved}
              onToast={showToast}
            />
          ))}

          {/* Unknown section always at bottom */}
          <UnknownSection
            onCategoryAssigned={handleCategoryAssigned}
            onToast={showToast}
            refreshTrigger={unknownRefresh}
          />
        </>
      )}
    </div>
  );
}
