/**
 * Presets page — browse curated PC builds grouped by use case.
 * Accessible at /presets
 */

import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getPresets } from '../api';
import type { PresetBuild } from '../types';
import { CATEGORY_LABELS, slotKeyToCategory } from '../types';
import { formatComponentName } from '@shared/component-utils';
import { SkeletonCard } from '../components/Skeleton';
import { UI } from '../ui-strings';
import { formatPrice } from '../utils/format';
import styles from './Presets.module.css';

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
    navigate('/build');
  }

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.pageHeader}>
          <Link to="/build" className={styles.back}>{UI.presets.back}</Link>
          <h1 className={styles.title}>{UI.presets.title}</h1>
        </div>
        <div className={styles.group}>
          <div className={styles.cards}>
            <SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard />
          </div>
        </div>
      </div>
    );
  }

  if (error) return <div className={styles.error}>{error}</div>;

  const grouped = presets.reduce<Record<string, PresetBuild[]>>((acc, p) => {
    if (!acc[p.use_case]) acc[p.use_case] = [];
    acc[p.use_case].push(p);
    return acc;
  }, {});

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <Link to="/build" className={styles.back}>{UI.presets.back}</Link>
        <h1 className={styles.title}>{UI.presets.title}</h1>
        <p className={styles.subtitle}>{UI.presets.subtitle}</p>
      </div>

      {Object.entries(grouped).map(([useCase, list]) => (
        <section key={useCase} className={styles.group}>
          <h2 className={styles.groupTitle}>{UI.presets.useCases[useCase] ?? useCase}</h2>
          <div className={styles.cards}>
            {list.map(preset => <PresetCard key={preset.id} preset={preset} onLoad={handleLoad} />)}
          </div>
        </section>
      ))}

      {presets.length === 0 && <p className={styles.empty}>{UI.presets.empty}</p>}
    </div>
  );
}

function PresetCard({ preset, onLoad }: { preset: PresetBuild; onLoad: (p: PresetBuild) => void }) {
  const componentCount = Object.keys(preset.components).length;
  return (
    <div className={`${styles.card} ${preset.incomplete ? styles.incomplete : ''}`}>
      <div className={styles.cardHeader}>
        <h3 className={styles.cardName}>{preset.name}</h3>
        {preset.incomplete && (
          <span className={styles.incompleteBadge} title={UI.presets.incompleteTitle}>
            {UI.presets.incomplete}
          </span>
        )}
      </div>

      {preset.description && <p className={styles.cardDesc}>{preset.description}</p>}

      <div className={styles.componentList}>
        {Object.entries(preset.components).map(([slotKey, component]) => {
          const cat = slotKeyToCategory(slotKey);
          const baseLabel = CATEGORY_LABELS[cat] ?? cat;
          const label = slotKey !== cat ? `${baseLabel} #${slotKey.replace(/^\w+_/, '')}` : baseLabel;
          return (
            <div key={slotKey} className={`${styles.componentRow} ${!component.is_active ? styles.inactive : ''}`}>
              <span className={styles.componentCat}>{label}</span>
              <span className={styles.componentName}>
                {formatComponentName({ ...component, category: cat })}
              </span>
            </div>
          );
        })}
      </div>

      <div className={styles.cardFooter}>
        {preset.total_price_estimate && (
          <span className={styles.price}>~{formatPrice(preset.total_price_estimate)}</span>
        )}
        <button className={styles.loadBtn} onClick={() => onLoad(preset)} disabled={componentCount === 0}>
          {UI.presets.load}
        </button>
      </div>
    </div>
  );
}
