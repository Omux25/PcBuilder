import { useState } from 'react';
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
import type { ComponentCategory } from '../types';
import { CATEGORY_LABELS, RULE_LABELS, slotKeyToCategory, CATEGORY_ORDER, CORE_CATEGORIES } from '../types';
import { useBuild } from '../context/BuildContext';
import { calculateBuildTotalPrice } from '../utils/buildUtils';
import { encodeBuildToUrl } from '../utils/buildUrl';
import { getSpecLine } from '../utils/specLine';
import styles from './Configurator.module.css';

// ── Helpers ───────────────────────────────────────────────────────────────────

function slotLabel(key: string): string {
  const cat = slotKeyToCategory(key);
  const base = CATEGORY_LABELS[cat] ?? cat;
  if (/^(ram|storage)_(\d+)$/.test(key)) {
    const idx = parseInt(key.split('_').pop()!, 10);
    return idx === 1 ? base : `${base} #${idx}`;
  }
  return base;
}

function countRam(build: Record<string, unknown>): number {
  let n = 0;
  for (let i = 1; i <= 8; i++) if (build[`ram_${i}`]) n++;
  if (build['ram']) n++;
  return n;
}

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

  type RowEntry =
    | { kind: 'slot'; slotKey: string; category: ComponentCategory }
    | { kind: 'add'; category: 'ram' | 'storage' };

  const rows: RowEntry[] = [];

  for (const cat of CATEGORY_ORDER) {
    const isCore = CORE_CATEGORIES.includes(cat);
    if (cat === 'ram') {
      for (let i = 1; i <= 8; i++) {
        if (build[`ram_${i}`]) rows.push({ kind: 'slot', slotKey: `ram_${i}`, category: 'ram' });
      }
      if (build['ram']) rows.push({ kind: 'slot', slotKey: 'ram', category: 'ram' });
      rows.push({ kind: 'add', category: 'ram' });
      continue;
    }
    if (cat === 'storage') {
      for (let i = 1; i <= 8; i++) {
        if (build[`storage_${i}`]) rows.push({ kind: 'slot', slotKey: `storage_${i}`, category: 'storage' });
      }
      if (build['storage']) rows.push({ kind: 'slot', slotKey: 'storage', category: 'storage' });
      rows.push({ kind: 'add', category: 'storage' });
      continue;
    }
    if (isCore || build[cat]) {
      rows.push({ kind: 'slot', slotKey: cat, category: cat as ComponentCategory });
    }
  }

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
        <h1 className={styles.title}>Configurateur</h1>
        {compat && (
          <div className={`${styles.statusBadge} ${!compat.compatible
            ? styles.statusFail
            : compat.warnings.length > 0
              ? styles.statusWarn
              : styles.statusOk
            }`}>
            {!compat.compatible
              ? <><AlertCircle size={16} /> Incompatibilités</>
              : compat.warnings.length > 0
                ? <><AlertCircle size={16} /> {compat.warnings.length} avertissement{compat.warnings.length > 1 ? 's' : ''}</>
                : <><CheckCircle2 size={16} /> Configuration compatible</>
            }
          </div>
        )}
      </header>

      {/* Power Meter */}
      {hasComponents && (
        <div className={styles.powerMeter}>
          <div className={styles.powerMain}>
            <div className={styles.powerInfo}>
              <div className={styles.powerLabel}>
                <Zap size={16} className={styles.zapIcon} />
                <span>Consommation estimée</span>
              </div>
              <div className={styles.tdpVal}>{tdp}W</div>
            </div>
            <div className={styles.progressBar}>
              <div 
                className={`${styles.progressFill} ${styles['psu_' + psuStatus]}`}
                style={{ width: `${psuPercent}%` }}
              />
            </div>
            <div className={styles.psuTarget}>
              Conseillé: <strong>{compat?.recommended_psu_wattage}W</strong>
            </div>
          </div>
          <div className={styles.psuLegend}>
            <span className={styles.usageLabel}>Utilisation PSU</span>
            <span className={styles.usageVal}>{psuWattage > 0 ? Math.round(psuPercent) : 0}%</span>
            <span className={styles.psuTarget}>{psuWattage}W installés</span>
          </div>
        </div>
      )}

      {/* Main List */}
      <div className={styles.card}>
        {rows.map((entry) => {
          if (entry.kind === 'add') {
            const isRam = entry.category === 'ram';
            const slotKey = isRam ? nextRamSlot() : nextStorageSlot();
            const count = isRam ? countRam(build) : countStorage(build);
            const addLabel = isRam ? 'Ajouter de la mémoire' : 'Ajouter un stockage';
            const catLabel = CATEGORY_LABELS[entry.category];

            return (
              <div key={`add-${entry.category}`} className={styles.rowWrap}>
                <div className={styles.row}>
                  <div className={styles.catCol}>
                    <div className={styles.catIconWrap}>
                      <CategoryIcon category={entry.category} size={18} />
                    </div>
                    <div className={styles.catLabel}>
                      {catLabel}
                      {count > 0 && <span className={styles.slotCount}>{count}</span>}
                    </div>
                  </div>
                  <div className={styles.pickerCol}>
                    <Link to={entry.category === slotKey ? `/browse/${entry.category}` : `/browse/${entry.category}/${slotKey}`} className={styles.emptyButton}>
                      <Plus size={16} />
                      {addLabel}
                    </Link>
                  </div>
                  <div className={styles.priceCol} />
                </div>
              </div>
            );
          }

          const { slotKey, category } = entry;
          const selected = build[slotKey];
          const label = slotLabel(slotKey);
          const isExpanded = expandedKey === slotKey;

          return (
            <div key={slotKey} className={styles.rowWrap}>
              <div
                className={styles.row}
                onClick={() => selected && setExpandedKey(isExpanded ? null : slotKey)}
                style={{ cursor: selected ? 'pointer' : 'default' }}
              >
                <div className={styles.catCol}>
                  <div className={styles.catIconWrap}>
                    <CategoryIcon category={category} size={18} />
                  </div>
                  <div className={styles.catLabel}>{label}</div>
                </div>

                <div className={styles.pickerCol}>
                  {selected ? (
                    <div className={styles.filledState}>
                      {selected.image_url && (
                        <img src={selected.image_url} alt="" className={styles.compThumb} referrerPolicy="no-referrer" />
                      )}
                      <div className={styles.compInfo}>
                        <span className={styles.compBrand}>{selected.brand}</span>
                        <Link
                          to={`/product/${selected.slug}`}
                          className={styles.compNameLink}
                          onClick={e => e.stopPropagation()}
                        >
                          {selected.name}
                        </Link>
                        <span className={styles.compSpecs}>{getSpecLine(selected)}</span>
                      </div>
                    </div>
                  ) : (
                    <Link to={category === slotKey ? `/browse/${category}` : `/browse/${category}/${slotKey}`} className={styles.emptyButton}>
                      <Plus size={16} />
                      Choisir un composant
                    </Link>
                  )}
                </div>

                <div className={styles.priceCol}>
                  {selected ? (
                    <>
                      <span className={styles.priceVal}>
                        {selected.lowest_price ? `${selected.lowest_price.toLocaleString('fr-MA')} MAD` : '—'}
                      </span>
                      <button
                        className={styles.actionBtn}
                        onClick={(e) => { e.stopPropagation(); removeFromBuild(slotKey); }}
                      >
                        <X size={18} />
                      </button>
                    </>
                  ) : null}
                </div>
              </div>

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
        <div className={styles.totalCard}>
          <div className={styles.totalInfo}>
            <span className={styles.totalLabel}>Total estimé</span>
            <span className={styles.totalPrice}>{totalPrice.toLocaleString('fr-MA')} MAD</span>
          </div>
          {hasComponents && (
            <div className={styles.footerActions}>
              <button
                className={`${styles.shareBtn} ${copied ? styles.shareBtnDone : ''}`}
                onClick={handleShare}
              >
                {copied ? <><Check size={18} /> Copié !</> : <><Share2 size={18} /> Partager</>}
              </button>
              {confirmReset ? (
                <div className={styles.resetConfirm}>
                  <button className={styles.resetConfirmYes} onClick={() => { resetBuild(); setConfirmReset(false); }}>
                    Vider ?
                  </button>
                  <button className={styles.resetConfirmNo} onClick={() => setConfirmReset(false)}>
                    Non
                  </button>
                </div>
              ) : (
                <button className={styles.resetBtn} onClick={() => setConfirmReset(true)}>
                  <RefreshCw size={16} />
                  Réinitialiser
                </button>
              )}
            </div>
          )}
        </div>
      </footer>

      {/* Compatibility */}
      {compat && (compat.errors.length > 0 || compat.warnings.length > 0) && (
        <div className={styles.compatSection}>
          {compat.errors.map((e, i) => (
            <div key={i} className={`${styles.compatCard} ${styles.compatErr}`}>
              <AlertCircle size={18} />
              <div>
                <strong>{RULE_LABELS[e.rule] || e.rule}</strong>
                <p>{e.message}</p>
              </div>
            </div>
          ))}
          {compat.warnings.map((w, i) => (
            <div key={i} className={`${styles.compatCard} ${styles.compatWarn}`}>
              <AlertCircle size={18} />
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
