import { z } from 'zod';

// ── Shared base ──────────────────────────────────────────────────────────────

export const componentCategorySchema = z.enum([
  'cpu', 'motherboard', 'gpu', 'ram', 'storage', 'psu', 'case', 'cooling',
  'fan', 'thermal_paste', 'monitor', 'keyboard', 'mouse', 'headphones',
  'speakers', 'webcam', 'os', 'wired_network_adapter',
  'wireless_network_adapter', 'sound_card', 'case_accessory',
  'fan_controller', 'external_storage', 'optical_drive', 'ups', 'accessory'
]);

export const baseComponentSchema = z.object({
  name: z.string().min(1, 'Le nom est requis'),
  brand: z.string().nullable().optional(),
  category: componentCategorySchema,
  mpn: z.string().nullable().optional(),
  ean: z.string().nullable().optional(),
  description: z.string().optional(),
  release_year: z.number().int().optional(),
  is_active: z.boolean().default(true),
  specs: z.record(z.string(), z.unknown()).default({}),
});

// Helper to preprocess comma-separated string inputs to arrays of strings
const stringOrArrayToArray = (inner: z.ZodTypeAny = z.array(z.string().min(1))) => z.preprocess((val) => {
  if (typeof val === 'string') {
    return val.split(',').map(s => s.trim()).filter(Boolean);
  }
  return val;
}, inner);

export const cpuSpecsSchema = baseComponentSchema.extend({
  category: z.literal('cpu'),
  socket: z.string().min(1, 'Socket requis'),
  tdp: z.number().optional(),
  core_count: z.number().int().positive().optional(),
  thread_count: z.number().int().positive().optional(),
  base_clock_ghz: z.number().positive().optional(),
  boost_clock_ghz: z.number().positive().optional(),
});

export const motherboardSpecsSchema = baseComponentSchema.extend({
  category: z.literal('motherboard'),
  socket: z.string().min(1, 'Socket requis'),
  form_factor: z.string().optional(),
  supported_ram_types: stringOrArrayToArray(z.array(z.string().min(1)).min(1, 'Au moins un type de RAM requis')),
  max_ram_frequency: z.number(),
  ram_slots: z.number().int().min(1).optional(),
  m2_slots: z.number().int().min(0).optional(),
  sata_ports: z.number().int().min(0).optional(),
  chipset: z.string().optional(),
});

export const gpuSpecsSchema = baseComponentSchema.extend({
  category: z.literal('gpu'),
  length_mm: z.number().nullable(),
  tdp: z.number().optional(),
  vram_gb: z.number().int().positive().optional(),
  chipset: z.string().optional(),
});

export const ramSpecsSchema = baseComponentSchema.extend({
  category: z.literal('ram'),
  ram_type: z.enum(['DDR4', 'DDR5']),
  capacity_gb: z.number().int().positive(),
  frequency_mhz: z.number(),
  kit_count: z.number().int().min(1).max(8).optional(),
  cas_latency: z.number().int().min(1).max(99).optional(),
});

export const storageSpecsSchema = baseComponentSchema.extend({
  category: z.literal('storage'),
  interface_type: z.string().optional(),
  capacity_gb: z.number().int().positive().optional(),
  read_speed_mbps: z.number().int().positive().optional(),
  write_speed_mbps: z.number().int().positive().optional(),
});

export const psuSpecsSchema = baseComponentSchema.extend({
  category: z.literal('psu'),
  wattage: z.number(),
  psu_form_factor: z.string().optional(),
  efficiency_rating: z.string().optional(),
  modular: z.string().optional(),
});

export const caseSpecsSchema = baseComponentSchema.extend({
  category: z.literal('case'),
  max_gpu_length_mm: z.number(),
  form_factor: z.string().optional(),
  supported_motherboards: stringOrArrayToArray().optional(),
  max_cooler_height_mm: z.number().optional(),
  supported_psu_form_factors: stringOrArrayToArray().optional(),
});

export const coolingSpecsSchema = baseComponentSchema.extend({
  category: z.literal('cooling'),
  height_mm: z.number().optional(),
  supported_sockets: stringOrArrayToArray().optional(),
  max_tdp: z.number().int().positive().optional(),
});

export const fanSpecsSchema = baseComponentSchema.extend({
  category: z.literal('fan'),
  size_mm: z.number().int(),
  airflow_cfm: z.number().optional(),
  noise_db: z.number().optional(),
  rgb: z.boolean().optional(),
  pack_size: z.number().int().min(1).optional(),
});

export const thermalPasteSpecsSchema = baseComponentSchema.extend({
  category: z.literal('thermal_paste'),
  weight_grams: z.number().positive(),
  thermal_conductivity: z.number().optional(),
  paste_type: z.enum(['paste', 'liquid_metal', 'pad']).optional(),
});

// ── Discriminated Union for All Components ───────────────────────────────────

export const componentSchema = z.discriminatedUnion('category', [
  cpuSpecsSchema,
  motherboardSpecsSchema,
  gpuSpecsSchema,
  ramSpecsSchema,
  storageSpecsSchema,
  psuSpecsSchema,
  caseSpecsSchema,
  coolingSpecsSchema,
  fanSpecsSchema,
  thermalPasteSpecsSchema,
  // Fallback for other categories that only use base schema
  baseComponentSchema.extend({
    category: z.enum([
      'monitor', 'keyboard', 'mouse', 'headphones', 'speakers', 'webcam',
      'os', 'wired_network_adapter', 'wireless_network_adapter', 'sound_card',
      'case_accessory', 'fan_controller', 'external_storage', 'optical_drive',
      'ups', 'accessory'
    ])
  })
]);

export type ComponentInput = z.infer<typeof componentSchema>;
export type ComponentCategory = z.infer<typeof componentCategorySchema>;
