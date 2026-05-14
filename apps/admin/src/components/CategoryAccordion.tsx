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

import { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, Link2 } from 'lucide-react';
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

const LOAD_SIZE = 50;

interface Props {
    category: string;
    summary: CategorySummaryEntry;
    state: CategoryState | undefined;
    isOpen: boolean;
    onToggle: () => void;
    onStateChange: (patch: Partial<CategoryState>) => void;
    onAssociateTout: (canonicalNames: string[]) => void;
    onGroupRemoved: (canonicalName: string) => void;
    onToast: (toast: ToastState) => void;
    hideHeader?: boolean;
    expandAllGroups?: boolean;
}

export function CategoryAccordion({
    category,
    summary,
    state,
    isOpen,
    onToggle,
    onStateChange,
    onAssociateTout,
    onGroupRemoved,
    onToast,
    hideHeader = false,
    expandAllGroups = false,
}: Props) {
    const [confirmAssociate, setConfirmAssociate] = useState(false);
    const [createLinkTarget, setCreateLinkTarget] = useState<CanonicalGroup | null>(null);
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
    const label = CATEGORY_LABELS[category as ComponentCategory] ?? category;

    const groups = state?.groups ?? [];
    const hasMore = state?.hasMore ?? false;
    const loading = state?.loading ?? false;
    const error = state?.error ?? null;

    // ── Fetch first batch on first open or if open on mount ──────────────────
    useEffect(() => {
        if (isOpen && !state && !loading) {
            fetchGroups(0);
        }
    }, [isOpen, state, loading]);

    // ── Fetch first batch on first open ──────────────────────────────────────
    async function handleToggle() {
        onToggle();
        if (!isOpen && !state) {
            // First open — fetch initial batch
            await fetchGroups(0);
        }
    }

    async function fetchGroups(offset: number) {
        onStateChange({ loading: true, error: null });
        try {
            const data = await getGroupedUnmatched({
                category,
                offset: String(offset),
                limit: String(LOAD_SIZE),
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

    return (
        <>
            {/* ── Header row ──────────────────────────────────────────────────── */}
            {!hideHeader && (
                <div
                    onClick={handleToggle}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '10px 14px',
                        background: 'var(--surface)',
                        border: '1px solid var(--border)',
                        borderRadius: isOpen ? 'var(--radius) var(--radius) 0 0' : 'var(--radius)',
                        cursor: 'pointer',
                        marginBottom: isOpen ? 0 : '6px',
                        userSelect: 'none',
                    }}
                >
                    <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
                        {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </span>
                    <span style={{ fontWeight: 600, fontSize: '14px', flex: 1 }}>
                        {label}
                    </span>
                    <span style={{ color: 'var(--text-dim)', fontSize: '12px' }}>
                        {summary.group_count} groupe{summary.group_count !== 1 ? 's' : ''}
                    </span>
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
                                flexShrink: 0,
                            }}
                        >
                            <Link2 size={12} /> Associer tout ({eligibleCount})
                        </button>
                    )}
                </div>
            )}

            {/* ── Body ────────────────────────────────────────────────────────── */}
            {isOpen && (
                <div style={{
                    border: '1px solid var(--border)',
                    borderTop: hideHeader ? '1px solid var(--border)' : 'none',
                    borderRadius: hideHeader ? 'var(--radius)' : '0 0 var(--radius) var(--radius)',
                    marginBottom: '6px',
                    overflow: 'hidden',
                    background: 'var(--surface)',
                }}>
                    {hideHeader && eligibleCount > 0 && (
                        <div style={{
                            padding: '10px 14px',
                            borderBottom: '1px solid var(--border)',
                            display: 'flex',
                            justifyContent: 'flex-end',
                            background: 'var(--bg)',
                        }}>
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
                                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                    <th style={{ width: '32px' }} />
                                    <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: '11px', color: 'var(--text-dim)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Nom canonique</th>
                                    <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: '11px', color: 'var(--text-dim)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Confiance</th>
                                    <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: '11px', color: 'var(--text-dim)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Revendeurs</th>
                                    <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: '11px', color: 'var(--text-dim)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Prix</th>
                                    <th style={{ textAlign: 'right', padding: '8px 12px', fontSize: '11px', color: 'var(--text-dim)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Actions</th>
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
