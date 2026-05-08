/**
 * Core domain types shared across Frontend, Admin, and Backend.
 */

export type ComponentCategory =
  | 'cpu' | 'motherboard' | 'gpu' | 'ram'
  | 'storage' | 'psu' | 'case' | 'cooling'
  | 'fan' | 'thermal_paste' | 'monitor'
  | 'keyboard' | 'mouse' | 'headphones' | 'speakers' | 'webcam'
  | 'os' | 'wired_network_adapter' | 'wireless_network_adapter'
  | 'sound_card' | 'case_accessory' | 'fan_controller'
  | 'external_storage' | 'optical_drive' | 'ups' | 'accessory';

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
  // Motherboard slot counts — used by ram_slots_exceeded and storage_slots_exceeded rules
  ram_slots?: number;
  m2_slots?: number;
  sata_ports?: number;
  // Fan-specific fields
  size_mm?: number;
  airflow_cfm?: number;
  noise_db?: number;
  rgb?: boolean;
  pack_size?: number;
  // Thermal paste-specific fields
  weight_grams?: number;
  thermal_conductivity?: number;
  paste_type?: 'paste' | 'liquid_metal' | 'pad';
  created_at: string;
  updated_at: string;
  lowest_price?: number | null;
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
  manual_category: string | null;
  linked_component_id: number | null;
  scraped_at: string;
}

export interface AdminRetailer {
  id: number;
  name: string;
  base_url: string;
  logo_url: string | null;
  country: string;
  is_active: boolean;
  scraping_enabled: boolean;
  scraping_interval_hours: number;
  last_scrape_at: string | null;
  last_scrape_status: 'SUCCESS' | 'PARTIAL' | 'FAILED' | null;
  price_records_count: number | null;
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
  cpu: 'Processeur (CPU)',
  motherboard: 'Carte mère',
  gpu: 'Carte graphique (GPU)',
  ram: 'Mémoire RAM',
  storage: 'Stockage',
  psu: 'Alimentation (PSU)',
  case: 'Boîtier',
  cooling: 'Refroidissement',
  fan: 'Ventilateur',
  thermal_paste: 'Pâte thermique',
  monitor: 'Écran',
  keyboard: 'Clavier',
  mouse: 'Souris',
  headphones: 'Casque / Audio',
  speakers: 'Enceintes',
  webcam: 'Webcam',
  os: 'Système d\'exploitation',
  wired_network_adapter: 'Réseau (Filaire)',
  wireless_network_adapter: 'Réseau (WiFi)',
  sound_card: 'Carte son',
  case_accessory: 'Accessoire boîtier',
  fan_controller: 'Contrôleur ventilateur',
  external_storage: 'Stockage externe',
  optical_drive: 'Lecteur optique',
  ups: 'Onduleur (UPS)',
  accessory: 'Autre accessoire',
};

export const RULE_LABELS: Record<string, string> = {
  socket_mismatch: 'Incompatibilité de socket',
  ram_type_mismatch: 'Type de RAM incompatible',
  ram_frequency_exceeded: 'Fréquence RAM dépassée',
  gpu_too_long: 'GPU trop long pour le boîtier',
  psu_underpowered: 'Alimentation insuffisante',
  form_factor_mismatch: 'Format de carte mère incompatible',
  cooler_too_tall: 'Refroidissement trop haut pour le boîtier',
  ram_slots_exceeded: 'Trop de barrettes RAM',
  storage_slots_exceeded: 'Trop de disques de stockage',
};

export const RULE_TOOLTIPS: Record<string, string> = {
  socket_mismatch: 'Le processeur et la carte mère doivent avoir le même socket (ex: AM5) pour fonctionner ensemble.',
  ram_type_mismatch: 'La carte mère ne supporte pas ce type de RAM (DDR4 vs DDR5).',
  ram_frequency_exceeded: 'La RAM fonctionnera à une vitesse inférieure, limitée par la carte mère ou le processeur.',
  gpu_too_long: 'La carte graphique est trop longue et ne rentrera pas physiquement dans ce boîtier.',
  psu_underpowered: 'L\'alimentation choisie n\'offre pas assez de puissance pour faire tourner ces composants de manière stable.',
  form_factor_mismatch: 'La carte mère ne rentre pas dans ce boîtier. Vérifiez les formats supportés (ATX, mATX, ITX).',
  cooler_too_tall: 'Le ventirad CPU est trop haut pour ce boîtier. Vérifiez la hauteur maximale supportée.',
  ram_slots_exceeded: 'La carte mère n\'a pas assez de slots DIMM pour le nombre de barrettes RAM sélectionnées.',
  storage_slots_exceeded: 'La carte mère n\'a pas assez de ports M.2 et SATA pour le nombre de disques sélectionnés.',
};

export const CORE_CATEGORIES: ComponentCategory[] = [
  'cpu', 'cooling', 'motherboard', 'ram', 'storage', 'gpu', 'case', 'psu', 'os'
];

export const CATEGORY_GROUPS: { label: string; categories: ComponentCategory[] }[] = [
  {
    label: 'Cartes d\'extension / Réseau',
    categories: ['sound_card', 'wired_network_adapter', 'wireless_network_adapter']
  },
  {
    label: 'Périphériques',
    categories: ['monitor', 'keyboard', 'mouse', 'headphones', 'speakers', 'webcam']
  },
  {
    label: 'Accessoires / Autres',
    categories: [
      'fan', 'case_accessory', 'fan_controller', 'thermal_paste',
      'external_storage', 'optical_drive', 'ups', 'accessory'
    ]
  }
];

export const CATEGORY_ORDER: ComponentCategory[] = [
  ...CORE_CATEGORIES,
  ...CATEGORY_GROUPS.flatMap(g => g.categories)
];

