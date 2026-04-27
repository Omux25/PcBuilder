/**
 * Presets page — browse curated PC builds grouped by use case.
 * Accessible at /presets
 */

import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getPresets } from '../api';
import type { PresetBuild } from '../types';
import { CATEGORY_LABELS } from '../types';
import styles from './Presets.module.css';

const USE_CASE_LABELS: Record<string, string> = {
  gaming:      '🎮 Gaming',
  workstation: '💼 Workstation',
  office:      '🏢 Bureau',
  budget:      '💰 Budget',
};

interface Props {
  onLoadPreset: (components: Record<string, number>) => void;
}

export function Presets({ onLoadPreset }: Props) {
  const [presets, setPresets] = useState<PresetBuild[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    getPresets()
      .then(setPresets)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  function handleLoad(preset: PresetBuild) {
    const componentIds: Record<string, number> = {};
    for (const [category, component] of Object.entries(preset.components)) {
      if (component.is_active) componentIds[category] = component.id;
    }
    onLoadPreset(componentIds);
    navigate('/');
  }

  if (loading) return <div className={styles.loading}>Chargement des configurations…</div>;
  if (error)   return <div className={styles.error}>{error}</div>;

  // Group by use case
  const grouped = presets.reduce<Record<string, PresetBuild[]>>((acc, p) => {
    if (!acc[p.use_case]) acc[p.use_case] = [];
    acc[p.use_case].push(p);
    return acc;
  }, {});

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <Link to="/" className={styles.back}>← Retour au configurateur</Link>
        <h1 className={styles.title}>Configurations prêtes à l'emploi</h1>
        <p className={styles.subtitle}>
          Choisissez une configuration adaptée à votre usage et chargez-la en un clic.
        </p>
      </div>

      {Object.entries(grouped).map(([useCase, list]) => (
        <section key={useCase} className={styles.group}>
          <h2 className={styles.groupTitle}>{USE_CASE_LABELS[useCase] ?? useCase}</h2>
          <div className={styles.cards}>
            {list.map((preset) => (
              <PresetCard key={preset.id} preset={preset} onLoad={handleLoad} />
            ))}
          </div>
        </section>
      ))}

      {presets.length === 0 && (
        <p className={styles.empty}>Aucune configuration disponible pour le moment.</p>
      )}
    </div>
  );
}

// ── Preset card ───────────────────────────────────────────────────────────────

function PresetCard({ preset, onLoad }: { preset: PresetBuild; onLoad: (p: PresetBuild) => void }) {
  const componentCount = Object.keys(preset.components).length;

  return (
    <div className={`${styles.card} ${preset.incomplete ? styles.incomplete : ''}`}>
      <div className={styles.cardHeader}>
        <h3 className={styles.cardName}>{preset.name}</h3>
        {preset.incomplete && (
          <span className={styles.incompleteBadge} title="Certains composants ne sont plus disponibles">
            ⚠ Incomplet
          </span>
        )}
      </div>

      {preset.description && (
        <p className={styles.cardDesc}>{preset.description}</p>
      )}

      <div className={styles.componentList}>
        {Object.entries(preset.components).map(([category, component]) => (
          <div key={category} className={`${styles.componentRow} ${!component.is_active ? styles.inactive : ''}`}>
            <span className={styles.componentCat}>
              {CATEGORY_LABELS[category as keyof typeof CATEGORY_LABELS] ?? category}
            </span>
            <span className={styles.componentName}>
              {component.brand ? `${component.brand} ` : ''}{component.name}
            </span>
          </div>
        ))}
      </div>

      <div className={styles.cardFooter}>
        {preset.total_price_estimate && (
          <span className={styles.price}>
            ~{preset.total_price_estimate.toLocaleString('fr-MA')} MAD
          </span>
        )}
        <button
          className={styles.loadBtn}
          onClick={() => onLoad(preset)}
          disabled={componentCount === 0}
        >
          Charger cette configuration
        </button>
      </div>
    </div>
  );
}
