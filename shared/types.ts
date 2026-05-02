/**
 * Core domain types shared across Frontend, Admin, and Backend.
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
  // Compatibility/Spec columns
  socket?: string;
  supported_ram_types?: string[];
  max_ram_frequency?: number;
  ram_type?: string;
  frequency_mhz?: number;
  length_mm?: number;
  max_gpu_length_mm?: number;
  supported_motherboards?: string[];
  max_cooler_height_mm?: number;
  form_factor?: string;
  height_mm?: number;
  wattage?: number;
  tdp?: number;
  benchmark_score?: number;
  created_at: string;
  updated_at: string;
}

export interface PriceOffer {
  retailer_id: number;
  retailer_name: string;
  price: number;
  in_stock: boolean;
  product_url: string;
  variant_label: string | null;
  variant_details: Record<string, unknown> | null;
  last_updated: string;
}

export interface PriceHistoryEntry {
  retailer_id: number;
  retailer_name: string;
  price: number;
  in_stock: boolean;
  recorded_at: string;
}

export interface CompatibilityIssue {
  rule: string;
  components: string[];
  message: string;
}

export interface CompatibilityResult {
  compatible: boolean;
  total_tdp: number;
  recommended_psu_wattage: number;
  errors: CompatibilityIssue[];
  warnings: CompatibilityIssue[];
}

export interface PresetComponent {
  id: number;
  slug: string;
  name: string;
  brand?: string;
  image_url?: string;
  is_active: boolean;
}

export interface PresetBuild {
  id: number;
  name: string;
  description?: string;
  use_case: 'gaming' | 'workstation' | 'office' | 'budget';
  total_price_estimate?: number;
  is_active: boolean;
  incomplete: boolean;
  components: Record<string, PresetComponent>;
  created_at: string;
  updated_at: string;
}

export interface LogEntry {
  id: number;
  level: 'INFO' | 'WARNING' | 'ERROR';
  site: string | null;
  message: string;
  created_at: string;
}

export interface UnmatchedListing {
  id: number;
  retailer_id: number;
  retailer_name?: string; // Joined from retailers table
  product_url: string;
  scraped_name: string;
  scraped_price: number;
  status: 'pending' | 'linked' | 'dismissed';
  linked_component_id: number | null;
  scraped_at: string;
}

export interface AdminRetailer {
  id: number;
  name: string;
  base_url: string;
  logo_url: string | null;
  country: string;
  scraping_interval_hours: number;
  last_scrape_at: string | null;
  last_scrape_status: 'SUCCESS' | 'PARTIAL' | 'FAILED' | null;
  price_records_count: number | null;
  is_active: boolean;
}

export interface DashboardData {
  stats: {
    total_components: number;
    components_by_category: Record<string, number>;
    active_retailers: number;
    total_retailers: number;
    total_price_records: number;
    unmatched_listings_count: number;
    last_scrape: {
      time: string | null;
      status: string | null;
    };
  };
  price_updates_chart: Array<{ date: string; count: number }>;
  recent_activity: Array<{
    id: number;
    action: string;
    entity_type: string | null;
    entity_id: number | null;
    created_at: string;
  }>;
}

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
  form_factor_mismatch:  'Format de carte mère incompatible',
  cooler_too_tall:       'Refroidissement trop haut pour le boîtier',
};

export const RULE_TOOLTIPS: Record<string, string> = {
  socket_mismatch:       'Le processeur et la carte mère doivent avoir le même socket (ex: AM5) pour fonctionner ensemble.',
  ram_type_mismatch:     'La carte mère ne supporte pas ce type de RAM (DDR4 vs DDR5).',
  ram_frequency_exceeded:'La RAM fonctionnera à une vitesse inférieure, limitée par la carte mère ou le processeur.',
  gpu_too_long:          'La carte graphique est trop longue et ne rentrera pas physiquement dans ce boîtier.',
  psu_underpowered:      'L\'alimentation choisie n\'offre pas assez de puissance pour faire tourner ces composants de manière stable.',
  form_factor_mismatch:  'La carte mère ne rentre pas dans ce boîtier. Vérifiez les formats supportés (ATX, mATX, ITX).',
  cooler_too_tall:       'Le ventirad CPU est trop haut pour ce boîtier. Vérifiez la hauteur maximale supportée.',
};

export const CATEGORY_ORDER: ComponentCategory[] = [
  'cpu', 'motherboard', 'gpu', 'ram', 'storage', 'psu', 'case', 'cooling',
];

