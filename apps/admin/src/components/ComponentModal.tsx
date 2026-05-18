import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Modal } from './Modal';
import { FanSpecFields } from './FanSpecFields';
import { ThermalPasteSpecFields } from './ThermalPasteSpecFields';
import { createAdminComponent, updateAdminComponent, getErrorMessage } from '../api';
import type { AdminComponent } from '../api';
import { CATEGORY_ORDER } from '@shared/types';
import { componentSchema, type ComponentInput } from '@shared/schemas/component.schema.js';
import styles from './Form.module.css';
import formLayout from './FormLayout.module.css';

// Category-specific required fields
const CATEGORY_FIELDS: Record<string, { key: string; label: string; type: 'text' | 'number'; placeholder: string }[]> = {
  cpu: [{ key: 'socket', label: 'Socket', type: 'text', placeholder: 'Ex: AM5, LGA1700' }],
  motherboard: [
    { key: 'socket', label: 'Socket', type: 'text', placeholder: 'Ex: AM5' },
    { key: 'max_ram_frequency', label: 'Fréq. RAM max (MHz)', type: 'number', placeholder: 'Ex: 6000' },
    { key: 'ram_slots', label: 'Slots RAM', type: 'number', placeholder: 'Ex: 4' },
    { key: 'm2_slots', label: 'Slots M.2', type: 'number', placeholder: 'Ex: 2' },
    { key: 'sata_ports', label: 'Ports SATA', type: 'number', placeholder: 'Ex: 4' },
  ],
  gpu: [{ key: 'length_mm', label: 'Longueur (mm)', type: 'number', placeholder: 'Ex: 320' }],
  ram: [
    { key: 'frequency_mhz', label: 'Fréquence (MHz)', type: 'number', placeholder: 'Ex: 6000' },
    { key: 'capacity_gb', label: 'Capacité (GB)', type: 'number', placeholder: 'Ex: 16' },
  ],
  psu: [{ key: 'wattage', label: 'Puissance (W)', type: 'number', placeholder: 'Ex: 850' }],
  case: [{ key: 'max_gpu_length_mm', label: 'GPU max (mm)', type: 'number', placeholder: 'Ex: 380' }],
  storage: [{ key: 'capacity_gb', label: 'Capacité (GB)', type: 'number', placeholder: 'Ex: 1000' }],
  cooling: [],
  fan: [],
  thermal_paste: [],
};

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  component: AdminComponent | null;
}

export function ComponentModal({ isOpen, onClose, onSaved, component }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ComponentInput>({
    resolver: zodResolver(componentSchema),
    defaultValues: {
      category: 'cpu',
      is_active: true,
      specs: {},
      release_year: new Date().getFullYear(),
    },
  });

  const category = watch('category');

  useEffect(() => {
    if (isOpen) {
      if (component) {
        // Map component data to form input shape
        const formData: ComponentInput = {
          name: component.name,
          brand: component.brand ?? null,
          category: component.category,
          description: component.description ?? undefined,
          release_year: component.release_year ?? new Date().getFullYear(),
          specs: (component.specs as Record<string, unknown>) ?? {},
          is_active: component.is_active,
        };
        reset(formData);
      } else {
        reset({
          name: '',
          brand: null,
          category: 'cpu',
          is_active: true,
          specs: {},
          release_year: new Date().getFullYear(),
        });
      }
      setError(null);
    }
  }, [component, isOpen, reset]);

  const onSubmit = async (data: ComponentInput) => {
    setLoading(true);
    setError(null);

    try {
      if (component) {
        await updateAdminComponent(component.id, data);
      } else {
        await createAdminComponent(data);
      }
      onSaved();
      onClose();
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const catFields = CATEGORY_FIELDS[category] ?? [];

  return (
    <Modal
      title={component ? 'Modifier le composant' : 'Nouveau composant'}
      isOpen={isOpen}
      onClose={onClose}
    >
      <form className={styles.form} onSubmit={handleSubmit(onSubmit)}>
        {error && <div className={styles.errorText}>{error}</div>}

        {/* Name */}
        <div className={styles.formGroup}>
          <label>Nom du composant</label>
          <input
            {...register('name')}
            className={styles.input}
            type="text"
            placeholder="Ex: Ryzen 5 7600"
          />
          {errors.name && <span className={styles.errorText}>{errors.name.message}</span>}
        </div>

        {/* Brand + Category */}
        <div className={formLayout.row}>
          <div className={styles.formGroup}>
            <label>Marque</label>
            <input
              {...register('brand')}
              className={styles.input}
              type="text"
              placeholder="Ex: AMD"
            />
            {errors.brand && <span className={styles.errorText}>{errors.brand.message}</span>}
          </div>
          <div className={styles.formGroup}>
            <label>Catégorie</label>
            <select
              {...register('category')}
              className={styles.select}
            >
              {CATEGORY_ORDER.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            {errors.category && <span className={styles.errorText}>{errors.category.message}</span>}
          </div>
        </div>

        {/* Category-specific required fields */}
        {catFields.length > 0 && (
          <div className={formLayout.rowWrap}>
            {catFields.map(field => (
              <div key={field.key} className={`${styles.formGroup} ${formLayout.flexItem}`}>
                <label>{field.label}</label>
                <input
                  {...register(field.key as any, { valueAsNumber: field.type === 'number' })}
                  className={styles.input}
                  type={field.type}
                  placeholder={field.placeholder}
                />
                {(errors as any)[field.key] && (
                  <span className={styles.errorText}>{(errors as any)[field.key].message}</span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Fan-specific spec fields */}
        {category === 'fan' && (
          <FanSpecFields
            values={{
              size_mm: (watch() as any).size_mm || '',
              airflow_cfm: (watch() as any).airflow_cfm || '',
              noise_db: (watch() as any).noise_db || '',
              rgb: !!(watch() as any).rgb,
              pack_size: (watch() as any).pack_size || '',
            }}
            onChange={(vals) => {
              Object.entries(vals).forEach(([key, val]) => setValue(key as any, val));
            }}
          />
        )}

        {/* Thermal paste-specific spec fields */}
        {category === 'thermal_paste' && (
          <ThermalPasteSpecFields
            values={{
              weight_grams: (watch() as any).weight_grams || '',
              thermal_conductivity: (watch() as any).thermal_conductivity || '',
              paste_type: ((watch() as any).paste_type) || '',
            }}
            onChange={(vals) => {
              Object.entries(vals).forEach(([key, val]) => setValue(key as any, val));
            }}
          />
        )}

        {/* Description */}
        <div className={styles.formGroup}>
          <label>Description</label>
          <textarea
            {...register('description')}
            className={styles.textarea}
            placeholder="Description courte..."
          />
          {errors.description && <span className={styles.errorText}>{errors.description.message}</span>}
        </div>

        {/* Specs JSON - Simplified for now to just show and not edit complex JSON easily in flat form */}
        <div className={styles.formGroup}>
          <label>Spécifications (JSON)</label>
          <textarea
            className={`${styles.textarea} ${formLayout.mono}`}
            value={JSON.stringify(watch('specs'), null, 2)}
            readOnly
            placeholder='{ "cores": 6, "tdp": 65 }'
          />
        </div>

        {/* Year + Active */}
        <div className={formLayout.rowSpaceBetween}>
          <div className={styles.formGroup}>
            <label>Année de sortie</label>
            <input
              {...register('release_year', { valueAsNumber: true })}
              className={`${styles.input} ${formLayout.yearInput}`}
              type="number"
            />
            {errors.release_year && <span className={styles.errorText}>{errors.release_year.message}</span>}
          </div>
          <label className={`${styles.checkboxGroup} ${formLayout.checkboxTop}`}>
            <input
              {...register('is_active')}
              type="checkbox"
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
