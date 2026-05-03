/**
 * Configurator — the main PC builder table.
 *
 * Features:
 * - Dynamic component slots: RAM and storage rows scale with the motherboard's
 *   slot counts (ram_slots, m2_slots + sata_ports). Defaults to 2 RAM + 2 storage.
 * - Searchable ComponentPicker per slot
 * - Click a selected row to expand inline price comparison
 * - Total price footer row
 * - Integrated compatibility validation
 */

import { useState, useEffect, Fragment } from 'react';
import { ComponentPicker } from './ComponentPicker';
import { InlinePrices } from './InlinePrices';
import { CategoryIcon } from './CategoryIcon';
import type { Component, ComponentCategory, CompatibilityResult } from '../types';
import { CATEGORY_LABELS, RULE_LABELS, slotKeyToCategory, isRamSlotKey, isStorageSlotKey } from '../types';
import { validateBuild } from '../api';
import { useBuild } from '../context/BuildContext';
import { calculateBuildTotalPrice, getConfiguratorSlots, pruneExcessSlots } from '../utils/buildUtils';
import { UI } from '../ui-strings';
import styles from './Configurator.module.css';

/** Human-readable label for a slot key. */
function slotLabel(key: string, slotKeys: string[]): string {
  const cat = slotKeyToCategory(key);
  const base = CATEGORY_LABELS[cat] ?? cat;

  if (isRamSlotKey(key) && key !== 'ram') {
    // Count how many RAM slots exist total
    const ramSlots = slotKeys.filter(isRamSlotKey);
    if (ramSlots.length > 1) {
      const idx = parseInt(key.replace('ram_', ''), 10);
      return `${base} #${idx}`;
    }
  }
  if (isStorageSlotKey(key) && key !== 'storage') {
    const storageSlots = slotKeys.filter(isStorageSlotKey);
    if (storageSlots.length > 1) {
      const idx = parseInt(key.replace('storage_', ''), 10);
      return `${base} #${idx}`;
    }
  }
  return base;
}

export function Configurator() {
  const { build, setBuild } = useBuild();
  const totalPrice = calculateBuildTotalPrice(build);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [compat, setCompat] = useState<CompatibilityResult | null>(null);

  const slotKeys = getConfiguratorSlots(build);
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

  function handleSelect(slotKey: string, component: Component | null) {
    let next = { ...build };
    if (component) {
      next[slotKey] = component;
      // When a motherboard is selected, prune slots that exceed its counts
      if (slotKey === 'motherboard') {
        next = pruneExcessSlots(next);
      }
    } else {
      delete next[slotKey];
      if (expandedKey === slotKey) setExpandedKey(null);
    }
    setBuild(next);
  }

  function toggleExpand(key: string) {
    if (!build[key]) return;
    setExpandedKey(expandedKey === key ? null : key);
  }

  return (
    <section className={styles.configurator}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h2 className={styles.title}>{UI.configurator.title}</h2>
          {compat && (
            <span className={`${styles.badge} ${compat.compatible ? styles.badgeOk : styles.badgeFail}`}>
              {compat.compatible ? UI.configurator.compatible : UI.configurator.incompatible}
            </span>
          )}
        </div>
        <button
          className={styles.resetBtn}
          onClick={() => { setBuild({}); setExpandedKey(null); }}
          disabled={!hasComponents}
        >
          {UI.configurator.reset}
        </button>
      </div>

      {/* Table */}
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.thCat}>{UI.configurator.thComponent}</th>
              <th className={styles.thSel}>{UI.configurator.thSelection}</th>
              <th className={styles.thPrice}>{UI.configurator.thBestPrice}</th>
              <th className={styles.thAct}></th>
            </tr>
          </thead>
          <tbody>
            {slotKeys.map((slotKey) => {
              const category = slotKeyToCategory(slotKey) as ComponentCategory;
              const selected = build[slotKey] ?? null;
              const price = selected ? (selected as Component & { lowest_price?: number | null }).lowest_price : null;
              const isExpanded = expandedKey === slotKey && !!selected;
              const label = slotLabel(slotKey, slotKeys);

              return (
                <Fragment key={slotKey}>
                  <tr
                    className={`${styles.row} ${selected ? styles.rowFilled : ''} ${isExpanded ? styles.rowOpen : ''}`}
                    onClick={() => toggleExpand(slotKey)}
                  >
                    <td className={styles.catCell}>
                      <span className={styles.catLabel}>
                        <CategoryIcon category={category} size={16} className={styles.catIcon} />
                        {label}
                      </span>
                    </td>
                    <td className={styles.selCell} onClick={(e) => e.stopPropagation()}>
                      <ComponentPicker
                        category={category}
                        slotKey={slotKey}
                        selected={selected}
                        build={build}
                        onSelect={(c) => handleSelect(slotKey, c)}
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
                          onClick={(e) => { e.stopPropagation(); handleSelect(slotKey, null); }}
                          title={UI.configurator.removeTitle}
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
                <td colSpan={2} className={styles.totalLabel}>{UI.configurator.totalLabel}</td>
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
          <span>{UI.configurator.allCompatible}</span>
          {compat.total_tdp > 0 && (
            <span className={styles.tdpInfo}>
              {UI.configurator.tdpInfo(compat.total_tdp, compat.recommended_psu_wattage)}
            </span>
          )}
        </div>
      )}
    </section>
  );
}
