/**
 * Shared TypeScript interfaces — mirror the backend API response shapes.
 */

export type ComponentCategory = 'cpu' | 'motherboard' | 'gpu' | 'ram' | 'storage' | 'psu' | 'case';

export interface Component {
  id: number;
  name: string;
  brand?: string;
  category: ComponentCategory;
  socket?: string;
  supported_ram_types?: string[];
  max_ram_frequency?: number;
  ram_type?: string;
  frequency_mhz?: number;
  length_mm?: number;
  max_gpu_length_mm?: number;
  wattage?: number;
  tdp?: number;
  created_at: string;
  updated_at: string;
}

export interface PriceOffer {
  retailer_name: string;
  price: number;
  in_stock: boolean;
  product_url: string;
  last_updated: string;
}

export interface CompatibilityError {
  rule: string;
  components: string[];
  message: string;
}

export interface CompatibilityWarning {
  rule: string;
  components: string[];
  message: string;
}

export interface CompatibilityResult {
  compatible: boolean;
  total_tdp: number;
  recommended_psu_wattage: number;
  errors: CompatibilityError[];
  warnings: CompatibilityWarning[];
}

/** The build configuration — one optional slot per category. */
export type BuildConfig = Partial<Record<ComponentCategory, Component>>;

export const CATEGORY_LABELS: Record<ComponentCategory, string> = {
  cpu:         'Processeur (CPU)',
  motherboard: 'Carte mère',
  gpu:         'Carte graphique (GPU)',
  ram:         'Mémoire RAM',
  storage:     'Stockage',
  psu:         'Alimentation (PSU)',
  case:        'Boîtier',
};

export const CATEGORY_ORDER: ComponentCategory[] = [
  'cpu', 'motherboard', 'gpu', 'ram', 'storage', 'psu', 'case',
];
