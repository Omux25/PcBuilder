/**
 * ComponentsIndex — landing page for /components
 * Shows all 8 categories as cards with a count and link to browse.
 */

import { Link } from 'react-router-dom';
import { CategoryIcon } from '../components/CategoryIcon';
import type { ComponentCategory } from '../types';
import { CATEGORY_LABELS, CORE_CATEGORIES, CATEGORY_GROUPS, CATEGORY_SLUGS } from '../types';
import { UI } from '../ui-strings';
import { SEO } from '../components/SEO';
import styles from './ComponentsIndex.module.css';

export function ComponentsIndex() {
  const renderGrid = (categories: ComponentCategory[], isCore = false) => (
    <div className={`${styles.grid} ${isCore ? styles.coreGrid : ''}`}>
      {categories.map(cat => (
        <Link key={cat} to={`/parcourir/${CATEGORY_SLUGS[cat] || cat}`} className={`${styles.card} ${isCore ? styles.coreCard : ''}`}>
          <div className={styles.cardBgIcon}>
            <CategoryIcon category={cat} size={isCore ? 120 : 100} />
          </div>
          <div className={styles.cardIcon}>
            <CategoryIcon category={cat} size={isCore ? 32 : 24} />
          </div>
          <div className={styles.cardInfo}>
            <h2 className={styles.cardTitle}>{CATEGORY_LABELS[cat]}</h2>
          </div>
          <span className={styles.cardArrow}>→</span>
        </Link>
      ))}
    </div>
  );

  return (
    <div className={styles.page}>
      <SEO 
        title="Catalogue des Composants PC"
        description="Parcourez notre catalogue complet de composants PC : Processeurs, Cartes graphiques, Cartes mères, Mémoire RAM, Stockage et plus encore."
      />
      <div className={styles.header}>
        <h1 className={styles.title}>{UI.componentsIndex.title}</h1>
        <p className={styles.subtitle}>{UI.componentsIndex.subtitle}</p>
      </div>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Composants principaux</h2>
        {renderGrid(CORE_CATEGORIES, true)}
      </section>

      {CATEGORY_GROUPS.map(group => (
        <section key={group.label} className={styles.section}>
          <h2 className={styles.sectionTitle}>{group.label}</h2>
          {renderGrid(group.categories)}
        </section>
      ))}
    </div>
  );
}
