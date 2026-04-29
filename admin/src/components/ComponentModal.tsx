import { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { createAdminComponent, updateAdminComponent } from '../api';
import type { AdminComponent } from '../api';
import styles from './Form.module.css';

const CATEGORIES = ['cpu', 'motherboard', 'gpu', 'ram', 'storage', 'psu', 'case', 'cooling'];

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  component: AdminComponent | null;
}

export function ComponentModal({ isOpen, onClose, onSaved, component }: Props) {
  const [formData, setFormData] = useState({
    name: '',
    brand: '',
    category: 'cpu',
    description: '',
    release_year: new Date().getFullYear(),
    specs: '{}',
    is_active: true,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (component) {
      setFormData({
        name: component.name,
        brand: String(component.brand ?? ''),
        category: component.category,
        description: String(component.description ?? ''),
        release_year: Number(component.release_year ?? new Date().getFullYear()),
        specs: JSON.stringify(component.specs ?? {}, null, 2),
        is_active: component.is_active,
      });
    } else {
      setFormData({
        name: '',
        brand: '',
        category: 'cpu',
        description: '',
        release_year: new Date().getFullYear(),
        specs: '{\n  \n}',
        is_active: true,
      });
    }
    setError(null);
    setValidationErrors({});
  }, [component, isOpen]);

  function validate() {
    const errors: Record<string, string> = {};
    if (!formData.name.trim()) errors.name = 'Le nom est requis.';
    if (!CATEGORIES.includes(formData.category)) errors.category = 'Catégorie invalide.';
    
    try {
      if (formData.specs.trim()) {
        const parsed = JSON.parse(formData.specs);
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
          errors.specs = 'Doit être un objet JSON valide ({}).';
        }
      }
    } catch {
      errors.specs = 'JSON invalide.';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setError(null);

    const payload = {
      ...formData,
      specs: formData.specs.trim() ? JSON.parse(formData.specs) : {},
    };

    try {
      if (component) {
        await updateAdminComponent(component.id, payload);
      } else {
        await createAdminComponent(payload);
      }
      onSaved();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur inattendue');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      title={component ? 'Modifier le composant' : 'Nouveau composant'}
      isOpen={isOpen}
      onClose={onClose}
    >
      <form className={styles.form} onSubmit={handleSubmit}>
        {error && <div className={styles.errorText}>{error}</div>}

        <div className={styles.formGroup}>
          <label>Nom du composant</label>
          <input
            className={styles.input}
            type="text"
            value={formData.name}
            onChange={e => setFormData({ ...formData, name: e.target.value })}
            placeholder="Ex: Ryzen 5 7600"
          />
          {validationErrors.name && <span className={styles.errorText}>{validationErrors.name}</span>}
        </div>

        <div style={{ display: 'flex', gap: '1rem' }}>
          <div className={styles.formGroup} style={{ flex: 1 }}>
            <label>Marque</label>
            <input
              className={styles.input}
              type="text"
              value={formData.brand}
              onChange={e => setFormData({ ...formData, brand: e.target.value })}
              placeholder="Ex: AMD"
            />
          </div>

          <div className={styles.formGroup} style={{ flex: 1 }}>
            <label>Catégorie</label>
            <select
              className={styles.select}
              value={formData.category}
              onChange={e => setFormData({ ...formData, category: e.target.value })}
            >
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        <div className={styles.formGroup}>
          <label>Description</label>
          <textarea
            className={styles.textarea}
            value={formData.description}
            onChange={e => setFormData({ ...formData, description: e.target.value })}
            placeholder="Description courte..."
            style={{ minHeight: '60px' }}
          />
        </div>

        <div className={styles.formGroup}>
          <label>Spécifications (JSON)</label>
          <textarea
            className={styles.textarea}
            value={formData.specs}
            onChange={e => setFormData({ ...formData, specs: e.target.value })}
            placeholder='{\n  "socket": "AM5",\n  "cores": 6\n}'
            style={{ fontFamily: 'monospace' }}
          />
          {validationErrors.specs && <span className={styles.errorText}>{validationErrors.specs}</span>}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className={styles.formGroup}>
            <label>Année de sortie</label>
            <input
              className={styles.input}
              type="number"
              value={formData.release_year}
              onChange={e => setFormData({ ...formData, release_year: parseInt(e.target.value) || new Date().getFullYear() })}
              style={{ width: '120px' }}
            />
          </div>

          <label className={styles.checkboxGroup} style={{ marginTop: '1rem' }}>
            <input
              type="checkbox"
              checked={formData.is_active}
              onChange={e => setFormData({ ...formData, is_active: e.target.checked })}
            />
            Actif
          </label>
        </div>

        <div className={styles.actions}>
          <button type="button" className={styles.cancelBtn} onClick={onClose} disabled={loading}>
            Annuler
          </button>
          <button type="submit" className={styles.submitBtn} disabled={loading}>
            {loading ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
