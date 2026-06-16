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
  Tag,
  Printer,
} from 'lucide-react';
import { InlinePrices } from './InlinePrices';
import { CategoryIcon } from './CategoryIcon';
import { ConfiguratorChecklist } from './ConfiguratorChecklist';
import { ConfiguratorTotals } from './ConfiguratorTotals';
import { ShareModal } from './ShareModal';
import type { ComponentCategory } from '../types';
import { CATEGORY_LABELS, RULE_LABELS, slotKeyToCategory, CATEGORY_ORDER, CORE_CATEGORIES } from '../types';
import { useBuild } from '../context/BuildContext';
import { calculateBuildTotalPrice } from '@shared/engine/pricing.engine';
import { encodeBuildToUrl } from '../utils/buildUrl';
import { getSpecLine } from '@shared/formatting/spec-line.formatter';
import { formatPrice } from '@shared/formatting/price.formatter';
import { formatComponentName } from '@shared/formatting/component-name.formatter';
import { LinkEngine } from '@shared/link-engine';
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
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  const hasComponents = Object.keys(build).length > 0;

  const checklist = [
    { key: 'cpu', label: 'Processeur', checked: !!build.cpu },
    { key: 'cooling', label: 'Refroidissement', checked: !!build.cooling },
    { key: 'motherboard', label: 'Carte Mère', checked: !!build.motherboard },
    { key: 'ram', label: 'Mémoire RAM', checked: countRam(build) > 0 },
    { key: 'storage', label: 'Stockage', checked: countStorage(build) > 0 },
    { key: 'gpu', label: 'Carte Graphique', checked: !!build.gpu },
    { key: 'case', label: 'Boîtier', checked: !!build.case },
    { key: 'psu', label: 'Alimentation', checked: !!build.psu },
  ];

  const checklistKeys = checklist.map(item => item.key);

  const shareUrl = (() => {
    const params = encodeBuildToUrl(build);
    return `${window.location.origin}${window.location.pathname}?${params}`;
  })();



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

  const coreRows = rows.filter(r => CORE_CATEGORIES.includes(r.category));
  const otherRows = rows.filter(r => !CORE_CATEGORIES.includes(r.category));

  const renderRow = (entry: RowEntry) => {
    if (entry.kind === 'add') {
      const isRam = entry.category === 'ram';
      const slotKey = isRam ? nextRamSlot() : nextStorageSlot();
      const count = isRam ? countRam(build) : countStorage(build);
      const addLabel = isRam ? 'Ajouter de la mémoire' : 'Ajouter un stockage';
      const catLabel = CATEGORY_LABELS[entry.category];
      const isRequired = checklistKeys.includes(entry.category);
      const targetUrl = entry.category === slotKey ? `/parcourir/${entry.category}` : `/parcourir/${entry.category}/${slotKey}`;

      return (
        <div key={`add-${entry.category}`} className={`${styles.rowWrap} ${styles.rowWrapEmpty}`}>
          <Link to={targetUrl} className={`${styles.row} ${styles.rowEmpty} ${styles.rowLink}`}>
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
              <div className={styles.emptyAction}>
                <Plus size={16} className={styles.plusIcon} />
                <span>{addLabel}</span>
              </div>
            </div>
            <div className={styles.priceCol}>
              <span className={`${styles.statusTag} ${isRequired ? styles.statusTagRequired : styles.statusTagOptional}`}>
                {isRequired ? 'Requis' : 'Optionnel'}
              </span>
            </div>
          </Link>
        </div>
      );
    }

    const { slotKey, category } = entry;
    const selected = build[slotKey];
    const label = slotLabel(slotKey);
    const isExpanded = expandedKey === slotKey;
    const isRequired = checklistKeys.includes(category);

    if (!selected) {
      const targetUrl = category === slotKey ? `/parcourir/${category}` : `/parcourir/${category}/${slotKey}`;
      return (
        <div key={slotKey} className={`${styles.rowWrap} ${styles.rowWrapEmpty}`}>
          <Link to={targetUrl} className={`${styles.row} ${styles.rowEmpty} ${styles.rowLink}`}>
            <div className={styles.catCol}>
              <div className={styles.catIconWrap}>
                <CategoryIcon category={category} size={18} />
              </div>
              <div className={styles.catLabel}>{label}</div>
            </div>
            <div className={styles.pickerCol}>
              <div className={styles.emptyAction}>
                <Plus size={16} className={styles.plusIcon} />
                <span>Choisir un composant</span>
              </div>
            </div>
            <div className={styles.priceCol}>
              <span className={`${styles.statusTag} ${isRequired ? styles.statusTagRequired : styles.statusTagOptional}`}>
                {isRequired ? 'Requis' : 'Optionnel'}
              </span>
            </div>
          </Link>
        </div>
      );
    }

    return (
      <div key={slotKey} className={styles.rowWrap}>
        <div
          className={`${styles.row} ${styles.rowFilled}`}
          style={{ cursor: 'default' }}
        >
          <div className={styles.catCol}>
            <div className={styles.catIconWrap}>
              <CategoryIcon category={category} size={18} />
            </div>
            <div className={styles.catLabel}>{label}</div>
          </div>

          <div className={styles.pickerCol}>
            <div className={styles.filledState}>
              {selected.image_url ? (
                <Link
                  to={LinkEngine.getProductUrl(selected)}
                  className={styles.compThumbLink}
                  onClick={e => e.stopPropagation()}
                >
                  <img src={selected.image_url} alt="" className={styles.compThumb} referrerPolicy="no-referrer" />
                </Link>
              ) : null}
              <div className={styles.compInfo}>
                <span className={styles.compBrand}>{selected.brand}</span>
                <Link
                  to={LinkEngine.getProductUrl(selected)}
                  className={styles.compNameLink}
                  onClick={e => e.stopPropagation()}
                >
                  {formatComponentName(selected, { excludeBrand: true })}
                </Link>
                <span className={styles.compSpecs}>{getSpecLine(selected)}</span>
                
                <button
                  type="button"
                  className={`${styles.offersBtn} ${isExpanded ? styles.offersBtnActive : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setExpandedKey(isExpanded ? null : slotKey);
                  }}
                >
                  <Tag size={12} className={styles.tagIcon} />
                  <span>{isExpanded ? 'Masquer les offres' : 'Voir les offres'}</span>
                  <span className={`${styles.chevronIcon} ${isExpanded ? styles.chevronIconOpen : ''}`}>▼</span>
                </button>
              </div>
            </div>
          </div>

          <div className={styles.priceCol}>
            <span className={styles.priceVal}>
              {selected.lowest_price ? formatPrice(selected.lowest_price) : '—'}
            </span>
            <button
              className={styles.actionBtn}
              onClick={(e) => { e.stopPropagation(); removeFromBuild(slotKey); }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {isExpanded && selected && (
          <div className={styles.expandContent}>
            <InlinePrices componentId={selected.id} />
          </div>
        )}
      </div>
    );
  };


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

      <div className={styles.layout}>
        {/* Left Column: Component Lists */}
        <div className={styles.mainColumn}>
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Composants principaux</h2>
            <div className={styles.card}>
              {coreRows.map(renderRow)}
            </div>
          </div>

          {otherRows.length > 0 && (
            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>Logiciel & Périphériques</h2>
              <div className={styles.card}>
                {otherRows.map(renderRow)}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Sticky Sidebar */}
        <div className={styles.sidebar}>
          {/* Unified Sidebar Card */}
          <div className={styles.sidebarCard}>
            <ConfiguratorChecklist checklist={checklist} />
            <ConfiguratorTotals
              hasComponents={hasComponents}
              tdp={tdp}
              psuPercent={psuPercent}
              psuStatus={psuStatus}
              recommendedWattage={compat?.recommended_psu_wattage}
              totalPrice={totalPrice}
              confirmReset={confirmReset}
              onShare={() => setIsShareModalOpen(true)}
              onReset={() => setConfirmReset(true)}
              onResetConfirm={() => { resetBuild(); setConfirmReset(false); }}
              onResetCancel={() => setConfirmReset(false)}
            />
          </div>

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
      </div>

      <ShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        build={build}
        totalPrice={totalPrice}
      />

      {/* Mobile Sticky Summary Bar */}
      {hasComponents && (
        <div className={styles.mobileStickySummary}>
          <div className={styles.mobileSummaryLeft}>
            <span className={styles.mobileTotalLabel}>Total estimé</span>
            <span className={styles.mobileTotalPrice}>{formatPrice(totalPrice)}</span>
          </div>
          <div className={styles.mobileSummaryRight}>
            {compat && (
              <div 
                className={`${styles.mobileCompatDot} ${!compat.compatible 
                  ? styles.mobileCompatFail 
                  : compat.warnings.length > 0 
                    ? styles.mobileCompatWarn 
                    : styles.mobileCompatOk
                }`}
                title={!compat.compatible ? 'Incompatibilités détectées' : compat.warnings.length > 0 ? 'Avertissements détectés' : 'Configuration compatible'}
                onClick={() => {
                  const el = document.querySelector(`.${styles.sidebar}`);
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                {!compat.compatible ? (
                  <><AlertCircle size={14} /> <span className={styles.mobileCompatText}>Incompatible</span></>
                ) : compat.warnings.length > 0 ? (
                  <><AlertCircle size={14} /> <span className={styles.mobileCompatText}>Alerte ({compat.warnings.length})</span></>
                ) : (
                  <><CheckCircle2 size={14} /> <span className={styles.mobileCompatText}>Compatible</span></>
                )}
              </div>
            )}
            <button 
              type="button"
              className={styles.mobileSummaryButton}
              onClick={() => {
                const el = document.querySelector(`.${styles.sidebar}`);
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              Détails
            </button>
          </div>
        </div>
      )}

      {/* ── Print Proposal Sheet (Only visible when printing) ── */}
      <div className={styles.printOnlyContainer}>
        <div className={styles.printHeader}>
          <div className={styles.printHeaderLeft}>
            <h1 className={styles.printBrandName}>PC BUILDER MAROC</h1>
            <p className={styles.printBrandTagline}>Comparateur de prix &amp; Vérificateur de compatibilité</p>
          </div>
          <div className={styles.printHeaderRight}>
            <div className={styles.printDocTitle}>PROPOSITION DE CONFIGURATION</div>
            <div className={styles.printDate}>Date : {new Date().toLocaleDateString('fr-MA', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
          </div>
        </div>

        <table className={styles.printTable}>
          <thead>
            <tr>
              <th style={{ width: '20%', textAlign: 'left' }}>Composant</th>
              <th style={{ width: '40%', textAlign: 'left' }}>Modèle</th>
              <th style={{ width: '25%', textAlign: 'left' }}>Détails</th>
              <th style={{ width: '15%', textAlign: 'right' }}>Meilleur Prix</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(build)
              .filter(([, comp]) => !!comp)
              .map(([slotKey, comp]) => {
                if (!comp) return null;
                return (
                  <tr key={slotKey} className={styles.printTableRow}>
                    <td className={styles.printTableCat}>{slotLabel(slotKey)}</td>
                    <td className={styles.printTableName}>
                      <strong>{comp.brand}</strong> {formatComponentName(comp, { excludeBrand: true })}
                    </td>
                    <td className={styles.printTableSpecs}>{getSpecLine(comp)}</td>
                    <td className={styles.printTablePrice}>
                      {comp.lowest_price ? `${formatPrice(comp.lowest_price)}` : '—'}
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>

        <div className={styles.printSummaryBlock}>
          <div className={styles.printSummaryLeft}>
            <h3 className={styles.printSummaryTitle}>Diagnostic Technique</h3>
            <div className={styles.printDiagList}>
              <div className={styles.printDiagItem}>
                <span className={styles.printDiagIcon}>✓</span>
                <span>Consommation estimée : <strong>{tdp}W</strong></span>
              </div>
              <div className={styles.printDiagItem}>
                <span className={styles.printDiagIcon}>✓</span>
                <span>Alimentation conseillée : <strong>{compat?.recommended_psu_wattage || '—'}W</strong></span>
              </div>
              <div className={styles.printDiagItem}>
                <span className={styles.printDiagIcon}>✓</span>
                <span>
                  {compat?.compatible 
                    ? 'Tous les composants sélectionnés sont compatibles.' 
                    : 'Présence de réserves techniques (vérifier les détails sur le site).'}
                </span>
              </div>
            </div>
          </div>
          <div className={styles.printSummaryRight}>
            <span className={styles.printTotalLabel}>TOTAL ESTIMÉ</span>
            <span className={styles.printTotalPrice}>{formatPrice(totalPrice)}</span>
            <span className={styles.printTotalPriceSub}>*Tarifs indicatifs calculés chez nos marchands partenaires</span>
          </div>
        </div>

        <div className={styles.printAdBox}>
          <div className={styles.printAdText}>
            <h3 className={styles.printAdTitle}>Configurez votre PC idéal sur pcbuilder.ma</h3>
            <p className={styles.printAdDesc}>
              Créez votre setup sur mesure, comparez les prix en temps réel parmi les plus grandes boutiques d'informatique au Maroc (Maroc Gaming, Ultra Gaming, etc.) et optimisez votre investissement en toute simplicité.
            </p>
            <a href={shareUrl} target="_blank" rel="noopener noreferrer" className={styles.printAdLink}>
              {shareUrl}
            </a>
          </div>
          <div className={styles.printAdQr}>
            <img 
              src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(shareUrl)}&color=0c0c0e&bgcolor=ffffff`}
              alt="QR Code de la configuration"
              className={styles.printQrImage}
            />
            <span className={styles.printQrText}>Scanner pour voir en ligne</span>
          </div>
        </div>
      </div>
    </div>
  );
}
