import type { Component } from '../types.js';

/**
 * Dynamically generates a uniform display name for a component based on its specifications.
 * 
 * Rules:
 * - Omits fields that are null or zero.
 * - Prioritizes Brand + Model (the 'name' column is now treated as 'model').
 */
export function formatComponentName(c: Partial<Component>): string {
  if (!c.name) return 'Unknown Component';
  
  const brand = c.brand ? c.brand.trim() : '';
  const model = c.name.trim();
  
  // Base name is always Brand + Model (if brand isn't already in model)
  let base = model;
  if (brand && !model.toLowerCase().startsWith(brand.toLowerCase())) {
    base = `${brand} ${model}`;
  }

  const parts: string[] = [base];

  switch (c.category) {
    case 'cpu':
      // Usually brand + model is enough for CPU (e.g. Intel Core i9 14900K)
      // but we could add core count if we want more detail.
      break;

    case 'gpu':
      if (c.vram_gb) parts.push(`${c.vram_gb}GB`);
      break;

    case 'ram':
      if (c.capacity_gb) {
        const totalCap = c.kit_count && c.kit_count > 1 
            ? `${c.kit_count * c.capacity_gb}GB (${c.kit_count}x${c.capacity_gb}GB)`
            : `${c.capacity_gb}GB`;
        parts.push(totalCap);
      }
      if (c.ram_type) parts.push(c.ram_type);
      if (c.frequency_mhz) parts.push(`${c.frequency_mhz}MHz`);
      if (c.cas_latency) parts.push(`CL${c.cas_latency}`);
      break;

    case 'storage':
      if (c.capacity_gb) {
        const cap = c.capacity_gb >= 1000 
            ? `${(c.capacity_gb / 1000).toFixed(0)}TB` 
            : `${c.capacity_gb}GB`;
        parts.push(cap);
      }
      if (c.interface_type) parts.push(c.interface_type);
      break;

    case 'psu': {
      if (c.wattage) parts.push(`${c.wattage}W`);
      if (c.efficiency_rating) {
        parts.push(c.efficiency_rating);
        // Remove the rating from the model name to avoid duplicates
        const ratingWord = c.efficiency_rating.replace('80+ ', '').toLowerCase();
        parts[0] = parts[0]
            .replace(new RegExp(`\\b80\\+\\s*${ratingWord}\\b`, 'gi'), '')
            .replace(new RegExp(`\\b${ratingWord}\\b`, 'gi'), '')
            .replace(/\s+/g, ' ').trim();
      }
      if (c.modular && c.modular !== 'Non') parts.push(`${c.modular} Modular`);
      break;
    }

    case 'motherboard':
      if (c.chipset) {
        // Only add chipset if not already in model name
        if (!model.toLowerCase().includes(c.chipset.toLowerCase())) {
            parts.push(c.chipset);
        }
      }
      if (c.form_factor) parts.push(c.form_factor);
      break;

    case 'case':
      if (c.form_factor) parts.push(c.form_factor);
      break;

    case 'cooling':
      if (c.size_mm) parts.push(`${c.size_mm}mm`);
      else if (c.height_mm) parts.push(`${c.height_mm}mm`);
      break;

    case 'fan':
      if (c.size_mm) parts.push(`${c.size_mm}mm`);
      if (c.pack_size && c.pack_size > 1) parts.push(`Pack of ${c.pack_size}`);
      break;
  }

  return parts.join(' ').replace(/\s+/g, ' ').trim();
}
