import { useEffect, useState } from 'react';
import { Link2, X } from 'lucide-react';
import { getUnmatchedListings, linkUnmatched, dismissUnmatched, searchComponents } from '../api';
import type { UnmatchedListing, AdminComponent } from '../api';
import styles from './Unmatched.module.css';

export function Unmatched() {
  const [listings, setListings] = useState<UnmatchedListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [linkTarget, setLinkTarget] = useState<UnmatchedListing | null>(null);
  const [componentSearch, setComponentSearch] = useState('');
  const [searchResults, setSearchResults] = useState<AdminComponent[]>([]);

  function load() {
    setLoading(true);
    getUnmatchedListings({ status: 'pending' })
      .then((data) => setListings(data.listings ?? []))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function handleSearch() {
    if (!componentSearch.trim()) return;
    const data = await searchComponents(componentSearch);
    setSearchResults(data.components ?? []);
  }

  async function handleLink(componentId: number) {
    if (!linkTarget) return;
    try {
      await linkUnmatched(linkTarget.id, componentId);
      setLinkTarget(null);
      setComponentSearch('');
      setSearchResults([]);
      load();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error');
    }
  }

  async function handleDismiss(id: number) {
    try {
      await dismissUnmatched(id);
      load();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error');
    }
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Listings non associes ({listings.length})</h1>

      {error && <p className={styles.error}>{error}</p>}
      {loading ? <p className={styles.loading}>Chargement...</p> : (
        listings.length === 0 ? (
          <p className={styles.empty}>Aucun listing en attente.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Revendeur</th>
                <th>Nom scrape</th>
                <th>Prix</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {listings.map((l) => (
                <tr key={l.id}>
                  <td>{l.retailer_name}</td>
                  <td>
                    <a href={l.product_url} target="_blank" rel="noopener noreferrer" className={styles.productLink}>
                      {l.scraped_name}
                    </a>
                  </td>
                  <td>{l.scraped_price ? `${Number(l.scraped_price).toLocaleString('fr-MA')} MAD` : '—'}</td>
                  <td className={styles.date}>{new Date(l.scraped_at).toLocaleDateString('fr-MA')}</td>
                  <td>
                    <div className={styles.actions}>
                      <button className={styles.linkBtn} onClick={() => setLinkTarget(l)} title="Associer">
                        <Link2 size={15} /> Associer
                      </button>
                      <button className={styles.dismissBtn} onClick={() => handleDismiss(l.id)} title="Ignorer">
                        <X size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      )}

      {/* Link modal */}
      {linkTarget && (
        <div className={styles.overlay}>
          <div className={styles.dialog}>
            <h3>Associer a un composant</h3>
            <p className={styles.targetName}>{linkTarget.scraped_name}</p>

            <div className={styles.searchRow}>
              <input
                type="text"
                placeholder="Rechercher un composant..."
                value={componentSearch}
                onChange={(e) => setComponentSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
              <button className={styles.searchBtn} onClick={handleSearch}>Rechercher</button>
            </div>

            {searchResults.length > 0 && (
              <ul className={styles.resultList}>
                {searchResults.map((c) => (
                  <li key={c.id} className={styles.resultItem} onClick={() => handleLink(c.id)}>
                    <span className={styles.resultName}>{c.brand ? `${c.brand} ` : ''}{c.name}</span>
                    <span className={styles.resultCat}>{c.category}</span>
                  </li>
                ))}
              </ul>
            )}

            <button className={styles.cancelBtn} onClick={() => { setLinkTarget(null); setSearchResults([]); setComponentSearch(''); }}>
              Annuler
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
