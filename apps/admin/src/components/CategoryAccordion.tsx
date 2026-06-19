/**
 * CategoryAccordion — collapsible section for one product category.
 *
 * - Collapsed by default; first open triggers lazy fetch of groups
 * - Load More appends 50 more groups without resetting the list
 * - State preserved on close/reopen (no re-fetch)
 * - "Associer tout (N)" button for bulk-linking high-confidence groups
 *
 * Requirements: 1.1, 1.4, 1.5, 1.6, 2.1–2.6, 5.1–5.3, 8.1–8.4
 */

import { useState, useEffect, useCallback } from 'react';
import { ChevronDown, ChevronRight, Link2, CheckCircle, CheckSquare, RefreshCw } from 'lucide-react';
import { CanonicalGroupRow } from './CanonicalGroupRow';
import { ConfirmDialog } from './ConfirmDialog';
import { CreateAndLinkModal } from './CreateAndLinkModal';
import type { CreateAndLinkResult } from './CreateAndLinkModal';
import type {
    CategorySummaryEntry,
    CategoryState,
    CanonicalGroup,
    ToastState,
} from '../api';
import { getGroupedUnmatched, getErrorMessage } from '../api';
import { CATEGORY_LABELS } from '@shared/types';
import type { ComponentCategory } from '@shared/types';
import { getCategoryIcon } from '../utils/categoryIcons';

const LOAD_SIZE = 50;

interface Props {
    category: string;
    summary: CategorySummaryEntry;
    state: CategoryState | undefined;
    isOpen: boolean;
    onToggle: () => void;
    onStateChange: (patch: Partial<CategoryState>) => void;
    onAssociateTout: (canonicalNames: string[]) => void;
    onConfirmCategory?: (category: string, includeMedium?: boolean) => void;
    onGroupRemoved: (canonicalName: string) => void;
    onToast: (toast: ToastState) => void;
    hideHeader?: boolean;
    expandAllGroups?: boolean;
    filterConfidence?: string;
    filterHasExisting?: string;
    /** True while bulkConfirmAllWithCategories is running for this category. */
    isConfirming?: boolean;
    /** True to disable collapsing the header. */
    disableToggle?: boolean;
}

export function CategoryAccordion({
    category,
    summary,
    state,
    isOpen,
    onToggle,
    onStateChange,
    onAssociateTout,
    onConfirmCategory,
    onGroupRemoved,
    onToast,
    hideHeader = false,
    expandAllGroups = false,
    filterConfidence = '',
    filterHasExisting = '',
    isConfirming = false,
    disableToggle = false,
}: Props) {
    const [confirmAssociate, setConfirmAssociate] = useState(false);
    const [confirmCategoryDialog, setConfirmCategoryDialog] = useState(false);
    const [confirmMediumCategoryDialog, setConfirmMediumCategoryDialog] = useState(false);
    const [createLinkTarget, setCreateLinkTarget] = useState<CanonicalGroup | null>(null);
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
    const label = CATEGORY_LABELS[category as ComponentCategory] ?? category;

    const groups = state?.groups ?? [];
    const hasMore = state?.hasMore ?? false;
    const loading = state?.loading ?? false;
    const error = state?.error ?? null;

    const fetchGroups = useCallback(async (offset: number) => {
        onStateChange({ loading: true, error: null });
        try {
            const data = await getGroupedUnmatched({
                category,
                offset: String(offset),
                limit: String(LOAD_SIZE),
                confidence: filterConfidence,
                hasExisting: filterHasExisting,
            });
            const newGroups = data.groups as CanonicalGroup[];
            onStateChange({
                groups: offset === 0 ? newGroups : [...(state?.groups ?? []), ...newGroups],
                offset: offset + newGroups.length,
                hasMore: (data.total_groups ?? 0) > offset + newGroups.length,
                loading: false,
                error: null,
            });
            if (expandAllGroups) {
                const names = newGroups.map(g => g.canonical_name);
                setExpandedGroups(prev => new Set([...prev, ...names]));
            }
        } catch (err) {
            onStateChange({ loading: false, error: getErrorMessage(err) });
        }
    }, [category, expandAllGroups, onStateChange, state, filterConfidence, filterHasExisting]);

    // ── Fetch first batch on first open or if open on mount ──────────────────
    useEffect(() => {
        if (isOpen && !state && !loading) {
            fetchGroups(0);
        }
    }, [isOpen, state, loading, fetchGroups]);

    // ── Fetch first batch on first open ──────────────────────────────────────
    async function handleToggle() {
        if (disableToggle) return;
        onToggle();
        if (!isOpen && !state) {
            // First open — fetch initial batch
            await fetchGroups(0);
        }
    }

    async function handleLoadMore() {
        await fetchGroups(state?.offset ?? groups.length);
    }

    // ── Group removed (reject or successful associate) ────────────────────────
    function handleGroupRemoved(canonicalName: string) {
        const next = groups.filter((g) => g.canonical_name !== canonicalName);
        onStateChange({ groups: next });
        onGroupRemoved(canonicalName);
    }

    // ── "Associer tout" ───────────────────────────────────────────────────────
    function getEligibleGroups(): CanonicalGroup[] {
        return groups.filter(
            (g) => g.confidence === 'high' && g.existing_component_id !== null,
        );
    }

    function handleAssociateToutClick(e: React.MouseEvent) {
        e.stopPropagation();
        setConfirmAssociate(true);
    }

    function handleAssociateToutConfirm() {
        setConfirmAssociate(false);
        const eligible = getEligibleGroups();
        onAssociateTout(eligible.map((g) => g.canonical_name));
    }

    function handleConfirmCategoryClick(e: React.MouseEvent) {
        e.stopPropagation();
        if (isConfirming) return;
        setConfirmCategoryDialog(true);
    }

    function handleConfirmCategoryDialogConfirm() {
        setConfirmCategoryDialog(false);
        if (onConfirmCategory) {
            onConfirmCategory(category);
        }
    }

    function handleConfirmMediumCategoryClick(e: React.MouseEvent) {
        e.stopPropagation();
        if (isConfirming) return;
        setConfirmMediumCategoryDialog(true);
    }

    function handleConfirmMediumCategoryDialogConfirm() {
        setConfirmMediumCategoryDialog(false);
        if (onConfirmCategory) {
            onConfirmCategory(category, true);
        }
    }

    // ── CreateAndLinkModal ────────────────────────────────────────────────────
    function handleCreateLinkSuccess(result: CreateAndLinkResult) {
        setCreateLinkTarget(null);
        onToast({
            message: `✓ ${result.linked_count} listing${result.linked_count !== 1 ? 's' : ''} associé${result.linked_count !== 1 ? 's' : ''} à "${result.component_name}".`,
            type: 'success',
        });
        if (createLinkTarget) {
            handleGroupRemoved(createLinkTarget.canonical_name);
        }
    }

    // ── Expand/collapse individual group rows ─────────────────────────────────
    function toggleGroupExpand(canonicalName: string) {
        setExpandedGroups((prev) => {
            const next = new Set(prev);
            if (next.has(canonicalName)) next.delete(canonicalName);
            else next.add(canonicalName);
            return next;
        });
    }

    const eligibleCount = summary.high_confidence_linkable_count;
    const highConfidenceCount = summary.high_confidence_count ?? 0;
    const totalCount = summary.group_count;
    
    // Progress bar calculations
    const highPercent = totalCount > 0 ? (highConfidenceCount / totalCount) * 100 : 0;

    return (
        <>
            {/* ── Header row ──────────────────────────────────────────────────── */}
            {!hideHeader && (
                <div
                    onClick={handleToggle}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '10px 14px',
                        background: 'rgba(255, 255, 255, 0.02)',
                        backdropFilter: 'blur(10px)',
                        border: '1px solid rgba(255, 255, 255, 0.06)',
                        borderRadius: isOpen && !disableToggle ? 'var(--radius) var(--radius) 0 0' : 'var(--radius)',
                        cursor: disableToggle ? 'default' : 'pointer',
                        marginBottom: isOpen && !disableToggle ? 0 : '8px',
                        userSelect: 'none',
                        transition: 'all 0.2s ease',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                        position: 'relative',
                        overflow: 'hidden'
                    }}
                    onMouseOver={(e) => { if (!disableToggle) { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)'; } }}
                    onMouseOut={(e) => { if (!disableToggle) { e.currentTarget.style.transform = 'none'; e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)'; } }}
                >
                    {!disableToggle && (
                        <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
                            {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </span>
                    )}
                    <span style={{ color: 'var(--accent-blue)', display: 'flex', alignItems: 'center' }}>
                        {getCategoryIcon(category)}
                    </span>
                    <span style={{ fontWeight: 600, fontSize: '14px', flex: 1 }}>
                        {label}
                    </span>
                    
                    <span style={{ color: 'var(--text-dim)', fontSize: '12px', flexShrink: 0 }}>
                        {totalCount} groupe{totalCount !== 1 ? 's' : ''}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, marginLeft: '12px' }}>
                        {eligibleCount > 0 && (
                            <button
                                onClick={handleAssociateToutClick}
                                title={`Associer ${eligibleCount} groupe${eligibleCount !== 1 ? 's' : ''} haute confiance`}
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    padding: '4px 10px',
                                    background: 'var(--success, #22c55e)',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: 'var(--radius)',
                                    fontSize: '12px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                }}
                            >
                                <Link2 size={12} /> Associer tout ({eligibleCount})
                            </button>
                        )}
                        {highConfidenceCount > 0 && onConfirmCategory && (
                            <button
                                onClick={handleConfirmCategoryClick}
                                disabled={isConfirming}
                                title={isConfirming ? 'Confirmation en cours...' : `Confirmer et créer automatiquement les suggestions haute confiance pour la catégorie ${label} (${highConfidenceCount})`}
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    width: '36px',
                                    height: '36px',
                                    background: isConfirming
                                        ? 'var(--surface-3)'
                                        : 'rgba(16, 185, 129, 0.15)',
                                    color: isConfirming ? 'var(--text-dim)' : '#10b981',
                                    border: '1px solid rgba(16, 185, 129, 0.3)',
                                    borderRadius: '6px',
                                    cursor: isConfirming ? 'not-allowed' : 'pointer',
                                    transition: 'all 0.2s',
                                    position: 'relative'
                                }}
                                onMouseOver={(e) => { if (!isConfirming) e.currentTarget.style.background = 'rgba(16, 185, 129, 0.25)'; }}
                                onMouseOut={(e) => { if (!isConfirming) e.currentTarget.style.background = 'rgba(16, 185, 129, 0.15)'; }}
                            >
                                {isConfirming
                                    ? <RefreshCw size={16} className="spin" />
                                    : <CheckCircle size={18} />
                                }
                                {!isConfirming && highConfidenceCount > 0 && (
                                    <span style={{
                                        position: 'absolute',
                                        top: '-6px',
                                        right: '-6px',
                                        background: '#10b981',
                                        color: '#fff',
                                        fontSize: '10px',
                                        fontWeight: 'bold',
                                        padding: '2px 5px',
                                        borderRadius: '12px',
                                        lineHeight: 1
                                    }}>
                                        {highConfidenceCount}
                                    </span>
                                )}
                            </button>
                        )}
                        {onConfirmCategory && (
                            <button
                                onClick={handleConfirmMediumCategoryClick}
                                disabled={isConfirming}
                                title={isConfirming ? 'Confirmation en cours...' : `Confirmer Moyenne + Haute confiance pour la catégorie ${label}`}
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    width: '36px',
                                    height: '36px',
                                    background: 'var(--surface-2)',
                                    color: 'var(--text)',
                                    border: '1px solid var(--border)',
                                    borderRadius: '6px',
                                    cursor: isConfirming ? 'not-allowed' : 'pointer',
                                    transition: 'all 0.2s',
                                }}
                                onMouseOver={(e) => { if (!isConfirming) e.currentTarget.style.background = 'var(--surface-3)'; }}
                                onMouseOut={(e) => { if (!isConfirming) e.currentTarget.style.background = 'var(--surface-2)'; }}
                            >
                                {isConfirming
                                    ? <RefreshCw size={16} className="spin" />
                                    : <CheckSquare size={18} />
                                }
                            </button>
                        )}
                    </div>

                    {/* Full-width bottom progress line */}
                    {totalCount > 0 && highConfidenceCount > 0 && (
                        <div style={{ 
                            position: 'absolute', 
                            bottom: 0, 
                            left: 0, 
                            height: '2px', 
                            background: '#10b981', 
                            width: `${highPercent}%`,
                            transition: 'width 0.5s ease',
                            borderBottomLeftRadius: isOpen ? 0 : 'var(--radius)'
                        }} />
                    )}
                </div>
            )}

            {/* ── Body ────────────────────────────────────────────────────────── */}
            {isOpen && (
                <div style={{
                    border: '1px solid var(--border)',
                    borderTop: hideHeader || disableToggle ? '1px solid var(--border)' : 'none',
                    borderRadius: hideHeader ? 'var(--radius)' : '0 0 var(--radius) var(--radius)',
                    marginBottom: '6px',
                    overflow: 'hidden',
                    background: 'var(--surface)',
                }}>
                    {hideHeader && (eligibleCount > 0 || (highConfidenceCount > 0 && onConfirmCategory)) && (
                        <div style={{
                            padding: '10px 14px',
                            borderBottom: '1px solid var(--border)',
                            display: 'flex',
                            justifyContent: 'flex-end',
                            gap: '8px',
                            background: 'var(--bg)',
                        }}>
                            {eligibleCount > 0 && (
                                <button
                                    onClick={handleAssociateToutClick}
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        padding: '6px 14px',
                                        background: 'var(--success, #22c55e)',
                                        color: '#fff',
                                        border: 'none',
                                        borderRadius: 'var(--radius)',
                                        fontSize: '12px',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                    }}
                                >
                                    <Link2 size={12} /> Associer tout ({eligibleCount})
                                </button>
                            )}
                            {highConfidenceCount > 0 && onConfirmCategory && (
                                <button
                                    onClick={handleConfirmCategoryClick}
                                    disabled={isConfirming}
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        padding: '6px 14px',
                                        background: isConfirming
                                            ? 'var(--surface-3)'
                                            : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                        color: isConfirming ? 'var(--text-dim)' : '#fff',
                                        border: 'none',
                                        borderRadius: 'var(--radius)',
                                        fontSize: '13px',
                                        fontWeight: 600,
                                        cursor: isConfirming ? 'not-allowed' : 'pointer',
                                        opacity: isConfirming ? 0.7 : 1,
                                    }}
                                >
                                    {isConfirming
                                        ? <><RefreshCw size={12} className="spin" /> Confirmation...</>
                                        : <><CheckCircle size={12} /> Confirmer ({highConfidenceCount})</>
                                    }
                                </button>
                            )}
                        </div>
                    )}
                    {loading && groups.length === 0 && (
                        <p style={{ padding: '16px', color: 'var(--text-dim)', fontSize: '13px' }}>
                            Chargement...
                        </p>
                    )}

                    {error && (
                        <p style={{ padding: '16px', color: 'var(--danger, #e05252)', fontSize: '13px' }}>
                            ⚠ {error}
                        </p>
                    )}

                    {!loading && !error && groups.length === 0 && (
                        <p style={{ padding: '16px', color: 'var(--text-dim)', fontSize: '13px' }}>
                            Aucun groupe en attente.
                        </p>
                    )}

                    {groups.length > 0 && (
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.06)', background: 'rgba(255, 255, 255, 0.015)' }}>
                                    <th style={{ width: '32px' }} />
                                    <th style={{ width: '48px' }} />
                                    <th style={{ textAlign: 'left', padding: '12px 14px', fontSize: '11px', color: 'var(--text-dim)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', width: '100%' }}>Nom canonique</th>
                                    <th style={{ textAlign: 'left', padding: '12px 14px', fontSize: '11px', color: 'var(--text-dim)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', width: '120px', whiteSpace: 'nowrap' }}>Confiance</th>
                                    <th style={{ textAlign: 'center', padding: '12px 14px', fontSize: '11px', color: 'var(--text-dim)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', width: '100px', whiteSpace: 'nowrap' }}>Revendeurs</th>
                                    <th style={{ textAlign: 'left', padding: '12px 14px', fontSize: '11px', color: 'var(--text-dim)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', width: '150px', whiteSpace: 'nowrap' }}>Prix</th>
                                    <th style={{ textAlign: 'right', padding: '12px 24px 12px 14px', fontSize: '11px', color: 'var(--text-dim)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', width: '300px', whiteSpace: 'nowrap' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {groups.map((group) => (
                                    <CanonicalGroupRow
                                        key={group.canonical_name}
                                        group={group}
                                        isExpanded={expandedGroups.has(group.canonical_name)}
                                        onToggleExpand={() => toggleGroupExpand(group.canonical_name)}
                                        onGroupRejected={handleGroupRemoved}
                                        onAssociate={(g) => setCreateLinkTarget(g)}
                                    />
                                ))}
                            </tbody>
                        </table>
                    )}

                    {/* Load More */}
                    {hasMore && (
                        <div style={{ padding: '12px', textAlign: 'center', borderTop: '1px solid var(--border)' }}>
                            <button
                                onClick={handleLoadMore}
                                disabled={loading}
                                style={{
                                    padding: '6px 16px',
                                    background: 'var(--surface-2)',
                                    border: '1px solid var(--border)',
                                    borderRadius: 'var(--radius)',
                                    fontSize: '12px',
                                    cursor: loading ? 'not-allowed' : 'pointer',
                                    color: 'var(--text-muted)',
                                    opacity: loading ? 0.6 : 1,
                                }}
                            >
                                {loading ? 'Chargement...' : `Charger plus (${summary.group_count - groups.length} restants)`}
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Confirm "Associer tout" */}
            {confirmAssociate && (
                <ConfirmDialog
                    title="Associer tout"
                    message={`Associer ${eligibleCount} groupe${eligibleCount !== 1 ? 's' : ''} haute confiance à leurs composants existants ?`}
                    confirmLabel={`Associer ${eligibleCount}`}
                    onConfirm={handleAssociateToutConfirm}
                    onCancel={() => setConfirmAssociate(false)}
                />
            )}

            {/* Confirm per-category ingestion */}
            {confirmCategoryDialog && (
                <ConfirmDialog
                    title={`Confirmer — ${label}`}
                    message={`Créer automatiquement tous les composants haute confiance pour la catégorie "${label}" ? Les correspondances existantes seront liées, les nouvelles créées.`}
                    confirmLabel={`Confirmer (${highConfidenceCount})`}
                    onConfirm={handleConfirmCategoryDialogConfirm}
                    onCancel={() => setConfirmCategoryDialog(false)}
                />
            )}
            
            {/* Confirm per-category (Medium + High) ingestion */}
            {confirmMediumCategoryDialog && (
                <ConfirmDialog
                    title={`Confirmer Moyenne + Haute — ${label}`}
                    message={`Créer automatiquement tous les composants MOYENNE et HAUTE confiance pour la catégorie "${label}" ?`}
                    confirmLabel={`Confirmer`}
                    onConfirm={handleConfirmMediumCategoryDialogConfirm}
                    onCancel={() => setConfirmMediumCategoryDialog(false)}
                />
            )}

            {/* CreateAndLinkModal */}
            <CreateAndLinkModal
                group={createLinkTarget}
                isOpen={createLinkTarget !== null}
                onClose={() => setCreateLinkTarget(null)}
                onSuccess={handleCreateLinkSuccess}
            />
        </>
    );
}
