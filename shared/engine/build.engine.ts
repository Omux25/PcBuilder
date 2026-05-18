import type { BuildConfig } from '../types.js';
import { CATEGORY_ORDER, CORE_CATEGORIES } from '../constants/build.constants.js';
import { isRamSlotKey, isStorageSlotKey } from '../types.js';

/**
 * Returns the ordered list of slot keys to render in the configurator.
 *
 * RAM and storage use a PCPartPicker-style model:
 * - Only slots that actually contain a component are shown.
 * - The Configurator renders an "+ Add Memory / + Add Storage" button separately.
 * - Compatibility errors fire when the count exceeds the motherboard's capacity.
 *
 * Non-RAM/storage CORE categories are always shown (empty or filled).
 * EXTRA categories are only shown when they contain a component.
 */
export function getConfiguratorSlots(build: BuildConfig): string[] {
  const slots: string[] = [];

  for (const cat of CATEGORY_ORDER) {
    const isCore = CORE_CATEGORIES.includes(cat);

    if (cat === 'ram') {
      // Only include slots that have a component
      for (let i = 1; i <= 8; i++) {
        if (build[`ram_${i}`]) slots.push(`ram_${i}`);
      }
      // Legacy bare 'ram' key (backwards compat)
      if (build['ram']) slots.push('ram');
      continue;
    }

    if (cat === 'storage') {
      // Only include slots that have a component
      for (let i = 1; i <= 8; i++) {
        if (build[`storage_${i}`]) slots.push(`storage_${i}`);
      }
      if (build['storage']) slots.push('storage');
      continue;
    }

    // For all other categories: show if core OR if it has a component
    const hasComponent = isCore || !!build[cat];
    if (hasComponent) slots.push(cat);
  }

  return slots;
}

/**
 * When the motherboard changes and its slot counts decrease, remove any
 * RAM/storage slots that exceed the new board's capacity.
 * Returns the cleaned build.
 */
export function pruneExcessSlots(build: BuildConfig): BuildConfig {
  const motherboard = build['motherboard'];
  const ramSlots = motherboard?.ram_slots ?? 8;
  const storageSlots = (motherboard?.m2_slots ?? 8) + (motherboard?.sata_ports ?? 8);

  const next = { ...build };
  for (const key of Object.keys(next)) {
    if (isRamSlotKey(key) && key !== 'ram') {
      const idx = parseInt(key.replace('ram_', ''), 10);
      if (idx > ramSlots) delete next[key];
    }
    if (isStorageSlotKey(key) && key !== 'storage') {
      const idx = parseInt(key.replace('storage_', ''), 10);
      if (idx > storageSlots) delete next[key];
    }
  }
  return next;
}
