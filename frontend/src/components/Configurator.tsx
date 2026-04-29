/**
 * Configurator — 8 component slots using the searchable ComponentPicker.
 * Shows a compact summary card when a component is selected.
 */

import { Link } from 'react-router-dom';
import { ComponentPicker } from './ComponentPicker';
import type { Component, ComponentCategory, BuildConfig } from '../types';
import { CATEGORY_LABELS, CATEGORY_ORDER } from '../types';
import styles from './Configurator.module.css';

interface Props {
  build: BuildConfig;
  onChange: (build: BuildConfig) => void;
}

export function Configurator({ build, onChange }: Props) {
  function handleSelect(category: ComponentCategory, component: Component | null) {
    const next = { ...build };
    if (component) next[category] = component;
    else delete next[category];
    onChange(next);
  }

  return (
    <section className={styles.configurator}>
      <div className={styles.header}>
        <h2 className={styles.title}>PC Builder</h2>
        <button
          className={styles.resetBtn}
          onClick={() => onChange({})}
          disabled={Object.keys(build).length === 0}
        >
          Réinitialiser
        </button>
      </div>

      <div className={styles.tableWrapper}>
        <table className={styles.builderTable}>
          <thead>
            <tr>
              <th className={styles.thCat}>Composant</th>
              <th className={styles.thSel}>Sélection</th>
              <th className={styles.thPrice}>Prix de base</th>
              <th className={styles.thAction}>Action</th>
            </tr>
          </thead>
          <tbody>
            {CATEGORY_ORDER.map((cat) => {
              const selected = build[cat];
              // TS hack: we know the Component picker passes a SmartComponent with lowest_price
              const price = selected ? (selected as any).lowest_price : null;

              return (
                <tr key={cat} className={selected ? styles.rowSelected : ''}>
                  <td className={styles.catCell}>
                    <span className={styles.catLabel}>{CATEGORY_LABELS[cat]}</span>
                  </td>
                  <td className={styles.selectionCell}>
                    <ComponentPicker
                      category={cat}
                      selected={selected ?? null}
                      build={build}
                      onSelect={(c) => handleSelect(cat, c)}
                    />
                  </td>
                  <td className={styles.priceCell}>
                    {selected ? (
                      <span className={styles.priceVal}>
                        {price ? `${price.toLocaleString('fr-MA')} MAD` : '—'}
                      </span>
                    ) : null}
                  </td>
                  <td className={styles.actionCell}>
                    {selected && (
                      <button
                        className={styles.removeBtn}
                        onClick={() => handleSelect(cat, null)}
                        title="Retirer"
                      >
                        ×
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
