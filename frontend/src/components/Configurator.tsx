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
        <h2 className={styles.title}>Configurer votre PC</h2>
        <button
          className={styles.resetBtn}
          onClick={() => onChange({})}
          disabled={Object.keys(build).length === 0}
        >
          Réinitialiser
        </button>
      </div>

      <div className={styles.slots}>
        {CATEGORY_ORDER.map((cat) => (
          <Slot
            key={cat}
            category={cat}
            selected={build[cat] ?? null}
            build={build}
            onSelect={(c) => handleSelect(cat, c)}
          />
        ))}
      </div>
    </section>
  );
}

// ── Single slot ───────────────────────────────────────────────────────────────

interface SlotProps {
  category: ComponentCategory;
  selected: Component | null;
  build: BuildConfig;
  onSelect: (component: Component | null) => void;
}

function Slot({ category, selected, build, onSelect }: SlotProps) {
  return (
    <div className={styles.slot}>
      <div className={styles.slotHeader}>
        <span className={styles.label}>{CATEGORY_LABELS[category]}</span>
        {selected && (
          <Link
            to={`/components/${selected.slug}`}
            className={styles.detailLink}
            title="Voir les détails et les prix"
          >
            Détails →
          </Link>
        )}
      </div>

      <ComponentPicker
        category={category}
        selected={selected}
        build={build}
        onSelect={onSelect}
      />

      {/* Compact summary card when selected */}
      {selected && (
        <div className={styles.summaryCard}>
          <span className={styles.cardBrand}>{selected.brand}</span>
          <span className={styles.cardName}>{selected.name}</span>
          {selected.tdp && (
            <span className={styles.cardSpec}>{selected.tdp}W TDP</span>
          )}
        </div>
      )}
    </div>
  );
}
