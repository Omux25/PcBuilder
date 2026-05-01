import { useEffect, useState } from 'react';
import { ToggleLeft, ToggleRight } from 'lucide-react';
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

  function load() {
    setLoading(true);
    getAdminRetailers()
      .then((data) => setRetailers(data.retailers ?? []))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function handleToggle(retailer: AdminRetailer) {
    try {
      await updateAdminRetailer(retailer.id, { is_active: !retailer.is_active });
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
              <th>Intervalle (h)</th>
              <th>Dernier scraping</th>
              <th>Statut</th>
              <th>Prix enregistres</th>
              <th>Actif</th>
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
                  {r.last_scrape_status && (
                    <span className={`${styles.badge} ${styles[r.last_scrape_status.toLowerCase()]}`}>
                      {r.last_scrape_status}
                    </span>
                  )}
                </td>
                <td>{r.price_records_count ?? 0}</td>
                <td>
                  <button className={styles.toggleBtn} onClick={() => handleToggle(r)}>
                    {r.is_active
                      ? <ToggleRight size={20} color="var(--success-soft)" />
                      : <ToggleLeft size={20} color="var(--text-dim)" />}
                  </button>
                  <button onClick={() => openModal(r)} style={{ background: 'none', border: 'none', color: 'var(--accent-blue)', cursor: 'pointer', marginLeft: '0.5rem', fontSize: '0.85rem' }}>
                    Modifier
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
