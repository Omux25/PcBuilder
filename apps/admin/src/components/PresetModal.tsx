import { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { createAdminPreset, updateAdminPreset, searchComponents, getErrorMessage} from '../api';
import type { AdminPreset, PresetPayload } from '../api';
import type { AdminComponent } from '../api';
import { CATEGORY_ORDER, CATEGORY_LABELS } from '@shared/types';
import styles from './Form.module.css';
import presetStyles from './PresetModal.module.css';

const USE_CASES = [
    { value: 'gaming', label: 'Gaming' },
    { value: 'workstation', label: 'Workstation' },
    { value: 'office', label: 'Bureau' },
    { value: 'budget', label: 'Budget' },
] as const;

type UseCase = typeof USE_CASES[number]['value'];

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSaved: () => void;
    preset: AdminPreset | null;
}

type ComponentSlots = Partial<Record<string, AdminComponent>>;

interface FormData {
    name: string;
    description: string;
    use_case: UseCase;
    is_featured: boolean;
    components: ComponentSlots;
}

const emptyForm = (): FormData => ({
    name: '',
    description: '',
    use_case: 'gaming',
    is_featured: false,
    components: {},
});

/**
 * Build the ordered list of slot keys for the preset form.
 * Single-slot categories use their plain name.
 * RAM uses ram_1..ram_4, storage uses storage_1..storage_4.
 * This mirrors the frontend configurator's slot model.
 */
const PRESET_SLOT_KEYS: string[] = CATEGORY_ORDER.flatMap(cat => {
    if (cat === 'ram') return ['ram_1', 'ram_2', 'ram_3', 'ram_4'];
    if (cat === 'storage') return ['storage_1', 'storage_2', 'storage_3', 'storage_4'];
    return [cat];
});

/** Derive the base category from a slot key (e.g. 'ram_2' → 'ram'). */
function slotToCategory(key: string): string {
    return key.replace(/_\d+$/, '');
}

/** Human-readable label for a slot key. */
function slotLabel(key: string): string {
    const cat = slotToCategory(key);
    const base = CATEGORY_LABELS[cat as keyof typeof CATEGORY_LABELS] ?? cat;
    const match = key.match(/_(\d+)$/);
    return match ? `${base} #${match[1]}` : base;
}

export function PresetModal({ isOpen, onClose, onSaved, preset }: Props) {
    const [formData, setFormData] = useState<FormData>(emptyForm());
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

    const [activeSearch, setActiveSearch] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<AdminComponent[]>([]);
    const [searchLoading, setSearchLoading] = useState(false);

    useEffect(() => {
        if (!isOpen) return;
        if (preset) {
            const slots: ComponentSlots = {};
            for (const [key, comp] of Object.entries(preset.components ?? {})) {
                slots[key] = comp as unknown as AdminComponent;
            }
            setFormData({
                name: preset.name,
                description: preset.description ?? '',
                use_case: preset.use_case as UseCase,
                is_featured: preset.is_featured ?? false,
                components: slots,
            });
        } else {
            setFormData(emptyForm());
        }
        setError(null);
        setValidationErrors({});
        setActiveSearch(null);
        setSearchQuery('');
        setSearchResults([]);
    }, [preset, isOpen]);

    function set<K extends keyof FormData>(key: K, value: FormData[K]) {
        setFormData(prev => ({ ...prev, [key]: value }));
    }

    async function handleSearch(slotKey: string, query: string) {
        if (!query.trim()) { setSearchResults([]); return; }
        setSearchLoading(true);
        try {
            const cat = slotToCategory(slotKey);
            const data = await searchComponents(query, cat);
            setSearchResults(data.components ?? []);
        } catch {
            setSearchResults([]);
        } finally {
            setSearchLoading(false);
        }
    }

    function openSearch(slotKey: string) {
        setActiveSearch(slotKey);
        setSearchQuery('');
        setSearchResults([]);
    }

    function closeSearch() {
        setActiveSearch(null);
        setSearchQuery('');
        setSearchResults([]);
    }

    function selectComponent(slotKey: string, component: AdminComponent) {
        set('components', { ...formData.components, [slotKey]: component });
        closeSearch();
    }

    function removeComponent(slotKey: string) {
        const next = { ...formData.components };
        delete next[slotKey];
        set('components', next);
    }

    function validate(): boolean {
        const errors: Record<string, string> = {};
        if (!formData.name.trim()) errors.name = 'Le nom est requis.';
        if (Object.keys(formData.components).length === 0) {
            errors.components = 'Ajoutez au moins un composant.';
        }
        setValidationErrors(errors);
        return Object.keys(errors).length === 0;
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!validate()) return;
        setLoading(true);
        setError(null);

        const componentsMap: Record<string, number> = {};
        for (const [key, comp] of Object.entries(formData.components)) {
            if (comp) componentsMap[key] = comp.id;
        }

        const payload: PresetPayload = {
            name: formData.name.trim(),
            description: formData.description.trim() || undefined,
            use_case: formData.use_case,
            is_featured: formData.is_featured,
            components: componentsMap,
        };

        try {
            if (preset) {
                await updateAdminPreset(preset.id, payload);
            } else {
                await createAdminPreset(payload);
            }
            onSaved();
            onClose();
        } catch (err: unknown) {
            setError(getErrorMessage(err));
        } finally {
            setLoading(false);
        }
    }

    return (
        <Modal
            title={preset ? 'Modifier la configuration' : 'Nouvelle configuration'}
            isOpen={isOpen}
            onClose={onClose}
        >
            <form className={styles.form} onSubmit={handleSubmit}>
                {error && <div className={styles.errorText}>{error}</div>}

                {/* Name */}
                <div className={styles.formGroup}>
                    <label>Nom</label>
                    <input
                        className={styles.input}
                        type="text"
                        value={formData.name}
                        onChange={e => set('name', e.target.value)}
                        placeholder="Ex: Gaming Mid-Range 2025"
                    />
                    {validationErrors.name && <span className={styles.errorText}>{validationErrors.name}</span>}
                </div>

                {/* Use case */}
                <div className={styles.formGroup}>
                    <label>Cas d'usage</label>
                    <select
                        className={styles.select}
                        value={formData.use_case}
                        onChange={e => set('use_case', e.target.value as UseCase)}
                    >
                        {USE_CASES.map(u => (
                            <option key={u.value} value={u.value}>{u.label}</option>
                        ))}
                    </select>
                </div>

                {/* Featured / Populaire */}
                <div className={styles.checkboxGroup}>
                    <input
                        id="is_featured"
                        type="checkbox"
                        checked={formData.is_featured}
                        onChange={e => set('is_featured', e.target.checked)}
                    />
                    <label htmlFor="is_featured" style={{ cursor: 'pointer', fontSize: '0.9rem', color: 'var(--text-2)', fontWeight: 500 }}>
                        Mettre en vedette (Afficher le contour bleu glow "Populaire")
                    </label>
                </div>

                {/* Description */}
                <div className={styles.formGroup}>
                    <label>Description</label>
                    <textarea
                        className={styles.textarea}
                        value={formData.description}
                        onChange={e => set('description', e.target.value)}
                        placeholder="Description courte du build..."
                    />
                </div>

                {/* Component slots — mirrors the frontend configurator slot model */}
                <div className={styles.formGroup}>
                    <label>Composants</label>
                    {validationErrors.components && (
                        <span className={styles.errorText}>{validationErrors.components}</span>
                    )}
                    <div className={presetStyles.slots}>
                        {PRESET_SLOT_KEYS.map(slotKey => {
                            const selected = formData.components[slotKey];
                            return (
                                <div key={slotKey} className={presetStyles.slot}>
                                    <span className={presetStyles.slotLabel}>{slotLabel(slotKey)}</span>
                                    {selected ? (
                                        <div className={presetStyles.slotFilled}>
                                            <span className={presetStyles.slotName}>
                                                {selected.brand ? `${selected.brand} ` : ''}{selected.name}
                                            </span>
                                            <button
                                                type="button"
                                                className={presetStyles.slotChange}
                                                onClick={() => openSearch(slotKey)}
                                            >
                                                Changer
                                            </button>
                                            <button
                                                type="button"
                                                className={presetStyles.slotRemove}
                                                onClick={() => removeComponent(slotKey)}
                                                aria-label={`Retirer ${slotLabel(slotKey)}`}
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            type="button"
                                            className={presetStyles.slotAdd}
                                            onClick={() => openSearch(slotKey)}
                                        >
                                            + Ajouter
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
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

            {/* Inline component search panel */}
            {activeSearch && (
                <div className={presetStyles.searchOverlay} onClick={closeSearch}>
                    <div className={presetStyles.searchPanel} onClick={e => e.stopPropagation()}>
                        <div className={presetStyles.searchHeader}>
                            <span>{slotLabel(activeSearch)}</span>
                            <button className={presetStyles.searchClose} onClick={closeSearch}>✕</button>
                        </div>
                        <div className={presetStyles.searchRow}>
                            <input
                                type="text"
                                placeholder="Rechercher..."
                                value={searchQuery}
                                autoFocus
                                onChange={e => {
                                    setSearchQuery(e.target.value);
                                    handleSearch(activeSearch, e.target.value);
                                }}
                                onKeyDown={e => e.key === 'Escape' && closeSearch()}
                            />
                        </div>
                        {searchLoading && <p className={presetStyles.searchHint}>Recherche...</p>}
                        {!searchLoading && searchQuery && searchResults.length === 0 && (
                            <p className={presetStyles.searchHint}>Aucun résultat pour cette catégorie.</p>
                        )}
                        {!searchLoading && !searchQuery && (
                            <p className={presetStyles.searchHint}>Tapez pour rechercher un composant.</p>
                        )}
                        <ul className={presetStyles.searchResults}>
                            {searchResults.map(c => (
                                <li
                                    key={c.id}
                                    className={presetStyles.searchResult}
                                    onClick={() => selectComponent(activeSearch, c)}
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={e => e.key === 'Enter' && selectComponent(activeSearch, c)}
                                >
                                    <span className={presetStyles.resultName}>
                                        {c.brand ? `${c.brand} ` : ''}{c.name}
                                    </span>
                                    <span className={presetStyles.resultId}>#{c.id}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            )}
        </Modal>
    );
}
