import { useEffect, useState, useCallback, useRef } from 'react';
import { Link2, X, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { getUnmatchedListings, linkUnmatched, dismissUnmatched, searchComponents, getAdminRetailers } from '../api';
import type { UnmatchedListing, AdminComponent, AdminRetailer } from '../api';
import { Modal } from '../components/Modal';
import styles from './Unmatched.module.css';

const PAGE_SIZE = 50;

export function Unmatched() {
  const [listings, setListings] = useState<UnmatchedListing[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [retailers, setRetailers] = useState<AdminRetailer[]>([]);
  const [search, setSearch] = useState('');
  const [retailerFilter, setRetailerFilter] = useState('');
  const [linkTarget, setLinkTarget] = useState<UnmatchedListing | null>(null);
  const [componentSearch, setComponentSearch] = useState('');
  const [searchResults, setSearchResults] = useState<AdminComponent[]>([]);

  // Keep a ref to the latest filter values so the debounced effect always
  // reads the current values without needing them in its own dep array.
  const filtersRef = useRef({ page, retailerFilter, search });
  filtersRef.current = { page, retailerFilter, search };

  const load = useCallback((p: number, rid: string, s: string) => {
    setLoading(true);
    const params: Record<string, string> = {
      status: 'pending',
      page: String(p),
      limit: String(PAGE_SIZE),
    };
    if (rid) params.retailer_id = rid;
    if (s) params.search = s;

    getUnmatchedListings(params)
      .then((data) => {
        setListings(data.listings ?? []);
        setTotal(data.total ?? 0);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []); // stable — no deps

  useEffect(() => {
    getAdminRetailers().then(d => setRetailers(d.retailers ?? []));
  }, []);

  // Initial load
  useEffect(() => {
    load(page, retailerFilter, search);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally runs once on mount

  // Reload on page or retailer filter change — instant, no debounce
  useEffect(() => {
    load(page, retailerFilter, search);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, retailerFilter]); // search intentionally excluded — handled below

  // Reload on search change — debounced 400ms, resets to page 1
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      load(1, filtersRef.current.retailerFilter, search);
    }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  function handleRetailerFilter(rid: string) {
    setRetailerFilter(rid);
    setPage(1);
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    load(1, retailerFilter, search);
  }

  async function handleComponentSearch() {
    if (!componentSearch.trim()) return;
    setMutationError(null);
    try {
      const data = await searchComponents(componentSearch);
      setSearchResults(data.components ?? []);
    } catch (err: unknown) {
      setMutationError(err instanceof Error ? err.message : 'Erreur lors de la recherche.');
    }
  }

  async function handleLink(componentId: number) {
    if (!linkTarget) return;
    setMutationError(null);
    try {
      await linkUnmatched(linkTarget.id, componentId);
      setLinkTarget(null);
      setComponentSearch('');
      setSearchResults([]);
      load(page, retailerFilter, search);
    } catch (err: unknown) {
      setMutationError(err instanceof Error ? err.message : 'Erreur inattendue');
    }
  }

  async function handleDismiss(id: number) {
    setMutationError(null);
    try {
      await dismissUnmatched(id);
      load(page, retailerFilter, search);
    } catch (err: unknown) {
      setMutationError(err instanceof Error ? err.message : 'Erreur inattendue');
    }
  }

  function closeLinkModal() {
    setLinkTarget(null);
    setSearchResults([]);
    setComponentSearch('');
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
        <div className={styles.filters}>
          <form onSubmit={handleSearchSubmit} className={styles.searchForm}>
            <div className={styles.searchInputWrapper}>
              <Search size={16} className={styles.searchIcon} />
              <input
                type="text"
                placeholder="Rechercher par nom..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={styles.searchInput}
              />
            </div>
          </form>

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
      </div>

      {error && <p className="admin-error">{error}</p>}
      {mutationError && <p className="admin-error">{mutationError}</p>}

      {loading ? <p className="admin-loading">Chargement...</p> : (
        listings.length === 0 ? (
          <p className="admin-empty">Aucun listing en attente{retailerFilter ? ' pour ce revendeur' : ''}.</p>
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
                        <button
                          className={styles.linkBtn}
                          onClick={() => setLinkTarget(l)}
                          title="Associer"
                          aria-label={`Associer ${l.scraped_name}`}
                        >
                          <Link2 size={15} /> Associer
                        </button>
                        <button
                          className={styles.dismissBtn}
                          onClick={() => handleDismiss(l.id)}
                          title="Ignorer"
                          aria-label={`Ignorer ${l.scraped_name}`}
                        >
                          <X size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {totalPages > 1 && (
              <div className="admin-pagination">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                  aria-label="Page précédente"
                >
                  <ChevronLeft size={14} />
                </button>
                <span>{page} / {totalPages} ({total} total)</span>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage(page + 1)}
                  aria-label="Page suivante"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            )}
          </>
        )
      )}

      {/* Link modal — uses the shared Modal component for consistent UX
          (Escape key, body scroll lock, backdrop click to close) */}
      <Modal
        title="Associer à un composant"
        isOpen={linkTarget !== null}
        onClose={closeLinkModal}
      >
        {linkTarget && (
          <div className={styles.linkModalBody}>
            <p className={styles.targetName}>{linkTarget.scraped_name}</p>
            <p className={styles.targetUrl}>
              <a href={linkTarget.product_url} target="_blank" rel="noopener noreferrer">
                {linkTarget.product_url}
              </a>
            </p>

            <div className={styles.searchRow}>
              <input
                type="text"
                placeholder="Rechercher un composant..."
                value={componentSearch}
                onChange={(e) => setComponentSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleComponentSearch()}
                autoFocus
              />
              <button className={styles.searchBtn} onClick={handleComponentSearch}>
                Rechercher
              </button>
            </div>

            {searchResults.length > 0 && (
              <ul className={styles.resultList}>
                {searchResults.map((c) => (
                  <li
                    key={c.id}
                    className={styles.resultItem}
                    onClick={() => handleLink(c.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && handleLink(c.id)}
                  >
                    <span className={styles.resultName}>{c.brand ? `${c.brand} ` : ''}{c.name}</span>
                    <span className="badge badge-accent">{c.category}</span>
                  </li>
                ))}
              </ul>
            )}

            {searchResults.length === 0 && componentSearch && (
              <p className="admin-empty">Aucun résultat pour "{componentSearch}".</p>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
