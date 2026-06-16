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
  cpu: [
    { key: 'socket', label: 'Socket', type: 'text', placeholder: 'Ex: AM5, LGA1700' },
    { key: 'core_count', label: 'Nombre de cœurs', type: 'number', placeholder: 'Ex: 6' },
    { key: 'thread_count', label: 'Nombre de threads', type: 'number', placeholder: 'Ex: 12' },
    { key: 'base_clock_ghz', label: 'Fréquence de base (GHz)', type: 'number', placeholder: 'Ex: 3.7' },
    { key: 'boost_clock_ghz', label: 'Fréquence boost (GHz)', type: 'number', placeholder: 'Ex: 4.6' },
    { key: 'tdp', label: 'TDP (W)', type: 'number', placeholder: 'Ex: 65' },
  ],
  motherboard: [
    { key: 'socket', label: 'Socket', type: 'text', placeholder: 'Ex: AM5' },
    { key: 'chipset', label: 'Chipset', type: 'text', placeholder: 'Ex: B650' },
    { key: 'form_factor', label: 'Format', type: 'text', placeholder: 'Ex: ATX, Micro-ATX' },
    { key: 'supported_ram_types', label: 'RAM supportée (virgules)', type: 'text', placeholder: 'Ex: DDR5' },
    { key: 'max_ram_frequency', label: 'Fréq. RAM max (MHz)', type: 'number', placeholder: 'Ex: 6000' },
    { key: 'ram_slots', label: 'Slots RAM', type: 'number', placeholder: 'Ex: 4' },
    { key: 'm2_slots', label: 'Slots M.2', type: 'number', placeholder: 'Ex: 2' },
    { key: 'sata_ports', label: 'Ports SATA', type: 'number', placeholder: 'Ex: 4' },
  ],
  gpu: [
    { key: 'chipset', label: 'Chipset', type: 'text', placeholder: 'Ex: RTX 4070' },
    { key: 'vram_gb', label: 'VRAM (Go)', type: 'number', placeholder: 'Ex: 12' },
    { key: 'tdp', label: 'TDP (W)', type: 'number', placeholder: 'Ex: 200' },
    { key: 'length_mm', label: 'Longueur (mm)', type: 'number', placeholder: 'Ex: 320' },
  ],
  ram: [
    { key: 'ram_type', label: 'Type RAM', type: 'text', placeholder: 'Ex: DDR4, DDR5' },
    { key: 'capacity_gb', label: 'Capacité (GB)', type: 'number', placeholder: 'Ex: 16' },
    { key: 'frequency_mhz', label: 'Fréquence (MHz)', type: 'number', placeholder: 'Ex: 6000' },
    { key: 'kit_count', label: 'Nombre de barrettes', type: 'number', placeholder: 'Ex: 2' },
    { key: 'cas_latency', label: 'Latence CAS (CL)', type: 'number', placeholder: 'Ex: 30' },
  ],
  psu: [
    { key: 'wattage', label: 'Puissance (W)', type: 'number', placeholder: 'Ex: 850' },
    { key: 'psu_form_factor', label: 'Format PSU', type: 'text', placeholder: 'Ex: ATX, SFX' },
    { key: 'efficiency_rating', label: 'Certification', type: 'text', placeholder: 'Ex: Gold, Platinum' },
    { key: 'modular', label: 'Modularité', type: 'text', placeholder: 'Ex: Full, Semi, Non' },
  ],
  case: [
    { key: 'form_factor', label: 'Format supporté', type: 'text', placeholder: 'Ex: ATX, Micro-ATX' },
    { key: 'supported_motherboards', label: 'CM supportées (virgules)', type: 'text', placeholder: 'Ex: ATX, Micro-ATX, Mini-ITX' },
    { key: 'supported_psu_form_factors', label: 'PSU supportés (virgules)', type: 'text', placeholder: 'Ex: ATX, SFX' },
    { key: 'max_gpu_length_mm', label: 'GPU max (mm)', type: 'number', placeholder: 'Ex: 380' },
    { key: 'max_cooler_height_mm', label: 'Ventirad max (mm)', type: 'number', placeholder: 'Ex: 160' },
  ],
  storage: [
    { key: 'capacity_gb', label: 'Capacité (GB)', type: 'number', placeholder: 'Ex: 1000' },
    { key: 'interface_type', label: 'Interface', type: 'text', placeholder: 'Ex: NVMe, SATA' },
    { key: 'read_speed_mbps', label: 'Vitesse lecture (Mo/s)', type: 'number', placeholder: 'Ex: 5000' },
    { key: 'write_speed_mbps', label: 'Vitesse écriture (Mo/s)', type: 'number', placeholder: 'Ex: 4000' },
  ],
  cooling: [
    { key: 'height_mm', label: 'Hauteur (mm)', type: 'number', placeholder: 'Ex: 154 (pour Air) ou 27 (épaisseur AIO)' },
    { key: 'supported_sockets', label: 'Sockets supportés (virgules)', type: 'text', placeholder: 'Ex: LGA1700, AM5, AM4' },
    { key: 'max_tdp', label: 'TDP max supporté (W)', type: 'number', placeholder: 'Ex: 250' },
  ],
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
        // Map component data to form input shape (including flat properties)
        const formData: any = {
          ...component,
          brand: component.brand ?? null,
          description: component.description ?? undefined,
          release_year: component.release_year ?? new Date().getFullYear(),
          specs: (typeof component.specs === 'string' ? JSON.parse(component.specs) : component.specs) ?? {},
        };
        if (Array.isArray(formData.supported_ram_types)) {
          formData.supported_ram_types = formData.supported_ram_types.join(', ');
        }
        if (Array.isArray(formData.supported_motherboards)) {
          formData.supported_motherboards = formData.supported_motherboards.join(', ');
        }
        if (Array.isArray(formData.supported_psu_form_factors)) {
          formData.supported_psu_form_factors = formData.supported_psu_form_factors.join(', ');
        }
        if (Array.isArray(formData.supported_sockets)) {
          formData.supported_sockets = formData.supported_sockets.join(', ');
        }
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
