import { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { createAdminComponent, updateAdminComponent } from '../api';
import type { AdminComponent } from '../api';
import { CATEGORY_ORDER } from '@shared/types';
import styles from './Form.module.css';
import formLayout from './FormLayout.module.css';

// Category-specific required fields
const CATEGORY_FIELDS: Record<string, { key: string; label: string; type: 'text' | 'number'; placeholder: string }[]> = {
  cpu: [{ key: 'socket', label: 'Socket', type: 'text', placeholder: 'Ex: AM5, LGA1700' }],
  motherboard: [
    { key: 'socket', label: 'Socket', type: 'text', placeholder: 'Ex: AM5' },
    { key: 'max_ram_frequency', label: 'Fréq. RAM max (MHz)', type: 'number', placeholder: 'Ex: 6000' },
  ],
  gpu: [{ key: 'length_mm', label: 'Longueur (mm)', type: 'number', placeholder: 'Ex: 320' }],
  ram: [{ key: 'frequency_mhz', label: 'Fréquence (MHz)', type: 'number', placeholder: 'Ex: 6000' }],
  psu: [{ key: 'wattage', label: 'Puissance (W)', type: 'number', placeholder: 'Ex: 850' }],
  case: [{ key: 'max_gpu_length_mm', label: 'GPU max (mm)', type: 'number', placeholder: 'Ex: 380' }],
  storage: [],
  cooling: [],
};

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  component: AdminComponent | null;
}

type FormData = {
  name: string;
  brand: string;
  category: string;
  description: string;
  release_year: number;
  specs: string;
  is_active: boolean;
  socket: string;
  max_ram_frequency: string;
  length_mm: string;
  frequency_mhz: string;
  wattage: string;
  max_gpu_length_mm: string;
};

const emptyForm = (): FormData => ({
  name: '',
  brand: '',
  category: 'cpu',
  description: '',
  release_year: new Date().getFullYear(),
  specs: '{}',
  is_active: true,
  socket: '',
  max_ram_frequency: '',
  length_mm: '',
  frequency_mhz: '',
  wattage: '',
  max_gpu_length_mm: '',
});

export function ComponentModal({ isOpen, onClose, onSaved, component }: Props) {
  const [formData, setFormData] = useState<FormData>(emptyForm());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (component) {
      const c = component as Record<string, unknown>;
      setFormData({
        name: component.name,
        brand: String(component.brand ?? ''),
        category: component.category,
        description: String(component.description ?? ''),
        release_year: Number(component.release_year ?? new Date().getFullYear()),
        specs: JSON.stringify(component.specs ?? {}, null, 2),
        is_active: component.is_active,
        socket: String(c.socket ?? ''),
        max_ram_frequency: String(c.max_ram_frequency ?? ''),
        length_mm: String(c.length_mm ?? ''),
        frequency_mhz: String(c.frequency_mhz ?? ''),
        wattage: String(c.wattage ?? ''),
        max_gpu_length_mm: String(c.max_gpu_length_mm ?? ''),
      });
    } else {
      setFormData(emptyForm());
    }
    setError(null);
    setValidationErrors({});
  }, [component, isOpen]);

  function set(key: keyof FormData, value: unknown) {
    setFormData(prev => ({ ...prev, [key]: value }));
  }

  function setCategory(cat: string) {
    // Clear all category-specific fields when switching category to avoid
    // sending stale values (e.g. a CPU socket value on a PSU payload).
    setFormData(prev => ({
      ...prev,
      category: cat,
      socket: '',
      max_ram_frequency: '',
      length_mm: '',
      frequency_mhz: '',
      wattage: '',
      max_gpu_length_mm: '',
    }));
  }

  function validate() {
    const errors: Record<string, string> = {};
    if (!formData.name.trim()) errors.name = 'Le nom est requis.';
    if (!(CATEGORY_ORDER as readonly string[]).includes(formData.category)) {
      errors.category = 'Catégorie invalide.';
    }
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

    const payload: Record<string, unknown> = {
      name: formData.name,
      brand: formData.brand || undefined,
      category: formData.category,
      description: formData.description || undefined,
      release_year: formData.release_year || undefined,
      specs: formData.specs.trim() ? JSON.parse(formData.specs) : {},
      is_active: formData.is_active,
    };

    // Category-specific fields
    if (formData.socket) payload.socket = formData.socket;
    if (formData.max_ram_frequency) payload.max_ram_frequency = Number(formData.max_ram_frequency);
    if (formData.length_mm) payload.length_mm = Number(formData.length_mm);
    if (formData.frequency_mhz) payload.frequency_mhz = Number(formData.frequency_mhz);
    if (formData.wattage) payload.wattage = Number(formData.wattage);
    if (formData.max_gpu_length_mm) payload.max_gpu_length_mm = Number(formData.max_gpu_length_mm);

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

  const catFields = CATEGORY_FIELDS[formData.category] ?? [];

  return (
    <Modal
      title={component ? 'Modifier le composant' : 'Nouveau composant'}
      isOpen={isOpen}
      onClose={onClose}
    >
      <form className={styles.form} onSubmit={handleSubmit}>
        {error && <div className={styles.errorText}>{error}</div>}

        {/* Name */}
        <div className={styles.formGroup}>
          <label>Nom du composant</label>
          <input
            className={styles.input}
            type="text"
            value={formData.name}
            onChange={e => set('name', e.target.value)}
            placeholder="Ex: Ryzen 5 7600"
          />
          {validationErrors.name && <span className={styles.errorText}>{validationErrors.name}</span>}
        </div>

        {/* Brand + Category */}
        <div className={formLayout.row}>
          <div className={styles.formGroup}>
            <label>Marque</label>
            <input
              className={styles.input}
              type="text"
              value={formData.brand}
              onChange={e => set('brand', e.target.value)}
              placeholder="Ex: AMD"
            />
          </div>
          <div className={styles.formGroup}>
            <label>Catégorie</label>
            <select
              className={styles.select}
              value={formData.category}
              onChange={e => setCategory(e.target.value)}
            >
              {CATEGORY_ORDER.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        {/* Category-specific required fields */}
        {catFields.length > 0 && (
          <div className={formLayout.rowWrap}>
            {catFields.map(field => (
              <div key={field.key} className={`${styles.formGroup} ${formLayout.flexItem}`}>
                <label>{field.label}</label>
                <input
                  className={styles.input}
                  type={field.type}
                  value={formData[field.key as keyof FormData] as string}
                  onChange={e => set(field.key as keyof FormData, e.target.value)}
                  placeholder={field.placeholder}
                />
              </div>
            ))}
          </div>
        )}

        {/* Description */}
        <div className={styles.formGroup}>
          <label>Description</label>
          <textarea
            className={styles.textarea}
            value={formData.description}
            onChange={e => set('description', e.target.value)}
            placeholder="Description courte..."
          />
        </div>

        {/* Specs JSON */}
        <div className={styles.formGroup}>
          <label>Spécifications (JSON)</label>
          <textarea
            className={`${styles.textarea} ${formLayout.mono}`}
            value={formData.specs}
            onChange={e => set('specs', e.target.value)}
            placeholder='{ "cores": 6, "tdp": 65 }'
          />
          {validationErrors.specs && <span className={styles.errorText}>{validationErrors.specs}</span>}
        </div>

        {/* Year + Active */}
        <div className={formLayout.rowSpaceBetween}>
          <div className={styles.formGroup}>
            <label>Année de sortie</label>
            <input
              className={`${styles.input} ${formLayout.yearInput}`}
              type="number"
              value={formData.release_year}
              onChange={e => set('release_year', parseInt(e.target.value, 10) || new Date().getFullYear())}
            />
          </div>
          <label className={`${styles.checkboxGroup} ${formLayout.checkboxTop}`}>
            <input
              type="checkbox"
              checked={formData.is_active}
              onChange={e => set('is_active', e.target.checked)}
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
