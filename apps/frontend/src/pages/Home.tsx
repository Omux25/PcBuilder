import { Link } from 'react-router-dom';
import { 
  Gamepad2, 
  Zap, 
  History, 
  ShieldCheck, 
  LayoutGrid, 
  ChevronRight
} from 'lucide-react';
import { CATEGORY_LABELS } from '../types';
import { CategoryIcon } from '../components/CategoryIcon';
import { UI } from '../ui-strings';
import styles from './Home.module.css';

const FEATURED_CATEGORIES: (keyof typeof CATEGORY_LABELS)[] = [
  'cpu', 'gpu', 'motherboard', 'ram', 'storage', 'monitor', 'mouse'
];

export function Home() {
  return (
    <div className={styles.home}>
      {/* ── Hero Section ────────────────────────────────────────────────── */}
      <header className={styles.hero}>
        <div className={styles.heroContent}>
          <div className={styles.heroBadge}>
            <Zap size={14} />
            <span>Nouveau: Configs 2026</span>
          </div>
          <h1 className={styles.heroTitle}>
            {UI.home.heroTitle}
            <span className={styles.heroAccent}>{UI.home.heroTitleAccent}</span>
          </h1>
          <p className={styles.heroSubtitle}>
            {UI.home.heroSubtitle}
          </p>
          <div className={styles.heroActions}>
            <Link to="/build" className={styles.ctaPrimary}>
              <Gamepad2 size={20} />
              {UI.home.ctaBuild}
            </Link>
            <Link to="/components" className={styles.ctaSecondary}>
              <LayoutGrid size={20} />
              {UI.home.ctaBrowse}
            </Link>
          </div>
        </div>
        <div className={styles.heroVisual}>
          <div className={styles.heroImageWrap}>
            <img 
              src="/premium_pc_hero.png" 
              alt="Premium PC Build" 
              className={styles.heroImage} 
            />
            <div className={styles.heroImageGlow} />
          </div>
        </div>
      </header>

      {/* ── Features Section ────────────────────────────────────────────── */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>{UI.home.sections.why}</h2>
        <div className={styles.features}>
          <div className={styles.featureCard}>
            <div className={styles.featureIcon}>
              <ShieldCheck size={24} />
            </div>
            <h3 className={styles.featureTitle}>{UI.home.features[0].title}</h3>
            <p className={styles.featureDesc}>{UI.home.features[0].desc}</p>
          </div>
          <div className={styles.featureCard}>
            <div className={styles.featureIcon}>
              <Zap size={24} />
            </div>
            <h3 className={styles.featureTitle}>{UI.home.features[1].title}</h3>
            <p className={styles.featureDesc}>{UI.home.features[1].desc}</p>
          </div>
          <div className={styles.featureCard}>
            <div className={styles.featureIcon}>
              <History size={24} />
            </div>
            <h3 className={styles.featureTitle}>{UI.home.features[2].title}</h3>
            <p className={styles.featureDesc}>{UI.home.features[2].desc}</p>
          </div>
        </div>
      </section>

      {/* ── Categories Section ──────────────────────────────────────────── */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>{UI.home.sections.categories}</h2>
        <div className={styles.categoriesGrid}>
          {FEATURED_CATEGORIES.map(cat => (
            <Link key={cat} to={`/browse/${cat}`} className={styles.categoryCard}>
              <CategoryIcon category={cat} size={32} className={styles.categoryIcon} />
              <span className={styles.categoryName}>{CATEGORY_LABELS[cat]}</span>
              <ChevronRight size={14} className={styles.categoryArrow} />
            </Link>
          ))}
          <Link to="/components" className={styles.categoryCard}>
            <LayoutGrid size={32} className={styles.categoryIcon} />
            <span className={styles.categoryName}>Tout voir</span>
            <ChevronRight size={14} className={styles.categoryArrow} />
          </Link>
        </div>
      </section>

      {/* ── Presets CTA ─────────────────────────────────────────────────── */}
      <section className={styles.section}>
        <div className={styles.presetsCta}>
          <div className={styles.presetsContent}>
            <h2 className={styles.presetsTitle}>{UI.home.sections.presets}</h2>
            <p className={styles.presetsDesc}>
              Besoin d'inspiration ? Découvrez nos configurations optimisées pour le gaming, le travail ou le budget.
            </p>
            <Link to="/presets" className={styles.ctaSecondary}>
              Voir les configurations
            </Link>
          </div>
          <div className={styles.presetsVisual}>
             <div className={styles.floatingCard} style={{ top: '10%', left: '10%' }}>Gaming Ultra</div>
             <div className={styles.floatingCard} style={{ bottom: '15%', right: '5%' }}>Workstation Pro</div>
             <div className={styles.floatingCard} style={{ top: '40%', right: '20%' }}>Budget King</div>
          </div>
        </div>
      </section>
    </div>
  );
}
