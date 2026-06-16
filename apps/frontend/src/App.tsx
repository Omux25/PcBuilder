import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { Routes, Route, Link, useLocation, useNavigate, Navigate, useParams } from 'react-router-dom';
import { Cpu, Sun, Moon, LayoutGrid, Search, GitCompare, Home as HomeIcon, Sliders, Sparkles, TrendingUp } from 'lucide-react';
import { Configurator } from './components/Configurator';
import { Skeleton } from './components/Skeleton';
import { CompareTray } from './components/CompareTray';
import { CategoryConflictModal } from './components/CategoryConflictModal';
import { useBuild } from './context/BuildContext';
import { getInitialTheme, applyTheme, toggleTheme } from './utils/theme';
import { getComponentById, getComponentBySlug } from './api';
import { UI } from './ui-strings';
import styles from './App.module.css';
import { Home } from './pages/Home';
const MarketTrends = lazy(() => import('./pages/MarketTrends').then(m => ({ default: m.MarketTrends })));
const ComponentDetail = lazy(() => import('./pages/ComponentDetail').then(m => ({ default: m.ComponentDetail })));
const Presets = lazy(() => import('./pages/Presets').then(m => ({ default: m.Presets })));
const CategoryBrowse = lazy(() => import('./pages/CategoryBrowse').then(m => ({ default: m.CategoryBrowse })));
const ComponentsIndex = lazy(() => import('./pages/ComponentsIndex').then(m => ({ default: m.ComponentsIndex })));
const Compare = lazy(() => import('./pages/Compare').then(m => ({ default: m.Compare })));
const GlobalSearch = lazy(() => import('./pages/GlobalSearch').then(m => ({ default: m.GlobalSearch })));
const NotFound = lazy(() => import('./pages/NotFound').then(m => ({ default: m.NotFound })));

function ProductRedirect() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [error, setError] = useState(false);

  useEffect(() => {
    if (slug) {
      getComponentBySlug(slug)
        .then(comp => {
          navigate(`/components/${comp.category}/${comp.slug}`, { replace: true });
        })
        .catch(() => {
          setError(true);
        });
    }
  }, [slug, navigate]);

  if (error) return <Navigate to="/404" replace />;
  return (
    <main className={styles.main}>
      <Skeleton height={400} />
    </main>
  );
}

export default function App() {
  const { build, setBuild, addToBuild } = useBuild();

  const [theme, setTheme] = useState<'light' | 'dark'>(getInitialTheme());
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => { setSearchOpen(false); }, [location.pathname]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === '/') {
        const active = document.activeElement;
        if (
          active &&
          (active.tagName === 'INPUT' ||
            active.tagName === 'TEXTAREA' ||
            active.getAttribute('contenteditable') === 'true')
        ) {
          return;
        }
        e.preventDefault();
        setSearchOpen(true);
        setTimeout(() => searchRef.current?.focus(), 50);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
  // Scroll to top on every route change (BrowserRouter has no built-in ScrollRestoration)
  useEffect(() => { window.scrollTo(0, 0); }, [location.pathname]);
  useEffect(() => {
    if (searchOpen) setTimeout(() => searchRef.current?.focus(), 50);
  }, [searchOpen]);

  async function handleLoadPreset(componentIds: Record<string, number>) {
    const uniqueIds = [...new Set(Object.values(componentIds))];
    const entries = await Promise.allSettled(
      uniqueIds.map(async (id) => {
        const component = await getComponentById(id);
        return component;
      })
    );
    const idToComponent = new Map<number, ReturnType<typeof getComponentById> extends Promise<infer T> ? T : never>();
    for (const result of entries) {
      if (result.status === 'fulfilled') {
        idToComponent.set(result.value.id, result.value);
      }
    }
    const newBuild: typeof build = {};
    for (const [slotKey, id] of Object.entries(componentIds)) {
      const comp = idToComponent.get(id);
      if (comp) newBuild[slotKey] = comp;
    }
    setBuild(newBuild);
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (searchInput.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchInput.trim())}`);
      setSearchOpen(false);
      setSearchInput('');
    }
  }

  function handleToggleTheme() {
    const next = toggleTheme();
    setTheme(next);
  }

  const isHome = location.pathname === '/';
  const isBuild = location.pathname === '/build';
  const isComponents = location.pathname.startsWith('/components') || location.pathname.startsWith('/browse');
  const isPresets = location.pathname === '/presets';

  return (
    <div className={styles.app}>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.headerLeft}>
            <Link to="/" className={styles.logoLink}>
              <span className={styles.logoIcon}><Cpu size={14} strokeWidth={2.5} /></span>
              <h1 className={styles.logo}>{UI.app.name} <span className={styles.sub}>{UI.app.subtitle}</span></h1>
            </Link>
            <nav className={styles.nav}>
              <Link to="/" className={`${styles.navLink} ${isHome ? styles.navLinkActive : ''}`}>
                <HomeIcon size={13} className={styles.navIcon} />
                {UI.nav.home}
              </Link>
              <Link to="/build" className={`${styles.navLink} ${isBuild ? styles.navLinkActive : ''}`}>
                <Sliders size={13} className={styles.navIcon} />
                {UI.nav.configurator}
              </Link>
              <Link to="/components" className={`${styles.navLink} ${isComponents ? styles.navLinkActive : ''}`}>
                <LayoutGrid size={13} className={styles.navIcon} />
                {UI.nav.components}
              </Link>
              <Link to="/presets" className={`${styles.navLink} ${isPresets ? styles.navLinkActive : ''}`}>
                <Sparkles size={13} className={styles.navIcon} />
                {UI.nav.presets}
              </Link>
              <Link to="/compare" className={`${styles.navLink} ${location.pathname === '/compare' ? styles.navLinkActive : ''}`}>
                <GitCompare size={13} className={styles.navIcon} />
                {UI.nav.compare}
              </Link>
              <Link to="/market-trends" className={`${styles.navLink} ${location.pathname === '/market-trends' ? styles.navLinkActive : ''}`}>
                <TrendingUp size={13} className={styles.navIcon} />
                {UI.nav.trends}
              </Link>
            </nav>
          </div>

          <div className={styles.headerRight}>
            <div className={`${styles.searchContainer} ${searchOpen ? styles.searchOpen : ''}`}>
              <button className={styles.iconBtn} onClick={() => setSearchOpen(true)} aria-label={UI.nav.search} title={UI.nav.search}>
                <Search size={15} />
              </button>
              <form className={styles.headerSearchForm} onSubmit={handleSearchSubmit}>
                <div className={styles.searchInputWrapper}>
                  <input
                    ref={searchRef}
                    type="text"
                    className={styles.headerSearchInput}
                    placeholder={`${UI.nav.search}…`}
                    value={searchInput}
                    onChange={e => setSearchInput(e.target.value)}
                    onBlur={() => { if (!searchInput) setSearchOpen(false); }}
                    onKeyDown={e => { if (e.key === 'Escape') { setSearchOpen(false); setSearchInput(''); } }}
                  />
                  <Search size={13} className={styles.searchFieldIcon} />
                  <span className={styles.searchShortcut}>/</span>
                </div>
              </form>
            </div>
            <button
              className={styles.themeToggle}
              onClick={handleToggleTheme}
              aria-label={theme === 'dark' ? UI.app.themeLight : UI.app.themeDark}
            >
              {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
            </button>
          </div>
        </div>
      </header>

      <Suspense fallback={<main className={styles.main}><Skeleton height={400} /></main>}>
        <Routes>
          {/* ── Home ────────────────────────────────────────────────────── */}
          <Route path="/" element={
            <main className={styles.main}>
              <Home />
            </main>
          } />

          <Route path="/build" element={
            <main className={styles.main}>
              <Configurator />
            </main>
          } />

          <Route path="/product/:slug" element={
            <ProductRedirect />
          } />

          <Route path="/components/:category/:identifier" element={
            <main className={styles.main}>
              <ComponentDetail onAddToBuild={addToBuild} />
            </main>
          } />

          <Route path="/components" element={
            <main className={styles.main}>
              <ComponentsIndex />
            </main>
          } />

          <Route path="/browse" element={<Navigate to="/components" replace />} />

          <Route path="/browse/:category/:slotKey?" element={
            <main className={styles.main}>
              <CategoryBrowse />
            </main>
          } />

          <Route path="/compare" element={
            <main className={styles.main}>
              <Compare />
            </main>
          } />

          <Route path="/search" element={
            <main className={styles.main}>
              <GlobalSearch />
            </main>
          } />

          <Route path="/market-trends" element={
            <main className={styles.main}>
              <MarketTrends />
            </main>
          } />

          <Route path="/presets" element={
            <main className={styles.main}>
              <Presets onLoadPreset={handleLoadPreset} />
            </main>
          } />

          <Route path="*" element={
            <main className={styles.main}>
              <NotFound />
            </main>
          } />
        </Routes>
      </Suspense>

      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <span className={styles.footerText}>{UI.footer.tagline}</span>
          <div className={styles.footerLinks}>
            <Link to="/search" className={styles.footerLink}>{UI.footer.search}</Link>
            <Link to="/compare" className={styles.footerLink}>{UI.footer.compare}</Link>
            <Link to="/market-trends" className={styles.footerLink}>{UI.footer.trends}</Link>
          </div>
        </div>
      </footer>

      {/* Mobile Bottom Navigation */}
      <nav className={styles.mobileNav}>
        <Link to="/" className={`${styles.mobileNavLink} ${isHome ? styles.mobileNavLinkActive : ''}`}>
          <HomeIcon size={20} />
          <span className={styles.mobileNavText}>{UI.nav.home}</span>
        </Link>
        <Link to="/build" className={`${styles.mobileNavLink} ${isBuild ? styles.mobileNavLinkActive : ''}`}>
          <Sliders size={20} />
          <span className={styles.mobileNavText}>Config</span>
        </Link>
        <Link to="/components" className={`${styles.mobileNavLink} ${isComponents ? styles.mobileNavLinkActive : ''}`}>
          <LayoutGrid size={20} />
          <span className={styles.mobileNavText}>{UI.nav.components}</span>
        </Link>
        <Link to="/presets" className={`${styles.mobileNavLink} ${isPresets ? styles.mobileNavLinkActive : ''}`}>
          <Sparkles size={20} />
          <span className={styles.mobileNavText}>Presets</span>
        </Link>
        <Link to="/compare" className={`${styles.mobileNavLink} ${location.pathname === '/compare' ? styles.mobileNavLinkActive : ''}`}>
          <GitCompare size={20} />
          <span className={styles.mobileNavText}>{UI.nav.compare}</span>
        </Link>
        <Link to="/market-trends" className={`${styles.mobileNavLink} ${location.pathname === '/market-trends' ? styles.mobileNavLinkActive : ''}`}>
          <TrendingUp size={20} />
          <span className={styles.mobileNavText}>{UI.nav.trends}</span>
        </Link>
      </nav>

      <CompareTray />
      <CategoryConflictModal />
    </div>
  );
}
