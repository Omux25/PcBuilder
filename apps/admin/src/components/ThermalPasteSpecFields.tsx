/**
 * ThermalPasteSpecFields — spec form section for thermal paste components.
 * Requirements: 6.6
 */

import styles from './Form.module.css';

export interface ThermalPasteSpecValues {
    weight_grams: number | '';
    thermal_conductivity: number | '';
    paste_type: 'paste' | 'liquid_metal' | 'pad' | '';
}

interface Props {
    values: ThermalPasteSpecValues;
    onChange: (values: ThermalPasteSpecValues) => void;
}

const PASTE_TYPE_LABELS: Record<string, string> = {
    paste: 'Pâte thermique',
    liquid_metal: 'Métal liquide',
    pad: 'Pad thermique',
};

export function ThermalPasteSpecFields({ values, onChange }: Props) {
    function set<K extends keyof ThermalPasteSpecValues>(key: K, value: ThermalPasteSpecValues[K]) {
        onChange({ ...values, [key]: value });
    }

    return (
        <div className={styles.fieldGroup}>
            <div className={styles.field}>
                <label htmlFor="tp-weight_grams">
                    Poids (grammes) <span aria-hidden="true" style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <input
                    id="tp-weight_grams"
                    type="number"
                    min={0.1}
                    step={0.1}
                    placeholder="ex: 4"
                    value={values.weight_grams}
                    onChange={e => set('weight_grams', e.target.value ? Number(e.target.value) : '')}
                    required
                />
            </div>

            <div className={styles.field}>
                <label htmlFor="tp-paste_type">Type</label>
                <select
                    id="tp-paste_type"
                    value={values.paste_type}
                    onChange={e => set('paste_type', e.target.value as ThermalPasteSpecValues['paste_type'])}
                >
                    <option value="">— Optionnel —</option>
                    {Object.entries(PASTE_TYPE_LABELS).map(([val, label]) => (
                        <option key={val} value={val}>{label}</option>
                    ))}
                </select>
            </div>

            <div className={styles.field}>
                <label htmlFor="tp-thermal_conductivity">Conductivité thermique (W/m·K)</label>
                <input
                    id="tp-thermal_conductivity"
                    type="number"
                    min={0}
                    step={0.1}
                    placeholder="Optionnel"
                    value={values.thermal_conductivity}
                    onChange={e => set('thermal_conductivity', e.target.value ? Number(e.target.value) : '')}
                />
            </div>
        </div>
    );
}
