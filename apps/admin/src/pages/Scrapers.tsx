import { useEffect, useState, useCallback, useRef } from 'react';
import { Play, PlayCircle, RefreshCw } from 'lucide-react';
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

const POLL_INTERVAL_MS = 3000;

export function Scrapers() {
  const [retailers, setRetailers] = useState<AdminRetailer[]>([]);
  const [logs, setLogs] = useState<ScraperLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false); // any scraper running
  const [logLevel, setLogLevel] = useState('');
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const logBoxRef = useRef<HTMLDivElement>(null);

  const loadRetailers = useCallback(() => {
    getAdminRetailers()
      .then((data) => setRetailers(data.retailers ?? []))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const loadLogs = useCallback(() => {
    const params: Record<string, string> = { limit: '100' };
    if (logLevel) params.level = logLevel;
    return getAdminLogs(params).then((data) => {
      setLogs(data.logs ?? []);
      return data.logs ?? [];
    });
  }, [logLevel]);

  useEffect(() => {
    loadRetailers();
    loadLogs();
  }, [loadRetailers, loadLogs]);

  // Auto-scroll log box to TOP (newest logs are at the top from the API)
  useEffect(() => {
    if (logBoxRef.current) {
      logBoxRef.current.scrollTop = 0;
    }
  }, [logs]);

  // Start polling logs every 3s while a scraper is running
  function startPolling() {
    if (pollRef.current) return;
    pollRef.current = setInterval(async () => {
      const newLogs = await loadLogs();
      loadRetailers();
      // Stop polling when we see a "Session complete" or "complete" log
      const done = newLogs.some(l =>
        l.level === 'INFO' && l.message.toLowerCase().includes('complete')
      );
      if (done) stopPolling();
    }, POLL_INTERVAL_MS);
  }

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    setRunning(false);
    loadRetailers();
  }

  // Cleanup on unmount
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  async function handleRunOne(retailerId: number) {
    setRunning(true);
    try {
      await runScraper(retailerId);
      startPolling();
    } catch (err: unknown) {
      setRunning(false);
      alert(err instanceof Error ? err.message : 'Error');
    }
  }

  async function handleRunAll() {
    setRunning(true);
    try {
      await runAllScrapers();
      startPolling();
    } catch (err: unknown) {
      setRunning(false);
      alert(err instanceof Error ? err.message : 'Error');
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>Scrapers</h1>
        <button className={styles.runAllBtn} onClick={handleRunAll} disabled={running}>
          <PlayCircle size={16} />
          {running ? 'Scraping en cours...' : 'Lancer tous'}
        </button>
      </div>

      {/* Running indicator */}
      {running && (
        <div className={styles.runningBanner}>
          <span className={styles.spinner} />
          Scraping en cours — les logs se mettent à jour automatiquement...
        </div>
      )}

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
                  {r.last_scrape_status ? (
                    <span className={`${styles.badge} ${styles[(r.last_scrape_status as string).toLowerCase()]}`}>
                      {r.last_scrape_status as string}
                    </span>
                  ) : '—'}
                </td>
                <td>
                  <button
                    className={styles.runBtn}
                    onClick={() => handleRunOne(r.id)}
                    disabled={running || !r.is_active}
                    title={!r.is_active ? 'Revendeur inactif' : 'Lancer maintenant'}
                  >
                    <Play size={14} />
                    {running ? 'En cours...' : 'Lancer'}
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
          <h2>Logs récents</h2>
          <select value={logLevel} onChange={(e) => setLogLevel(e.target.value)} disabled={running}>
            <option value="">Tous niveaux</option>
            <option value="INFO">INFO</option>
            <option value="WARNING">WARNING</option>
            <option value="ERROR">ERROR</option>
          </select>
          <button className={styles.refreshBtn} onClick={() => loadLogs()} disabled={running}>
            <RefreshCw size={13} />
            {running ? 'Auto' : 'Actualiser'}
          </button>
        </div>
        <div className={styles.logBox} ref={logBoxRef}>
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
