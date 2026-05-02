import { useEffect, useState } from 'react';
import { ToggleLeft, ToggleRight, Trash2 } from 'lucide-react';
import { getAdminRetailers, updateAdminRetailer } from '../api';
import type { AdminRetailer } from '../api';
import { RetailerModal } from '../components/RetailerModal';
import styles from './Retailers.module.css';

export function Retailers() {
  const [retailers, setRetailers] = useState<AdminRetailer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRetailer, setEditingRetailer] = useState<AdminRetailer | null>(null);
  const [confirmDeactivate, setConfirmDeactivate] = useState<AdminRetailer | null>(null);

  function load() {
    setLoading(true);
    getAdminRetailers()
      .then((data) => setRetailers(data.retailers ?? []))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  // Optimistic toggle — update local state immediately, then sync with server
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
      alert(err instanceof Error ? err.message : 'Error');
    }
  }

  async function handleDeactivate(retailer: AdminRetailer) {
    try {
      await updateAdminRetailer(retailer.id, { is_active: false });
      setConfirmDeactivate(null);
      load();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error');
    }
  }

  function openModal(retailer: AdminRetailer | null = null) {
    setEditingRetailer(retailer);
    setModalOpen(true);
  }

  return (
    <div className={styles.page}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 className={styles.title} style={{ margin: 0 }}>Revendeurs</h1>
        <button onClick={() => openModal()} style={{ background: 'var(--accent-blue)', color: 'var(--bg)', border: 'none', padding: '0.45rem 0.9rem', borderRadius: 'var(--radius)', fontWeight: 600, cursor: 'pointer' }}>
          + Ajouter
        </button>
      </div>

      {error && <p className={styles.error}>{error}</p>}
      {loading ? <p className={styles.loading}>Chargement...</p> : (
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
                    <span className={`${styles.badge} ${styles[r.last_scrape_status.toLowerCase()]}`}>
                      {r.last_scrape_status}
                    </span>
                  ) : '—'}
                </td>
                <td>{r.price_records_count ?? 0}</td>
                <td>
                  <button className={styles.toggleBtn} onClick={() => handleToggle(r)} title={r.is_active ? 'Désactiver' : 'Activer'}>
                    {r.is_active
                      ? <ToggleRight size={20} color="var(--success-soft)" />
                      : <ToggleLeft size={20} color="var(--text-dim)" />}
                  </button>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <button onClick={() => openModal(r)} style={{ background: 'none', border: 'none', color: 'var(--accent-blue)', cursor: 'pointer', fontSize: '0.85rem' }}>
                      Modifier
                    </button>
                    {!r.is_active && (
                      <button
                        onClick={() => setConfirmDeactivate(r)}
                        style={{ background: 'none', border: 'none', color: 'var(--danger-soft)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                        title="Supprimer définitivement"
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

      {/* Confirm deactivate/delete dialog */}
      {confirmDeactivate && (
        <div className={styles.overlay}>
          <div className={styles.dialog}>
            <h3>Supprimer {confirmDeactivate.name} ?</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.5rem' }}>
              Ce revendeur est déjà inactif. La suppression est irréversible et effacera toutes ses données de prix.
              <br /><br />
              Note : la suppression n'est pas encore implémentée côté API — seule la désactivation est disponible.
            </p>
            <div className={styles.dialogActions}>
              <button className={styles.cancelBtn} onClick={() => setConfirmDeactivate(null)}>Annuler</button>
              <button
                className={styles.confirmDeleteBtn}
                onClick={() => handleDeactivate(confirmDeactivate)}
              >
                Désactiver définitivement
              </button>
            </div>
          </div>
        </div>
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
