import type { Component } from '../types.js';

/**
 * Dynamically generates a uniform display name for a component based on its specifications.
 * 
 * Rules:
 * - Omits fields that are null or zero.
 * - Prioritizes Brand + Model (the 'name' column is now treated as 'model').
 * - Avoids duplicating information already present in the model name.
 */
export function formatComponentName(c: Partial<Component>, options: { excludeBrand?: boolean } = {}): string {
  if (!c.name) return 'Unknown Component';
  
  const brand = c.brand ? c.brand.trim() : '';
  const model = c.name.trim();
  const lowerModel = model.toLowerCase();
  
  // Base name
  let base = model;
  if (!options.excludeBrand && brand && !lowerModel.includes(brand.toLowerCase())) {
    base = `${brand} ${model}`;
  }

  const parts: string[] = [base];

  // Helper to append a spec if it's not already in the string
  const appendIfMissing = (spec: string | number | null | undefined, suffix: string = '') => {
    if (!spec) return;
    const str = `${spec}${suffix}`;
    if (!lowerModel.includes(str.toLowerCase().trim())) {
      parts.push(str);
    }
  };

  switch (c.category) {
    case 'cpu':
      break;

    case 'gpu':
      if (c.chipset) {
        if (!lowerModel.includes(c.chipset.toLowerCase())) {
          parts.push(c.chipset);
        }
      }
      appendIfMissing(c.vram_gb, 'GB');
      break;

    case 'ram':
      if (c.capacity_gb) {
        const totalCap = `${c.capacity_gb}GB`;
        
        if (!lowerModel.includes(totalCap.toLowerCase())) {
          const stickCap = (c.kit_count && c.kit_count > 1) 
            ? Math.round(c.capacity_gb / c.kit_count)
            : c.capacity_gb;
            
          const detail = c.kit_count && c.kit_count > 1 
            ? `${totalCap} (${c.kit_count}x${stickCap}GB)`
            : totalCap;
          parts.push(detail);
        }
      }
      appendIfMissing(c.ram_type);
      appendIfMissing(c.frequency_mhz, 'MHz');
      if (c.cas_latency && !lowerModel.includes(`cl${c.cas_latency}`)) {
        parts.push(`CL${c.cas_latency}`);
      }
      break;

    case 'storage':
      if (c.capacity_gb) {
        const cap = c.capacity_gb >= 1000 
            ? `${(c.capacity_gb / 1000).toFixed(0)}TB` 
            : `${c.capacity_gb}GB`;
        if (!lowerModel.includes(cap.toLowerCase())) {
          parts.push(cap);
        }
      }
      appendIfMissing(c.interface_type);
      break;

    case 'psu':
      appendIfMissing(c.wattage, 'W');
      if (c.efficiency_rating && !lowerModel.includes(c.efficiency_rating.toLowerCase())) {
        parts.push(c.efficiency_rating);
      }
      if (c.modular && c.modular !== 'Non' && !lowerModel.includes('modulaire') && !lowerModel.includes('modular')) {
        parts.push(`${c.modular} Modular`);
      }
      break;

    case 'motherboard':
      if (c.chipset) {
        if (!lowerModel.includes(c.chipset.toLowerCase())) {
            parts.push(c.chipset);
        }
      }
      appendIfMissing(c.form_factor);
      break;

    case 'case':
      appendIfMissing(c.form_factor);
      break;

    case 'cooling':
      if (c.size_mm) appendIfMissing(c.size_mm, 'mm');
      else if (c.height_mm) appendIfMissing(c.height_mm, 'mm');
      break;

    case 'fan':
      appendIfMissing(c.size_mm, 'mm');
      if (c.pack_size && c.pack_size > 1 && !lowerModel.includes('pack')) {
        parts.push(`Pack of ${c.pack_size}`);
      }
      break;
  }

  return parts.join(' ').replace(/\s+/g, ' ').trim();
}
