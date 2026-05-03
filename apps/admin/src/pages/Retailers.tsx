import { useEffect, useState, useCallback } from 'react';
import { ToggleLeft, ToggleRight, Trash2, Plus } from 'lucide-react';
import { getAdminRetailers, updateAdminRetailer, hardDeleteRetailer } from '../api';
import type { AdminRetailer } from '../api';
import { RetailerModal } from '../components/RetailerModal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import styles from './Retailers.module.css';

export function Retailers() {
  const [retailers, setRetailers] = useState<AdminRetailer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRetailer, setEditingRetailer] = useState<AdminRetailer | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<AdminRetailer | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    getAdminRetailers()
      .then((data) => setRetailers(data.retailers ?? []))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleToggle(retailer: AdminRetailer) {
    // Optimistic update — no flicker
    setRetailers(prev =>
      prev.map(r => r.id === retailer.id ? { ...r, is_active: !r.is_active } : r)
    );
    try {
      await updateAdminRetailer(retailer.id, { is_active: !retailer.is_active });
    } catch (err: unknown) {
      // Revert on failure
      setRetailers(prev =>
        prev.map(r => r.id === retailer.id ? { ...r, is_active: retailer.is_active } : r)
      );
      setMutationError(err instanceof Error ? err.message : 'Erreur inattendue');
    }
  }

  async function handleDelete(retailer: AdminRetailer) {
    setMutationError(null);
    try {
      await hardDeleteRetailer(retailer.id);
      setConfirmDelete(null);
      load();
    } catch (err: unknown) {
      setConfirmDelete(null);
      setMutationError(err instanceof Error ? err.message : 'Erreur inattendue');
    }
  }

  function openModal(retailer: AdminRetailer | null = null) {
    setEditingRetailer(retailer);
    setModalOpen(true);
  }

  return (
    <div className={styles.page}>
      <div className="admin-header">
        <h1>Revendeurs</h1>
        <button onClick={() => openModal()} className="btn-primary">
          <Plus size={16} /> Ajouter
        </button>
      </div>

      {error && <p className="admin-error">{error}</p>}
      {mutationError && <p className="admin-error">{mutationError}</p>}

      {loading ? <p className="admin-loading">Chargement...</p> : (
        <table>
          <thead>
            <tr>
              <th>Nom</th>
              <th>Pays</th>
              <th>Intervalle</th>
              <th>Dernier scraping</th>
              <th>Statut</th>
              <th>Prix</th>
              <th>Actif</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {retailers.map((r) => (
              <tr key={r.id}>
                <td>
                  <div className={styles.name}>{r.name}</div>
                  <div className={styles.url}>{r.base_url}</div>
                </td>
                <td>{r.country}</td>
                <td>{r.scraping_interval_hours}h</td>
                <td className={styles.date}>
                  {r.last_scrape_at ? new Date(r.last_scrape_at).toLocaleString('fr-MA') : '—'}
                </td>
                <td>
                  {r.last_scrape_status ? (
                    <span className={`badge badge-${r.last_scrape_status.toLowerCase()}`}>
                      {r.last_scrape_status}
                    </span>
                  ) : '—'}
                </td>
                <td>{r.price_records_count ?? 0}</td>
                <td>
                  <button
                    className={styles.toggleBtn}
                    onClick={() => handleToggle(r)}
                    title={r.is_active ? 'Désactiver' : 'Activer'}
                    aria-label={r.is_active ? `Désactiver ${r.name}` : `Activer ${r.name}`}
                  >
                    {r.is_active
                      ? <ToggleRight size={20} color="var(--success-soft)" />
                      : <ToggleLeft size={20} color="var(--text-dim)" />}
                  </button>
                </td>
                <td>
                  <div className={styles.actions}>
                    <button
                      onClick={() => openModal(r)}
                      className={styles.editBtn}
                      aria-label={`Modifier ${r.name}`}
                    >
                      Modifier
                    </button>
                    {!r.is_active && (
                      <button
                        onClick={() => setConfirmDelete(r)}
                        className={styles.deleteBtn}
                        title="Supprimer définitivement"
                        aria-label={`Supprimer ${r.name}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {confirmDelete && (
        <ConfirmDialog
          title={`Supprimer ${confirmDelete.name} ?`}
          message="Suppression définitive et irréversible. Toutes les données de prix, mappings et logs associés à ce revendeur seront effacés."
          confirmLabel="Supprimer définitivement"
          danger
          onConfirm={() => handleDelete(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      <RetailerModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={load}
        retailer={editingRetailer}
      />
    </div>
  );
}
