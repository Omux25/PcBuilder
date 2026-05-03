import { useState, useRef } from 'react';
import { Upload } from 'lucide-react';
import { bulkImportComponents } from '../api';
import type { ImportResult } from '../api';
import styles from './BulkImport.module.css';

const MAX_FILE_SIZE_MB = 10;

export function BulkImport() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    validateAndSetFile(f);
  }

  function validateAndSetFile(f: File | null) {
    setResult(null);
    setError(null);
    if (!f) { setFile(null); return; }

    const sizeMB = f.size / (1024 * 1024);
    if (sizeMB > MAX_FILE_SIZE_MB) {
      setError(`Fichier trop volumineux (${sizeMB.toFixed(1)} MB). Maximum : ${MAX_FILE_SIZE_MB} MB.`);
      setFile(null);
      return;
    }
    const ext = f.name.split('.').pop()?.toLowerCase();
    if (ext !== 'csv' && ext !== 'json') {
      setError('Format non supporté. Utilisez un fichier .csv ou .json.');
      setFile(null);
      return;
    }
    setFile(f);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    const f = e.dataTransfer.files?.[0] ?? null;
    validateAndSetFile(f);
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
  }

  async function handleImport() {
    if (!file) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await bulkImportComponents(file);
      setResult(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Import en masse</h1>
      <p className={styles.desc}>
        Importez des composants depuis un fichier CSV ou JSON.
        Chaque ligne doit contenir au minimum : name, brand, category.
      </p>

      <div
        className={styles.uploadArea}
        onClick={() => inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        role="button"
        tabIndex={0}
        aria-label="Zone de dépôt de fichier"
        onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
      >
        <Upload size={32} color="var(--text-dim)" />
        <p>{file ? file.name : 'Cliquez ou deposez un fichier CSV / JSON'}</p>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.json"
          onChange={handleFileChange}
          className={styles.hiddenInput}
        />
      </div>

      {file && (
        <button className={styles.importBtn} onClick={handleImport} disabled={loading}>
          {loading ? 'Import en cours...' : "Lancer l'import"}
        </button>
      )}

      {error && <p className={styles.error}>{error}</p>}

      {result && (
        <div className={styles.results}>
          <h2>Resultats</h2>
          <div className={styles.statsRow}>
            <div className={styles.stat}><span>{result.total_rows}</span>Total</div>
            <div className={`${styles.stat} ${styles.success}`}><span>{result.imported}</span>Importes</div>
            <div className={`${styles.stat} ${styles.warn}`}><span>{result.skipped}</span>Ignores</div>
            <div className={`${styles.stat} ${styles.danger}`}><span>{result.failed}</span>Echecs</div>
          </div>

          {(result.errors?.length ?? 0) > 0 && (
            <div className={styles.errorList}>
              <h3>Erreurs</h3>
              {result.errors?.map((e, i) => (
                <div key={i} className={styles.errorRow}>
                  <span className={styles.rowNum}>Ligne {e.row}</span>
                  <span>{e.message}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
