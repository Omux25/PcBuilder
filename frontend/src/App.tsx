import { useState, useEffect, lazy, Suspense } from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import { Configurator } from './components/Configurator';
import { BuildSummary } from './components/BuildSummary';
import { PriceComparison } from './components/PriceComparison';
import type { BuildConfig, Component } from './types';
import styles from './App.module.css';

// Lazy-load the detail page — it's only needed when navigating to /components/:slug
const ComponentDetail = lazy(() => import('./pages/ComponentDetail').then(m => ({ default: m.ComponentDetail })));

export default function App() {
  const [build, setBuild] = useState<BuildConfig>({});
  const [priceTarget, setPriceTarget] = useState<Component | null>(null);

  const selectedComponents = Object.values(build).filter(Boolean) as Component[];

  // Sélectionner automatiquement le premier composant pour la comparaison des prix
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

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <Link to="/" className={styles.logoLink}>
          <h1 className={styles.logo}>PC Builder <span className={styles.sub}>Maroc</span></h1>
        </Link>
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
      </Routes>

      <footer className={styles.footer}>
        <p>PC Builder Maroc — comparateur de prix, pas un vendeur. Les achats se font sur les sites des revendeurs.</p>
      </footer>
    </div>
  );
}
