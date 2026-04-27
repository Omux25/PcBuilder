import { useState } from 'react';
import { Configurator } from './components/Configurator';
import { BuildSummary } from './components/BuildSummary';
import { PriceComparison } from './components/PriceComparison';
import type { BuildConfig, Component } from './types';
import styles from './App.module.css';

export default function App() {
  const [build, setBuild] = useState<BuildConfig>({});
  // The component whose prices are currently shown — defaults to the first selected one
  const [priceTarget, setPriceTarget] = useState<Component | null>(null);

  const selectedComponents = Object.values(build).filter(Boolean) as Component[];

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <h1 className={styles.logo}>🖥 PC Builder <span className={styles.sub}>Maroc</span></h1>
        <p className={styles.tagline}>Configurez, vérifiez la compatibilité, comparez les prix.</p>
      </header>

      <main className={styles.main}>
        {/* Left column — configurator + build summary */}
        <div className={styles.left}>
          <Configurator build={build} onChange={setBuild} />
          <BuildSummary build={build} />
        </div>

        {/* Right column — price comparison */}
        <div className={styles.right}>
          {/* Quick-select buttons for price comparison */}
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

      <footer className={styles.footer}>
        <p>PC Builder Maroc — comparateur de prix, pas un vendeur. Les achats se font sur les sites des revendeurs.</p>
      </footer>
    </div>
  );
}
