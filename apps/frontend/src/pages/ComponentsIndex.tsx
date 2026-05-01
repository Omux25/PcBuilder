/**
 * ComponentsIndex — landing page for /components
 * Shows all 8 categories as cards with a count and link to browse.
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getComponents } from '../api';
import { CategoryIcon } from '../components/CategoryIcon';
import type { ComponentCategory } from '../types';
import { CATEGORY_LABELS, CATEGORY_ORDER } from '../types';
import styles from './ComponentsIndex.module.css';

interface CategoryStat {
  category: ComponentCategory;
  count: number;
}

export function ComponentsIndex() {
  const [stats, setStats] = useState<CategoryStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all(
      CATEGORY_ORDER.map(cat =>
        getComponents({ category: cat, limit: 1 }).then(({ total }) => ({ category: cat, count: total }))
      )
    ).then(setStats).finally(() => setLoading(false));
  }, []);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Catalogue de composants</h1>
        <p className={styles.subtitle}>
          Parcourez notre catalogue de composants PC avec comparaison de prix en temps réel.
        </p>
      </div>

      <div className={styles.grid}>
        {CATEGORY_ORDER.map(cat => {
          const stat = stats.find(s => s.category === cat);
          return (
            <Link key={cat} to={`/browse/${cat}`} className={styles.card}>
              <div className={styles.cardIcon}>
                <CategoryIcon category={cat} size={28} />
              </div>
              <div className={styles.cardInfo}>
                <h2 className={styles.cardTitle}>{CATEGORY_LABELS[cat]}</h2>
                <p className={styles.cardCount}>
                  {loading ? '…' : `${stat?.count ?? 0} composant${(stat?.count ?? 0) !== 1 ? 's' : ''}`}
                </p>
              </div>
              <span className={styles.cardArrow}>→</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
