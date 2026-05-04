import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Package, Store, Radio, AlertCircle, Layers, Upload, LogOut, Tag } from 'lucide-react';
import { logout } from '../api';
import styles from './Layout.module.css';

const NAV = [
  { to: '/admin/dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
  { to: '/admin/components', label: 'Composants', icon: Package },
  { to: '/admin/components/import', label: 'Import en masse', icon: Upload },
  { to: '/admin/retailers', label: 'Revendeurs', icon: Store },
  { to: '/admin/scrapers', label: 'Scrapers', icon: Radio },
  { to: '/admin/unmatched', label: 'Non associes', icon: AlertCircle },
  { to: '/admin/presets', label: 'Configurations', icon: Layers },
  { to: '/admin/keyword-rules', label: 'Règles mots-clés', icon: Tag },
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
          <span className={styles.brandName}>PC Builder</span>
          <span className={styles.brandSub}>Admin</span>
        </div>

        <nav className={styles.nav}>
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ''}`}
            >
              <Icon size={17} aria-hidden />
              {label}
            </NavLink>
          ))}
        </nav>

        <button className={styles.logoutBtn} onClick={handleLogout}>
          <LogOut size={16} aria-hidden />
          Deconnexion
        </button>
      </aside>

      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}
