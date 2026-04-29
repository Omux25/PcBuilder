import { useState, lazy, Suspense } from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import { Configurator } from './components/Configurator';
import { Skeleton } from './components/Skeleton';
import type { BuildConfig, Component, ComponentCategory } from './types';
import { getComponentById } from './api';
import styles from './App.module.css';

const ComponentDetail = lazy(() => import('./pages/ComponentDetail').then(m => ({ default: m.ComponentDetail })));
const Presets = lazy(() => import('./pages/Presets').then(m => ({ default: m.Presets })));

export default function App() {
  const [build, setBuild] = useState<BuildConfig>({});

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
        <Route path="/" element={
          <main className={styles.main}>
            <Configurator build={build} onChange={setBuild} />
          </main>
        } />

        <Route path="/components/:slug" element={
          <Suspense fallback={<div className={styles.main}><Skeleton height={400} /></div>}>
            <ComponentDetail />
          </Suspense>
        } />

        <Route path="/presets" element={
          <Suspense fallback={<div className={styles.main}><Skeleton height={400} /></div>}>
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
