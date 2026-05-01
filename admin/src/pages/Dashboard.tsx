import { useEffect, useState, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { getDashboard } from '../api';
import type { DashboardData } from '../api';
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
    const interval = setInterval(load, 60_000);
    return () => clearInterval(interval);
  }, [load]);

  if (loading) return <div className={styles.loading}>Chargement...</div>;
  if (error)   return <div className={styles.error}>{error}</div>;

  const stats = data?.stats;
  const chart = data?.price_updates_chart ?? [];
  const activity = data?.recent_activity ?? [];

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Tableau de bord</h1>

      {/* Stats cards */}
      <div className={styles.statsGrid}>
        <StatCard label="Composants actifs" value={stats?.total_components ?? 0} />
        <StatCard label="Revendeurs actifs" value={`${stats?.active_retailers ?? 0} / ${stats?.total_retailers ?? 0}`} />
        <StatCard label="Enregistrements de prix" value={stats?.total_price_records ?? 0} />
        <StatCard label="Listings non associes" value={stats?.unmatched_listings_count ?? 0} accent={(stats?.unmatched_listings_count ?? 0) > 0} />
      </div>

      {/* Last scrape */}
      {stats?.last_scrape?.time && (
        <div className={styles.scrapeInfo}>
          Dernier scraping : {new Date(stats.last_scrape.time).toLocaleString('fr-MA')}
          {' '}<span className={`${styles.statusBadge} ${styles[stats.last_scrape.status?.toLowerCase() ?? '']}`}>
            {stats.last_scrape.status}
          </span>
        </div>
      )}

      {/* Price updates chart */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Mises a jour des prix (30 jours)</h2>
        <div className={styles.chart}>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chart} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="date" tick={{ fill: 'var(--text-dim)', fontSize: 11 }} tickLine={false} />
              <YAxis tick={{ fill: 'var(--text-dim)', fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 6 }}
                labelStyle={{ color: 'var(--text-2)', fontSize: 12 }}
              />
              <Bar dataKey="count" fill="var(--accent-blue)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Recent activity */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Activite recente</h2>
        {activity.length === 0 ? (
          <p className={styles.empty}>Aucune activite recente.</p>
        ) : (
          <ul className={styles.activityList}>
            {activity.map((item) => (
              <li key={item.id} className={styles.activityItem}>
                <span className={styles.activityAction}>{item.action}</span>
                {item.entity_type && <span className={styles.activityEntity}>{item.entity_type} #{item.entity_id}</span>}
                <span className={styles.activityTime}>{new Date(item.created_at).toLocaleString('fr-MA')}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}


function StatCard({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className={`${styles.statCard} ${accent ? styles.statAccent : ''}`}>
      <div className={styles.statValue}>{value}</div>
      <div className={styles.statLabel}>{label}</div>
    </div>
  );
}
