import { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { createAdminRetailer, updateAdminRetailer, getErrorMessage} from '../api';
import type { AdminRetailer } from '../api';
import styles from './Form.module.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  retailer: AdminRetailer | null;
}

export function RetailerModal({ isOpen, onClose, onSaved, retailer }: Props) {
  const [formData, setFormData] = useState({
    name: '',
    base_url: '',
    country: 'MA',
    scraping_interval_hours: 24,
    is_active: true,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (retailer) {
      setFormData({
        name: retailer.name,
        base_url: String(retailer.base_url ?? ''),
        country: String(retailer.country ?? 'MA'),
        scraping_interval_hours: Number(retailer.scraping_interval_hours ?? 24),
        is_active: retailer.is_active,
      });
    } else {
      setFormData({
        name: '',
        base_url: '',
        country: 'MA',
        scraping_interval_hours: 24,
        is_active: true,
      });
    }
    setError(null);
    setValidationErrors({});
  }, [retailer, isOpen]);

  function validate() {
    const errors: Record<string, string> = {};
    if (!formData.name.trim()) errors.name = 'Le nom est requis.';
    if (!formData.base_url.trim()) errors.base_url = "L'URL est requise.";
    else {
      try {
        new URL(formData.base_url);
      } catch {
        errors.base_url = 'URL invalide (incluez http:// ou https://).';
      }
    }
    if (formData.scraping_interval_hours < 1) errors.scraping_interval_hours = 'Doit être au moins 1 heure.';
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setError(null);

    try {
      if (retailer) {
        await updateAdminRetailer(retailer.id, formData);
      } else {
        await createAdminRetailer(formData);
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
      title={retailer ? 'Modifier le revendeur' : 'Nouveau revendeur'}
      isOpen={isOpen}
      onClose={onClose}
    >
      <form className={styles.form} onSubmit={handleSubmit}>
        {error && <div className={styles.errorText}>{error}</div>}

        <div className={styles.formGroup}>
          <label>Nom du revendeur</label>
          <input
            className={styles.input}
            type="text"
            value={formData.name}
            onChange={e => setFormData({ ...formData, name: e.target.value })}
            placeholder="Ex: UltraPC"
          />
          {validationErrors.name && <span className={styles.errorText}>{validationErrors.name}</span>}
        </div>

        <div className={styles.formGroup}>
          <label>URL de base</label>
          <input
            className={styles.input}
            type="url"
            value={formData.base_url}
            onChange={e => setFormData({ ...formData, base_url: e.target.value })}
            placeholder="Ex: https://www.ultrapc.ma"
          />
          {validationErrors.base_url && <span className={styles.errorText}>{validationErrors.base_url}</span>}
        </div>

        <div className={styles.formGroup}>
          <label>Pays (Code ISO)</label>
          <input
            className={styles.input}
            type="text"
            maxLength={2}
            value={formData.country}
            onChange={e => setFormData({ ...formData, country: e.target.value.toUpperCase() })}
            placeholder="Ex: MA"
          />
        </div>

        <div className={styles.formGroup}>
          <label>Intervalle de scraping (heures)</label>
          <input
            className={styles.input}
            type="number"
            min="1"
            value={formData.scraping_interval_hours}
            onChange={e => setFormData({ ...formData, scraping_interval_hours: parseInt(e.target.value) || 24 })}
          />
          {validationErrors.scraping_interval_hours && <span className={styles.errorText}>{validationErrors.scraping_interval_hours}</span>}
        </div>

        <label className={styles.checkboxGroup}>
          <input
            type="checkbox"
            checked={formData.is_active}
            onChange={e => setFormData({ ...formData, is_active: e.target.checked })}
          />
          Actif
        </label>

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
