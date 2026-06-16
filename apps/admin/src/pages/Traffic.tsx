import { useEffect, useState } from 'react';
import { RefreshCw, Trash2, Globe, Server, Activity, Clock, AlertTriangle, Monitor } from 'lucide-react';
import { getAdminTrafficLogs, clearAllTrafficLogs, type TrafficLogEntry } from '../api';
import styles from './Traffic.module.css';

function parseIp(ip: string | null) {
  if (!ip) return 'Inconnu';
  // Extracts the first IP in a comma-separated list (handles X-Forwarded-For)
  return ip.split(',')[0].trim();
}

function parseUserAgent(ua: string | null) {
  if (!ua) return 'Inconnu';
  
  if (ua.includes('Googlebot')) return '🤖 Googlebot';
  if (ua.includes('bingbot')) return '🤖 Bingbot';
  if (ua.includes('Go-http-client')) return 'Go HTTP Client';
  if (ua.includes('curl')) return 'Terminal (curl)';
  if (ua.includes('PostmanRuntime')) return 'Postman';

  let browser = 'Inconnu';
  if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Edg')) browser = 'Edge';
  else if (ua.includes('Chrome')) browser = 'Chrome';
  else if (ua.includes('Safari')) browser = 'Safari';

  let os = '';
  if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Mac OS')) os = 'macOS';
  else if (ua.includes('Linux')) os = 'Linux';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';

  if (os && browser !== 'Inconnu') return `${browser} sur ${os}`;
  if (browser !== 'Inconnu') return browser;
  if (os) return os;
  
  // Truncate fallback
  return ua.length > 25 ? ua.substring(0, 25) + '...' : ua;
}

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

  // Compute Page Stats
  const avgResponseTime = logs.length > 0 
    ? Math.round(logs.reduce((acc, log) => acc + log.responseTimeMs, 0) / logs.length) 
    : 0;
  
  const errorCount = logs.filter(l => l.statusCode >= 400).length;
  const errorRate = logs.length > 0 ? Math.round((errorCount / logs.length) * 100) : 0;

  const bots = logs.filter(l => l.userAgent?.includes('bot') || l.userAgent?.includes('Go-http-client')).length;
  const botRate = logs.length > 0 ? Math.round((bots / logs.length) * 100) : 0;

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

      {/* Stats Grid */}
      <div className={styles.statsGrid}>
        <StatCard
          label="Temps moyen (page)"
          value={`${avgResponseTime}ms`}
          icon={<Clock size={20} />}
          color={avgResponseTime > 500 ? 'danger' : 'blue'}
        />
        <StatCard
          label="Taux d'erreur (page)"
          value={`${errorRate}%`}
          icon={<AlertTriangle size={20} />}
          color={errorRate > 5 ? 'danger' : 'green'}
          accent={errorRate > 10}
        />
        <StatCard
          label="Trafic Bot / Scripts (page)"
          value={`${botRate}%`}
          icon={<Server size={20} />}
          color="purple"
        />
      </div>

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
                <th>Client</th>
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
                    <td className={styles.dateCell}>{new Date(log.createdAt).toLocaleString('fr-MA')}</td>
                    <td>
                      <span className={`${styles.badge} ${styles['method' + log.method] || styles.methodDefault}`}>
                        {log.method}
                      </span>
                    </td>
                    <td className={styles.pathCell} title={log.path}>
                      {log.path.replace('/api', '') || '/'}
                    </td>
                    <td>
                      <span className={`${styles.statusBadge} ${log.statusCode >= 400 ? styles.statusError : styles.statusOk}`}>
                        {log.statusCode}
                      </span>
                    </td>
                    <td className={styles.timeCell}>{log.responseTimeMs}ms</td>
                    <td className={styles.ipCell}>
                      <Globe size={12} className={styles.inlineIcon} />
                      {parseIp(log.ip)}
                    </td>
                    <td className={styles.uaCell} title={log.userAgent || ''}>
                      <Monitor size={12} className={styles.inlineIcon} style={{marginRight: '4px'}} />
                      {parseUserAgent(log.userAgent)}
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

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color: 'blue' | 'green' | 'purple' | 'danger';
  accent?: boolean;
}

const colorMap = {
  blue:   { icon: 'rgba(137,180,250,0.12)', text: 'var(--accent-blue)',  glow: 'rgba(137,180,250,0.15)' },
  green:  { icon: 'rgba(166,227,161,0.12)', text: 'var(--success-soft)', glow: 'rgba(166,227,161,0.15)' },
  purple: { icon: 'rgba(99,102,241,0.15)',  text: 'var(--accent-h)',     glow: 'rgba(99,102,241,0.15)'  },
  danger: { icon: 'rgba(243,139,168,0.12)', text: 'var(--danger-soft)',  glow: 'rgba(243,139,168,0.15)' },
};

function StatCard({ label, value, icon, color, accent }: StatCardProps) {
  const c = colorMap[color];
  return (
    <div
      style={{
        background: 'var(--surface)',
        border: `1px solid ${accent ? 'rgba(243,139,168,0.3)' : 'var(--border)'}`,
        borderRadius: 'var(--radius-lg)',
        padding: '1.25rem 1.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
        transition: 'var(--transition)',
        boxShadow: accent ? `0 0 20px ${c.glow}` : 'none',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: c.icon,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: c.text,
            flexShrink: 0,
          }}
        >
          {icon}
        </div>
      </div>
      <div>
        <div style={{ fontSize: '1.75rem', fontWeight: 800, lineHeight: 1, color: accent ? c.text : 'var(--text)', letterSpacing: '-0.03em' }}>
          {value}
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
          {label}
        </div>
      </div>
    </div>
  );
}
