import { useEffect, useState, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Package, Store, TrendingUp, AlertCircle, Activity, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getDashboard } from '../api';
import type { DashboardData } from '../api';
import { fmtNum, fmtDate } from '../utils/fmt';
import styles from './Dashboard.module.css';

export function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    getDashboard()
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(() => {
      if (!document.hidden) load();
    }, 60_000);
    return () => clearInterval(interval);
  }, [load]);

  if (loading) return <div className="admin-loading">Chargement...</div>;
  if (error) return <div className="admin-error">{error}</div>;

  const stats = data?.stats;
  const rawChart = data?.price_updates_chart ?? [];
  const chart = rawChart.map(entry => ({
    ...entry,
    date: new Date(entry.date).toLocaleDateString('fr-MA', { day: 'numeric', month: 'short' }),
  }));
  const activity = data?.recent_activity ?? [];
  const unmatchedCount = stats?.unmatched_listings_count ?? 0;

  const formatAction = (action: string) => {
    const map: Record<string, string> = {
      'login': 'Connexion',
      'logout': 'Déconnexion',
      'trigger_scraper': 'Lancement du scraper',
      'create_retailer': 'Création d\'un revendeur',
      'update_retailer': 'Modification d\'un revendeur',
      'delete_retailer': 'Suppression d\'un revendeur',
      'match_listing': 'Association d\'un listing',
      'ignore_listing': 'Listing ignoré',
      'bulk_category_update': 'Mise à jour de catégorie en masse',
      'create_component': 'Création d\'un composant',
      'update_component': 'Modification d\'un composant',
    };
    return map[action] || action.replace(/_/g, ' ');
  };

  return (
    <div className={styles.page}>
      <div className={styles.titleRow}>
        <div>
          <h1 className={styles.title}>Tableau de bord</h1>
          <p className={styles.subtitle}>Vue d'ensemble du catalogue</p>
        </div>
        {stats?.last_scrape?.time && (
          <div className={styles.scrapeInfo}>
            <Activity size={13} />
            Dernier scraping : {fmtDate(stats.last_scrape.time)}
            {' '}<span className={`badge badge-${stats.last_scrape.status?.toLowerCase() ?? ''}`}>
              {stats.last_scrape.status}
            </span>
          </div>
        )}
      </div>

      {/* Stats cards */}
      <div className={styles.statsGrid}>
        <StatCard
          label="Composants actifs"
          value={stats?.total_components ?? 0}
          icon={<Package size={20} />}
          color="blue"
        />
        <StatCard
          label="Revendeurs actifs"
          value={`${stats?.active_retailers ?? 0} / ${stats?.total_retailers ?? 0}`}
          icon={<Store size={20} />}
          color="green"
        />
        <StatCard
          label="Enregistrements de prix"
          value={fmtNum(stats?.total_price_records ?? 0)}
          icon={<TrendingUp size={20} />}
          color="purple"
        />
        <StatCard
          label="Listings non associés"
          value={unmatchedCount}
          icon={<AlertCircle size={20} />}
          color={unmatchedCount > 0 ? 'danger' : 'green'}
          accent={unmatchedCount > 0}
          action={unmatchedCount > 0 ? (
            <Link to="/admin/unmatched" className={styles.quickActionBtn}>
              Résoudre <ArrowRight size={14} />
            </Link>
          ) : undefined}
        />
      </div>

      {/* Price updates chart */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Mises à jour des prix <span className={styles.sectionSub}>(14 jours)</span></h2>
        <div className={styles.chart}>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chart} margin={{ top: 5, right: 16, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fill: 'var(--text-dim)', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fill: 'var(--text-dim)', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={40}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  fontSize: 12,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                }}
                labelStyle={{ color: 'var(--text-2)', fontWeight: 600 }}
                itemStyle={{ color: 'var(--accent-blue)' }}
                cursor={{ fill: 'rgba(137,180,250,0.05)' }}
              />
              <Bar dataKey="count" fill="var(--accent)" radius={[4, 4, 0, 0]} maxBarSize={48} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Recent activity */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Activité récente</h2>
        {activity.length === 0 ? (
          <p className="admin-empty">Aucune activité récente importante.</p>
        ) : (
          <div className={styles.activityList}>
            {activity.map((item) => (
              <div key={item.id} className={styles.activityItem}>
                <div className={styles.activityDot} />
                <span className={styles.activityAction} style={{ textTransform: 'capitalize' }}>
                  {formatAction(item.action)}
                </span>
                {item.entity_type && (
                  <span className={styles.activityEntity}>{item.entity_type} #{item.entity_id}</span>
                )}
                <span className={styles.activityTime}>{new Date(item.created_at).toLocaleString('fr-MA')}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color: 'blue' | 'green' | 'purple' | 'danger';
  accent?: boolean;
  action?: React.ReactNode;
}

const colorMap = {
  blue:   { icon: 'rgba(137,180,250,0.12)', text: 'var(--accent-blue)',  glow: 'rgba(137,180,250,0.15)' },
  green:  { icon: 'rgba(166,227,161,0.12)', text: 'var(--success-soft)', glow: 'rgba(166,227,161,0.15)' },
  purple: { icon: 'rgba(99,102,241,0.15)',  text: 'var(--accent-h)',     glow: 'rgba(99,102,241,0.15)'  },
  danger: { icon: 'rgba(243,139,168,0.12)', text: 'var(--danger-soft)',  glow: 'rgba(243,139,168,0.15)' },
};

function StatCard({ label, value, icon, color, accent, action }: StatCardProps) {
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
        position: 'relative',
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
        {action && (
          <div style={{ marginTop: '-4px', marginRight: '-4px' }}>
            {action}
          </div>
        )}
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
