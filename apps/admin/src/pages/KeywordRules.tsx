/**
 * KeywordRules page — /admin/keyword-rules
 *
 * Displays all keyword rules (admin + built-in) with search/filter,
 * allows adding new admin rules and deleting existing ones.
 *
 * Requirements: 12.1–12.5, 13.1–13.7, 14.1–14.8
 */

import { useEffect, useState, useMemo } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { getKeywordRules, deleteKeywordRule, getErrorMessage} from '../api';
import type { KeywordRuleResponse } from '../api';
import { CATEGORY_LABELS } from '@shared/types';
import type { ComponentCategory } from '@shared/types';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { AddRuleModal } from '../components/AddRuleModal';
import styles from './KeywordRules.module.css';

const MATCH_TYPE_DISPLAY: Record<string, string> = {
    contains: 'Contenu',
    word: 'Mot exact',
    starts_with: 'Commence par',
    number_before: 'Nombre avant',
};

export function KeywordRules() {
    const [rules, setRules] = useState<KeywordRuleResponse[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [toast, setToast] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('');
    const [deleteTarget, setDeleteTarget] = useState<KeywordRuleResponse | null>(null);
    const [showAddModal, setShowAddModal] = useState(false);

    function load() {
        setLoading(true);
        getKeywordRules()
            .then(data => setRules(data))
            .catch(e => setError(e.message))
            .finally(() => setLoading(false));
    }

    useEffect(() => { load(); }, []);

    // Client-side filter
    const filtered = useMemo(() => {
        return rules.filter(r => {
            const matchesSearch = !search || r.keyword.toLowerCase().includes(search.toLowerCase());
            const matchesCategory = !categoryFilter || r.category === categoryFilter;
            return matchesSearch && matchesCategory;
        });
    }, [rules, search, categoryFilter]);

    const adminCount = rules.filter(r => r.source === 'admin').length;
    const builtinCount = rules.filter(r => r.source === 'builtin').length;

    // Unique categories for filter dropdown
    const categories = useMemo(() => {
        return [...new Set(rules.map(r => r.category))].sort();
    }, [rules]);

    async function handleDelete() {
        if (!deleteTarget) return;
        try {
            await deleteKeywordRule(deleteTarget.id);
            setRules(prev => prev.filter(r => r.id !== deleteTarget.id));
            setToast(`Règle "${deleteTarget.keyword}" supprimée.`);
            setTimeout(() => setToast(null), 4000);
        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            setDeleteTarget(null);
        }
    }

    function handleRuleAdded(rule: KeywordRuleResponse) {
        setRules(prev => [rule, ...prev]);
        setShowAddModal(false);
        setToast(`Règle "${rule.keyword}" ajoutée.`);
        setTimeout(() => setToast(null), 4000);
    }

    return (
        <div className={styles.page}>
            {/* Header */}
            <div className={styles.header}>
                <div>
                    <h1 className={styles.title}>Règles de mots-clés</h1>
                    <p className={styles.subtitle}>
                        {adminCount} règle{adminCount !== 1 ? 's' : ''} admin · {builtinCount} règle{builtinCount !== 1 ? 's' : ''} intégrée{builtinCount !== 1 ? 's' : ''}
                    </p>
                </div>
                <div className={styles.toolbar}>
                    <input
                        type="text"
                        placeholder="Rechercher un mot-clé..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className={styles.searchInput}
                    />
                    <select
                        value={categoryFilter}
                        onChange={e => setCategoryFilter(e.target.value)}
                        className={styles.categoryFilter}
                    >
                        <option value="">Toutes les catégories</option>
                        {categories.map(cat => (
                            <option key={cat} value={cat}>
                                {CATEGORY_LABELS[cat as ComponentCategory] ?? cat}
                            </option>
                        ))}
                    </select>
                    <button className={styles.addBtn} onClick={() => setShowAddModal(true)}>
                        <Plus size={14} /> Ajouter une règle
                    </button>
                </div>
            </div>

            {/* Toast */}
            {toast && (
                <div style={{
                    background: 'var(--success)',
                    color: '#0f1117',
                    padding: '10px 16px',
                    borderRadius: 'var(--radius)',
                    marginBottom: '12px',
                    fontSize: '13px',
                    fontWeight: 500,
                }}>
                    {toast}
                </div>
            )}

            {error && <p className="admin-error">{error}</p>}

            {loading ? (
                <p className="admin-loading">Chargement...</p>
            ) : filtered.length === 0 ? (
                <p className="admin-empty">
                    {search || categoryFilter ? 'Aucune règle ne correspond aux filtres.' : 'Aucune règle définie.'}
                </p>
            ) : (
                <table>
                    <thead>
                        <tr>
                            <th>Mot-clé</th>
                            <th>Type</th>
                            <th>Catégorie</th>
                            <th>Source</th>
                            <th>Listings affectés</th>
                            <th>Date</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.map(rule => (
                            <tr key={rule.id}>
                                <td>
                                    <code style={{ fontSize: '13px', color: 'var(--accent-blue)' }}>{rule.keyword}</code>
                                </td>
                                <td>
                                    <span className={styles.matchType}>
                                        {MATCH_TYPE_DISPLAY[rule.match_type] ?? rule.match_type}
                                    </span>
                                </td>
                                <td>{CATEGORY_LABELS[rule.category as ComponentCategory] ?? rule.category}</td>
                                <td>
                                    <span className={`${styles.badge} ${rule.source === 'admin' ? styles.badgeAdmin : styles.badgeBuiltin}`}>
                                        {rule.source === 'admin' ? 'Admin' : 'Intégrée'}
                                    </span>
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                    <span style={{
                                        fontWeight: rule.match_count > 0 ? 600 : 400,
                                        color: rule.match_count > 0 ? 'var(--text)' : 'var(--text-dim)',
                                    }}>
                                        {rule.match_count}
                                    </span>
                                </td>
                                <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                    {rule.source === 'admin'
                                        ? new Date(rule.created_at).toLocaleDateString('fr-MA')
                                        : '—'}
                                </td>
                                <td>
                                    {rule.source === 'admin' ? (
                                        <button
                                            className={styles.deleteBtn}
                                            onClick={() => setDeleteTarget(rule)}
                                            title={`Supprimer la règle "${rule.keyword}"`}
                                            aria-label={`Supprimer la règle ${rule.keyword}`}
                                        >
                                            <Trash2 size={13} />
                                        </button>
                                    ) : (
                                        <span style={{ color: 'var(--text-dim)', fontSize: '12px' }}>—</span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}

            {/* Add rule modal */}
            <AddRuleModal
                isOpen={showAddModal}
                onClose={() => setShowAddModal(false)}
                onSuccess={handleRuleAdded}
            />

            {/* Confirm delete */}
            {deleteTarget && (
                <ConfirmDialog
                    title="Supprimer la règle"
                    message={`Supprimer la règle "${deleteTarget.keyword}" → ${CATEGORY_LABELS[deleteTarget.category as ComponentCategory] ?? deleteTarget.category} ?`}
                    confirmLabel="Supprimer"
                    danger
                    onConfirm={handleDelete}
                    onCancel={() => setDeleteTarget(null)}
                />
            )}
        </div>
    );
}
