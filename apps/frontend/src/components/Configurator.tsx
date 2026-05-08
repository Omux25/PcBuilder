import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Plus,
  RefreshCw,
  X,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { InlinePrices } from './InlinePrices';
import { CategoryIcon } from './CategoryIcon';
import type { ComponentCategory, CompatibilityResult } from '../types';
import { CATEGORY_LABELS, RULE_LABELS, slotKeyToCategory, CATEGORY_ORDER, CORE_CATEGORIES } from '../types';
import { validateBuild } from '../api';
import { useBuild } from '../context/BuildContext';
import { calculateBuildTotalPrice } from '../utils/buildUtils';
import styles from './Configurator.module.css';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Human-readable label for a slot key. */
function slotLabel(key: string): string {
  const cat = slotKeyToCategory(key);
  const base = CATEGORY_LABELS[cat] ?? cat;
  // ram_1 → "Mémoire", ram_2 → "Mémoire #2", etc.
  if (/^(ram|storage)_(\d+)$/.test(key)) {
    const idx = parseInt(key.split('_').pop()!, 10);
    return idx === 1 ? base : `${base} #${idx}`;
  }
  return base;
}

/** Count how many RAM sticks are in the build. */
function countRam(build: Record<string, unknown>): number {
  let n = 0;
  for (let i = 1; i <= 8; i++) if (build[`ram_${i}`]) n++;
  if (build['ram']) n++;
  return n;
}

/** Count how many storage drives are in the build. */
function countStorage(build: Record<string, unknown>): number {
  let n = 0;
  for (let i = 1; i <= 8; i++) if (build[`storage_${i}`]) n++;
  if (build['storage']) n++;
  return n;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function Configurator() {
  const { build, removeFromBuild, resetBuild } = useBuild();
  const totalPrice = calculateBuildTotalPrice(build);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [compat, setCompat] = useState<CompatibilityResult | null>(null);

  const hasComponents = Object.keys(build).length > 0;

  // Debounced compatibility check
  useEffect(() => {
    if (!hasComponents) { setCompat(null); return; }
    const timer = setTimeout(() => {
      validateBuild(build).then(setCompat).catch(() => setCompat(null));
    }, 300);
    return () => clearTimeout(timer);
  }, [build, hasComponents]);

  // ── Build the ordered list of rows to render ──────────────────────────────
  // Each entry is either a filled/empty slot row, or an "add" button row.
  type RowEntry =
    | { kind: 'slot'; slotKey: string; category: ComponentCategory }
    | { kind: 'add'; category: 'ram' | 'storage' };

  const rows: RowEntry[] = [];

  for (const cat of CATEGORY_ORDER) {
    const isCore = CORE_CATEGORIES.includes(cat);

    if (cat === 'ram') {
      // Show all filled RAM slots in order
      for (let i = 1; i <= 8; i++) {
        if (build[`ram_${i}`]) rows.push({ kind: 'slot', slotKey: `ram_${i}`, category: 'ram' });
      }
      if (build['ram']) rows.push({ kind: 'slot', slotKey: 'ram', category: 'ram' });
      // Always show the "+ Add Memory" button
      rows.push({ kind: 'add', category: 'ram' });
      continue;
    }

    if (cat === 'storage') {
      // Show all filled storage slots in order
      for (let i = 1; i <= 8; i++) {
        if (build[`storage_${i}`]) rows.push({ kind: 'slot', slotKey: `storage_${i}`, category: 'storage' });
      }
      if (build['storage']) rows.push({ kind: 'slot', slotKey: 'storage', category: 'storage' });
      // Always show the "+ Add Storage" button
      rows.push({ kind: 'add', category: 'storage' });
      continue;
    }

    // All other categories: show if core OR if it has a component
    if (isCore || build[cat]) {
      rows.push({ kind: 'slot', slotKey: cat, category: cat as ComponentCategory });
    }
  }

  // ── Next available slot key for add buttons ───────────────────────────────
  function nextRamSlot(): string {
    for (let i = 1; i <= 8; i++) if (!build[`ram_${i}`]) return `ram_${i}`;
    return 'ram_1';
  }
  function nextStorageSlot(): string {
    for (let i = 1; i <= 8; i++) if (!build[`storage_${i}`]) return `storage_${i}`;
    return 'storage_1';
  }

  return (
    <div className={styles.configurator}>
      {/* Header */}
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Configurateur</h1>
          {compat && (
            <div className={`${styles.statusBadge} ${compat.compatible ? styles.statusOk : styles.statusFail}`}>
              {compat.compatible ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
              {compat.compatible ? 'Configuration compatible' : 'Incompatibilités détectées'}
            </div>
          )}
        </div>
      </header>

      {/* Main Card */}
      <div className={styles.card}>
        {rows.map((entry, idx) => {
          // ── "Add" button row — same grid as every other row ──────────────
          if (entry.kind === 'add') {
            const isRam = entry.category === 'ram';
            const slotKey = isRam ? nextRamSlot() : nextStorageSlot();
            const count = isRam ? countRam(build) : countStorage(build);
            const addLabel = isRam ? 'Ajouter de la mémoire' : 'Ajouter un stockage';
            const catLabel = CATEGORY_LABELS[entry.category];
            const isLastRow = idx === rows.length - 1;

            return (
              <div
                key={`add-${entry.category}`}
                className={`${styles.rowWrap} ${isLastRow ? styles.rowWrapLast : ''}`}
              >
                <div className={styles.row}>
                  {/* Column 1: Category — identical to slot rows */}
                  <div className={styles.catCol}>
                    <CategoryIcon category={entry.category} size={16} className={styles.catIcon} />
                    <span>
                      {catLabel}
                      {count > 0 && <span className={styles.slotCount}>{count}</span>}
                    </span>
                  </div>

                  {/* Column 2: Add button — same position as "Choisir un composant" */}
                  <div className={styles.pickerCol}>
                    <Link
                      to={`/browse/${entry.category}/${slotKey}`}
                      className={styles.emptyButton}
                    >
                      <Plus size={14} />
                      {addLabel}
                    </Link>
                  </div>

                  {/* Column 3: empty */}
                  <div className={styles.priceCol} />
                </div>
              </div>
            );
          }

          // ── Filled / empty slot row ───────────────────────────────────────
          const { slotKey, category } = entry;
          const selected = build[slotKey];
          const label = slotLabel(slotKey);
          const isExpanded = expandedKey === slotKey;
          const isLastRow = idx === rows.length - 1;

          return (
            <div
              key={slotKey}
              className={`${styles.rowWrap} ${isLastRow ? styles.rowWrapLast : ''}`}
            >
              <div
                className={styles.row}
                onClick={() => selected && setExpandedKey(isExpanded ? null : slotKey)}
                style={{ cursor: selected ? 'pointer' : 'default' }}
              >
                {/* Column 1: Category */}
                <div className={styles.catCol}>
                  <CategoryIcon category={category} size={16} className={styles.catIcon} />
                  <span>{label}</span>
                </div>

                {/* Column 2: Selection */}
                <div className={styles.pickerCol}>
                  {selected ? (
                    <div className={styles.filledState}>
                      {selected.image_url && (
                        <img src={selected.image_url} alt="" className={styles.compThumb} referrerPolicy="no-referrer" />
                      )}
                      <div className={styles.compInfo}>
                        {selected.brand && (
                          <span className={styles.compBrand}>{selected.brand}</span>
                        )}
                        <span className={styles.compName}>{selected.name}</span>
                        <span className={styles.compSpecs}>
                          {selected.tdp && `${selected.tdp}W TDP`}
                          {selected.frequency_mhz && ` • ${selected.frequency_mhz} MHz`}
                          {selected.wattage && ` • ${selected.wattage}W`}
                          {selected.form_factor && ` • ${selected.form_factor}`}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <Link to={`/browse/${category}/${slotKey}`} className={styles.emptyButton}>
                      <Plus size={14} />
                      Choisir un composant
                    </Link>
                  )}
                </div>

                {/* Column 3: Price & Actions */}
                <div className={styles.priceCol}>
                  {selected ? (
                    <>
                      <span className={styles.priceVal}>
                        {selected.lowest_price
                          ? `${selected.lowest_price.toLocaleString('fr-MA')} MAD`
                          : '—'}
                      </span>
                      <button
                        className={styles.actionBtn}
                        onClick={(e) => { e.stopPropagation(); removeFromBuild(slotKey); }}
                        title="Retirer"
                        aria-label={`Retirer ${label}`}
                      >
                        <X size={16} />
                      </button>
                    </>
                  ) : null}
                </div>
              </div>

              {/* Inline price expansion */}
              {isExpanded && selected && (
                <div className={styles.expandContent}>
                  <InlinePrices componentId={selected.id} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <footer className={styles.footer}>
        <div className={styles.footerLeft}>
          <div className={styles.totalLabel}>Total estimé</div>
          <div className={styles.totalPrice}>{totalPrice.toLocaleString('fr-MA')} MAD</div>
        </div>
        <button
          className={styles.resetBtn}
          onClick={resetBuild}
          disabled={!hasComponents}
        >
          <RefreshCw size={16} />
          Réinitialiser
        </button>
      </footer>

      {/* Compatibility messages */}
      {compat && (compat.errors.length > 0 || compat.warnings.length > 0) && (
        <div className={styles.compatSection}>
          {compat.errors.map((e, i) => (
            <div key={i} className={`${styles.compatCard} ${styles.compatErr}`}>
              <AlertCircle size={16} />
              <div>
                <strong>{RULE_LABELS[e.rule] || e.rule}</strong>
                <p>{e.message}</p>
              </div>
            </div>
          ))}
          {compat.warnings.map((w, i) => (
            <div key={i} className={`${styles.compatCard} ${styles.compatWarn}`}>
              <AlertCircle size={16} />
              <div>
                <strong>{RULE_LABELS[w.rule] || w.rule}</strong>
                <p>{w.message}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
