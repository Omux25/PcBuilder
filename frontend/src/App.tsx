import { useState, useEffect, lazy, Suspense } from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import { Configurator } from './components/Configurator';
import { BuildSummary } from './components/BuildSummary';
import { PriceComparison } from './components/PriceComparison';
import type { BuildConfig, Component, ComponentCategory } from './types';
import { getComponentById } from './api';
import styles from './App.module.css';

// Lazy-load pages — only needed when navigating to those routes
const ComponentDetail = lazy(() => import('./pages/ComponentDetail').then(m => ({ default: m.ComponentDetail })));
const Presets = lazy(() => import('./pages/Presets').then(m => ({ default: m.Presets })));

export default function App() {
  const [build, setBuild] = useState<BuildConfig>({});
  const [priceTarget, setPriceTarget] = useState<Component | null>(null);

  const selectedComponents = Object.values(build).filter(Boolean) as Component[];

  // Auto-select first component for price comparison when build changes
  useEffect(() => {
    if (selectedComponents.length === 0) {
      setPriceTarget(null);
      return;
    }
    const stillSelected = priceTarget && selectedComponents.some((c) => c.id === priceTarget.id);
    if (!stillSelected) {
      setPriceTarget(selectedComponents[0]);
    }
  }, [build]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load a preset build — fetches each component by ID and populates the build
  async function handleLoadPreset(componentIds: Record<string, number>) {
    const entries = await Promise.allSettled(
      Object.entries(componentIds).map(async ([category, id]) => {
        const component = await getComponentById(id);
        return [category, component] as [ComponentCategory, Component];
      })
    );
    const newBuild: BuildConfig = {};
    for (const result of entries) {
      if (result.status === 'fulfilled') {
        const [category, component] = result.value;
        newBuild[category] = component;
      }
    }
    setBuild(newBuild);
  }

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <Link to="/" className={styles.logoLink}>
          <h1 className={styles.logo}>PC Builder <span className={styles.sub}>Maroc</span></h1>
        </Link>
        <nav className={styles.nav}>
          <Link to="/presets" className={styles.navLink}>Configurations prêtes</Link>
        </nav>
      </header>

      <Routes>
        {/* Page principale — configurateur */}
        <Route path="/" element={
          <main className={styles.main}>
            <div className={styles.left}>
              <Configurator build={build} onChange={setBuild} />
              <BuildSummary build={build} />
            </div>
            <div className={styles.right}>
              {selectedComponents.length > 0 && (
                <div className={styles.priceNav}>
                  <p className={styles.priceNavLabel}>Voir les prix pour :</p>
                  <div className={styles.priceNavBtns}>
                    {selectedComponents.map((c) => (
                      <button
                        key={c.id}
                        className={`${styles.priceNavBtn} ${priceTarget?.id === c.id ? styles.active : ''}`}
                        onClick={() => setPriceTarget(c)}
                      >
                        {c.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <PriceComparison component={priceTarget} />
            </div>
          </main>
        } />

        {/* Page détail composant */}
        <Route path="/components/:slug" element={
          <Suspense fallback={<div className={styles.loading}>Chargement...</div>}>
            <ComponentDetail />
          </Suspense>
        } />

        {/* Configurations prêtes */}
        <Route path="/presets" element={
          <Suspense fallback={<div className={styles.loading}>Chargement...</div>}>
            <Presets onLoadPreset={handleLoadPreset} />
          </Suspense>
        } />
      </Routes>

      <footer className={styles.footer}>
        <p>PC Builder Maroc — comparateur de prix, pas un vendeur. Les achats se font sur les sites des revendeurs.</p>
      </footer>
    </div>
  );
}
