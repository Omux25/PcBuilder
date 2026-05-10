/**
 * SearchOverrideView — flat cross-category search results.
 *
 * Shown when the global search bar is active. Replaces the accordion layout.
 * Hard cap at 50 results — no Load More. Shows a hint if total > 50.
 * Each row has a category badge so the admin can see which category it belongs to.
 *
 * Requirements: 6.3, 6.6, 6.7
 */

import { useEffect, useRef, useState } from 'react';
import { CanonicalGroupRow } from './CanonicalGroupRow';
import { CreateAndLinkModal } from './CreateAndLinkModal';
import type { CreateAndLinkResult } from './CreateAndLinkModal';
import type { CanonicalGroup, ToastState } from '../api';
import { getGroupedUnmatched, getErrorMessage } from '../api';
import { CATEGORY_LABELS } from '@shared/types';
import type { ComponentCategory } from '@shared/types';

const SEARCH_LIMIT = 50;
const DEBOUNCE_MS = 300;

interface Props {
    query: string;
    onGroupRemoved: (canonicalName: string, category: string) => void;
    onToast: (toast: ToastState) => void;
}

export function SearchOverrideView({ query, onGroupRemoved, onToast }: Props) {
    const [groups, setGroups] = useState<CanonicalGroup[]>([]);
    const [totalGroups, setTotalGroups] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
    const [createLinkTarget, setCreateLinkTarget] = useState<CanonicalGroup | null>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        if (!query.trim()) {
            setGroups([]);
            setTotalGroups(0);
            return;
        }
        debounceRef.current = setTimeout(() => {
            fetchResults(query.trim());
        }, DEBOUNCE_MS);
        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, [query]);

    async function fetchResults(q: string) {
        setLoading(true);
        setError(null);
        try {
            const data = await getGroupedUnmatched({ search: q, limit: String(SEARCH_LIMIT) });
            setGroups((data.groups ?? []) as CanonicalGroup[]);
            setTotalGroups(data.total_groups ?? 0);
        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            setLoading(false);
        }
    }

    function handleGroupRemoved(canonicalName: string) {
        const group = groups.find((g) => g.canonical_name === canonicalName);
        setGroups((prev) => prev.filter((g) => g.canonical_name !== canonicalName));
        if (group) onGroupRemoved(canonicalName, group.category ?? '');
    }

    function handleCreateLinkSuccess(result: CreateAndLinkResult) {
        setCreateLinkTarget(null);
        onToast({
            message: `✓ ${result.linked_count} listing${result.linked_count !== 1 ? 's' : ''} associé${result.linked_count !== 1 ? 's' : ''} à "${result.component_name}".`,
            type: 'success',
        });
        if (createLinkTarget) handleGroupRemoved(createLinkTarget.canonical_name);
    }

    function toggleGroupExpand(canonicalName: string) {
        setExpandedGroups((prev) => {
            const next = new Set(prev);
            if (next.has(canonicalName)) next.delete(canonicalName);
            else next.add(canonicalName);
            return next;
        });
    }

    if (loading) {
        return (
            <div style={{ padding: '24px', color: 'var(--text-dim)', fontSize: '13px', textAlign: 'center' }}>
                Recherche en cours...
            </div>
        );
    }

    if (error) {
        return (
            <div style={{ padding: '16px', color: 'var(--danger, #e05252)', fontSize: '13px' }}>
                ⚠ {error}
            </div>
        );
    }

    if (!query.trim()) return null;

    if (groups.length === 0) {
        return (
            <div style={{ padding: '24px', color: 'var(--text-dim)', fontSize: '13px', textAlign: 'center' }}>
                Aucun résultat pour « {query} ».
            </div>
        );
    }

    return (
        <div>
            <div style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                    {totalGroups} résultat{totalGroups !== 1 ? 's' : ''} pour « {query} »
                    {totalGroups > SEARCH_LIMIT && ` — affichage des ${SEARCH_LIMIT} premiers`}
                </span>
                {totalGroups > SEARCH_LIMIT && (
                    <span style={{
                        fontSize: '11px',
                        color: 'var(--warning, #f59e0b)',
                        background: 'color-mix(in srgb, var(--warning, #f59e0b) 12%, transparent)',
                        padding: '2px 8px',
                        borderRadius: '999px',
                        fontWeight: 500,
                    }}>
                        Plus de {SEARCH_LIMIT} résultats — affinez votre recherche
                    </span>
                )}
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
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
                            categoryBadge={
                                group.category
                                    ? (CATEGORY_LABELS[group.category as ComponentCategory] ?? group.category)
                                    : '⚠️ Inconnu'
                            }
                        />
                    ))}
                </tbody>
            </table>

            <CreateAndLinkModal
                group={createLinkTarget}
                isOpen={createLinkTarget !== null}
                onClose={() => setCreateLinkTarget(null)}
                onSuccess={handleCreateLinkSuccess}
            />
        </div>
    );
}
