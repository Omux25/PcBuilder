import { Check } from 'lucide-react';
import styles from './Configurator.module.css';

export interface ChecklistItem {
  key: string;
  label: string;
  checked: boolean;
}

interface ConfiguratorChecklistProps {
  checklist: ChecklistItem[];
}

export function ConfiguratorChecklist({ checklist }: ConfiguratorChecklistProps) {
  const checkedCount = checklist.filter(item => item.checked).length;
  const totalCount = checklist.length;
  const progressPercent = (checkedCount / totalCount) * 100;

  return (
    <div className={styles.checklistSection}>
      <div className={styles.checklistHeader}>
        <h3 className={styles.checklistTitle}>Guide de Configuration</h3>
        <span className={styles.checklistProgress}>{checkedCount} / {totalCount}</span>
      </div>
      <div className={styles.checklistBar}>
        <div 
          className={styles.checklistBarFill} 
          style={{ width: `${progressPercent}%` }}
        />
      </div>
      <ul className={styles.checklistGrid}>
        {checklist.map(item => (
          <li 
            key={item.key} 
            className={`${styles.checklistItem} ${item.checked ? styles.checkedItem : ''}`}
          >
            {item.checked ? (
              <Check size={12} className={styles.checkIconActive} />
            ) : (
              <span className={styles.checkIconPending} />
            )}
            <span className={styles.checkLabel}>{item.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
