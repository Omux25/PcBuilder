/**
 * Shared TypeScript interfaces — mirror the backend API response shapes.
 */

export type ComponentCategory =
  | 'cpu' | 'motherboard' | 'gpu' | 'ram'
  | 'storage' | 'psu' | 'case' | 'cooling';

export interface Component {
  id: number;
  slug: string;
  name: string;
  brand?: string;
  category: ComponentCategory;
  description?: string;
  specs?: Record<string, unknown>;
  image_url?: string;
  release_year?: number;
  is_active: boolean;
  // Legacy flat columns — still used by compatibility engine
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
  retailer_id: number;
  retailer_name: string;
  price: number;
  in_stock: boolean;
  product_url: string;
  last_updated: string;
}

export interface PriceHistoryEntry {
  retailer_id: number;
  retailer_name: string;
  price: number;
  in_stock: boolean;
  recorded_at: string;
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

export interface PresetBuild {
  id: number;
  name: string;
  description?: string;
  use_case: 'gaming' | 'workstation' | 'office' | 'budget';
  total_price_estimate?: number;
  incomplete: boolean;
  components: Record<string, Pick<Component, 'id' | 'slug' | 'name' | 'brand' | 'image_url' | 'is_active'>>;
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
  cooling:     'Refroidissement',
};

export const RULE_LABELS: Record<string, string> = {
  socket_mismatch:       'Incompatibilité de socket',
  ram_type_mismatch:     'Type de RAM incompatible',
  ram_frequency_exceeded:'Fréquence RAM dépassée',
  gpu_too_long:          'GPU trop long pour le boîtier',
  psu_underpowered:      'Alimentation insuffisante',
};

export const CATEGORY_ORDER: ComponentCategory[] = [
  'cpu', 'motherboard', 'gpu', 'ram', 'storage', 'psu', 'case', 'cooling',
];
