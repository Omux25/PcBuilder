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
  brand?: string | null;
  category: ComponentCategory;
  description?: string;
  specs?: Record<string, unknown>;
  image_url?: string;
  image_urls?: string[];
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
  // Cooling-specific compatibility fields
  supported_sockets?: string[];   // sockets this cooler mounts on (e.g. ['AM4','AM5','LGA1700'])
  max_tdp?: number;               // max CPU TDP the cooler can handle (W)
  // PSU-specific fields
  psu_form_factor?: string;       // ATX | SFX | SFX-L | TFX | Flex-ATX
  // Case-specific compatibility fields
  supported_psu_form_factors?: string[]; // PSU form factors the case accepts
  // RAM kit fields
  kit_count?: number;             // number of physical sticks in the kit (default 1)
  cas_latency?: number;           // CAS latency (e.g. 16 for CL16)
  capacity_gb?: number;           // Total capacity in GB (RAM kit total or Storage total)
  // CPU-specific fields
  core_count?: number;            // CPU: number of physical cores
  thread_count?: number;          // CPU: number of threads
  // GPU-specific fields
  vram_gb?: number;               // GPU: VRAM in GB
  // Schema enrichment (migration 036)
  chipset?: string;               // GPU: 'RTX 4090' | Motherboard: 'B650M', 'Z790'
  interface_type?: string;        // Storage: 'NVMe' | 'SATA' | 'HDD'
  read_speed_mbps?: number;       // Storage: sequential read MB/s
  write_speed_mbps?: number;      // Storage: sequential write MB/s
  efficiency_rating?: string;     // PSU: 'Gold' | 'Platinum' | 'Titanium' | 'Bronze'
  modular?: string;               // PSU: 'Full' | 'Semi' | 'Non'
  base_clock_ghz?: number;        // CPU: base clock GHz
  boost_clock_ghz?: number;       // CPU: boost clock GHz
  mpn?: string;                   // Manufacturer Part Number
  tags?: string[];                // ['rgb', 'white', 'nvme', 'wifi', ...]
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
  primary_price?: number | null;
  total_offers?: number;
  offers?: {
    retailer_name: string;
    price: number;
    in_stock: boolean;
    product_url: string;
  }[];
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
  is_featured?: boolean;
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
  image_url: string | null;
  image_urls: string[] | null;
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

import type { ComponentInput } from './schemas/component.schema.js';
export type { ComponentInput };

export interface ComponentFilters {
  category?: string;
  socket?: string;
  ram_type?: string;
  brand?: string;
  search?: string;
  sort?: string;
  vram_gb?: any;
  in_stock?: boolean;
  min_price?: number;
  max_price?: number;
  min_wattage?: number;
  max_wattage?: number;
  min_capacity_gb?: number;
  max_capacity_gb?: number;
  min_frequency_mhz?: number;
  max_frequency_mhz?: number;
  chipset?: string;
  form_factor?: string;
  interface_type?: string;
  efficiency_rating?: string;
  modular?: string;
  core_count?: number;
  include_inactive?: boolean;
  is_active?: boolean;
  sortBy?: string;
  sortOrder?: string;
  // Compatibility Hints (for sorting)
  compat_socket?: string;
  compat_ram_type?: string;
  compat_form_factors?: string[];
  cooling_type?: string;
}

/** The build configuration — one optional slot per category.
 *
 * Keys are either a base category ('cpu', 'motherboard', etc.) or an indexed
 * multi-slot key ('ram_1', 'ram_2', 'storage_1', 'storage_2', etc.).
 * Single-slot categories still use their plain name as the key.
 */
export type BuildConfig = Partial<Record<string, Component>>;

/** Derive the component category from a slot key (e.g. 'ram_2' → 'ram'). */
export function slotKeyToCategory(key: string): ComponentCategory {
    const base = key.replace(/_\d+$/, '');
    return base as ComponentCategory;
}

/** Returns true if the slot key is a multi-slot RAM key. */
export function isRamSlotKey(key: string): boolean {
    return key === 'ram' || /^ram_\d+$/.test(key);
}

/** Returns true if the slot key is a multi-slot storage key. */
export function isStorageSlotKey(key: string): boolean {
    return key === 'storage' || /^storage_\d+$/.test(key);
}

export * from './constants/build.constants.js';
