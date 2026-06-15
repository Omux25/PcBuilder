/**
 * BuildContext — global state for the current PC build configuration.
 *
 * Eliminates prop-drilling of `build`, `onChange`, and `onAddToBuild`
 * through the entire component tree.
 *
 * Multi-slot support: RAM and storage use indexed keys (ram_1, ram_2, etc.).
 * addToBuild() places a component into the first available slot for its category.
 */

import { createContext, useContext, useState, useCallback, useEffect, useMemo, type ReactNode } from 'react';
import type { BuildConfig, Component, ComponentCategory, CompatibilityResult } from '../types';
import { validateCompatibility } from '@shared/engine/compatibility.engine';
import { getComponentsByIds, getSharedBuild } from '../api';
import {
  saveBuildToStorage,
  loadBuildFromStorage,
  clearBuildStorage,
  decodeBuildFromUrl,
} from '../utils/buildUrl';
import { pruneExcessSlots } from '@shared/engine/build.engine';

interface BuildContextValue {
  build: BuildConfig;
  analysis: CompatibilityResult | null;
  setBuild: (build: BuildConfig) => void;
  addToBuild: (component: Component, specificSlotKey?: string) => void;
  removeFromBuild: (slotKey: string) => void;
  resetBuild: () => void;
  initializing: boolean;
}

const BuildContext = createContext<BuildContextValue | null>(null);

/** Find the first available slot key for a given category in the current build. */
function findNextSlot(build: BuildConfig, category: ComponentCategory): string {
  if (category === 'ram') {
    for (let i = 1; i <= 8; i++) {
      if (!build[`ram_${i}`]) return `ram_${i}`;
    }
    return 'ram_1'; // fallback: overwrite slot 1
  }
  if (category === 'storage') {
    for (let i = 1; i <= 8; i++) {
      if (!build[`storage_${i}`]) return `storage_${i}`;
    }
    return 'storage_1'; // fallback: overwrite slot 1
  }
  return category;
}

export function BuildProvider({ children }: { children: ReactNode }) {
  const [build, setBuildState] = useState<BuildConfig>({});
  const [initializing, setInitializing] = useState(true);

  // Restore build from URL params or localStorage on mount
  useEffect(() => {
    async function restoreBuild() {
      let idMap: Record<string, number> = {};
      const params = new URLSearchParams(window.location.search);
      const shareId = params.get('s');

      if (shareId) {
        try {
          idMap = await getSharedBuild(shareId);
        } catch (err) {
          console.error('Failed to fetch shared build:', err);
        }
      } else {
        const urlIds = decodeBuildFromUrl(window.location.search);
        const storageIds = loadBuildFromStorage();
        idMap = Object.keys(urlIds).length > 0 ? urlIds : storageIds;
      }
      const ids = [...new Set(Object.values(idMap).filter(Boolean) as number[])];

      if (ids.length === 0) {
        setInitializing(false);
        return;
      }

      try {
        const components = await getComponentsByIds(ids);
        // Map component IDs back to their slot keys
        const idToComponent = new Map(components.map(c => [c.id, c]));
        const restored: BuildConfig = {};
        for (const [key, id] of Object.entries(idMap)) {
          const comp = idToComponent.get(id);
          if (comp) restored[key] = comp;
        }
        setBuildState(restored);
      } catch (err) {
        console.error('Failed to restore build:', err);
      } finally {
        setInitializing(false);
      }
    }
    restoreBuild();
  }, []);

  // Persist to localStorage on every change
  useEffect(() => {
    if (initializing) return;
    if (Object.keys(build).length > 0) saveBuildToStorage(build);
    else clearBuildStorage();
  }, [build, initializing]);

  const setBuild = useCallback((newBuild: BuildConfig) => {
    setBuildState(newBuild);
  }, []);

  /**
   * Add a component to the build.
   * - RAM → placed in the first empty ram_N slot
   * - Storage → placed in the first empty storage_N slot
   * - Everything else → keyed by category name directly
   *
   * When a motherboard is added, prune any slots that exceed the new board's counts.
   */
  const addToBuild = useCallback((component: Component, specificSlotKey?: string) => {
    setBuildState(prev => {
      const slotKey = specificSlotKey || findNextSlot(prev, component.category as ComponentCategory);
      const next = { ...prev, [slotKey]: component };
      // If a motherboard was just added, prune excess RAM/storage slots
      if (component.category === 'motherboard') {
        return pruneExcessSlots(next);
      }
      return next;
    });
  }, []);

  const removeFromBuild = useCallback((slotKey: string) => {
    setBuildState(prev => {
      const next = { ...prev };
      delete next[slotKey];
      return next;
    });
  }, []);

  const resetBuild = useCallback(() => {
    setBuildState({});
  }, []);

  const analysis = useMemo(() => {
    if (Object.keys(build).length === 0) return null;
    return validateCompatibility(build);
  }, [build]);

  return (
    <BuildContext.Provider value={{ build, analysis, setBuild, addToBuild, removeFromBuild, resetBuild, initializing }}>
      {children}
    </BuildContext.Provider>
  );
}

export function useBuild(): BuildContextValue {
  const ctx = useContext(BuildContext);
  if (!ctx) throw new Error('useBuild must be used inside <BuildProvider>');
  return ctx;
}
