import { useEffect, useState, useCallback } from 'react';
import { Pencil, Trash2, Plus, ToggleLeft, ToggleRight } from 'lucide-react';
import { getAdminComponents, deleteAdminComponent, updateAdminComponent } from '../api';
import type { AdminComponent } from '../api';
import { ComponentModal } from '../components/ComponentModal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import styles from './Components.module.css';
import { CATEGORY_ORDER } from '@shared/types';

const LIMIT = 20;

export function Components() {
  const [components, setComponents] = useState<AdminComponent[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingComponent, setEditingComponent] = useState<AdminComponent | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    const params: Record<string, string> = { page: String(page), limit: String(LIMIT) };
    if (search) params.search = search;
    if (category) params.category = category;

    getAdminComponents(params)
      .then((data) => {
        setComponents(data.components ?? []);
        setTotal(data.total ?? 0);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [page, category, search]);

  useEffect(() => { load(); }, [load]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
  }

  async function handleToggleActive(component: AdminComponent) {
    setMutationError(null);
    try {
      await updateAdminComponent(component.id, { is_active: !component.is_active });
      load();
    } catch (err: unknown) {
      setMutationError(err instanceof Error ? err.message : 'Erreur inattendue');
    }
  }

  async function handleDelete(id: number) {
    setMutationError(null);
    try {
      await deleteAdminComponent(id);
      setConfirmDelete(null);
      load();
    } catch (err: unknown) {
      setConfirmDelete(null);
      setMutationError(err instanceof Error ? err.message : 'Erreur inattendue');
    }
  }

  const totalPages = Math.ceil(total / LIMIT);

  function openModal(component: AdminComponent | null = null) {
    setEditingComponent(component);
    setModalOpen(true);
  }

  return (
    <div className={styles.page}>
      <div className="admin-header">
        <h1>Composants</h1>
        <button onClick={() => openModal()} className="btn-primary">
          <Plus size={16} /> Ajouter
        </button>
      </div>

      <form onSubmit={handleSearch} className={styles.filters}>
        <input
          type="text"
          placeholder="Rechercher..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={styles.searchInput}
        />
        <select value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }}>
          <option value="">Toutes categories</option>
          {CATEGORY_ORDER.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <button type="submit" className={styles.searchBtn}>Rechercher</button>
      </form>

      {error && <p className="admin-error">{error}</p>}
      {mutationError && <p className="admin-error">{mutationError}</p>}

      {loading ? (
        <p className="admin-loading">Chargement...</p>
      ) : (
        <>
          <table>
            <thead>
              <tr>
                <th>Nom</th>
                <th>Marque</th>
                <th>Categorie</th>
                <th>Annee</th>
                <th>Statut</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {components.map((c) => (
                <tr key={c.id}>
                  <td>
                    <div className={styles.componentName}>{c.name}</div>
                    <div className={styles.componentSlug}>{c.slug}</div>
                  </td>
                  <td>{c.brand ?? '—'}</td>
                  <td><span className="badge badge-accent">{c.category}</span></td>
                  <td>{c.release_year ?? '—'}</td>
                  <td>
                    <button
                      className={styles.toggleBtn}
                      onClick={() => handleToggleActive(c)}
                      title={c.is_active ? 'Desactiver' : 'Activer'}
                      aria-label={c.is_active ? `Désactiver ${c.name}` : `Activer ${c.name}`}
                    >
                      {c.is_active
                        ? <ToggleRight size={20} color="var(--success-soft)" />
                        : <ToggleLeft size={20} color="var(--text-dim)" />}
                    </button>
                  </td>
                  <td>
                    <div className={styles.actions}>
                      <button
                        onClick={() => openModal(c)}
                        className={styles.editBtn}
                        title="Modifier"
                        aria-label={`Modifier ${c.name}`}
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        className={styles.deleteBtn}
                        onClick={() => setConfirmDelete(c.id)}
                        title="Supprimer"
                        aria-label={`Supprimer ${c.name}`}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div className="admin-pagination">
              <button disabled={page <= 1} onClick={() => setPage(page - 1)}>Précédent</button>
              <span>{page} / {totalPages} ({total} total)</span>
              <button disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Suivant</button>
            </div>
          )}
        </>
      )}

      {confirmDelete !== null && (
        <ConfirmDialog
          title="Confirmer la suppression"
          message="Cette action est irreversible. Les enregistrements lies doivent etre supprimes d'abord."
          confirmLabel="Supprimer"
          danger
          onConfirm={() => handleDelete(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      <ComponentModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={load}
        component={editingComponent}
      />
    </div>
  );
}
