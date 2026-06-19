/**
 * Unmatched — category-accordion view for pending unmatched listings.
 *
 * Layout (redesigned):
 *   - Top bar: title, search, reprocess button
 *   - Horizontal category tab bar (replaces the old inner sidebar)
 *   - Full-width content area with accordions / UnknownSection
 *
 * State:
 *   - categorySummary: lightweight counts from /by-category
 *   - categoryState: Map<category, CategoryState> — per-category lazy-load cache
 *   - accordionOpen: Map<category, boolean> — preserved across search override
 *
 * Toast: last-write-wins — new toast replaces previous immediately.
 */

import React, { useEffect, useRef, useState } from 'react';
import { RefreshCw, Search, X, CheckCircle, CheckSquare, ChevronDown, Layers } from 'lucide-react';
import { CategoryAccordion } from '../components/CategoryAccordion';
import { UnknownSection } from '../components/UnknownSection';
import { SearchOverrideView } from '../components/SearchOverrideView';
import { ConfirmDialog } from '../components/ConfirmDialog';
import type {
  CategorySummaryEntry,
  CategoryState,
  ToastState,
} from '../api';
import {
  getCategoryUnmatchedSummary,
  bulkAssociateUnmatched,
  reprocessSuggestions,
  getErrorMessage,
  bulkConfirmAllWithCategories,
} from '../api';
import { CATEGORY_ORDER, CATEGORY_LABELS, type ComponentCategory } from '@shared/types';
import { getCategoryIcon } from '../utils/categoryIcons';

export function Unmatched() {
  // ── Summary (lightweight initial load) ───────────────────────────────────
  const [categorySummary, setCategorySummary] = useState<CategorySummaryEntry[]>([]);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  // ── Per-category lazy-load cache ──────────────────────────────────────────
  const [categoryState, setCategoryState] = useState<Map<string, CategoryState>>(new Map());

  // ── Accordion open/closed state (preserved across search) ────────────────
  const [accordionOpen, setAccordionOpen] = useState<Map<string, boolean>>(new Map());

  // ── Active category tab ───────────────────────────────────────────────────
  const [activeCategory, setActiveCategory] = useState<string | null>('all');

  // ── Global search ─────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  // ── Toast (last-write-wins) ───────────────────────────────────────────────
  const [toast, setToast] = useState<ToastState | null>(null);
  const [toastExpanded, setToastExpanded] = useState(false);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Reprocess ─────────────────────────────────────────────────────────────
  const [reprocessing, setReprocessing] = useState(false);
  const [confirmingCategories, setConfirmingCategories] = useState(false);
  const [confirmingCategory, setConfirmingCategory] = useState<string | null>(null);
  const [confirmAllDialog, setConfirmAllDialog] = useState(false);

  // ── Unknown section refresh trigger ──────────────────────────────────────
  const [unknownRefresh, setUnknownRefresh] = useState(0);

  // ── Filtering states ──────────────────────────────────────────────────────
  const [filterConfidence, setFilterConfidence] = useState<string>('');
  const [filterHasExisting, setFilterHasExisting] = useState<string>('');

  // ── Load category summary on mount ───────────────────────────────────────
  useEffect(() => {
    loadSummary(filterConfidence, filterHasExisting);
  }, []);

  // ── Reload summary and clear cache when filters change ───────────────────
  useEffect(() => {
    loadSummary(filterConfidence, filterHasExisting);
    setCategoryState(new Map());
  }, [filterConfidence, filterHasExisting]);

  async function loadSummary(confidence = filterConfidence, hasExisting = filterHasExisting) {
    setSummaryLoading(true);
    setSummaryError(null);
    try {
      const data = await getCategoryUnmatchedSummary({
        confidence: confidence ?? '',
        hasExisting: hasExisting ?? '',
      });
      const sorted = [...(data.categories ?? [])].sort((a, b) => {
        if (a.category === null) return 1;
        if (b.category === null) return -1;
        const ai = CATEGORY_ORDER.indexOf(a.category as ComponentCategory);
        const bi = CATEGORY_ORDER.indexOf(b.category as ComponentCategory);
        return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
      });
      setCategorySummary(sorted);
    } catch (err) {
      setSummaryError(getErrorMessage(err));
    } finally {
      setSummaryLoading(false);
    }
  }

  // ── Toast helper ──────────────────────────────────────────────────────────
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
        loadSummary();
      }
    } catch (err) {
      showToast({ message: getErrorMessage(err), type: 'error' });
    }
  }

  // ── Group removed (reject or associate) ──────────────────────────────────
  function handleGroupRemoved(canonicalName: string) {
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
  function handleCategoryAssigned(_listingId: number, category: string) {
    setCategoryState((prev) => {
      const next = new Map(prev);
      next.delete(category);
      return next;
    });
    setAccordionOpen((prev) => {
      const next = new Map(prev);
      next.set(category, false);
      return next;
    });
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
        setCategoryState(new Map());
        setAccordionOpen(new Map());
      }, 15000);
    } catch (err) {
      showToast({ message: getErrorMessage(err), type: 'error' });
    } finally {
      setReprocessing(false);
    }
  }

  async function handleConfirmCategories(includeMedium: boolean = false) {
    if (confirmingCategories) return;
    setConfirmingCategories(true);
    try {
      const targetCategory = (activeCategory && activeCategory !== 'all') ? activeCategory : undefined;
      const result = await bulkConfirmAllWithCategories(targetCategory, includeMedium);
      showToast({
        message: `✓ Ingestion réussie : ${result.created_components} composants créés, ${result.created_listings} listings associés aux nouveaux, ${result.linked_listings} listings associés aux existants.`,
        type: 'success',
      });
      loadSummary();
      setUnknownRefresh((n) => n + 1);
      setCategoryState(new Map());
      setAccordionOpen(new Map());
    } catch (err) {
      showToast({ message: getErrorMessage(err), type: 'error' });
    } finally {
      setConfirmingCategories(false);
    }
  }

  // ── Category confirmation handler ──────────────────────────────────────────
  async function handleConfirmCategory(category: string, includeMedium: boolean = false) {
    if (confirmingCategory) return;
    setConfirmingCategory(category);
    try {
      const result = await bulkConfirmAllWithCategories(category, includeMedium);
      showToast({
        message: `✓ Ingestion réussie pour la catégorie : ${result.created_components} composants créés, ${result.created_listings} listings associés aux nouveaux, ${result.linked_listings} listings associés aux existants.`,
        type: 'success',
      });
      loadSummary(filterConfidence, filterHasExisting);
      setCategoryState((prev) => {
        const next = new Map(prev);
        next.delete(category);
        return next;
      });
      setAccordionOpen((prev) => {
        const next = new Map(prev);
        next.set(category, false);
        return next;
      });
    } catch (err) {
      showToast({ message: getErrorMessage(err), type: 'error' });
    } finally {
      setConfirmingCategory(null);
    }
  }

  // ── Derived ───────────────────────────────────────────────────────────────
  const knownCategories = categorySummary.filter((e) => e.category !== null);
  const unknownEntry = categorySummary.find((e) => e.category === null);
  const totalGroups = categorySummary.reduce((sum, e) => sum + e.group_count, 0);

  // ── Tab style helper ──────────────────────────────────────────────────────
  function tabStyle(isActive: boolean): React.CSSProperties {
    return {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '8px 16px',
      fontSize: '13px',
      fontWeight: isActive ? 600 : 500,
      color: isActive ? 'var(--accent-blue)' : 'var(--text-dim)',
      background: isActive ? 'rgba(137, 180, 250, 0.12)' : 'rgba(255, 255, 255, 0.03)',
      border: isActive ? '1px solid rgba(137, 180, 250, 0.3)' : '1px solid rgba(255, 255, 255, 0.06)',
      cursor: 'pointer',
      whiteSpace: 'nowrap',
      transition: 'all 0.2s ease',
      flexShrink: 0,
      borderRadius: '999px',
    };
  }

  function badgeStyle(isActive: boolean): React.CSSProperties {
    return {
      fontSize: '11px',
      background: isActive ? 'var(--accent-blue)' : 'rgba(255, 255, 255, 0.08)',
      color: isActive ? '#000' : 'var(--text-muted)',
      padding: '2px 8px',
      borderRadius: '999px',
      fontWeight: 700,
      marginLeft: '2px',
    };
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* ── Top Bar ────────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 24px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--surface)',
        flexShrink: 0,
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>Produits non associés</h1>
          <p style={{ margin: '2px 0 0', color: 'var(--text-muted)', fontSize: '12px' }}>
            {summaryLoading ? 'Chargement...' : `${totalGroups} groupe${totalGroups !== 1 ? 's' : ''} en attente`}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Search */}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', color: 'var(--text-dim)', pointerEvents: 'none' }} />
            <input
              ref={searchRef}
              type="search"
              placeholder="Rechercher..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                paddingLeft: '32px',
                paddingRight: searchQuery ? '32px' : '12px',
                paddingTop: '8px',
                paddingBottom: '8px',
                fontSize: '13px',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                background: 'var(--surface-2)',
                color: 'var(--text)',
                width: '240px',
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{ position: 'absolute', right: '8px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', display: 'flex', alignItems: 'center' }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* ── Global Actions Toolbar ────────────────────────────── */}
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            {/* Confirmation Pill Group */}
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              background: 'var(--surface-2)', 
              padding: '6px', 
              borderRadius: 'var(--radius)',
              border: '1px solid var(--border)'
            }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-dim)', padding: '0 10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Confirmer
              </span>
              <div style={{ width: '1px', height: '20px', background: 'var(--border)', margin: '0 6px' }} />
              
              <button
                onClick={() => { if (!confirmingCategories) setConfirmAllDialog(true); }}
                disabled={confirmingCategories}
                title="Créer automatiquement tous les produits avec une confiance ÉLEVÉE"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  height: '34px',
                  padding: '0 16px',
                  fontSize: '13px',
                  fontWeight: 600,
                  borderRadius: '4px',
                  border: 'none',
                  cursor: confirmingCategories ? 'not-allowed' : 'pointer',
                  background: 'transparent',
                  color: '#10b981',
                  transition: 'all 0.2s',
                }}
                onMouseOver={(e) => { if (!confirmingCategories) e.currentTarget.style.background = 'rgba(16, 185, 129, 0.1)'; }}
                onMouseOut={(e) => { if (!confirmingCategories) e.currentTarget.style.background = 'transparent'; }}
              >
                <CheckCircle size={16} />
                <span>Haute</span>
              </button>

              <button
                onClick={() => { if (!confirmingCategories) { setConfirmAllDialog(true); handleConfirmCategories(true); setConfirmAllDialog(false); } }}
                disabled={confirmingCategories}
                title="Créer automatiquement tous les produits avec une confiance MOYENNE ou ÉLEVÉE"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  height: '34px',
                  padding: '0 16px',
                  fontSize: '13px',
                  fontWeight: 600,
                  borderRadius: '4px',
                  border: 'none',
                  cursor: confirmingCategories ? 'not-allowed' : 'pointer',
                  background: 'transparent',
                  color: 'var(--text)',
                  transition: 'all 0.2s',
                }}
                onMouseOver={(e) => { if (!confirmingCategories) e.currentTarget.style.background = 'var(--surface-3)'; }}
                onMouseOut={(e) => { if (!confirmingCategories) e.currentTarget.style.background = 'transparent'; }}
              >
                <CheckSquare size={16} />
                <span>Moyenne + Haute</span>
              </button>
            </div>

          <button
            onClick={handleReprocess}
            disabled={reprocessing}
            title="Recalculer les suggestions et associer automatiquement les produits reconnus"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              height: '36px',
              padding: '0 20px',
              fontSize: '13px',
              fontWeight: 600,
              borderRadius: 'var(--radius)',
              border: reprocessing ? '1px solid var(--border)' : '1px solid rgba(79, 70, 229, 0.4)',
              cursor: reprocessing ? 'not-allowed' : 'pointer',
              transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
              background: reprocessing
                ? 'var(--surface-3)'
                : 'rgba(79, 70, 229, 0.1)',
              color: reprocessing ? 'var(--text-dim)' : '#818cf8',
              boxShadow: reprocessing ? 'none' : '0 0 10px rgba(79, 70, 229, 0.2)',
            }}
            onMouseOver={(e) => { 
              if (!reprocessing) {
                e.currentTarget.style.background = 'rgba(79, 70, 229, 0.2)'; 
                e.currentTarget.style.boxShadow = '0 0 15px rgba(79, 70, 229, 0.4)';
              }
            }}
            onMouseOut={(e) => { 
              if (!reprocessing) {
                e.currentTarget.style.background = 'rgba(79, 70, 229, 0.1)'; 
                e.currentTarget.style.boxShadow = '0 0 10px rgba(79, 70, 229, 0.2)';
              }
            }}
          >
            <RefreshCw
              size={14}
              style={{
                animation: reprocessing ? 'spin 1s linear infinite' : 'none',
              }}
            />
            {reprocessing ? 'Traitement...' : 'Tout Traiter'}
          </button>
          </div>
        </div>

        {/* ── Filter Bar ────────────────────────────────────────────────────────── */}
        {!summaryLoading && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '12px 24px',
            borderBottom: '1px solid var(--border)',
            background: 'var(--surface)',
            flexShrink: 0,
          }}>
            <span style={{ fontSize: '12px', color: 'var(--text-dim)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Filtrer par</span>
            
            {/* Confidence Filter */}
            <div style={{ position: 'relative' }}>
              <select
                value={filterConfidence}
                onChange={(e) => setFilterConfidence(e.target.value)}
                style={{
                  appearance: 'none',
                  padding: '6px 32px 6px 12px',
                  fontSize: '13px',
                  fontWeight: 500,
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '6px',
                  background: 'rgba(255, 255, 255, 0.03)',
                  color: 'var(--text)',
                  cursor: 'pointer',
                  outline: 'none',
                  transition: 'all 0.2s',
                }}
                onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)'; e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)'; }}
                onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)'; e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)'; }}
              >
                <option value="">Toutes les confiances</option>
                <option value="high">Confiance : Élevée</option>
                <option value="medium">Confiance : Moyenne</option>
                <option value="low">Confiance : Faible</option>
                <option value="unknown">Confiance : Inconnue</option>
              </select>
              <ChevronDown size={14} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-dim)' }} />
            </div>

            {/* Association / Match Filter */}
            <div style={{ position: 'relative' }}>
              <select
                value={filterHasExisting}
                onChange={(e) => setFilterHasExisting(e.target.value)}
                style={{
                  appearance: 'none',
                  padding: '6px 32px 6px 12px',
                  fontSize: '13px',
                  fontWeight: 500,
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '6px',
                  background: 'rgba(255, 255, 255, 0.03)',
                  color: 'var(--text)',
                  cursor: 'pointer',
                  outline: 'none',
                  transition: 'all 0.2s',
                }}
                onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)'; e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)'; }}
                onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)'; e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)'; }}
              >
                <option value="">Tous les statuts</option>
                <option value="true">Composant existant trouvé</option>
                <option value="false">Nouveau composant à créer</option>
              </select>
              <ChevronDown size={14} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-dim)' }} />
            </div>

            {(filterConfidence || filterHasExisting) && (
              <button
                onClick={() => {
                  setFilterConfidence('');
                  setFilterHasExisting('');
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--accent-blue)',
                  fontSize: '12px',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  padding: 0,
                }}
              >
                Réinitialiser
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Horizontal Category Tabs ──────────────────────────────────────────── */}
      {!summaryLoading && categorySummary.length > 0 && (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '10px',
          padding: '16px 24px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--surface-2)',
          flexShrink: 0,
        }}>
          <button onClick={() => setActiveCategory('all')} style={tabStyle(activeCategory === 'all')}>
            <span style={{ 
              color: activeCategory === 'all' ? 'var(--accent-blue)' : 'var(--text-dim)', 
              display: 'flex', 
              alignItems: 'center' 
            }}>
              <Layers size={14} />
            </span>
            Tous <span style={badgeStyle(activeCategory === 'all')}>{totalGroups}</span>
          </button>

          {knownCategories.map(entry => {
            const isActive = activeCategory === entry.category;
            return (
              <button key={entry.category!} onClick={() => setActiveCategory(entry.category)} style={tabStyle(isActive)}>
                <span style={{ 
                  color: isActive ? 'var(--accent-blue)' : 'var(--text-dim)', 
                  display: 'flex', 
                  alignItems: 'center' 
                }}>
                  {React.cloneElement(getCategoryIcon(entry.category) as React.ReactElement, { size: 14 })}
                </span>
                {CATEGORY_LABELS[entry.category as ComponentCategory] ?? entry.category}
                <span style={badgeStyle(isActive)}>{entry.group_count}</span>
              </button>
            );
          })}

          {unknownEntry && (
            <>
              <div style={{ width: '1px', height: '20px', background: 'var(--border)', margin: '0 8px', flexShrink: 0 }} />
              <button onClick={() => setActiveCategory(null)} style={tabStyle(activeCategory === null)}>
                ⚠ Inconnus <span style={badgeStyle(activeCategory === null)}>{unknownEntry.group_count}</span>
              </button>
            </>
          )}
        </div>
      )}

      {/* ── Main Content (full width) ─────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px', background: 'var(--bg)' }}>
        {/* Toast */}
        {toast && (
          <div style={{
            background: toast.type === 'success' ? 'var(--success)' : 'var(--surface)',
            color: toast.type === 'success' ? '#0f1117' : 'var(--text)',
            border: toast.type === 'error' ? '1px solid var(--danger, #e05252)' : 'none',
            padding: '12px 20px',
            borderRadius: 'var(--radius)',
            marginBottom: '20px',
            fontSize: '13px',
            fontWeight: 500,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            position: 'sticky',
            top: 0,
            zIndex: 5,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>{toast.message}</span>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                {toast.failures && toast.failures.length > 0 && (
                  <button onClick={() => setToastExpanded(v => !v)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '11px', color: 'inherit', textDecoration: 'underline' }}>
                    {toastExpanded ? 'Masquer' : 'Voir les erreurs'}
                  </button>
                )}
                <button onClick={() => setToast(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', display: 'flex', alignItems: 'center' }}>
                  <X size={16} />
                </button>
              </div>
            </div>
            {toastExpanded && toast.failures && (
              <ul style={{ margin: '10px 0 0', paddingLeft: '20px', fontSize: '12px' }}>
                {toast.failures.map((f) => (
                  <li key={f.canonical_name}><strong>{f.canonical_name}</strong>: {f.error}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Content */}
        {searchQuery ? (
          <SearchOverrideView
            query={searchQuery}
            filterConfidence={filterConfidence}
            filterHasExisting={filterHasExisting}
            onGroupRemoved={(canonicalName) => handleGroupRemoved(canonicalName)}
            onToast={showToast}
          />
        ) : summaryLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 0', gap: '16px' }}>
            <RefreshCw size={32} className="spin" style={{ color: 'var(--text-dim)' }} />
            <p style={{ color: 'var(--text-dim)', fontSize: '14px' }}>Chargement des données...</p>
          </div>
        ) : summaryError ? (
          <div style={{ textAlign: 'center', padding: '60px 40px' }}>
            <p style={{ color: 'var(--danger, #e05252)', fontSize: '14px' }}>⚠ {summaryError}</p>
          </div>
        ) : categorySummary.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '100px 40px', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: '64px', marginBottom: '24px' }}>🎉</div>
            <h2 style={{ fontSize: '20px', fontWeight: 600, margin: '0 0 12px', color: 'var(--text)' }}>Tout est à jour</h2>
            <p style={{ fontSize: '14px', margin: 0 }}>Aucun produit en attente d'association.</p>
          </div>
        ) : activeCategory === 'all' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {knownCategories.map((entry) => (
              <CategoryAccordion
                key={entry.category!}
                category={entry.category!}
                summary={entry}
                state={categoryState.get(entry.category!)}
                isOpen={accordionOpen.get(entry.category!) ?? false}
                isConfirming={confirmingCategory === entry.category!}
                filterConfidence={filterConfidence}
                filterHasExisting={filterHasExisting}
                onToggle={() => toggleAccordion(entry.category!)}
                onStateChange={(patch) => patchCategoryState(entry.category!, patch)}
                onAssociateTout={handleAssociateTout}
                onConfirmCategory={handleConfirmCategory}
                onGroupRemoved={handleGroupRemoved}
                onToast={showToast}
              />
            ))}
          </div>
        ) : activeCategory === null ? (
          <UnknownSection
            onCategoryAssigned={handleCategoryAssigned}
            refreshTrigger={unknownRefresh}
          />
        ) : (
          <CategoryAccordion
            key={activeCategory}
            category={activeCategory}
            summary={knownCategories.find(c => c.category === activeCategory)!}
            state={categoryState.get(activeCategory)}
            isOpen={true}
            hideHeader={false}
            disableToggle={true}
            isConfirming={confirmingCategory === activeCategory}
            filterConfidence={filterConfidence}
            filterHasExisting={filterHasExisting}
            onToggle={() => {}}
            onStateChange={(patch) => patchCategoryState(activeCategory, patch)}
            onAssociateTout={handleAssociateTout}
            onConfirmCategory={handleConfirmCategory}
            onGroupRemoved={handleGroupRemoved}
            onToast={showToast}
          />
        )}
      </div>

      {/* Global confirm-all dialog */}
      {confirmAllDialog && (
        <ConfirmDialog
          title="Confirmer toutes les hautes confiances"
          message="Créer automatiquement des composants pour TOUS les produits haute confiance ou avec catégorie manuelle ? Les correspondances existantes seront liées, les nouvelles créées."
          confirmLabel="Confirmer"
          onConfirm={() => { setConfirmAllDialog(false); handleConfirmCategories(false); }}
          onCancel={() => setConfirmAllDialog(false)}
        />
      )}
    </div>
  );
}
