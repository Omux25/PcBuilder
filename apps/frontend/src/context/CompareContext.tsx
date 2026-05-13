/**
 * CompareContext — global state for the comparison list.
 * Persists selected component IDs in localStorage.
 */

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

interface CompareContextType {
  compareIds: number[];
  compareCategory: string | null;
  addToCompare: (id: number, category: string) => void;
  removeFromCompare: (id: number) => void;
  clearCompare: () => void;
  isInCompare: (id: number) => boolean;
}

const CompareContext = createContext<CompareContextType | undefined>(undefined);

const STORAGE_KEY = 'pcbuilder_compare';
const CAT_STORAGE_KEY = 'pcbuilder_compare_cat';
export const MAX_COMPARE = 4;

export function CompareProvider({ children }: { children: ReactNode }) {
  const [compareIds, setCompareIds] = useState<number[]>([]);
  const [compareCategory, setCompareCategory] = useState<string | null>(null);

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    const savedCat = localStorage.getItem(CAT_STORAGE_KEY);
    if (saved) {
      try {
        setCompareIds(JSON.parse(saved).map(Number).filter(Boolean).slice(0, MAX_COMPARE));
        setCompareCategory(savedCat);
      } catch {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(CAT_STORAGE_KEY);
      }
    }
  }, []);

  // Sync to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(compareIds));
    if (compareCategory) localStorage.setItem(CAT_STORAGE_KEY, compareCategory);
    else localStorage.removeItem(CAT_STORAGE_KEY);
  }, [compareIds, compareCategory]);

  const addToCompare = (id: number, category: string) => {
    if (compareIds.length > 0 && compareCategory && compareCategory !== category) {
      // In a real app we'd use a toast, for now we just block
      console.warn('Cannot compare different categories');
      return;
    }

    setCompareIds(prev => {
      if (prev.includes(id)) return prev;
      if (prev.length >= MAX_COMPARE) return prev;
      if (prev.length === 0) setCompareCategory(category);
      return [...prev, id];
    });
  };

  const removeFromCompare = (id: number) => {
    setCompareIds(prev => {
      const next = prev.filter(i => i !== id);
      if (next.length === 0) setCompareCategory(null);
      return next;
    });
  };

  const clearCompare = () => {
    setCompareIds([]);
    setCompareCategory(null);
  };

  const isInCompare = (id: number) => compareIds.includes(id);

  return (
    <CompareContext.Provider value={{ 
      compareIds, 
      compareCategory, 
      addToCompare, 
      removeFromCompare, 
      clearCompare, 
      isInCompare 
    }}>
      {children}
    </CompareContext.Provider>
  );
}

export function useCompare() {
  const context = useContext(CompareContext);
  if (!context) throw new Error('useCompare must be used within a CompareProvider');
  return context;
}
