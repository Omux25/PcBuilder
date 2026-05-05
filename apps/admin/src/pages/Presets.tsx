import { useEffect, useState, useCallback } from 'react';
import { Pencil, Trash2, Plus } from 'lucide-react';
import { getAdminPresets, deleteAdminPreset, getErrorMessage} from '../api';
import type { AdminPreset } from '../api';
import type { PresetComponent } from '@shared/types';
import { CATEGORY_LABELS } from '@shared/types';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { PresetModal } from '../components/PresetModal';
import styles from './Presets.module.css';

const USE_CASE_LABELS: Record<string, string> = {
  gaming: 'Gaming', workstation: 'Workstation', office: 'Bureau', budget: 'Budget',
};

/** Human-readable label for a slot key (e.g. 'ram_2' → 'RAM #2'). */
function slotLabel(key: string): string {
  const cat = key.replace(/_\d+$/, '');
  const base = CATEGORY_LABELS[cat as keyof typeof CATEGORY_LABELS] ?? cat;
  const match = key.match(/_(\d+)$/);
  return match ? `${base} #${match[1]}` : base;
}

export function Presets() {
  const [presets, setPresets] = useState<AdminPreset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPreset, setEditingPreset] = useState<AdminPreset | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    getAdminPresets()
      .then((data) => setPresets(data.presets ?? []))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleDelete(id: number) {
    setMutationError(null);
    try {
      await deleteAdminPreset(id);
      setConfirmDelete(null);
      load();
    } catch (err: unknown) {
      setConfirmDelete(null);
      setMutationError(getErrorMessage(err));
    }
  }

  function openCreate() {
    setEditingPreset(null);
    setModalOpen(true);
  }

  function openEdit(preset: AdminPreset) {
    setEditingPreset(preset);
    setModalOpen(true);
  }

  return (
    <div className={styles.page}>
      <div className="admin-header">
        <h1>Configurations prédéfinies</h1>
        <button onClick={openCreate} className="btn-primary">
          <Plus size={16} /> Nouvelle configuration
        </button>
      </div>

      {error && <p className="admin-error">{error}</p>}
      {mutationError && <p className="admin-error">{mutationError}</p>}

      {loading ? <p className="admin-loading">Chargement...</p> : (
        presets.length === 0 ? (
          <p className="admin-empty">Aucune configuration. Créez-en une avec le bouton ci-dessus.</p>
        ) : (
          <div className={styles.grid}>
            {presets.map((p) => (
              <div key={p.id} className={`${styles.card} ${p.incomplete ? styles.incomplete : ''}`}>
                <div className={styles.cardHeader}>
                  <div>
                    <div className={styles.cardName}>{p.name}</div>
                    <span className="badge badge-accent">{USE_CASE_LABELS[p.use_case] ?? p.use_case}</span>
                  </div>
                  <div className={styles.cardActions}>
                    <button
                      className={styles.editBtn}
                      onClick={() => openEdit(p)}
                      aria-label={`Modifier ${p.name}`}
                      title="Modifier"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      className={styles.deleteBtn}
                      onClick={() => setConfirmDelete(p.id)}
                      aria-label={`Supprimer ${p.name}`}
                      title="Supprimer"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {p.description && <p className={styles.desc}>{p.description}</p>}

                {p.incomplete && (
                  <p className={styles.incompleteNote}>⚠ Certains composants ne sont plus disponibles.</p>
                )}

                <div className={styles.componentList}>
                  {Object.entries((p.components as Record<string, PresetComponent>) ?? {}).map(([key, comp]) => (
                    <div key={key} className={styles.componentRow}>
                      <span className={styles.cat}>{slotLabel(key)}</span>
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
        <ConfirmDialog
          title="Supprimer cette configuration ?"
          message="Cette action est irréversible."
          confirmLabel="Supprimer"
          danger
          onConfirm={() => handleDelete(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      <PresetModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={load}
        preset={editingPreset}
      />
    </div>
  );
}
