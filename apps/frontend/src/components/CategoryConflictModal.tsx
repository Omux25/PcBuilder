import { useCompare } from '../context/CompareContext';
import { CATEGORY_LABELS, type ComponentCategory } from '../types';
import { GitCompare, AlertTriangle } from 'lucide-react';
import styles from './CategoryConflictModal.module.css';

export function CategoryConflictModal() {
  const { categoryConflict, clearCategoryConflict, clearCompare, addToCompare, compareCategory } = useCompare();

  if (!categoryConflict) return null;

  const currentLabel = compareCategory ? CATEGORY_LABELS[compareCategory as ComponentCategory] : 'composants';
  const targetLabel = CATEGORY_LABELS[categoryConflict.category as ComponentCategory] || 'composant';

  function handleOverride() {
    clearCompare();
    addToCompare(categoryConflict.id, categoryConflict.category, categoryConflict.name);
    clearCategoryConflict();
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.modal} role="dialog" aria-modal="true">
        <div className={styles.header}>
          <div className={styles.iconWrap}>
            <AlertTriangle className={styles.alertIcon} size={24} />
          </div>
          <h3 className={styles.title}>Changer de Catégorie ?</h3>
        </div>
        
        <div className={styles.body}>
          <p className={styles.text}>
            Vous comparez actuellement des <strong>{currentLabel}</strong>. 
            Impossible d'y ajouter le produit <em>{categoryConflict.name}</em> (qui est de la catégorie <strong>{targetLabel}</strong>).
          </p>
          <p className={styles.textSecondary}>
            Souhaitez-vous vider votre sélection de comparaison actuelle pour comparer cette nouvelle catégorie à la place ?
          </p>
        </div>

        <div className={styles.footer}>
          <button 
            type="button" 
            className={styles.cancelBtn} 
            onClick={clearCategoryConflict}
          >
            Conserver l'ancienne
          </button>
          <button 
            type="button" 
            className={styles.overrideBtn} 
            onClick={handleOverride}
          >
            <GitCompare size={14} />
            <span>Vider et Comparer</span>
          </button>
        </div>
      </div>
    </div>
  );
}
