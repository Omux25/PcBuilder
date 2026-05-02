import { useEffect, useState, useCallback } from 'react';
import { Play, PlayCircle } from 'lucide-react';
import { getAdminRetailers, getAdminLogs, runScraper, runAllScrapers } from '../api';
import type { AdminRetailer } from '../api';
import styles from './Scrapers.module.css';

interface ScraperLog {
  id: number;
  level: string;
  site?: string | null;
  message: string;
  created_at: string;
}

export function Scrapers() {
  const [retailers, setRetailers] = useState<AdminRetailer[]>([]);
  const [logs, setLogs] = useState<ScraperLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState<Set<number>>(new Set());
  const [logLevel, setLogLevel] = useState('');
  const [error, setError] = useState<string | null>(null);

  const loadRetailers = useCallback(() => {
    getAdminRetailers()
      .then((data) => setRetailers(data.retailers ?? []))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const loadLogs = useCallback(() => {
    const params: Record<string, string> = { limit: '100' };
    if (logLevel) params.level = logLevel;
    getAdminLogs(params)
      .then((data) => setLogs(data.logs ?? []));
  }, [logLevel]);

  useEffect(() => {
    loadRetailers();
    loadLogs();
  }, [loadRetailers, loadLogs]);

  async function handleRunOne(retailerId: number) {
    setRunning((prev) => new Set(prev).add(retailerId));
    try {
      await runScraper(retailerId);
      setTimeout(loadRetailers, 2000);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error');
    } finally {
      setRunning((prev) => { const s = new Set(prev); s.delete(retailerId); return s; });
    }
  }

  async function handleRunAll() {
    try {
      await runAllScrapers();
      setTimeout(loadRetailers, 2000);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error');
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>Scrapers</h1>
        <button className={styles.runAllBtn} onClick={handleRunAll}>
          <PlayCircle size={16} /> Lancer tous
        </button>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      {!loading && (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Revendeur</th>
              <th>Dernier scraping</th>
              <th>Statut</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {retailers.map((r) => (
              <tr key={r.id}>
                <td>{r.name}</td>
                <td className={styles.date}>
                  {r.last_scrape_at ? new Date(r.last_scrape_at as string).toLocaleString('fr-MA') : '—'}
                </td>
                <td>
                  {r.last_scrape_status && (
                    <span className={`${styles.badge} ${styles[(r.last_scrape_status as string).toLowerCase()]}`}>
                      {r.last_scrape_status as string}
                    </span>
                  )}
                </td>
                <td>
                  <button
                    className={styles.runBtn}
                    onClick={() => handleRunOne(r.id)}
                    disabled={running.has(r.id) || !r.is_active}
                    title={!r.is_active ? 'Revendeur inactif' : 'Lancer maintenant'}
                  >
                    <Play size={14} />
                    {running.has(r.id) ? 'En cours...' : 'Lancer'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Log viewer */}
      <section className={styles.logSection}>
        <div className={styles.logHeader}>
          <h2>Logs recents</h2>
          <select value={logLevel} onChange={(e) => setLogLevel(e.target.value)}>
            <option value="">Tous niveaux</option>
            <option value="INFO">INFO</option>
            <option value="WARNING">WARNING</option>
            <option value="ERROR">ERROR</option>
          </select>
          <button className={styles.refreshBtn} onClick={loadLogs}>Actualiser</button>
        </div>
        <div className={styles.logBox}>
          {logs.length === 0 ? (
            <p className={styles.empty}>Aucun log.</p>
          ) : (
            logs.map((log) => (
              <div key={log.id} className={`${styles.logEntry} ${styles[log.level?.toLowerCase()]}`}>
                <span className={styles.logLevel}>{log.level}</span>
                {log.site && <span className={styles.logSite}>[{log.site}]</span>}
                <span className={styles.logMsg}>{log.message}</span>
                <span className={styles.logTime}>{new Date(log.created_at).toLocaleString('fr-MA')}</span>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

