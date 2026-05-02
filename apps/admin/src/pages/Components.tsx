import { useEffect, useState } from 'react';
import { Pencil, Trash2, Plus, ToggleLeft, ToggleRight } from 'lucide-react';
import { getAdminComponents, deleteAdminComponent, updateAdminComponent } from '../api';
import type { AdminComponent } from '../api';
import { ComponentModal } from '../components/ComponentModal';
import styles from './Components.module.css';

const CATEGORIES = ['cpu', 'motherboard', 'gpu', 'ram', 'storage', 'psu', 'case', 'cooling'];

export function Components() {
  const [components, setComponents] = useState<AdminComponent[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingComponent, setEditingComponent] = useState<AdminComponent | null>(null);

  const LIMIT = 20;

  function load() {
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
  }

  useEffect(() => { load(); }, [page, category]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    load();
  }

  async function handleToggleActive(component: AdminComponent) {
    try {
      // Only send the minimal fields needed — sending the full component object
      // causes validation errors because it includes DB-only fields (timestamps, etc.)
      await updateAdminComponent(component.id, {
        name: component.name,
        brand: component.brand,
        category: component.category,
        is_active: !component.is_active,
      });
      load();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error');
    }
  }

  async function handleDelete(id: number) {
    try {
      await deleteAdminComponent(id);
      setConfirmDelete(null);
      load();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error');
    }
  }

  const totalPages = Math.ceil(total / LIMIT);

  function openModal(component: AdminComponent | null = null) {
    setEditingComponent(component);
    setModalOpen(true);
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>Composants</h1>
        <button onClick={() => openModal()} className={styles.addBtn} style={{ border: 'none', cursor: 'pointer' }}>
          <Plus size={16} /> Ajouter
        </button>
      </div>

      {/* Filters */}
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
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <button type="submit" className={styles.searchBtn}>Rechercher</button>
      </form>

      {error && <p className={styles.error}>{error}</p>}

      {loading ? (
        <p className={styles.loading}>Chargement...</p>
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
                  <td><span className={styles.categoryBadge}>{c.category}</span></td>
                  <td>{c.release_year ?? '—'}</td>
                  <td>
                    <button
                      className={styles.toggleBtn}
                      onClick={() => handleToggleActive(c)}
                      title={c.is_active ? 'Desactiver' : 'Activer'}
                    >
                      {c.is_active
                        ? <ToggleRight size={20} color="var(--success-soft)" />
                        : <ToggleLeft size={20} color="var(--text-dim)" />}
                    </button>
                  </td>
                  <td>
                    <div className={styles.actions}>
                      <button onClick={() => openModal(c)} className={styles.editBtn} title="Modifier" style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
                        <Pencil size={15} />
                      </button>
                      <button
                        className={styles.deleteBtn}
                        onClick={() => setConfirmDelete(c.id)}
                        title="Supprimer"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className={styles.pagination}>
              <button disabled={page <= 1} onClick={() => setPage(page - 1)}>Precedent</button>
              <span>{page} / {totalPages} ({total} total)</span>
              <button disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Suivant</button>
            </div>
          )}
        </>
      )}

      {/* Delete confirmation */}
      {confirmDelete !== null && (
        <div className={styles.overlay}>
          <div className={styles.dialog}>
            <h3>Confirmer la suppression</h3>
            <p>Cette action est irreversible. Les enregistrements lies doivent etre supprimes d'abord.</p>
            <div className={styles.dialogActions}>
              <button className={styles.cancelBtn} onClick={() => setConfirmDelete(null)}>Annuler</button>
              <button className={styles.confirmDeleteBtn} onClick={() => handleDelete(confirmDelete)}>Supprimer</button>
            </div>
          </div>
        </div>
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
