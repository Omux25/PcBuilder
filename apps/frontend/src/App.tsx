import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { Routes, Route, Link, useLocation, useNavigate, Navigate, useParams } from 'react-router-dom';
import { Cpu, Sun, Moon, LayoutGrid, Search, GitCompare, Home as HomeIcon, Sliders, Sparkles, TrendingUp } from 'lucide-react';
import { Configurator } from './components/Configurator';
import { Skeleton } from './components/Skeleton';
const CompareTray = lazy(() => import('./components/CompareTray').then(m => ({ default: m.CompareTray })));
const CategoryConflictModal = lazy(() => import('./components/CategoryConflictModal').then(m => ({ default: m.CategoryConflictModal })));
import { useBuild } from './context/BuildContext';
import { getInitialTheme, applyTheme, toggleTheme } from './utils/theme';
import { getComponentById, getComponentBySlug, trackTraffic } from './api';
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
  // Scroll to top on every route change and track traffic
  useEffect(() => { 
    window.scrollTo(0, 0); 
    trackTraffic(location.pathname + location.search);
  }, [location.pathname, location.search]);
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
  const isBuild = location.pathname === '/build' || location.pathname === '/configurateur';
  const isComponents = location.pathname.startsWith('/components') || location.pathname.startsWith('/browse') || location.pathname.startsWith('/composants') || location.pathname.startsWith('/parcourir');
  const isPresets = location.pathname === '/presets' || location.pathname === '/configurations';

  return (
    <div className={styles.app}>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.headerLeft}>
            <Link to="/" className={styles.logoLink}>
              <img src="/logo-full.png" alt="PC Builder Maroc" className={styles.logoImage} />
            </Link>
            <nav className={styles.nav}>
              <Link to="/" className={`${styles.navLink} ${isHome ? styles.navLinkActive : ''}`}>
                <HomeIcon size={13} className={styles.navIcon} />
                {UI.nav.home}
              </Link>
              <Link to="/configurateur" className={`${styles.navLink} ${isBuild ? styles.navLinkActive : ''}`}>
                <Sliders size={13} className={styles.navIcon} />
                {UI.nav.configurator}
              </Link>
              <Link to="/composants" className={`${styles.navLink} ${isComponents ? styles.navLinkActive : ''}`}>
                <LayoutGrid size={13} className={styles.navIcon} />
                {UI.nav.components}
              </Link>
              <Link to="/configurations" className={`${styles.navLink} ${isPresets ? styles.navLinkActive : ''}`}>
                <Sparkles size={13} className={styles.navIcon} />
                {UI.nav.presets}
              </Link>
              <Link to="/comparer" className={`${styles.navLink} ${location.pathname === '/comparer' ? styles.navLinkActive : ''}`}>
                <GitCompare size={13} className={styles.navIcon} />
                {UI.nav.compare}
              </Link>
              <Link to="/tendances" className={`${styles.navLink} ${location.pathname === '/tendances' ? styles.navLinkActive : ''}`}>
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

          <Route path="/configurateur" element={
            <main className={styles.main}>
              <Configurator />
            </main>
          } />
          <Route path="/build" element={<Navigate to="/configurateur" replace />} />

          <Route path="/produit/:slug" element={
            <ProductRedirect />
          } />
          <Route path="/product/:slug" element={<ProductRedirect />} />

          <Route path="/composants/:category/:identifier" element={
            <main className={styles.main}>
              <ComponentDetail onAddToBuild={addToBuild} />
            </main>
          } />
          <Route path="/components/:category/:identifier" element={
            <main className={styles.main}>
              <ComponentDetail onAddToBuild={addToBuild} />
            </main>
          } />

          <Route path="/composants" element={
            <main className={styles.main}>
              <ComponentsIndex />
            </main>
          } />
          <Route path="/components" element={<Navigate to="/composants" replace />} />

          <Route path="/parcourir" element={<Navigate to="/composants" replace />} />
          <Route path="/browse" element={<Navigate to="/composants" replace />} />

          <Route path="/parcourir/:category/:slotKey?" element={
            <main className={styles.main}>
              <CategoryBrowse />
            </main>
          } />
          <Route path="/browse/:category/:slotKey?" element={
            <main className={styles.main}>
              <CategoryBrowse />
            </main>
          } />

          <Route path="/comparer" element={
            <main className={styles.main}>
              <Compare />
            </main>
          } />
          <Route path="/compare" element={<Navigate to="/comparer" replace />} />

          <Route path="/recherche" element={
            <main className={styles.main}>
              <GlobalSearch />
            </main>
          } />
          <Route path="/search" element={<Navigate to="/recherche" replace />} />

          <Route path="/tendances" element={
            <main className={styles.main}>
              <MarketTrends />
            </main>
          } />
          <Route path="/market-trends" element={<Navigate to="/tendances" replace />} />

          <Route path="/configurations" element={
            <main className={styles.main}>
              <Presets onLoadPreset={handleLoadPreset} />
            </main>
          } />
          <Route path="/presets" element={<Navigate to="/configurations" replace />} />

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
            <Link to="/recherche" className={styles.footerLink}>{UI.footer.search}</Link>
            <Link to="/comparer" className={styles.footerLink}>{UI.footer.compare}</Link>
            <Link to="/tendances" className={styles.footerLink}>{UI.footer.trends}</Link>
          </div>
        </div>
      </footer>

      {/* Mobile Bottom Navigation */}
      <nav className={styles.mobileNav}>
        <Link to="/" className={`${styles.mobileNavLink} ${isHome ? styles.mobileNavLinkActive : ''}`}>
          <HomeIcon size={20} />
          <span className={styles.mobileNavText}>{UI.nav.home}</span>
        </Link>
        <Link to="/configurateur" className={`${styles.mobileNavLink} ${isBuild ? styles.mobileNavLinkActive : ''}`}>
          <Sliders size={20} />
          <span className={styles.mobileNavText}>Config</span>
        </Link>
        <Link to="/composants" className={`${styles.mobileNavLink} ${isComponents ? styles.mobileNavLinkActive : ''}`}>
          <LayoutGrid size={20} />
          <span className={styles.mobileNavText}>{UI.nav.components}</span>
        </Link>
        <Link to="/configurations" className={`${styles.mobileNavLink} ${isPresets ? styles.mobileNavLinkActive : ''}`}>
          <Sparkles size={20} />
          <span className={styles.mobileNavText}>Presets</span>
        </Link>
        <Link to="/comparer" className={`${styles.mobileNavLink} ${location.pathname === '/comparer' ? styles.mobileNavLinkActive : ''}`}>
          <GitCompare size={20} />
          <span className={styles.mobileNavText}>{UI.nav.compare}</span>
        </Link>
        <Link to="/tendances" className={`${styles.mobileNavLink} ${location.pathname === '/tendances' ? styles.mobileNavLinkActive : ''}`}>
          <TrendingUp size={20} />
          <span className={styles.mobileNavText}>{UI.nav.trends}</span>
        </Link>
      </nav>

      <Suspense fallback={null}>
        <CompareTray />
        <CategoryConflictModal />
      </Suspense>
    </div>
  );
}
