import { useEffect, useState, useCallback, useRef } from 'react';
import { Play, PlayCircle, RefreshCw, Download, Trash2 } from 'lucide-react';
import {
  getAdminRetailers, getAdminLogs, runScraper, runAllScrapers,
  getScraperStatus, updateAdminRetailer, clearAdminLogs, getErrorMessage
} from '../api';
import type { AdminRetailer } from '../api';
import type { LogEntry } from '@shared/types';
import { fmtDate } from '../utils/fmt';
import styles from './Scrapers.module.css';

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes max

const INTERVAL_OPTIONS = [
  { label: '4h', value: 4 },
  { label: '8h', value: 8 },
  { label: '12h', value: 12 },
  { label: '24h', value: 24 },
  { label: '48h', value: 48 },
];

const STEP_PATTERNS: Array<{ match: string; label: (msg: string) => string }> = [
  { match: 'Scraping complete', label: () => 'Finalisation...' },
  { match: 'Building catalog', label: () => 'Construction du catalogue...' },
  { match: 'Auto-mapping', label: () => 'Mapping automatique...' },
  { match: 'Aggregating', label: () => 'Agrégation des prix...' },
  { match: 'Scraped ', label: (msg) => msg.replace(/^\[.*?\]\s*/, '') },
  { match: 'Scraper started', label: (msg) => msg.replace(/^\[.*?\]\s*/, '') + ' en cours...' },
  { match: 'Scraping started', label: () => 'Démarrage...' },
];

/** Derive a human-readable current step from the most recent log messages. */
function deriveCurrentStep(logs: LogEntry[]): string {
  for (const log of logs) {
    if (log.level !== 'INFO') continue;
    const pattern = STEP_PATTERNS.find(p => log.message.includes(p.match));
    if (pattern) return pattern.label(log.message);
  }
  return 'Scraping en cours...';
}

/** Format "next scrape in Xh Ym" from last_scrape_at + interval. */
function nextScrapeLabel(r: AdminRetailer): string {
  if (!r.scraping_enabled) return 'Désactivé';
  if (!r.last_scrape_at) return 'Dès que possible';
  const next = new Date(r.last_scrape_at).getTime() + r.scraping_interval_hours * 3600_000;
  const diff = next - Date.now();
  if (diff <= 0) return 'Dès que possible';
  const h = Math.floor(diff / 3600_000);
  const m = Math.floor((diff % 3600_000) / 60_000);
  return h > 0 ? `dans ${h}h ${m}m` : `dans ${m}m`;
}

export function Scrapers() {
  const [retailers, setRetailers] = useState<AdminRetailer[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [fullSessionRunning, setFullSessionRunning] = useState(false);
  const [runningJobs, setRunningJobs] = useState<Set<number>>(new Set());
  const [logLevel, setLogLevel] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [clearConfirm, setClearConfirm] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollStartRef = useRef<number>(0);
  const logBoxRef = useRef<HTMLDivElement>(null);

  const loadRetailers = useCallback(() => {
    return getAdminRetailers()
      .then((data) => setRetailers(data.retailers ?? []))
      .catch((e: Error) => setError(e.message));
  }, []);

  const loadLogs = useCallback(() => {
    const params: Record<string, string> = { limit: '100' };
    if (logLevel) params.level = logLevel;
    return getAdminLogs(params).then((data) => {
      setLogs(data.logs ?? []);
      return data.logs ?? [];
    });
  }, [logLevel]);

  const syncStatus = useCallback(async () => {
    try {
      const status = await getScraperStatus();
      setRunning(status.running);
      setFullSessionRunning(status.full_session_running ?? false);
      setRunningJobs(new Set(status.running_jobs ?? []));
      return status.running;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    Promise.all([loadRetailers(), loadLogs(), syncStatus()]).finally(() =>
      setLoading(false)
    );
  }, [loadRetailers, loadLogs, syncStatus]);

  // Auto-start polling if a session is already running on mount
  useEffect(() => {
    if (running && !pollRef.current) startPolling();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  // Auto-scroll log box to top (newest first)
  useEffect(() => {
    if (logBoxRef.current) logBoxRef.current.scrollTop = 0;
  }, [logs]);

  function startPolling() {
    if (pollRef.current) return;
    pollStartRef.current = Date.now();
    pollRef.current = setInterval(async () => {
      const isRunning = await syncStatus();
      loadLogs();
      loadRetailers();
      const timedOut = Date.now() - pollStartRef.current > POLL_TIMEOUT_MS;
      if (!isRunning || timedOut) stopPolling();
    }, POLL_INTERVAL_MS);
  }

  function stopPolling() {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    setRunning(false);
    loadRetailers();
    loadLogs();
  }

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  async function handleRunOne(retailerId: number) {
    setMutationError(null);
    setRunning(true);
    setRunningJobs(prev => new Set([...prev, retailerId]));
    try {
      await runScraper(retailerId);
      startPolling();
    } catch (err: unknown) {
      await syncStatus();
      const apiErr = err as { status?: number };
      const msg = getErrorMessage(err);
      if (apiErr.status !== 409 && !msg.includes('already running')) {
        setMutationError(msg);
      }
    }
  }

  async function handleRunAll() {
    setMutationError(null);
    setRunning(true);
    try {
      await runAllScrapers();
      startPolling();
    } catch (err: unknown) {
      const isRunning = await syncStatus();
      const apiErr = err as { status?: number };
      const msg = getErrorMessage(err);
      if (apiErr.status === 409 || msg.includes('already running')) {
        if (isRunning) startPolling();
      } else {
        setMutationError(msg);
      }
    }
  }

  async function handleToggleEnabled(r: AdminRetailer) {
    const next = !r.scraping_enabled;
    setRetailers(prev => prev.map(x => x.id === r.id ? { ...x, scraping_enabled: next } : x));
    try {
      await updateAdminRetailer(r.id, { scraping_enabled: next });
    } catch {
      setRetailers(prev => prev.map(x => x.id === r.id ? { ...x, scraping_enabled: !next } : x));
    }
  }

  async function handleIntervalChange(r: AdminRetailer, hours: number) {
    setRetailers(prev => prev.map(x => x.id === r.id ? { ...x, scraping_interval_hours: hours } : x));
    try {
      await updateAdminRetailer(r.id, { scraping_interval_hours: hours });
    } catch {
      setRetailers(prev => prev.map(x => x.id === r.id ? { ...x, scraping_interval_hours: r.scraping_interval_hours } : x));
    }
  }

  async function handleDownloadLogs() {
    setMutationError(null);
    try {
      const data = await getAdminLogs({ limit: '10000' });
      const allLogs = data.logs ?? [];
      const lines = allLogs.map((log) => {
        const time = fmtDate(log.created_at);
        const site = log.site ? `[${log.site}] ` : '';
        return `[${time}] ${log.level.padEnd(7)} ${site}${log.message}`;
      });
      const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `scraper-logs-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setMutationError('Erreur lors du téléchargement des logs.');
    }
  }

  async function handleClearLogs(mode: 'keep7' | 'all') {
    setClearConfirm(false);
    setMutationError(null);
    try {
      const { deleted } = await clearAdminLogs(mode);
      setLogLevel('');
      await loadLogs();
      if (deleted === 0) {
        setMutationError('Aucun log à supprimer.');
      }
    } catch {
      setMutationError('Erreur lors de la suppression des logs.');
    }
  }

  const currentStep = running ? deriveCurrentStep(logs) : '';

  return (
    <div className={styles.page}>
      <div className="admin-header">
        <h1>Scrapers</h1>
        <button className="btn-primary" onClick={handleRunAll} disabled={running}>
          <PlayCircle size={16} />
          {running ? 'Scraping en cours...' : 'Lancer tous'}
        </button>
      </div>

      {running && (
        <div className={styles.runningBanner}>
          <div className={styles.pulseDot} />
          <span className={styles.bannerStep}>{currentStep}</span>
          <button
            className={styles.hideBannerBtn}
            onClick={stopPolling}
            title="Masquer l'indicateur (le scraping continue)"
          >
            Masquer
          </button>
        </div>
      )}

      {error && <p className="admin-error">{error}</p>}
      {mutationError && <p className="admin-error">{mutationError}</p>}

      {!loading && (
        <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 8px' }}>
          <thead>
            <tr style={{ textAlign: 'left' }}>
              <th style={{ padding: '0 1rem', fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Revendeur</th>
              <th style={{ padding: '0 1rem', fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Dernier scraping</th>
              <th style={{ padding: '0 1rem', fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Statut</th>
              <th style={{ padding: '0 1rem', fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Planification</th>
              <th style={{ padding: '0 1rem', fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Intervalle</th>
              <th style={{ padding: '0 1rem', fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {retailers.map((r) => (
              <tr 
                key={r.id} 
                className={!r.scraping_enabled ? styles.rowDisabled : ''}
                style={{ 
                  background: 'var(--surface)', 
                  boxShadow: 'var(--shadow-sm)',
                  transition: 'transform 0.2s, box-shadow 0.2s'
                }}
                onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)'; }}
                onMouseOut={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; }}
              >
                <td style={{ padding: '1rem', borderRadius: 'var(--radius) 0 0 var(--radius)', borderLeft: `3px solid ${r.scraping_enabled ? 'var(--accent)' : 'transparent'}` }}>
                  <div className={styles.retailerName}>{r.name}</div>
                </td>
                <td className={styles.dateCell} style={{ padding: '1rem' }}>
                  {fmtDate(r.last_scrape_at as string)}
                </td>
                <td style={{ padding: '1rem' }}>
                  {r.last_scrape_status ? (
                    <span className={`badge badge-${(r.last_scrape_status as string).toLowerCase()}`} style={{ fontWeight: 700 }}>
                      {r.last_scrape_status as string}
                    </span>
                  ) : '—'}
                </td>
                <td style={{ padding: '1rem' }}>
                  <div className={styles.scheduleCell}>
                    <button
                      className={`${styles.toggle} ${r.scraping_enabled ? styles.toggleOn : styles.toggleOff}`}
                      onClick={() => handleToggleEnabled(r)}
                      title={r.scraping_enabled ? 'Désactiver la planification' : 'Activer la planification'}
                    >
                      <span className={styles.toggleThumb} />
                    </button>
                    <span className={styles.nextScrape}>{nextScrapeLabel(r)}</span>
                  </div>
                </td>
                <td style={{ padding: '1rem' }}>
                  <select
                    className={styles.intervalSelect}
                    value={r.scraping_interval_hours}
                    onChange={(e) => handleIntervalChange(r, Number(e.target.value))}
                    disabled={!r.scraping_enabled}
                  >
                    {INTERVAL_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </td>
                <td style={{ padding: '1rem', textAlign: 'right', borderRadius: '0 var(--radius) var(--radius) 0' }}>
                  <button
                    className="admin-btn-secondary"
                    style={{ padding: '0.4rem 1rem', fontSize: '0.8rem', borderRadius: 'var(--radius-lg)' }}
                    onClick={() => handleRunOne(r.id)}
                    disabled={fullSessionRunning || runningJobs.has(r.id) || !r.is_active}
                  >
                    <Play size={14} />
                    {(fullSessionRunning || runningJobs.has(r.id)) ? 'En cours' : 'Lancer'}
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
        <div className={styles.logToolbar}>
          <div className={styles.logFilters}>
            <h2>Logs récents</h2>
            <select
              value={logLevel}
              onChange={(e) => setLogLevel(e.target.value)}
              disabled={running}
            >
              <option value="">Tous les niveaux</option>
              <option value="INFO">INFO</option>
              <option value="WARNING">WARNING</option>
              <option value="ERROR">ERROR</option>
            </select>
            <button className="admin-btn-secondary" onClick={() => loadLogs()} disabled={running}>
              <RefreshCw size={14} className={running ? 'spin' : ''} />
              Actualiser
            </button>
          </div>
          
          <div className={styles.logActions}>
            <button
              className="admin-btn-secondary"
              onClick={handleDownloadLogs}
              disabled={logs.length === 0}
            >
              <Download size={14} />
              Exporter
            </button>

            {!clearConfirm ? (
              <button
                className="btn-danger"
                style={{ padding: '0.4rem 0.8rem' }}
                onClick={() => setClearConfirm(true)}
                disabled={logs.length === 0}
              >
                <Trash2 size={14} />
                Vider
              </button>
            ) : (
              <div className={styles.clearConfirm}>
                <span>Supprimer :</span>
                <button className={styles.clearConfirmOption} onClick={() => handleClearLogs('keep7')}>
                  Garder 7 jours
                </button>
                <button
                  className={`${styles.clearConfirmOption} ${styles.clearConfirmDanger}`}
                  onClick={() => handleClearLogs('all')}
                >
                  Tout supprimer
                </button>
                <button className={styles.clearConfirmCancel} onClick={() => setClearConfirm(false)}>
                  Annuler
                </button>
              </div>
            )}
          </div>
        </div>
        </div>
        <div className={styles.logBox} ref={logBoxRef}>
          {logs.length === 0 ? (
            <p className="admin-empty">Aucun log.</p>
          ) : (
            logs.map((log) => (
              <div key={log.id} className={`${styles.logEntry} ${styles[log.level.toLowerCase()]}`}>
                <span className={styles.logLevelBadge}>{log.level}</span>
                {log.site && !log.message.startsWith(`[${log.site}]`) && (
                  <span className={styles.logSite}>{log.site}</span>
                )}
                <span className={styles.logMsg}>{log.message}</span>
                <span className={styles.logTime}>{fmtDate(log.created_at)}</span>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
