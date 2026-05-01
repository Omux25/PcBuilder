/**
 * BuildSummary — shows TDP, PSU recommendation, compatibility errors and warnings.
 * Calls the API whenever the build changes.
 */

import { useEffect, useState } from 'react';
import { validateBuild } from '../api';
import type { BuildConfig, CompatibilityResult } from '../types';
import { RULE_LABELS, RULE_TOOLTIPS } from '../types';
import styles from './BuildSummary.module.css';

interface Props {
  build: BuildConfig;
}

export function BuildSummary({ build }: Props) {
  const [result, setResult] = useState<CompatibilityResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasComponents = Object.keys(build).length > 0;

  useEffect(() => {
    if (!hasComponents) {
      setResult(null);
      return;
    }

    setLoading(true);
    setError(null);

    const abortController = new AbortController();

    const timer = setTimeout(() => {
      validateBuild(build)
        .then((r) => {
          if (!abortController.signal.aborted) setResult(r);
        })
        .catch((e: Error) => {
          if (!abortController.signal.aborted) setError(e.message);
        })
        .finally(() => {
          if (!abortController.signal.aborted) setLoading(false);
        });
    }, 300);

    return () => {
      clearTimeout(timer);
      abortController.abort();
    };
  }, [build, hasComponents]);

  if (!hasComponents) {
    return (
      <section className={styles.summary}>
        <h2 className={styles.title}>Résumé de la configuration</h2>
        <p className={styles.empty}>Sélectionnez des composants pour voir la compatibilité.</p>
      </section>
    );
  }

  return (
    <section className={styles.summary}>
      <h2 className={styles.title}>Résumé de la configuration</h2>

      {loading && <p className={styles.hint}>Vérification…</p>}
      {error   && <p className={styles.errorMsg}>Erreur: {error}</p>}

      {result && (
        <>
          {/* Status badge */}
          <div className={`${styles.badge} ${result.compatible ? styles.ok : styles.fail}`}>
            {result.compatible ? '✓ Compatible' : '✗ Incompatible'}
          </div>

          {/* TDP */}
          <div className={styles.stats}>
            <Stat label="Consommation totale" value={`${result.total_tdp} W`} />
            <Stat label="Alimentation recommandée (min)" value={`${result.recommended_psu_wattage} W`} />
          </div>

          {/* Errors */}
          {result.errors.length > 0 && (
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>Erreurs</h3>
              <ul className={styles.list}>
                {result.errors.map((e, i) => (
                  <li key={i} className={styles.errorItem}>
                    <span className={styles.rule} data-tooltip={RULE_TOOLTIPS[e.rule]}>
                      {RULE_LABELS[e.rule] ?? e.rule}
                    </span>
                    <span>{e.message}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Warnings */}
          {result.warnings.length > 0 && (
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>Avertissements</h3>
              <ul className={styles.list}>
                {result.warnings.map((w, i) => (
                  <li key={i} className={styles.warnItem}>
                    <span className={styles.rule} data-tooltip={RULE_TOOLTIPS[w.rule]}>
                      {RULE_LABELS[w.rule] ?? w.rule}
                    </span>
                    <span>{w.message}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.compatible && result.errors.length === 0 && result.warnings.length === 0 && (
            <p className={styles.allGood}>Tous les composants sont compatibles.</p>
          )}
        </>
      )}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.stat}>
      <span className={styles.statLabel}>{label}</span>
      <span className={styles.statValue}>{value}</span>
    </div>
  );
}
