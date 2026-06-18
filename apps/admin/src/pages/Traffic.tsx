import React, { useEffect, useState } from 'react';
import { RefreshCw, Trash2, Globe, Server, Activity, Clock, AlertTriangle, Monitor, Users, List, ChevronDown, ChevronRight } from 'lucide-react';
import { getAdminTrafficLogs, getAdminTrafficVisitors, clearAllTrafficLogs, type TrafficLogEntry, type TrafficVisitorEntry } from '../api';
import styles from './Traffic.module.css';

function parseIp(ip: string | null) {
  if (!ip) return 'Inconnu';
  return ip.split(',')[0].trim();
}

function parseUserAgent(ua: string | null) {
  if (!ua) return 'Inconnu';
  
  if (ua.includes('Googlebot')) return 'Googlebot';
  if (ua.includes('bingbot')) return 'Bingbot';
  if (ua.includes('GPTBot')) return 'ChatGPT Bot';
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
  
  return ua.length > 25 ? ua.substring(0, 25) + '...' : ua;
}

function formatPathName(path: string | null): string {
  if (!path) return '/';
  return path.split('?')[0];
}

function TrafficRowDetails({ log }: { log: TrafficLogEntry }) {
  if (!log.path) return null;
  const parts = log.path.split('?');
  const queryStr = parts.length > 1 ? parts[1] : '';
  const searchParams = new URLSearchParams(queryStr);
  const chips: React.ReactNode[] = [];
  
  let explanation = '';
  if (log.path.includes('/components/smart-search')) {
    const cat = searchParams.get('category');
    const q = searchParams.get('search');
    if (cat && q) {
      explanation = `L'utilisateur a recherché "${q}" dans la catégorie "${cat}".`;
    } else if (cat) {
      explanation = `L'utilisateur a filtré la catégorie "${cat}".`;
    } else if (q) {
      explanation = `L'utilisateur a recherché "${q}" dans tout le catalogue.`;
    }
  } else if (log.path.includes('/recherche')) {
    const q = searchParams.get('q');
    if (q) explanation = `L'utilisateur a effectué une recherche globale pour "${q}".`;
  }

  for (const [key, value] of searchParams.entries()) {
    chips.push(
      <div key={key} style={{
        display: 'inline-flex', alignItems: 'center', padding: '4px 10px', 
        background: 'rgba(137, 180, 250, 0.15)', color: 'var(--blue)', 
        borderRadius: '20px', fontSize: '0.75rem', fontWeight: 600, border: '1px solid rgba(137, 180, 250, 0.3)'
      }}>
        <span style={{ opacity: 0.7, marginRight: '4px' }}>{key}:</span> {value}
      </div>
    );
  }

  return (
    <div style={{
      padding: '1.25rem 1.5rem', background: 'rgba(0, 0, 0, 0.15)', 
      borderBottom: '1px solid var(--border)', borderTop: '1px dashed rgba(255, 255, 255, 0.05)',
      display: 'flex', flexDirection: 'column', gap: '1rem'
    }}>
      {chips.length > 0 && (
        <div>
          <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 700, letterSpacing: '0.05em' }}>Filtres & Paramètres</div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {chips}
          </div>
        </div>
      )}
      
      {explanation && (
        <div style={{ 
          padding: '10px 14px', background: 'rgba(166, 227, 161, 0.1)', 
          borderLeft: '3px solid var(--green)', color: 'var(--text)', 
          fontSize: '0.85rem', borderRadius: '0 8px 8px 0', lineHeight: 1.5
        }}>
          💡 <strong>Interprétation :</strong> {explanation}
        </div>
      )}

      <div style={{ display: 'flex', gap: '2rem' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 700, letterSpacing: '0.05em' }}>URL Complète (Raw)</div>
          <div style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--text-muted)', wordBreak: 'break-all', background: 'rgba(0,0,0,0.2)', padding: '6px 10px', borderRadius: '6px' }}>
            {log.path}
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 700, letterSpacing: '0.05em' }}>User-Agent Brut</div>
          <div style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--text-muted)', wordBreak: 'break-all', background: 'rgba(0,0,0,0.2)', padding: '6px 10px', borderRadius: '6px' }}>
            {log.userAgent || 'N/A'}
          </div>
        </div>
      </div>
    </div>
  );
}

export function Traffic() {
  const [activeTab, setActiveTab] = useState<'visitors' | 'raw'>('visitors');
  const [ipFilter, setIpFilter] = useState<string | null>(null);
  const [expandedRowIds, setExpandedRowIds] = useState<Set<number>>(new Set());

  const toggleRow = (id: number) => {
    setExpandedRowIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  
  const [visitors, setVisitors] = useState<TrafficVisitorEntry[]>([]);
  const [logs, setLogs] = useState<TrafficLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const limit = 50;

  useEffect(() => {
    setPage(1);
    fetchData();
  }, [activeTab, ipFilter]);

  useEffect(() => {
    fetchData();
  }, [page]);

  async function fetchData() {
    setLoading(true);
    try {
      if (activeTab === 'visitors') {
        const res = await getAdminTrafficVisitors({ limit: String(limit), offset: String((page - 1) * limit) });
        setVisitors(res.data);
        setTotal(res.total);
      } else {
        const params: Record<string, string> = { limit: String(limit), offset: String((page - 1) * limit) };
        if (ipFilter) params.ip = ipFilter;
        
        const res = await getAdminTrafficLogs(params);
        setLogs(res.data);
        setTotal(res.total);
      }
    } catch (err) {
      console.error('Failed to fetch traffic data', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleClearLogs() {
    if (!confirm('Etes-vous sûr de vouloir supprimer TOUS les logs de trafic ?')) return;
    try {
      await clearAllTrafficLogs();
      setPage(1);
      fetchData();
    } catch (err) {
      console.error('Failed to clear traffic logs', err);
    }
  }

  function handleVisitorClick(ip: string) {
    setIpFilter(ip);
    setActiveTab('raw');
  }

  const totalPages = Math.ceil(total / limit);

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.titleArea}>
          <Activity className={styles.titleIcon} size={28} />
          <div>
            <h1 className={styles.title}>Trafic Web</h1>
            <p className={styles.subtitle}>{total.toLocaleString()} {activeTab === 'visitors' ? 'visiteurs uniques' : 'requêtes enregistrées'}</p>
          </div>
        </div>

        <div className={styles.actions}>
          <button onClick={fetchData} disabled={loading} className={styles.btnSecondary} title="Rafraîchir">
            <RefreshCw size={16} className={loading ? styles.spinning : ''} />
          </button>
          <button onClick={handleClearLogs} className={styles.btnDanger} title="Purger les logs">
            <Trash2 size={16} />
            Purger
          </button>
        </div>
      </header>

      {/* Tabs Navigation */}
      <div className={styles.tabs}>
        <button 
          className={`${styles.tab} ${activeTab === 'visitors' ? styles.tabActive : ''}`}
          onClick={() => { setActiveTab('visitors'); setIpFilter(null); }}
        >
          <Users size={16} /> Visiteurs
        </button>
        <button 
          className={`${styles.tab} ${activeTab === 'raw' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('raw')}
        >
          <List size={16} /> Requêtes Brutes {ipFilter && `(Filtre: ${ipFilter})`}
        </button>
        {ipFilter && activeTab === 'raw' && (
          <button 
            className={styles.tab}
            style={{ marginLeft: 'auto', color: 'var(--danger-soft)' }}
            onClick={() => setIpFilter(null)}
          >
            Effacer le filtre
          </button>
        )}
      </div>

      {/* Stats Grid */}
      <div className={styles.statsGrid}>
        {activeTab === 'visitors' ? (
          <>
            <StatCard
              label="Visiteurs Uniques"
              value={total}
              icon={<Users size={20} />}
              color="blue"
            />
            <StatCard
              label="Visiteurs Erronés (page)"
              value={visitors.filter(v => v.errorCount > 0).length}
              icon={<AlertTriangle size={20} />}
              color={visitors.some(v => v.errorCount > 0) ? 'danger' : 'green'}
              accent={visitors.filter(v => v.errorCount > 0).length > 5}
            />
            <StatCard
              label="Bots / Scripts (page)"
              value={visitors.filter(v => v.userAgent?.includes('bot') || v.userAgent?.includes('Go-http-client')).length}
              icon={<Server size={20} />}
              color="purple"
            />
          </>
        ) : (
          <>
            <StatCard
              label="Temps moyen (page)"
              value={`${logs.length > 0 ? Math.round(logs.reduce((acc, log) => acc + log.responseTimeMs, 0) / logs.length) : 0}ms`}
              icon={<Clock size={20} />}
              color={(logs.length > 0 ? Math.round(logs.reduce((acc, log) => acc + log.responseTimeMs, 0) / logs.length) : 0) > 500 ? 'danger' : 'blue'}
            />
            <StatCard
              label="Taux d'erreur (page)"
              value={`${logs.length > 0 ? Math.round((logs.filter(l => l.statusCode >= 400).length / logs.length) * 100) : 0}%`}
              icon={<AlertTriangle size={20} />}
              color={(logs.length > 0 ? Math.round((logs.filter(l => l.statusCode >= 400).length / logs.length) * 100) : 0) > 5 ? 'danger' : 'green'}
              accent={(logs.length > 0 ? Math.round((logs.filter(l => l.statusCode >= 400).length / logs.length) * 100) : 0) > 10}
            />
            <StatCard
              label="Trafic Bot / Scripts (page)"
              value={`${logs.length > 0 ? Math.round((logs.filter(l => l.userAgent?.includes('bot') || l.userAgent?.includes('Go-http-client')).length / logs.length) * 100) : 0}%`}
              icon={<Server size={20} />}
              color="purple"
            />
          </>
        )}
      </div>

      {/* Main Table */}
      <div className={styles.card}>
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            {activeTab === 'visitors' ? (
              <>
                <thead>
                  <tr>
                    <th>IP / Visiteur</th>
                    <th>Requêtes</th>
                    <th>Erreurs</th>
                    <th>Dernière Activité</th>
                    <th>Première Activité</th>
                    <th>Client Principal</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && visitors.length === 0 ? (
                    <tr><td colSpan={6} className={styles.empty}>Chargement des visiteurs...</td></tr>
                  ) : visitors.length === 0 ? (
                    <tr><td colSpan={6} className={styles.empty}>Aucun visiteur enregistré.</td></tr>
                  ) : (
                    visitors.map(visitor => (
                      <tr 
                        key={visitor.ip} 
                        style={{ cursor: 'pointer' }} 
                        onClick={() => handleVisitorClick(visitor.ip)}
                        title="Cliquez pour voir toutes les requêtes de ce visiteur"
                      >
                        <td className={styles.ipCell}>
                          <Globe size={12} className={styles.inlineIcon} />
                          <span style={{ textDecoration: 'underline', textDecorationStyle: 'dotted', textUnderlineOffset: '4px' }}>
                            {visitor.ip}
                          </span>
                        </td>
                        <td style={{ fontWeight: 600 }}>{visitor.totalRequests.toLocaleString()}</td>
                        <td>
                          {visitor.errorCount > 0 ? (
                            <span className={`${styles.statusBadge} ${styles.statusError}`}>
                              {visitor.errorCount}
                            </span>
                          ) : (
                            <span className={`${styles.statusBadge} ${styles.statusOk}`}>
                              0
                            </span>
                          )}
                        </td>
                        <td className={styles.dateCell}>{new Date(visitor.lastSeen).toLocaleString('fr-MA')}</td>
                        <td className={styles.dateCell}>{new Date(visitor.firstSeen).toLocaleString('fr-MA')}</td>
                        <td className={styles.uaCell} title={visitor.userAgent || ''}>
                          <Monitor size={12} className={styles.inlineIcon} style={{marginRight: '4px'}} />
                          {parseUserAgent(visitor.userAgent)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </>
            ) : (
              <>
                <thead>
                  <tr>
                    <th style={{ width: 40 }}></th>
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
                    <tr><td colSpan={8} className={styles.empty}>Chargement des données de trafic...</td></tr>
                  ) : logs.length === 0 ? (
                    <tr><td colSpan={8} className={styles.empty}>Aucun trafic enregistré.</td></tr>
                  ) : (
                    logs.map(log => {
                      const isExpanded = expandedRowIds.has(log.id);
                      return (
                        <React.Fragment key={log.id}>
                          <tr 
                            onClick={() => toggleRow(log.id)}
                            style={{ cursor: 'pointer', transition: 'background-color 0.2s', backgroundColor: isExpanded ? 'rgba(255,255,255,0.02)' : 'transparent' }}
                          >
                            <td style={{ color: 'var(--text-muted)' }}>
                              {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                            </td>
                            <td className={styles.dateCell}>{new Date(log.createdAt).toLocaleString('fr-MA')}</td>
                            <td>
                              <span className={`${styles.badge} ${styles['method' + log.method] || styles.methodDefault}`}>
                                {log.method}
                              </span>
                            </td>
                            <td className={styles.pathCell} title={log.path}>
                              {formatPathName(log.path)}
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
                          {isExpanded && (
                            <tr>
                              <td colSpan={8} style={{ padding: 0 }}>
                                <TrafficRowDetails log={log} />
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              </>
            )}
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
