import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { getAdminPresets, deleteAdminPreset } from '../api';
import styles from './Presets.module.css';

const USE_CASE_LABELS: Record<string, string> = {
  gaming: 'Gaming', workstation: 'Workstation', office: 'Bureau', budget: 'Budget',
};

export function Presets() {
  const [presets, setPresets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  function load() {
    setLoading(true);
    getAdminPresets()
      .then((data: any) => setPresets(data.presets ?? []))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function handleDelete(id: number) {
    try {
      await deleteAdminPreset(id);
      setConfirmDelete(null);
      load();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error');
    }
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Configurations predefinies</h1>

      {error && <p className={styles.error}>{error}</p>}
      {loading ? <p className={styles.loading}>Chargement...</p> : (
        presets.length === 0 ? (
          <p className={styles.empty}>Aucune configuration.</p>
        ) : (
          <div className={styles.grid}>
            {presets.map((p) => (
              <div key={p.id} className={`${styles.card} ${p.incomplete ? styles.incomplete : ''}`}>
                <div className={styles.cardHeader}>
                  <div>
                    <div className={styles.cardName}>{p.name}</div>
                    <span className={styles.useCaseBadge}>{USE_CASE_LABELS[p.use_case] ?? p.use_case}</span>
                  </div>
                  <button className={styles.deleteBtn} onClick={() => setConfirmDelete(p.id)}>
                    <Trash2 size={15} />
                  </button>
                </div>

                {p.description && <p className={styles.desc}>{p.description}</p>}

                {p.incomplete && (
                  <p className={styles.incompleteNote}>Certains composants ne sont plus disponibles.</p>
                )}

                <div className={styles.componentList}>
                  {Object.entries(p.components ?? {}).map(([cat, comp]: [string, any]) => (
                    <div key={cat} className={styles.componentRow}>
                      <span className={styles.cat}>{cat}</span>
                      <span className={styles.compName}>{comp.brand ? `${comp.brand} ` : ''}{comp.name}</span>
                    </div>
                  ))}
                </div>

                {p.total_price_estimate && (
                  <div className={styles.price}>~{Number(p.total_price_estimate).toLocaleString('fr-MA')} MAD</div>
                )}
              </div>
            ))}
          </div>
        )
      )}

      {confirmDelete !== null && (
        <div className={styles.overlay}>
          <div className={styles.dialog}>
            <h3>Supprimer cette configuration ?</h3>
            <p>Cette action est irreversible.</p>
            <div className={styles.dialogActions}>
              <button className={styles.cancelBtn} onClick={() => setConfirmDelete(null)}>Annuler</button>
              <button className={styles.confirmBtn} onClick={() => handleDelete(confirmDelete)}>Supprimer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
