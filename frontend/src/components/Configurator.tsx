/**
 * Configurator — the main PC builder table.
 *
 * Features:
 * - 8 component slots with searchable ComponentPicker
 * - Category icons for visual identification
 * - Click a selected row to expand inline price comparison
 * - Total price footer row
 * - Integrated compatibility validation
 */

import { useState, useEffect, Fragment } from 'react';
import { ComponentPicker } from './ComponentPicker';
import { InlinePrices } from './InlinePrices';
import { CategoryIcon } from './CategoryIcon';
import type { Component, ComponentCategory, CompatibilityResult } from '../types';
import { CATEGORY_LABELS, CATEGORY_ORDER, RULE_LABELS } from '../types';
import { validateBuild } from '../api';
import { useBuild } from '../context/BuildContext';
import { calculateBuildTotalPrice } from '../utils/buildUtils';
import styles from './Configurator.module.css';

export function Configurator() {
  const { build, setBuild } = useBuild();
  const totalPrice = calculateBuildTotalPrice(build);
  const [expandedCat, setExpandedCat] = useState<ComponentCategory | null>(null);
  const [compat, setCompat] = useState<CompatibilityResult | null>(null);

  const hasComponents = Object.keys(build).length > 0;

  useEffect(() => {
    if (!hasComponents) {
      setCompat(null);
      return;
    }
    const timer = setTimeout(() => {
      validateBuild(build).then(setCompat).catch(() => setCompat(null));
    }, 300);
    return () => clearTimeout(timer);
  }, [build, hasComponents]);

  function handleSelect(category: ComponentCategory, component: Component | null) {
    const next = { ...build };
    if (component) {
      next[category] = component;
    } else {
      delete next[category];
      if (expandedCat === category) setExpandedCat(null);
    }
    setBuild(next);
  }

  function toggleExpand(cat: ComponentCategory) {
    if (!build[cat]) return;
    setExpandedCat(expandedCat === cat ? null : cat);
  }

  return (
    <section className={styles.configurator}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h2 className={styles.title}>Configurateur</h2>
          {compat && (
            <span className={`${styles.badge} ${compat.compatible ? styles.badgeOk : styles.badgeFail}`}>
              {compat.compatible ? '✓ Compatible' : '✗ Problèmes'}
            </span>
          )}
        </div>
        <button
          className={styles.resetBtn}
          onClick={() => { setBuild({}); setExpandedCat(null); }}
          disabled={!hasComponents}
        >
          Réinitialiser
        </button>
      </div>

      {/* Table */}
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.thCat}>Composant</th>
              <th className={styles.thSel}>Sélection</th>
              <th className={styles.thPrice}>Meilleur prix</th>
              <th className={styles.thAct}></th>
            </tr>
          </thead>
          <tbody>
            {CATEGORY_ORDER.map((cat) => {
              const selected = build[cat];
              const price = selected ? (selected as Component & { lowest_price?: number | null }).lowest_price : null;
              const isExpanded = expandedCat === cat && !!selected;

              return (
                <Fragment key={cat}>
                  <tr
                    className={`${styles.row} ${selected ? styles.rowFilled : ''} ${isExpanded ? styles.rowOpen : ''}`}
                    onClick={() => toggleExpand(cat)}
                  >
                    <td className={styles.catCell}>
                      <span className={styles.catLabel}>
                        <CategoryIcon category={cat} size={16} className={styles.catIcon} />
                        {CATEGORY_LABELS[cat]}
                      </span>
                    </td>
                    <td className={styles.selCell} onClick={(e) => e.stopPropagation()}>
                      <ComponentPicker
                        category={cat}
                        selected={selected ?? null}
                        build={build}
                        onSelect={(c) => handleSelect(cat, c)}
                      />
                    </td>
                    <td className={styles.priceCell}>
                      {selected && (
                        <div className={styles.priceWrap}>
                          <span className={styles.priceVal}>
                            {price ? `${price.toLocaleString('fr-MA')} MAD` : '—'}
                          </span>
                          <span className={styles.chevron}>▼</span>
                        </div>
                      )}
                    </td>
                    <td className={styles.actCell}>
                      {selected && (
                        <button
                          className={styles.removeBtn}
                          onClick={(e) => { e.stopPropagation(); handleSelect(cat, null); }}
                          title="Retirer"
                        >
                          ×
                        </button>
                      )}
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr className={styles.expandRow}>
                      <td colSpan={4} className={styles.expandCell}>
                        <InlinePrices componentId={selected!.id} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
          {hasComponents && (
            <tfoot>
              <tr className={styles.totalRow}>
                <td colSpan={2} className={styles.totalLabel}>Total estimé</td>
                <td className={styles.totalVal}>
                  {totalPrice > 0 ? `${totalPrice.toLocaleString('fr-MA')} MAD` : '—'}
                </td>
                <td></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Compatibility footer */}
      {compat && (compat.errors.length > 0 || compat.warnings.length > 0) && (
        <div className={styles.compatFooter}>
          {compat.errors.map((e, i) => (
            <div key={`e${i}`} className={styles.compatErr}>
              <span className={styles.compatIcon}>✗</span>
              <strong>{RULE_LABELS[e.rule] ?? e.rule}</strong>
              <span>{e.message}</span>
            </div>
          ))}
          {compat.warnings.map((w, i) => (
            <div key={`w${i}`} className={styles.compatWarn}>
              <span className={styles.compatIcon}>⚠</span>
              <strong>{RULE_LABELS[w.rule] ?? w.rule}</strong>
              <span>{w.message}</span>
            </div>
          ))}
        </div>
      )}

      {compat && compat.compatible && compat.errors.length === 0 && compat.warnings.length === 0 && (
        <div className={styles.compatOk}>
          <span>✓ Tous les composants sont compatibles</span>
          {compat.total_tdp > 0 && (
            <span className={styles.tdpInfo}>
              TDP : {compat.total_tdp}W · PSU recommandé : {compat.recommended_psu_wattage}W
            </span>
          )}
        </div>
      )}
    </section>
  );
}
