import { useEffect, useState, useCallback } from 'react';
import { Link2, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { getUnmatchedListings, linkUnmatched, dismissUnmatched, searchComponents, getAdminRetailers } from '../api';
import type { UnmatchedListing, AdminComponent, AdminRetailer } from '../api';
import styles from './Unmatched.module.css';

const PAGE_SIZE = 50;

export function Unmatched() {
  const [listings, setListings] = useState<UnmatchedListing[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retailers, setRetailers] = useState<AdminRetailer[]>([]);
  const [retailerFilter, setRetailerFilter] = useState('');
  const [linkTarget, setLinkTarget] = useState<UnmatchedListing | null>(null);
  const [componentSearch, setComponentSearch] = useState('');
  const [searchResults, setSearchResults] = useState<AdminComponent[]>([]);

  const load = useCallback((p = page, rid = retailerFilter) => {
    setLoading(true);
    const params: Record<string, string> = {
      status: 'pending',
      page: String(p),
      limit: String(PAGE_SIZE),
    };
    if (rid) params.retailer_id = rid;

    getUnmatchedListings(params)
      .then((data) => {
        setListings(data.listings ?? []);
        setTotal(data.total ?? 0);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [page, retailerFilter]);

  useEffect(() => {
    load();
    getAdminRetailers().then(d => setRetailers(d.retailers ?? []));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handlePageChange(newPage: number) {
    setPage(newPage);
    load(newPage, retailerFilter);
  }

  function handleRetailerFilter(rid: string) {
    setRetailerFilter(rid);
    setPage(1);
    load(1, rid);
  }

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

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Listings non associés</h1>
          <p className={styles.subtitle}>
            {total} produit{total !== 1 ? 's' : ''} en attente d'association manuelle.
            L'auto-mapper a déjà traité les produits identifiables — ce qui reste sont des bundles, accessoires ou modèles inconnus.
          </p>
        </div>
        <select
          value={retailerFilter}
          onChange={e => handleRetailerFilter(e.target.value)}
          className={styles.retailerFilter}
        >
          <option value="">Tous les revendeurs</option>
          {retailers.filter(r => r.is_active).map(r => (
            <option key={r.id} value={String(r.id)}>{r.name}</option>
          ))}
        </select>
      </div>

      {error && <p className={styles.error}>{error}</p>}
      {loading ? <p className={styles.loading}>Chargement...</p> : (
        listings.length === 0 ? (
          <p className={styles.empty}>Aucun listing en attente{retailerFilter ? ' pour ce revendeur' : ''}.</p>
        ) : (
          <>
            <table>
              <thead>
                <tr>
                  <th>Revendeur</th>
                  <th>Nom scrappé</th>
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

            {totalPages > 1 && (
              <div className={styles.pagination}>
                <button disabled={page <= 1} onClick={() => handlePageChange(page - 1)}>
                  <ChevronLeft size={14} />
                </button>
                <span>{page} / {totalPages} ({total} total)</span>
                <button disabled={page >= totalPages} onClick={() => handlePageChange(page + 1)}>
                  <ChevronRight size={14} />
                </button>
              </div>
            )}
          </>
        )
      )}

      {/* Link modal */}
      {linkTarget && (
        <div className={styles.overlay}>
          <div className={styles.dialog}>
            <h3>Associer à un composant</h3>
            <p className={styles.targetName}>{linkTarget.scraped_name}</p>
            <p className={styles.targetUrl}>
              <a href={linkTarget.product_url} target="_blank" rel="noopener noreferrer">{linkTarget.product_url}</a>
            </p>

            <div className={styles.searchRow}>
              <input
                type="text"
                placeholder="Rechercher un composant..."
                value={componentSearch}
                onChange={(e) => setComponentSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                autoFocus
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
