/**
 * Presets page — browse curated PC builds grouped by use case.
 * Accessible at /presets
 */

import { useEffect, useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getPresets } from '../api';
import type { PresetBuild } from '../types';
import { CATEGORY_LABELS, slotKeyToCategory } from '../types';
import { formatComponentName } from '@shared/component-utils';
import { SkeletonCard } from '../components/Skeleton';
import { UI } from '../ui-strings';
import { formatPrice } from '../utils/format';
import styles from './Presets.module.css';

interface Props {
  onLoadPreset: (components: Record<string, number>) => void;
}

export function Presets({ onLoadPreset }: Props) {
  const [presets, setPresets] = useState<PresetBuild[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    getPresets()
      .then(setPresets)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  function handleLoad(preset: PresetBuild) {
    const componentIds: Record<string, number> = {};
    for (const [category, component] of Object.entries(preset.components)) {
      if (component.is_active) componentIds[category] = component.id;
    }
    onLoadPreset(componentIds);
    navigate('/build');
  }

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.pageHeader}>
          <Link to="/build" className={styles.back}>{UI.presets.back}</Link>
          <h1 className={styles.title}>{UI.presets.title}</h1>
        </div>
        <div className={styles.group}>
          <div className={styles.cards}>
            <SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard />
          </div>
        </div>
      </div>
    );
  }

  if (error) return <div className={styles.error}>{error}</div>;

  const grouped = presets.reduce<Record<string, PresetBuild[]>>((acc, p) => {
    if (!acc[p.use_case]) acc[p.use_case] = [];
    acc[p.use_case].push(p);
    return acc;
  }, {});

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <Link to="/build" className={styles.back}>{UI.presets.back}</Link>
        <h1 className={styles.title}>{UI.presets.title}</h1>
        <p className={styles.subtitle}>{UI.presets.subtitle}</p>
      </div>

      {Object.entries(grouped).map(([useCase, list]) => (
        <section key={useCase} className={styles.group}>
          <h2 className={styles.groupTitle}>{UI.presets.useCases[useCase] ?? useCase}</h2>
          <div className={styles.cards}>
            {list.map(preset => <PresetCard key={preset.id} preset={preset} onLoad={handleLoad} />)}
          </div>
        </section>
      ))}

      {presets.length === 0 && <p className={styles.empty}>{UI.presets.empty}</p>}
    </div>
  );
}

interface BoundingBox {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/**
 * Programmatically calculate the bounding box of non-white pixels in an image.
 * Uses an off-screen downscaled canvas to keep CPU scanning virtually instantaneous (< 1ms).
 */
function getNonWhiteBoundingBox(imgElement: HTMLImageElement): BoundingBox | null {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const maxDim = 120; // Fast scan bounds
  let w = imgElement.naturalWidth;
  let h = imgElement.naturalHeight;
  if (!w || !h) return null;

  if (w > maxDim || h > maxDim) {
    if (w > h) {
      h = Math.round((h * maxDim) / w);
      w = maxDim;
    } else {
      w = Math.round((w * maxDim) / h);
      h = maxDim;
    }
  }

  canvas.width = w;
  canvas.height = h;
  ctx.drawImage(imgElement, 0, 0, w, h);

  try {
    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;

    let minX = w;
    let minY = h;
    let maxX = 0;
    let maxY = 0;
    let found = false;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        const a = data[idx + 3];

        // Pixel is not white/off-white (RGB less than 250) and is visible
        if (a > 15 && (r < 250 || g < 250 || b < 250)) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
          found = true;
        }
      }
    }

    if (!found) return null;

    return {
      left: minX / w,
      top: minY / h,
      right: maxX / w,
      bottom: maxY / h,
    };
  } catch {
    return null; // Tainted canvas due to CORS
  }
}

interface AutofitImageProps {
  src: string;
  alt: string;
  className?: string;
}

/**
 * Premium Image Component that automatically centers and zooms
 * its content so that all product subjects appear at the exact same size.
 */
function AutofitImage({ src, alt, className }: AutofitImageProps) {
  const [transformStyle, setTransformStyle] = useState<string>('scale(1.35) translate(0%, 0%)');
  const imgRef = useRef<HTMLImageElement>(null);

  const handleLoad = () => {
    const img = imgRef.current;
    if (!img) return;

    const box = getNonWhiteBoundingBox(img);
    if (box) {
      const contentWidth = box.right - box.left;
      const contentHeight = box.bottom - box.top;

      if (contentWidth > 0 && contentHeight > 0) {
        // Find center of physical item
        const contentCenterX = box.left + contentWidth / 2;
        const contentCenterY = box.top + contentHeight / 2;
        
        // Calculate offset from actual container center (0.50, 0.50)
        const translateX = (0.50 - contentCenterX) * 100;
        const translateY = (0.50 - contentCenterY) * 100;

        // Auto-scale to fill 82% of container safely
        const targetFill = 0.82;
        const scaleX = targetFill / contentWidth;
        const scaleY = targetFill / contentHeight;
        const scale = Math.min(scaleX, scaleY, 2.5); // Cap scale to prevent pixelation

        setTransformStyle(`scale(${scale}) translate(${translateX}%, ${translateY}%)`);
      }
    }
  };

  const proxiedSrc = src && src.startsWith('http')
    ? `/api/builds/proxy-image?url=${encodeURIComponent(src)}`
    : src;

  useEffect(() => {
    setTransformStyle('scale(1.35) translate(0%, 0%)');
  }, [src]);

  return (
    <img
      ref={imgRef}
      src={proxiedSrc}
      alt={alt}
      className={className}
      onLoad={handleLoad}
      crossOrigin="anonymous"
      style={{
        transform: transformStyle,
        transformOrigin: 'center center',
        transition: 'transform 0.4s cubic-bezier(0.25, 1, 0.5, 1)',
      }}
    />
  );
}

function PresetCard({ preset, onLoad }: { preset: PresetBuild; onLoad: (p: PresetBuild) => void }) {
  const [expanded, setExpanded] = useState(false);
  const componentCount = Object.keys(preset.components).length;
  
  // Strictly display the case component to represent the visual build, using a premium placeholder if not defined
  const caseComponent = preset.components['case'] || Object.entries(preset.components).find(([key]) => key.startsWith('case'))?.[1];
  const heroImage = caseComponent?.image_url || '/premium_pc_hero.png';

  const componentEntries = Object.entries(preset.components);
  const coreCategories = ['cpu', 'gpu'];
  
  // Core components visible by default
  const coreEntries = componentEntries.filter(([slotKey]) => {
    const cat = slotKeyToCategory(slotKey);
    return coreCategories.includes(cat);
  });

  // Non-core components shown when expanded
  const otherEntries = componentEntries.filter(([slotKey]) => {
    const cat = slotKeyToCategory(slotKey);
    return !coreCategories.includes(cat);
  });

  const visibleEntries = expanded ? componentEntries : coreEntries;
  const remainingCount = otherEntries.length;

  return (
    <div className={`${styles.card} ${preset.incomplete ? styles.incomplete : ''} ${preset.is_featured ? styles.featured : ''}`}>
      <div className={styles.cardImageWrapper}>
        <AutofitImage src={heroImage} alt={preset.name} className={styles.cardImage} />
      </div>

      <div className={styles.cardHeader}>
        <div className={styles.nameWrap}>
          {preset.is_featured && <span className={styles.featuredBadge}>Populaire</span>}
          <h3 className={styles.cardName}>{preset.name}</h3>
        </div>
        {preset.incomplete && (
          <span className={styles.incompleteBadge} title={UI.presets.incompleteTitle}>
            {UI.presets.incomplete}
          </span>
        )}
      </div>

      {preset.description && <p className={styles.cardDesc}>{preset.description}</p>}

      <div className={styles.componentList}>
        {visibleEntries.map(([slotKey, component]) => {
          const cat = slotKeyToCategory(slotKey);
          const baseLabel = CATEGORY_LABELS[cat] ?? cat;
          const label = slotKey !== cat ? `${baseLabel} #${slotKey.replace(/^\w+_/, '')}` : baseLabel;
          return (
            <div key={slotKey} className={`${styles.componentRow} ${!component.is_active ? styles.inactive : ''}`}>
              <span className={styles.componentCat}>{label}</span>
              <span className={styles.componentName}>
                {formatComponentName({ ...component, category: cat })}
              </span>
            </div>
          );
        })}
      </div>

      {remainingCount > 0 && (
        <button 
          className={styles.toggleBtn} 
          onClick={() => setExpanded(!expanded)}
        >
          {expanded 
            ? `Masquer les détails ▲` 
            : `Voir les ${remainingCount} autres composants ▼`
          }
        </button>
      )}

      <div className={styles.cardFooter}>
        {preset.total_price_estimate && (
          <span className={styles.price}>~{formatPrice(preset.total_price_estimate)}</span>
        )}
        <button className={styles.loadBtn} onClick={() => onLoad(preset)} disabled={componentCount === 0}>
          {UI.presets.load}
        </button>
      </div>
    </div>
  );
}
