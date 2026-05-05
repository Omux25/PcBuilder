import { useEffect, useState, useCallback, useRef } from 'react';
import { Link2, X, ChevronLeft, ChevronRight, Search, Layers, List, Zap, RefreshCw } from 'lucide-react';
import {
  getUnmatchedListings, linkUnmatched, dismissUnmatched, searchComponents, getAdminRetailers,
  getGroupedUnmatched, bulkDismissUnmatched, bulkApproveUnmatched, reprocessSuggestions, getErrorMessage
} from '../api';
import type { UnmatchedListing, AdminComponent, AdminRetailer, CanonicalGroup } from '../api';
import { Modal } from '../components/Modal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ConfidenceBadge } from '../components/ConfidenceBadge';
import { CreateAndLinkModal } from '../components/CreateAndLinkModal';
import type { CreateAndLinkResult } from '../components/CreateAndLinkModal';
import styles from './Unmatched.module.css';

const PAGE_SIZE = 50;

type ViewMode = 'grouped' | 'flat';

export function Unmatched() {
  // ── View mode ──────────────────────────────────────────────────────────────
  const [viewMode, setViewMode] = useState<ViewMode>('grouped');

  // ── Flat view state (existing, unchanged) ─────────────────────────────────
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

  // ── Grouped view state ─────────────────────────────────────────────────────
  const [groups, setGroups] = useState<CanonicalGroup[]>([]);
  const [totalGroups, setTotalGroups] = useState(0);
  const [totalListings, setTotalListings] = useState(0);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [groupsError, setGroupsError] = useState<string | null>(null);
  const [groupPage, setGroupPage] = useState(1);
  const GROUP_PAGE_SIZE = 50;
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());
  const [createLinkTarget, setCreateLinkTarget] = useState<CanonicalGroup | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [confirmDismiss, setConfirmDismiss] = useState(false);
  const [confirmApprove, setConfirmApprove] = useState(false);
  const [reprocessing, setReprocessing] = useState(false);

  const filtersRef = useRef({ page, retailerFilter, search });
  filtersRef.current = { page, retailerFilter, search };

  // ── Flat view load (existing logic, unchanged) ────────────────────────────
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
  }, []);

  // ── Grouped view load ─────────────────────────────────────────────────────
  const loadGroups = useCallback((s: string, rid: string, gp = 1) => {
    setGroupsLoading(true);
    setGroupsError(null);
    const params: Record<string, string> = { page: String(gp), limit: String(GROUP_PAGE_SIZE) };
    if (s) params.search = s;
    if (rid) params.retailer_id = rid;

    getGroupedUnmatched(params)
      .then((data) => {
        setGroups(data.groups ?? []);
        setTotalGroups(data.total_groups ?? 0);
        setTotalListings(data.total_listings ?? 0);
      })
      .catch((e: Error) => setGroupsError(e.message))
      .finally(() => setGroupsLoading(false));
  }, []);

  useEffect(() => {
    getAdminRetailers().then(d => setRetailers(d.retailers ?? []));
  }, []);

  // Initial load
  useEffect(() => {
    load(page, retailerFilter, search);
    loadGroups(search, retailerFilter, 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load(page, retailerFilter, search);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, retailerFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      setGroupPage(1);
      load(1, filtersRef.current.retailerFilter, search);
      loadGroups(search, filtersRef.current.retailerFilter, 1);
    }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  useEffect(() => {
    if (viewMode === 'grouped') {
      loadGroups(search, retailerFilter, groupPage);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, retailerFilter, groupPage]);

  function handleRetailerFilter(rid: string) {
    setRetailerFilter(rid);
    setPage(1);
    setGroupPage(1);
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    setGroupPage(1);
    load(1, retailerFilter, search);
    loadGroups(search, retailerFilter, 1);
  }

  // ── Flat view handlers (existing, unchanged) ──────────────────────────────
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
      setMutationError(getErrorMessage(err));
    }
  }

  async function handleDismiss(id: number) {
    setMutationError(null);
    try {
      await dismissUnmatched(id);
      load(page, retailerFilter, search);
    } catch (err: unknown) {
      setMutationError(getErrorMessage(err));
    }
  }

  function closeLinkModal() {
    setLinkTarget(null);
    setSearchResults([]);
    setComponentSearch('');
  }

  // ── Grouped view handlers ─────────────────────────────────────────────────
  function toggleGroup(canonicalName: string) {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(canonicalName)) next.delete(canonicalName);
      else next.add(canonicalName);
      return next;
    });
  }

  function toggleSelectGroup(canonicalName: string) {
    setSelectedGroups(prev => {
      const next = new Set(prev);
      if (next.has(canonicalName)) next.delete(canonicalName);
      else next.add(canonicalName);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedGroups.size === groups.length) {
      setSelectedGroups(new Set());
    } else {
      setSelectedGroups(new Set(groups.map(g => g.canonical_name)));
    }
  }

  async function handleBulkDismiss() {
    const ids = groups
      .filter(g => selectedGroups.has(g.canonical_name))
      .flatMap(g => g.listings.map(l => l.id));
    try {
      const result = await bulkDismissUnmatched(ids);
      setSuccessToast(`${result.dismissed} listing${result.dismissed !== 1 ? 's' : ''} ignoré${result.dismissed !== 1 ? 's' : ''}.`);
      setSelectedGroups(new Set());
      setConfirmDismiss(false);
      loadGroups(search, retailerFilter, groupPage);
    } catch (err: unknown) {
      setGroupsError(getErrorMessage(err));
    }
  }

  async function handleBulkApprove() {
    const highConfidenceNames = groups
      .filter(g => g.confidence === 'high' && g.existing_component_id)
      .map(g => g.canonical_name);
    try {
      const result = await bulkApproveUnmatched(highConfidenceNames);
      setSuccessToast(`${result.linked_listings} listing${result.linked_listings !== 1 ? 's' : ''} associé${result.linked_listings !== 1 ? 's' : ''} (${result.approved_groups} groupe${result.approved_groups !== 1 ? 's' : ''}).`);
      setConfirmApprove(false);
      loadGroups(search, retailerFilter, groupPage);
    } catch (err: unknown) {
      setGroupsError(getErrorMessage(err));
    }
  }

  async function handleReprocess() {
    setReprocessing(true);
    setGroupsError(null);
    try {
      await reprocessSuggestions();
      setSuccessToast('✓ Recalcul et création automatique lancés. La liste se mettra à jour dans ~15 secondes.');
      setTimeout(() => setSuccessToast(null), 15000);
      setTimeout(() => loadGroups(search, retailerFilter), 15000);
    } catch (err: unknown) {
      setGroupsError(getErrorMessage(err));
    } finally {
      setReprocessing(false);
    }
  }

  function handleCreateLinkSuccess(result: CreateAndLinkResult) {
    setCreateLinkTarget(null);
    setSuccessToast(`✓ ${result.linked_count} listing${result.linked_count !== 1 ? 's' : ''} associé${result.linked_count !== 1 ? 's' : ''} à "${result.component_name}".`);
    loadGroups(search, retailerFilter, groupPage);
    setTimeout(() => setSuccessToast(null), 5000);
  }

  const highConfidenceGroups = groups.filter(g => g.confidence === 'high' && g.existing_component_id);
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Listings non associés</h1>
          <p className={styles.subtitle}>
            {viewMode === 'grouped'
              ? `${totalGroups} groupe${totalGroups !== 1 ? 's' : ''} — ${totalListings} listing${totalListings !== 1 ? 's' : ''} en attente.`
              : `${total} produit${total !== 1 ? 's' : ''} en attente d'association manuelle.`
            }
          </p>
        </div>

        <div className={styles.filters}>
          {/* View toggle */}
          <div style={{ display: 'flex', gap: '4px', background: 'var(--surface-2)', borderRadius: 'var(--radius)', padding: '3px' }}>
            <button
              onClick={() => setViewMode('grouped')}
              style={{
                background: viewMode === 'grouped' ? 'var(--accent)' : 'transparent',
                color: viewMode === 'grouped' ? '#fff' : 'var(--text-muted)',
                padding: '5px 10px',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
              title="Vue groupée"
            >
              <Layers size={13} /> Groupé
            </button>
            <button
              onClick={() => setViewMode('flat')}
              style={{
                background: viewMode === 'flat' ? 'var(--accent)' : 'transparent',
                color: viewMode === 'flat' ? '#fff' : 'var(--text-muted)',
                padding: '5px 10px',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
              title="Vue liste"
            >
              <List size={13} /> Liste
            </button>
          </div>

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

          <button
            onClick={handleReprocess}
            disabled={reprocessing}
            title="Recalculer les catégories et créer automatiquement les composants reconnus"
            style={{
              display: 'flex', alignItems: 'center', gap: '5px',
              padding: '6px 12px', fontSize: '12px',
              background: 'var(--surface-2)', color: 'var(--text-muted)',
              borderRadius: 'var(--radius)', border: '1px solid var(--border)',
              cursor: reprocessing ? 'not-allowed' : 'pointer',
              opacity: reprocessing ? 0.6 : 1,
            }}
          >
            <RefreshCw size={13} style={{ animation: reprocessing ? 'spin 1s linear infinite' : 'none' }} />
            {reprocessing ? 'Traitement...' : 'Retraiter'}
          </button>
        </div>
      </div>

      {/* Success toast */}
      {
        successToast && (
          <div style={{
            background: 'var(--success)',
            color: '#0f1117',
            padding: '10px 16px',
            borderRadius: 'var(--radius)',
            marginBottom: '12px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '13px',
            fontWeight: 500,
          }}>
            {successToast}
            <button onClick={() => setSuccessToast(null)} style={{ background: 'none', color: '#0f1117', padding: '0 4px' }}>
              <X size={14} />
            </button>
          </div>
        )
      }

      {error && <p className="admin-error">{error}</p>}
      {mutationError && <p className="admin-error">{mutationError}</p>}
      {groupsError && <p className="admin-error">{groupsError}</p>}

      {/* ── GROUPED VIEW ── */}
      {
        viewMode === 'grouped' && (
          <>
            {/* Bulk action bar */}
            {(selectedGroups.size > 0 || highConfidenceGroups.length > 0) && (
              <div style={{
                display: 'flex',
                gap: '8px',
                alignItems: 'center',
                padding: '8px 12px',
                background: 'var(--surface-2)',
                borderRadius: 'var(--radius)',
                marginBottom: '12px',
                flexWrap: 'wrap',
              }}>
                {selectedGroups.size > 0 && (
                  <button
                    onClick={() => setConfirmDismiss(true)}
                    style={{ background: 'var(--danger)', color: '#fff', padding: '6px 12px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <X size={13} /> Ignorer {selectedGroups.size} groupe{selectedGroups.size !== 1 ? 's' : ''}
                  </button>
                )}
                {highConfidenceGroups.length > 0 && (
                  <button
                    onClick={() => setConfirmApprove(true)}
                    style={{ background: 'var(--success)', color: '#0f1117', padding: '6px 12px', fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <Zap size={13} /> Approuver tout ({highConfidenceGroups.length} haute confiance)
                  </button>
                )}
              </div>
            )}

            {groupsLoading ? (
              <p className="admin-loading">Chargement...</p>
            ) : groups.length === 0 ? (
              <p className="admin-empty">Aucun listing en attente{retailerFilter ? ' pour ce revendeur' : ''}.</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th style={{ width: '32px' }}>
                      <input
                        type="checkbox"
                        checked={selectedGroups.size === groups.length && groups.length > 0}
                        onChange={toggleSelectAll}
                        aria-label="Tout sélectionner"
                        style={{ cursor: 'pointer' }}
                      />
                    </th>
                    <th>Nom canonique</th>
                    <th>Catégorie</th>
                    <th>Revendeurs</th>
                    <th>Prix</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {groups.map((group) => (
                    <>
                      <tr
                        key={group.canonical_name}
                        style={{ cursor: 'pointer' }}
                        onClick={() => toggleGroup(group.canonical_name)}
                      >
                        <td onClick={e => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedGroups.has(group.canonical_name)}
                            onChange={() => toggleSelectGroup(group.canonical_name)}
                            aria-label={`Sélectionner ${group.canonical_name}`}
                            style={{ cursor: 'pointer' }}
                          />
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                              {expandedGroups.has(group.canonical_name) ? '▼' : '▶'}
                            </span>
                            <strong>{group.canonical_name}</strong>
                            {group.brand && <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{group.brand}</span>}
                            <span style={{ color: 'var(--text-dim)', fontSize: '11px' }}>
                              ({group.listing_count})
                            </span>
                          </div>
                        </td>
                        <td onClick={e => e.stopPropagation()}>
                          <ConfidenceBadge
                            confidence={group.confidence as 'high' | 'medium' | 'low' | 'unknown'}
                            category={group.category}
                          />
                        </td>
                        <td>{group.retailer_count}</td>
                        <td>
                          {group.price_min !== null && group.price_max !== null
                            ? group.price_min === group.price_max
                              ? `${group.price_min.toLocaleString('fr-MA')} MAD`
                              : `${group.price_min.toLocaleString('fr-MA')} – ${group.price_max.toLocaleString('fr-MA')} MAD`
                            : '—'}
                        </td>
                        <td onClick={e => e.stopPropagation()}>
                          <div className={styles.actions}>
                            <button
                              className={styles.linkBtn}
                              onClick={() => setCreateLinkTarget(group)}
                              title={group.existing_component_id ? 'Associer à l\'existant' : 'Créer et associer'}
                              aria-label={`Associer ${group.canonical_name}`}
                            >
                              <Link2 size={15} />
                              {group.existing_component_id ? 'Associer' : 'Créer'}
                            </button>
                            <button
                              className={styles.dismissBtn}
                              onClick={() => {
                                setSelectedGroups(new Set([group.canonical_name]));
                                setConfirmDismiss(true);
                              }}
                              title="Ignorer"
                              aria-label={`Ignorer ${group.canonical_name}`}
                            >
                              <X size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Expanded: individual listings */}
                      {expandedGroups.has(group.canonical_name) && group.listings.map(listing => (
                        <tr key={listing.id} style={{ background: 'var(--surface-2)', fontSize: '13px' }}>
                          <td />
                          <td style={{ paddingLeft: '32px' }}>
                            <a
                              href={listing.product_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={styles.productLink}
                            >
                              {listing.scraped_name}
                            </a>
                          </td>
                          <td style={{ color: 'var(--text-muted)' }}>{listing.retailer_name}</td>
                          <td>{listing.scraped_price ? `${Number(listing.scraped_price).toLocaleString('fr-MA')} MAD` : '—'}</td>
                          <td className={styles.date}>{new Date(listing.scraped_at).toLocaleDateString('fr-MA')}</td>
                          <td />
                        </tr>
                      ))}
                    </>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )
      }

      {/* ── GROUPED VIEW PAGINATION ── */}
      {viewMode === 'grouped' && Math.ceil(totalGroups / GROUP_PAGE_SIZE) > 1 && (
        <div className="admin-pagination">
          <button disabled={groupPage <= 1} onClick={() => setGroupPage(groupPage - 1)} aria-label="Page précédente">
            <ChevronLeft size={14} />
          </button>
          <span>{groupPage} / {Math.ceil(totalGroups / GROUP_PAGE_SIZE)} ({totalGroups} groupes)</span>
          <button disabled={groupPage >= Math.ceil(totalGroups / GROUP_PAGE_SIZE)} onClick={() => setGroupPage(groupPage + 1)} aria-label="Page suivante">
            <ChevronRight size={14} />
          </button>
        </div>
      )}

      {/* ── FLAT VIEW (existing, unchanged) ── */}
      {
        viewMode === 'flat' && (
          <>
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
                      <button disabled={page <= 1} onClick={() => setPage(page - 1)} aria-label="Page précédente">
                        <ChevronLeft size={14} />
                      </button>
                      <span>{page} / {totalPages} ({total} total)</span>
                      <button disabled={page >= totalPages} onClick={() => setPage(page + 1)} aria-label="Page suivante">
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  )}
                </>
              )
            )}
          </>
        )
      }

      {/* ── Flat view link modal (existing, unchanged) ── */}
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

      {/* ── Grouped view: Create & Link modal ── */}
      <CreateAndLinkModal
        group={createLinkTarget}
        isOpen={createLinkTarget !== null}
        onClose={() => setCreateLinkTarget(null)}
        onSuccess={handleCreateLinkSuccess}
      />

      {/* ── Confirm bulk dismiss ── */}
      {
        confirmDismiss && (
          <ConfirmDialog
            title="Ignorer les listings"
            message={`Ignorer ${selectedGroups.size} groupe${selectedGroups.size !== 1 ? 's' : ''} (${groups.filter(g => selectedGroups.has(g.canonical_name)).reduce((s, g) => s + g.listing_count, 0)} listings) ?`}
            confirmLabel="Ignorer"
            danger
            onConfirm={handleBulkDismiss}
            onCancel={() => setConfirmDismiss(false)}
          />
        )
      }

      {/* ── Confirm bulk approve ── */}
      {
        confirmApprove && (
          <ConfirmDialog
            title="Approuver les correspondances"
            message={`Associer ${highConfidenceGroups.reduce((s, g) => s + g.listing_count, 0)} listings à leurs composants existants (${highConfidenceGroups.length} groupes haute confiance) ?`}
            confirmLabel="Approuver"
            onConfirm={handleBulkApprove}
            onCancel={() => setConfirmApprove(false)}
          />
        )
      }
    </div >
  );
}
