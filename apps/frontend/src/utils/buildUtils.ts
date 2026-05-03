import type { BuildConfig, Component } from '../types';
import { CATEGORY_ORDER, isRamSlotKey, isStorageSlotKey } from '../types';

/** Compute total estimated price from the current build. */
export function calculateBuildTotalPrice(build: BuildConfig): number {
  return Object.entries(build).reduce((sum, [, comp]) => {
    if (!comp) return sum;
    const price = (comp as Component & { lowest_price?: number | null }).lowest_price;
    return price ? sum + price : sum;
  }, 0);
}

/**
 * Returns the ordered list of slot keys to render in the configurator.
 * Single-slot categories use their plain name.
 * RAM and storage use indexed keys (ram_1, ram_2, ...) based on the
 * motherboard's slot counts, with sensible defaults when no board is selected.
 */
export function getConfiguratorSlots(build: BuildConfig): string[] {
  const motherboard = build['motherboard'];
  const ramSlots = motherboard?.ram_slots ?? 2;
  const storageSlots = (motherboard?.m2_slots ?? 1) + (motherboard?.sata_ports ?? 1);

  const slots: string[] = [];
  for (const cat of CATEGORY_ORDER) {
    if (cat === 'ram') {
      for (let i = 1; i <= ramSlots; i++) slots.push(`ram_${i}`);
    } else if (cat === 'storage') {
      for (let i = 1; i <= storageSlots; i++) slots.push(`storage_${i}`);
    } else {
      slots.push(cat);
    }
  }
  return slots;
}

/**
 * When the motherboard changes and its slot counts decrease, remove any
 * RAM/storage slots that no longer fit. Returns the cleaned build.
 */
export function pruneExcessSlots(build: BuildConfig): BuildConfig {
  const motherboard = build['motherboard'];
  const ramSlots = motherboard?.ram_slots ?? 4; // be generous when pruning
  const storageSlots = (motherboard?.m2_slots ?? 4) + (motherboard?.sata_ports ?? 4);

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
