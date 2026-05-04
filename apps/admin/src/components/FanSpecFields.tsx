/**
 * FanSpecFields — spec form section for fan components.
 * Requirements: 5.6
 */

import styles from './Form.module.css';

export interface FanSpecValues {
    size_mm: number | '';
    airflow_cfm: number | '';
    noise_db: number | '';
    rgb: boolean;
    pack_size: number | '';
}

interface Props {
    values: FanSpecValues;
    onChange: (values: FanSpecValues) => void;
}

const VALID_SIZES = [80, 92, 120, 140, 200] as const;

export function FanSpecFields({ values, onChange }: Props) {
    function set<K extends keyof FanSpecValues>(key: K, value: FanSpecValues[K]) {
        onChange({ ...values, [key]: value });
    }

    return (
        <div className={styles.fieldGroup}>
            <div className={styles.field}>
                <label htmlFor="fan-size_mm">
                    Taille (mm) <span aria-hidden="true" style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <select
                    id="fan-size_mm"
                    value={values.size_mm}
                    onChange={e => set('size_mm', e.target.value ? Number(e.target.value) : '')}
                    required
                >
                    <option value="">— Sélectionner —</option>
                    {VALID_SIZES.map(s => (
                        <option key={s} value={s}>{s} mm</option>
                    ))}
                </select>
            </div>

            <div className={styles.field}>
                <label htmlFor="fan-pack_size">Pack (nombre de ventilateurs)</label>
                <input
                    id="fan-pack_size"
                    type="number"
                    min={1}
                    max={10}
                    placeholder="1"
                    value={values.pack_size}
                    onChange={e => set('pack_size', e.target.value ? Number(e.target.value) : '')}
                />
            </div>

            <div className={styles.field}>
                <label htmlFor="fan-airflow_cfm">Débit d'air (CFM)</label>
                <input
                    id="fan-airflow_cfm"
                    type="number"
                    min={0}
                    step={0.1}
                    placeholder="Optionnel"
                    value={values.airflow_cfm}
                    onChange={e => set('airflow_cfm', e.target.value ? Number(e.target.value) : '')}
                />
            </div>

            <div className={styles.field}>
                <label htmlFor="fan-noise_db">Niveau sonore (dB)</label>
                <input
                    id="fan-noise_db"
                    type="number"
                    min={0}
                    step={0.1}
                    placeholder="Optionnel"
                    value={values.noise_db}
                    onChange={e => set('noise_db', e.target.value ? Number(e.target.value) : '')}
                />
            </div>

            <div className={styles.field}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input
                        id="fan-rgb"
                        type="checkbox"
                        checked={values.rgb}
                        onChange={e => set('rgb', e.target.checked)}
                        style={{ width: 'auto', cursor: 'pointer' }}
                    />
                    Éclairage RGB / ARGB
                </label>
            </div>
        </div>
    );
}
