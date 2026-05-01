/**
 * BuildContext — global state for the current PC build configuration.
 *
 * Eliminates prop-drilling of `build`, `onChange`, and `onAddToBuild`
 * through the entire component tree.
 *
 * Usage:
 *   const { build, setBuild, addToBuild } = useBuild();
 */

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import type { BuildConfig, Component, ComponentCategory } from '../types';
import { getComponentsByIds } from '../api';
import {
  saveBuildToStorage,
  loadBuildFromStorage,
  clearBuildStorage,
  decodeBuildFromUrl,
} from '../utils/buildUrl';

interface BuildContextValue {
  build: BuildConfig;
  setBuild: (build: BuildConfig) => void;
  addToBuild: (component: Component) => void;
  removeFromBuild: (category: ComponentCategory) => void;
  resetBuild: () => void;
  initializing: boolean;
}

const BuildContext = createContext<BuildContextValue | null>(null);

export function BuildProvider({ children }: { children: ReactNode }) {
  const [build, setBuildState]  = useState<BuildConfig>({});
  const [initializing, setInitializing] = useState(true);

  // Restore build from URL params or localStorage on mount
  useEffect(() => {
    async function restoreBuild() {
      const urlIds     = decodeBuildFromUrl(window.location.search);
      const storageIds = loadBuildFromStorage();
      const idMap = Object.keys(urlIds).length > 0 ? urlIds : storageIds;
      const ids   = Object.values(idMap).filter(Boolean) as number[];

      if (ids.length === 0) {
        setInitializing(false);
        return;
      }

      try {
        const components = await getComponentsByIds(ids);
        const restored: BuildConfig = {};
        components.forEach(c => {
          restored[c.category as ComponentCategory] = c;
        });
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

  const addToBuild = useCallback((component: Component) => {
    setBuildState(prev => ({ ...prev, [component.category]: component }));
  }, []);

  const removeFromBuild = useCallback((category: ComponentCategory) => {
    setBuildState(prev => {
      const next = { ...prev };
      delete next[category];
      return next;
    });
  }, []);

  const resetBuild = useCallback(() => {
    setBuildState({});
  }, []);

  return (
    <BuildContext.Provider value={{ build, setBuild, addToBuild, removeFromBuild, resetBuild, initializing }}>
      {children}
    </BuildContext.Provider>
  );
}

export function useBuild(): BuildContextValue {
  const ctx = useContext(BuildContext);
  if (!ctx) throw new Error('useBuild must be used inside <BuildProvider>');
  return ctx;
}
