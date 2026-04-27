/**
 * Configurator — 7 component slots, each with a category selector.
 * Fetches components from the API and updates the build state.
 */

import { useState, useEffect } from 'react';
import { getComponents } from '../api';
import type { Component, ComponentCategory, BuildConfig } from '../types';
import { CATEGORY_LABELS, CATEGORY_ORDER } from '../types';
import styles from './Configurator.module.css';

interface Props {
  build: BuildConfig;
  onChange: (build: BuildConfig) => void;
}

export function Configurator({ build, onChange }: Props) {
  return (
    <section className={styles.configurator}>
      <h2 className={styles.title}>Configurer votre PC</h2>
      <div className={styles.slots}>
        {CATEGORY_ORDER.map((cat) => (
          <Slot
            key={cat}
            category={cat}
            selected={build[cat] ?? null}
            onSelect={(component) => {
              const next = { ...build };
              if (component) next[cat] = component;
              else delete next[cat];
              onChange(next);
            }}
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
  onSelect: (component: Component | null) => void;
}

function Slot({ category, selected, onSelect }: SlotProps) {
  const [components, setComponents] = useState<Component[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    getComponents(category)
      .then(setComponents)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [category]);

  return (
    <div className={styles.slot}>
      <label className={styles.label} htmlFor={`slot-${category}`}>
        {CATEGORY_LABELS[category]}
      </label>

      {loading && <p className={styles.hint}>Chargement…</p>}
      {error   && <p className={styles.error}>Erreur: {error}</p>}

      {!loading && !error && (
        <select
          id={`slot-${category}`}
          value={selected?.id ?? ''}
          onChange={(e) => {
            const id = Number(e.target.value);
            onSelect(components.find((c) => c.id === id) ?? null);
          }}
          aria-label={`Sélectionner ${CATEGORY_LABELS[category]}`}
        >
          <option value=''>— Aucun —</option>
          {components.map((c) => (
            <option key={c.id} value={c.id}>
              {c.brand ? `${c.brand} ` : ''}{c.name}
            </option>
          ))}
        </select>
      )}

      {selected && (
        <button
          className={styles.clear}
          onClick={() => onSelect(null)}
          aria-label={`Retirer ${CATEGORY_LABELS[category]}`}
        >
          ✕
        </button>
      )}
    </div>
  );
}
