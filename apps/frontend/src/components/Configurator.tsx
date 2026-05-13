import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Plus,
  RefreshCw,
  X,
  AlertCircle,
  CheckCircle2,
  Zap,
  Share2,
  Check,
} from 'lucide-react';
import { InlinePrices } from './InlinePrices';
import { CategoryIcon } from './CategoryIcon';
import type { ComponentCategory, CompatibilityResult } from '../types';
import { CATEGORY_LABELS, RULE_LABELS, slotKeyToCategory, CATEGORY_ORDER, CORE_CATEGORIES } from '../types';
import { useBuild } from '../context/BuildContext';
import { validateCompatibility } from '@shared/compatibility-engine';
import { calculateBuildTotalPrice } from '../utils/buildUtils';
import { encodeBuildToUrl } from '../utils/buildUrl';
import { getSpecLine } from '../utils/specLine';
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
  const { build, analysis: compat, removeFromBuild, resetBuild } = useBuild();
  const totalPrice = calculateBuildTotalPrice(build);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [copied, setCopied] = useState(false);

  const hasComponents = Object.keys(build).length > 0;

  function handleShare() {
    const params = encodeBuildToUrl(build);
    const url = `${window.location.origin}${window.location.pathname}?${params}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const psu = build.psu;
  const tdp = compat?.total_tdp || 0;
  const psuWattage = psu?.wattage || 0;
  const psuPercent = psuWattage > 0 ? Math.min(100, (tdp / psuWattage) * 100) : 0;
  const psuStatus = psuPercent > 90 ? 'critical' : psuPercent > 75 ? 'warning' : 'safe';

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
            <div className={`${styles.statusBadge} ${!compat.compatible
              ? styles.statusFail
              : compat.warnings.length > 0
                ? styles.statusWarn
                : styles.statusOk
              }`}>
              {!compat.compatible
                ? <><AlertCircle size={14} /> Incompatibilités détectées</>
                : compat.warnings.length > 0
                  ? <><AlertCircle size={14} /> {compat.warnings.length} avertissement{compat.warnings.length > 1 ? 's' : ''}</>
                  : <><CheckCircle2 size={14} /> Configuration compatible</>
              }
            </div>
          )}
        </div>
      </header>

      {/* Power Meter */}
      {hasComponents && (
        <div className={styles.powerMeter}>
          <div className={styles.powerInfo}>
            <div className={styles.powerLabel}>
              <Zap size={14} className={styles.zapIcon} />
              Consommation estimée: <strong>{tdp}W</strong>
            </div>
            <div className={styles.psuTarget}>
              Alimentation conseillée: <strong>{compat?.recommended_psu_wattage}W</strong>
            </div>
          </div>
          <div className={styles.progressBar}>
            <div 
              className={`${styles.progressFill} ${styles['psu_' + psuStatus]}`}
              style={{ width: `${psuPercent}%` }}
            />
          </div>
          {psu && (
            <div className={styles.psuLegend}>
              Utilisation de votre PSU ({psuWattage}W): {Math.round(psuPercent)}%
            </div>
          )}
        </div>
      )}

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
                        <Link
                          to={`/product/${selected.slug}`}
                          className={styles.compNameLink}
                          onClick={e => e.stopPropagation()}
                          title="Voir la fiche produit"
                        >
                          {selected.name}
                        </Link>
                        <span className={styles.compSpecs}>
                          {getSpecLine(selected)}
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
        {confirmReset ? (
          <div className={styles.resetConfirm}>
            <span className={styles.resetConfirmText}>Vider la configuration ?</span>
            <button
              className={styles.resetConfirmYes}
              onClick={() => { resetBuild(); setConfirmReset(false); }}
            >
              Confirmer
            </button>
            <button
              className={styles.resetConfirmNo}
              onClick={() => setConfirmReset(false)}
            >
              Annuler
            </button>
          </div>
        ) : (
          <button
            className={styles.resetBtn}
            onClick={() => setConfirmReset(true)}
            disabled={!hasComponents}
          >
            <RefreshCw size={16} />
            Réinitialiser
          </button>
        )}

        {hasComponents && (
          <button
            className={`${styles.shareBtn} ${copied ? styles.shareBtnDone : ''}`}
            onClick={handleShare}
          >
            {copied ? <><Check size={16} /> Copié !</> : <><Share2 size={16} /> Partager</>}
          </button>
        )}
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
