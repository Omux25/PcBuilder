import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { Cpu, Sun, Moon, Check, Link2, LayoutGrid, Search, GitCompare, FileText } from 'lucide-react';
import { Configurator } from './components/Configurator';
import { Skeleton } from './components/Skeleton';
import { CompareTray } from './components/CompareTray';
import { useBuild } from './context/BuildContext';
import { calculateBuildTotalPrice } from './utils/buildUtils';
import { CATEGORY_ORDER, CATEGORY_LABELS } from './types';
import { encodeBuildToUrl } from './utils/buildUrl';
import { getInitialTheme, applyTheme, toggleTheme } from './utils/theme';
import { getComponentById } from './api';
import { UI } from './ui-strings';
import styles from './App.module.css';

const ComponentDetail = lazy(() => import('./pages/ComponentDetail').then(m => ({ default: m.ComponentDetail })));
const Presets = lazy(() => import('./pages/Presets').then(m => ({ default: m.Presets })));
const CategoryBrowse = lazy(() => import('./pages/CategoryBrowse').then(m => ({ default: m.CategoryBrowse })));
const ComponentsIndex = lazy(() => import('./pages/ComponentsIndex').then(m => ({ default: m.ComponentsIndex })));
const Compare = lazy(() => import('./pages/Compare').then(m => ({ default: m.Compare })));
const GlobalSearch = lazy(() => import('./pages/GlobalSearch').then(m => ({ default: m.GlobalSearch })));
const MarketTrends = lazy(() => import('./pages/MarketTrends').then(m => ({ default: m.MarketTrends })));

export default function App() {
  const { build, setBuild, addToBuild } = useBuild();
  const totalPrice = calculateBuildTotalPrice(build);

  const [theme, setTheme] = useState<'light' | 'dark'>(getInitialTheme());
  const [copied, setCopied] = useState(false);
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

  function handleShare() {
    const qs = encodeBuildToUrl(build);
    const url = `${window.location.origin}/?${qs}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleExportText() {
    const lines = [UI.build.exportHeader, ''];
    // Iterate all slot keys in display order (single-slot categories + indexed RAM/storage)
    for (const cat of CATEGORY_ORDER) {
      if (cat === 'ram') {
        for (let i = 1; i <= 4; i++) {
          const comp = build[`ram_${i}`];
          if (!comp) continue;
          const price = (comp as typeof comp & { lowest_price?: number | null }).lowest_price;
          const priceStr = price ? ` — ${price.toLocaleString('fr-MA')} MAD` : '';
          const label = i === 1 ? CATEGORY_LABELS.ram : `${CATEGORY_LABELS.ram} #${i}`;
          lines.push(`${label}: ${comp.brand ? comp.brand + ' ' : ''}${comp.name}${priceStr}`);
        }
      } else if (cat === 'storage') {
        for (let i = 1; i <= 4; i++) {
          const comp = build[`storage_${i}`];
          if (!comp) continue;
          const price = (comp as typeof comp & { lowest_price?: number | null }).lowest_price;
          const priceStr = price ? ` — ${price.toLocaleString('fr-MA')} MAD` : '';
          const label = i === 1 ? CATEGORY_LABELS.storage : `${CATEGORY_LABELS.storage} #${i}`;
          lines.push(`${label}: ${comp.brand ? comp.brand + ' ' : ''}${comp.name}${priceStr}`);
        }
      } else {
        const comp = build[cat];
        if (!comp) continue;
        const price = (comp as typeof comp & { lowest_price?: number | null }).lowest_price;
        const priceStr = price ? ` — ${price.toLocaleString('fr-MA')} MAD` : '';
        lines.push(`${CATEGORY_LABELS[cat]}: ${comp.brand ? comp.brand + ' ' : ''}${comp.name}${priceStr}`);
      }
    }
    if (totalPrice > 0) {
      lines.push('');
      lines.push(`${UI.build.exportTotal}: ${totalPrice.toLocaleString('fr-MA')} MAD`);
    }
    lines.push('');
    lines.push(`${UI.build.exportLink}: ${window.location.origin}/?${encodeBuildToUrl(build)}`);
    navigator.clipboard.writeText(lines.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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

  const hasComponents = Object.keys(build).length > 0;
  const isHome = location.pathname === '/';
  const isComponents = location.pathname.startsWith('/components') || location.pathname.startsWith('/browse');
  const isPresets = location.pathname === '/presets';

  return (
    <div className={styles.app}>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <Link to="/" className={styles.logoLink}>
            <span className={styles.logoIcon}><Cpu size={16} strokeWidth={2.5} /></span>
            <h1 className={styles.logo}>{UI.app.name} <span className={styles.sub}>{UI.app.subtitle}</span></h1>
          </Link>
          <nav className={styles.nav}>
            <Link to="/" className={`${styles.navLink} ${isHome ? styles.navLinkActive : ''}`}>
              {UI.nav.configurator}
            </Link>
            <Link to="/components" className={`${styles.navLink} ${isComponents ? styles.navLinkActive : ''}`}>
              <LayoutGrid size={13} className={styles.navIcon} />
              {UI.nav.components}
            </Link>
            <Link to="/presets" className={`${styles.navLink} ${isPresets ? styles.navLinkActive : ''}`}>
              {UI.nav.presets}
            </Link>
            <Link to="/compare" className={`${styles.navLink} ${location.pathname === '/compare' ? styles.navLinkActive : ''}`}>
              <GitCompare size={13} className={styles.navIcon} />
              {UI.nav.compare}
            </Link>
            <Link to="/market-trends" className={`${styles.navLink} ${location.pathname === '/market-trends' ? styles.navLinkActive : ''}`}>
              {UI.nav.trends}
            </Link>
          </nav>
        </div>

        <div className={styles.headerRight}>
          {searchOpen ? (
            <form className={styles.headerSearchForm} onSubmit={handleSearchSubmit}>
              <input
                ref={searchRef}
                type="search"
                className={styles.headerSearchInput}
                placeholder={`${UI.nav.search}…`}
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                onBlur={() => { if (!searchInput) setSearchOpen(false); }}
                onKeyDown={e => { if (e.key === 'Escape') { setSearchOpen(false); setSearchInput(''); } }}
              />
            </form>
          ) : (
            <button className={styles.iconBtn} onClick={() => setSearchOpen(true)} aria-label={UI.nav.search} title={UI.nav.search}>
              <Search size={16} />
            </button>
          )}
          <button
            className={styles.themeToggle}
            onClick={handleToggleTheme}
            aria-label={theme === 'dark' ? UI.app.themeLight : UI.app.themeDark}
          >
            {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
          </button>
        </div>
      </header>

      <Routes>
        {/* ── Home ────────────────────────────────────────────────────── */}
        <Route path="/" element={
          <>
            <section className={styles.hero}>
              <div className={styles.heroContent}>
                <h2 className={styles.heroTitle}>
                  {UI.hero.title}{' '}
                  <span className={styles.heroAccent}>{UI.hero.titleAccent}</span>
                </h2>
                <p className={styles.heroSub}>{UI.hero.subtitle}</p>
                <div className={styles.heroCtas}>
                  {CATEGORY_ORDER.slice(0, 5).map(cat => (
                    <Link key={cat} to={`/browse/${cat}`} className={styles.heroCatLink}>
                      {cat.toUpperCase()}
                    </Link>
                  ))}
                </div>
              </div>
            </section>

            <main className={styles.main}>
              {hasComponents && (
                <div className={styles.buildActions}>
                  <button
                    className={`${styles.actionBtn} ${copied ? styles.actionBtnSuccess : ''}`}
                    onClick={handleShare}
                  >
                    {copied ? <><Check size={14} /> {UI.build.copied}</> : <><Link2 size={14} /> {UI.build.share}</>}
                  </button>
                  <button className={styles.actionBtn} onClick={handleExportText}>
                    <FileText size={14} /> {UI.build.export}
                  </button>
                </div>
              )}
              <Configurator />
            </main>
          </>
        } />

        <Route path="/product/:slug" element={
          <main className={styles.main}>
            <Suspense fallback={<Skeleton height={400} />}>
              <ComponentDetail onAddToBuild={addToBuild} />
            </Suspense>
          </main>
        } />

        <Route path="/components" element={
          <main className={styles.main}>
            <Suspense fallback={<Skeleton height={400} />}>
              <ComponentsIndex />
            </Suspense>
          </main>
        } />

        <Route path="/browse/:category/:slotKey?" element={
          <main className={styles.main}>
            <Suspense fallback={<Skeleton height={400} />}>
              <CategoryBrowse />
            </Suspense>
          </main>
        } />

        <Route path="/compare" element={
          <main className={styles.main}>
            <Suspense fallback={<Skeleton height={400} />}>
              <Compare />
            </Suspense>
          </main>
        } />

        <Route path="/search" element={
          <main className={styles.main}>
            <Suspense fallback={<Skeleton height={400} />}>
              <GlobalSearch />
            </Suspense>
          </main>
        } />

        <Route path="/market-trends" element={
          <main className={styles.main}>
            <Suspense fallback={<Skeleton height={400} />}>
              <MarketTrends />
            </Suspense>
          </main>
        } />

        <Route path="/presets" element={
          <main className={styles.main}>
            <Suspense fallback={<Skeleton height={400} />}>
              <Presets onLoadPreset={handleLoadPreset} />
            </Suspense>
          </main>
        } />
      </Routes>

      <footer className={styles.footer}>
        <span className={styles.footerText}>{UI.footer.tagline}</span>
        <div className={styles.footerLinks}>
          <Link to="/search" className={styles.footerLink}>{UI.footer.search}</Link>
          <Link to="/compare" className={styles.footerLink}>{UI.footer.compare}</Link>
          <Link to="/market-trends" className={styles.footerLink}>{UI.footer.trends}</Link>
          <a href="https://www.ultrapc.ma" target="_blank" rel="noopener noreferrer" className={styles.footerLink}>UltraPC</a>
          <a href="https://nextlevelpc.ma" target="_blank" rel="noopener noreferrer" className={styles.footerLink}>NextLevel</a>
          <a href="https://setupgame.ma" target="_blank" rel="noopener noreferrer" className={styles.footerLink}>SetupGame</a>
        </div>
      </footer>

      <CompareTray />
    </div>
  );
}
