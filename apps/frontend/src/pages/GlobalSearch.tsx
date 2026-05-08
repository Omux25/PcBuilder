/**
 * GlobalSearch — cross-category search results page.
 * Accessible at /search?q=ryzen+7
 *
 * Searches across all 8 categories simultaneously and groups results by category.
 */

import { useEffect, useState, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, X } from 'lucide-react';
import { getComponents } from '../api';
import { CategoryIcon } from '../components/CategoryIcon';
import type { Component, ComponentCategory } from '../types';
import { CATEGORY_LABELS, CATEGORY_ORDER } from '../types';
import { UI } from '../ui-strings';
import styles from './GlobalSearch.module.css';

const MAX_PER_CATEGORY = 5;

interface CategoryResults {
  category: ComponentCategory;
  components: Component[];
  total: number;
}

export function GlobalSearch() {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get('q') ?? '';

  const [input, setInput] = useState(query);
  const [results, setResults] = useState<CategoryResults[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    if (!query.trim()) { setResults([]); setSearched(false); return; }
    setLoading(true);
    setSearched(false);
    Promise.all(
      CATEGORY_ORDER.map(cat =>
        getComponents({ category: cat, search: query, limit: MAX_PER_CATEGORY })
          .then(({ components, total }) => ({ category: cat, components, total }))
          .catch(() => ({ category: cat, components: [], total: 0 }))
      )
    ).then(all => {
      setResults(all.filter(r => r.total > 0));
      setSearched(true);
    }).finally(() => setLoading(false));
  }, [query]);

  function handleInput(val: string) {
    setInput(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (val.trim()) setSearchParams({ q: val.trim() }, { replace: true });
      else setSearchParams({}, { replace: true });
    }, 350);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (input.trim()) setSearchParams({ q: input.trim() });
  }

  const totalResults = results.reduce((sum, r) => sum + r.total, 0);

  return (
    <div className={styles.page}>
      <div className={styles.searchSection}>
        <form className={styles.searchForm} onSubmit={handleSubmit}>
          <div className={styles.searchWrap}>
            <Search size={18} className={styles.searchIcon} />
            <input
              ref={inputRef}
              type="search"
              className={styles.searchInput}
              placeholder={UI.search.placeholder}
              value={input}
              onChange={e => handleInput(e.target.value)}
              autoComplete="off"
            />
            {input && (
              <button type="button" className={styles.clearBtn}
                onClick={() => { setInput(''); setSearchParams({}); inputRef.current?.focus(); }}>
                <X size={16} />
              </button>
            )}
          </div>
        </form>

        {query && searched && (
          <p className={styles.resultCount}>
            {loading ? UI.search.searching : (
              totalResults > 0
                ? UI.search.results(totalResults, query)
                : UI.search.noResults(query)
            )}
          </p>
        )}
      </div>

      {loading && (
        <div className={styles.skeletonWrap}>
          {[1, 2, 3].map(i => (
            <div key={i} className={styles.skeletonGroup}>
              <div className={styles.skeletonTitle} />
              {[1, 2, 3].map(j => <div key={j} className={styles.skeletonRow} />)}
            </div>
          ))}
        </div>
      )}

      {!loading && results.length > 0 && (
        <div className={styles.results}>
          {results.map(({ category, components, total }) => (
            <section key={category} className={styles.group}>
              <div className={styles.groupHeader}>
                <span className={styles.groupIcon}><CategoryIcon category={category} size={16} /></span>
                <h2 className={styles.groupTitle}>{CATEGORY_LABELS[category]}</h2>
                <span className={styles.groupCount}>{UI.search.groupCount(total)}</span>
                {total > MAX_PER_CATEGORY && (
                  <Link to={`/browse/${category}?q=${encodeURIComponent(query)}`} className={styles.seeAll}>
                    {UI.search.seeAll}
                  </Link>
                )}
              </div>
              <div className={styles.componentList}>
                {components.map(c => (
                  <Link key={c.id} to={`/product/${c.slug}`} className={styles.componentRow}>
                    {c.image_url ? (
                      <img src={c.image_url} alt={c.name} className={styles.componentImg} referrerPolicy="no-referrer" />
                    ) : (
                      <div className={styles.componentImgPlaceholder}>
                        <CategoryIcon category={c.category as ComponentCategory} size={18} />
                      </div>
                    )}
                    <div className={styles.componentInfo}>
                      {c.brand && <span className={styles.componentBrand}>{c.brand}</span>}
                      <span className={styles.componentName}>{c.name}</span>
                      {getKeySpec(c) && <span className={styles.componentSpec}>{getKeySpec(c)}</span>}
                    </div>
                    <span className={styles.componentArrow}>→</span>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {!loading && searched && results.length === 0 && (
        <div className={styles.empty}>
          <Search size={40} className={styles.emptyIcon} />
          <p className={styles.emptyTitle}>{UI.search.emptyTitle(query)}</p>
          <p className={styles.emptyHint}>{UI.search.emptyHint}</p>
          <div className={styles.suggestions}>
            <p className={styles.suggestLabel}>{UI.search.suggestions}</p>
            {CATEGORY_ORDER.map(cat => (
              <Link key={cat} to={`/browse/${cat}`} className={styles.suggestLink}>
                <CategoryIcon category={cat} size={13} />
                {CATEGORY_LABELS[cat]}
              </Link>
            ))}
          </div>
        </div>
      )}

      {!query && !loading && (
        <div className={styles.initial}>
          <p className={styles.initialHint}>{UI.search.browseBy}</p>
          <div className={styles.catGrid}>
            {CATEGORY_ORDER.map(cat => (
              <Link key={cat} to={`/browse/${cat}`} className={styles.catCard}>
                <CategoryIcon category={cat} size={24} />
                <span>{CATEGORY_LABELS[cat]}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function getKeySpec(c: Component): string | null {
  const specs = c.specs as Record<string, unknown> | undefined;
  const get = (k: string) => specs?.[k] ?? (c as unknown as Record<string, unknown>)[k];
  switch (c.category) {
    case 'cpu': return c.socket ? `Socket ${c.socket}` : null;
    case 'motherboard': return c.socket ? `Socket ${c.socket}` : null;
    case 'gpu': return get('vram_gb') ? `${get('vram_gb')} Go VRAM` : null;
    case 'ram': return c.ram_type && c.frequency_mhz ? `${c.ram_type} ${c.frequency_mhz} MHz` : null;
    case 'storage': return get('capacity_gb') ? `${get('capacity_gb')} Go` : null;
    case 'psu': return c.wattage ? `${c.wattage}W` : null;
    case 'case': return c.max_gpu_length_mm ? `GPU max ${c.max_gpu_length_mm}mm` : null;
    default: return null;
  }
}
