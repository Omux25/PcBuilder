import { useEffect, useState } from 'react';
import { RefreshCw, Trash2, Globe, Server, Activity } from 'lucide-react';
import { getAdminTrafficLogs, clearAllTrafficLogs, type TrafficLogEntry } from '../api';
import styles from './Traffic.module.css';

export function Traffic() {
  const [logs, setLogs] = useState<TrafficLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const limit = 50;

  useEffect(() => {
    fetchLogs();
  }, [page]);

  async function fetchLogs() {
    setLoading(true);
    try {
      const res = await getAdminTrafficLogs({ limit: String(limit), offset: String((page - 1) * limit) });
      setLogs(res.data);
      setTotal(res.total);
    } catch (err) {
      console.error('Failed to fetch traffic logs', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleClearLogs() {
    if (!confirm('Etes-vous sûr de vouloir supprimer TOUS les logs de trafic ?')) return;
    try {
      await clearAllTrafficLogs();
      setPage(1);
      fetchLogs();
    } catch (err) {
      console.error('Failed to clear traffic logs', err);
    }
  }

  const totalPages = Math.ceil(total / limit);

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.titleArea}>
          <Activity className={styles.titleIcon} size={28} />
          <div>
            <h1 className={styles.title}>Trafic Web</h1>
            <p className={styles.subtitle}>{total.toLocaleString()} requêtes enregistrées</p>
          </div>
        </div>

        <div className={styles.actions}>
          <button onClick={fetchLogs} disabled={loading} className={styles.btnSecondary} title="Rafraîchir">
            <RefreshCw size={16} className={loading ? styles.spinning : ''} />
          </button>
          <button onClick={handleClearLogs} className={styles.btnDanger} title="Purger les logs">
            <Trash2 size={16} />
            Purger
          </button>
        </div>
      </header>

      <div className={styles.card}>
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Date</th>
                <th>Méthode</th>
                <th>Chemin</th>
                <th>Status</th>
                <th>Temps</th>
                <th>IP</th>
                <th>User Agent</th>
              </tr>
            </thead>
            <tbody>
              {loading && logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className={styles.empty}>Chargement des données de trafic...</td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className={styles.empty}>Aucun trafic enregistré.</td>
                </tr>
              ) : (
                logs.map(log => (
                  <tr key={log.id}>
                    <td className={styles.dateCell}>{new Date(log.createdAt).toLocaleString()}</td>
                    <td>
                      <span className={`${styles.badge} ${styles['method' + log.method] || styles.methodDefault}`}>
                        {log.method}
                      </span>
                    </td>
                    <td className={styles.pathCell} title={log.path}>{log.path}</td>
                    <td>
                      <span className={`${styles.statusBadge} ${log.statusCode >= 400 ? styles.statusError : styles.statusOk}`}>
                        {log.statusCode}
                      </span>
                    </td>
                    <td className={styles.timeCell}>{log.responseTimeMs}ms</td>
                    <td className={styles.ipCell}>
                      <Globe size={12} className={styles.inlineIcon} />
                      {log.ip || 'Inconnu'}
                    </td>
                    <td className={styles.uaCell} title={log.userAgent || ''}>
                      {log.userAgent || 'N/A'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className={styles.pagination}>
            <button
              disabled={page === 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              className={styles.pageBtn}
            >
              Précédent
            </button>
            <span className={styles.pageInfo}>
              Page {page} sur {totalPages}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              className={styles.pageBtn}
            >
              Suivant
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
