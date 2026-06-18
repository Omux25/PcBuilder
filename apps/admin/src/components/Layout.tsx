import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Package, Store, Radio, AlertCircle, Layers, Upload, LogOut, Tag, Activity } from 'lucide-react';
import { logout } from '../api';
import styles from './Layout.module.css';

const NAV_GROUPS = [
  {
    title: 'Vue d\'ensemble',
    items: [
      { to: '/admin/dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
      { to: '/admin/traffic', label: 'Trafic', icon: Activity },
    ],
  },
  {
    title: 'Catalogue',
    items: [
      { to: '/admin/components', label: 'Composants', icon: Package },
      { to: '/admin/presets', label: 'Configurations', icon: Layers },
      { to: '/admin/components/import', label: 'Import en masse', icon: Upload },
    ],
  },
  {
    title: 'Pipeline & Données',
    items: [
      { to: '/admin/retailers', label: 'Revendeurs', icon: Store },
      { to: '/admin/scrapers', label: 'Scrapers', icon: Radio },
      { to: '/admin/unmatched', label: 'Non associés', icon: AlertCircle },
      { to: '/admin/keyword-rules', label: 'Règles mots-clés', icon: Tag },
    ],
  },
];

export function Layout() {
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/admin/login');
  }

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <img src="/logo-full.webp" alt="PC Builder Maroc" width="193" height="32" className={styles.brandLogo} />
        </div>

        <nav className={styles.nav}>
          {NAV_GROUPS.map((group) => (
            <div key={group.title} className={styles.navGroup}>
              <h3 className={styles.navGroupTitle}>{group.title}</h3>
              <div className={styles.navGroupItems}>
                {group.items.map(({ to, label, icon: Icon }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={to === '/admin/components' || to === '/admin/dashboard'}
                    className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ''}`}
                  >
                    <Icon size={18} strokeWidth={2.5} aria-hidden className={styles.navIcon} />
                    {label}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <button className={styles.logoutBtn} onClick={handleLogout}>
          <LogOut size={16} aria-hidden />
          Déconnexion
        </button>
      </aside>

      <main className={styles.main}>
        <div className={styles.glassLayer}></div>
        <Outlet />
      </main>
    </div>
  );
}
