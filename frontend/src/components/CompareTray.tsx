/**
 * CompareTray — floating tray showing selected items for comparison.
 * Allows quick navigation to the Compare page.
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { GitCompare, X, Trash2 } from 'lucide-react';
import { useCompare } from '../context/CompareContext';
import { getComponentById } from '../api';
import type { Component } from '../types';
import styles from './CompareTray.module.css';

export function CompareTray() {
  const { compareIds, removeFromCompare, clearCompare } = useCompare();
  const [items, setItems] = useState<Component[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (compareIds.length === 0) {
      setItems([]);
      return;
    }

    setLoading(true);
    Promise.all(
      compareIds.map(id => getComponentById(id).catch(() => null))
    ).then(results => {
      setItems(results.filter((c): c is Component => c !== null));
    }).finally(() => setLoading(false));
  }, [compareIds]);

  if (compareIds.length === 0) return null;

  function handleGoToCompare() {
    navigate(`/compare?ids=${compareIds.join(',')}`);
  }

  return (
    <div className={styles.tray}>
      <div className={styles.header}>
        <div className={styles.title}>
          <GitCompare size={16} />
          <span>Comparaison ({compareIds.length})</span>
        </div>
        <button className={styles.clearBtn} onClick={clearCompare} title="Tout effacer">
          <Trash2 size={14} />
        </button>
      </div>

      <div className={styles.items}>
        {items.map(item => (
          <div key={item.id} className={styles.item}>
            <div className={styles.itemInfo}>
              <span className={styles.itemName} title={item.name}>{item.name}</span>
            </div>
            <button
              className={styles.removeItem}
              onClick={() => removeFromCompare(item.id)}
              title="Retirer"
            >
              <X size={12} />
            </button>
          </div>
        ))}
        {loading && items.length < compareIds.length && (
          <div className={styles.itemLoading}>...</div>
        )}
      </div>

      <div className={styles.footer}>
        <button
          className={styles.compareBtn}
          onClick={handleGoToCompare}
          disabled={compareIds.length < 2}
        >
          Comparer maintenant
        </button>
      </div>
    </div>
  );
}
