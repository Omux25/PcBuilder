/**
 * Zod validation schemas for each component category.
 *
 * Requirements: 8.2, 8.3, 11.2
 */

import { z } from 'zod';
import type { ComponentCategory as SharedCategory } from '@shared/types';

// ── Shared base ──────────────────────────────────────────────────────────────

const baseSchema = z.object({
  name: z.string().min(1),
  brand: z.string().nullable().optional(),
});

// ── Per-category schemas ─────────────────────────────────────────────────────

export const cpuSchema = baseSchema.extend({
  socket: z.string().min(1),
  tdp: z.number().optional(),
  core_count: z.number().int().positive().optional(),
  thread_count: z.number().int().positive().optional(),
  base_clock_ghz: z.number().positive().optional(),
  boost_clock_ghz: z.number().positive().optional(),
});

export const motherboardSchema = baseSchema.extend({
  socket: z.string().min(1),
  form_factor: z.string().optional(),
  supported_ram_types: z.array(z.string().min(1)).min(1),
  max_ram_frequency: z.number(),
  tdp: z.number().optional(),
  ram_slots: z.number().int().min(1).optional(),
  m2_slots: z.number().int().min(0).optional(),
  sata_ports: z.number().int().min(0).optional(),
  chipset: z.string().optional(),
});

export const gpuSchema = baseSchema.extend({
  length_mm: z.number(),
  tdp: z.number().optional(),
  vram_gb: z.number().int().positive().optional(),
  chipset: z.string().optional(),
});

export const ramSchema = baseSchema.extend({
  ram_type: z.enum(['DDR4', 'DDR5']),
  capacity_gb: z.number().int().positive(),
  frequency_mhz: z.number(),
  tdp: z.number().optional(),
  kit_count: z.number().int().min(1).max(8).optional(),
  cas_latency: z.number().int().min(1).max(99).optional(),
});

export const storageSchema = baseSchema.extend({
  interface: z.string().optional(),
  interface_type: z.string().optional(),
  tdp: z.number().optional(),
  capacity_gb: z.number().int().positive().optional(),
  read_speed_mbps: z.number().int().positive().optional(),
  write_speed_mbps: z.number().int().positive().optional(),
});

export const psuSchema = baseSchema.extend({
  wattage: z.number(),
  psu_form_factor: z.string().optional(),
  efficiency_rating: z.string().optional(),
  modular: z.string().optional(),
});

export const caseSchema = baseSchema.extend({
  max_gpu_length_mm: z.number(),
  form_factor: z.string().optional(),
  // Rule 5 (form_factor_mismatch): list of supported motherboard form factors
  // e.g. ['ATX', 'mATX', 'Mini-ITX']
  supported_motherboards: z.array(z.string().min(1)).optional(),
  // Rule 6 (cooler_too_tall): maximum CPU cooler height in mm
  max_cooler_height_mm: z.number().optional(),
  // Rule 12 (psu_form_factor_mismatch): list of PSU form factors the case accepts
  // e.g. ['ATX'] for a full tower, ['SFX', 'SFX-L'] for an ITX case
  supported_psu_form_factors: z.array(z.string().min(1)).optional(),
});

export const coolingSchema = baseSchema.extend({
  tdp: z.number().optional(),
  // Rule 6 (cooler_too_tall): cooler height in mm — required for the rule to fire
  height_mm: z.number().optional(),
  // Rule 10 (cooler_socket_mismatch): sockets this cooler supports
  supported_sockets: z.array(z.string().min(1)).optional(),
  // Rule 11 (cpu_cooler_tdp_insufficient): max CPU TDP this cooler can handle
  max_tdp: z.number().int().positive().optional(),
});

const VALID_FAN_SIZES = [80, 92, 120, 140, 200] as const;

export const fanSchema = baseSchema.extend({
  size_mm: z.number().int().refine(
    (v) => (VALID_FAN_SIZES as readonly number[]).includes(v),
    { message: `size_mm must be one of: ${VALID_FAN_SIZES.join(', ')}` },
  ),
  airflow_cfm: z.number().optional(),
  noise_db: z.number().optional(),
  rgb: z.boolean().optional(),
  pack_size: z.number().int().min(1).optional(),
});

export const thermalPasteSchema = baseSchema.extend({
  weight_grams: z.number().positive(),
  thermal_conductivity: z.number().optional(),
  paste_type: z.enum(['paste', 'liquid_metal', 'pad']).optional(),
});

// ── Category → schema map ────────────────────────────────────────────────────

export const componentSchemas = {
  cpu: cpuSchema,
  motherboard: motherboardSchema,
  gpu: gpuSchema,
  ram: ramSchema,
  storage: storageSchema,
  psu: psuSchema,
  case: caseSchema,
  cooling: coolingSchema,
  fan: fanSchema,
  thermal_paste: thermalPasteSchema,
} as const;

export type ComponentCategory = SharedCategory;

// ── Typed input for service layer ────────────────────────────────────────────

/**
 * Union of all validated component shapes.
 * Used as the parameter type for createComponent() and updateComponent()
 * so the service layer has compile-time safety instead of Record<string, unknown>.
 */
export type ComponentInput =
  | (z.infer<typeof cpuSchema> & { category: 'cpu'; description?: string; specs?: Record<string, unknown>; image_url?: string; image_urls?: string[]; release_year?: number })
  | (z.infer<typeof motherboardSchema> & { category: 'motherboard'; description?: string; specs?: Record<string, unknown>; image_url?: string; image_urls?: string[]; release_year?: number })
  | (z.infer<typeof gpuSchema> & { category: 'gpu'; description?: string; specs?: Record<string, unknown>; image_url?: string; image_urls?: string[]; release_year?: number })
  | (z.infer<typeof ramSchema> & { category: 'ram'; description?: string; specs?: Record<string, unknown>; image_url?: string; image_urls?: string[]; release_year?: number })
  | (z.infer<typeof storageSchema> & { category: 'storage'; description?: string; specs?: Record<string, unknown>; image_url?: string; image_urls?: string[]; release_year?: number })
  | (z.infer<typeof psuSchema> & { category: 'psu'; description?: string; specs?: Record<string, unknown>; image_url?: string; image_urls?: string[]; release_year?: number })
  | (z.infer<typeof caseSchema> & { category: 'case'; description?: string; specs?: Record<string, unknown>; image_url?: string; image_urls?: string[]; release_year?: number; form_factor?: string })
  | (z.infer<typeof coolingSchema> & { category: 'cooling'; description?: string; specs?: Record<string, unknown>; image_url?: string; image_urls?: string[]; release_year?: number })
  | (z.infer<typeof fanSchema> & { category: 'fan'; description?: string; specs?: Record<string, unknown>; image_url?: string; image_urls?: string[]; release_year?: number })
  | (z.infer<typeof thermalPasteSchema> & { category: 'thermal_paste'; description?: string; specs?: Record<string, unknown>; image_url?: string; image_urls?: string[]; release_year?: number });
