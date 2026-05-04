/**
 * Zod validation schemas for each component category.
 *
 * Requirements: 8.2, 8.3, 11.2
 */

import { z } from 'zod/v4';
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
});

export const motherboardSchema = baseSchema.extend({
  socket: z.string().min(1),
  supported_ram_types: z.array(z.string().min(1)).min(1),
  max_ram_frequency: z.number(),
  tdp: z.number().optional(),
  // Slot counts — optional, used by multi-slot compatibility rules
  ram_slots: z.number().int().min(1).optional(),
  m2_slots: z.number().int().min(0).optional(),
  sata_ports: z.number().int().min(0).optional(),
});

export const gpuSchema = baseSchema.extend({
  length_mm: z.number(),
  tdp: z.number().optional(),
});

export const ramSchema = baseSchema.extend({
  ram_type: z.enum(['DDR4', 'DDR5']),
  frequency_mhz: z.number(),
  tdp: z.number().optional(),
});

export const storageSchema = baseSchema.extend({
  tdp: z.number().optional(),
});

export const psuSchema = baseSchema.extend({
  wattage: z.number(),
});

export const caseSchema = baseSchema.extend({
  max_gpu_length_mm: z.number(),
  // Rule 5 (form_factor_mismatch): list of supported motherboard form factors
  // e.g. ['ATX', 'mATX', 'Mini-ITX']
  supported_motherboards: z.array(z.string().min(1)).optional(),
  // Rule 6 (cooler_too_tall): maximum CPU cooler height in mm
  max_cooler_height_mm: z.number().optional(),
});

export const coolingSchema = baseSchema.extend({
  tdp: z.number().optional(),
  // Rule 6 (cooler_too_tall): cooler height in mm — required for the rule to fire
  height_mm: z.number().optional(),
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
  | (z.infer<typeof cpuSchema> & { category: 'cpu'; description?: string; specs?: Record<string, unknown>; image_url?: string; release_year?: number })
  | (z.infer<typeof motherboardSchema> & { category: 'motherboard'; description?: string; specs?: Record<string, unknown>; image_url?: string; release_year?: number })
  | (z.infer<typeof gpuSchema> & { category: 'gpu'; description?: string; specs?: Record<string, unknown>; image_url?: string; release_year?: number })
  | (z.infer<typeof ramSchema> & { category: 'ram'; description?: string; specs?: Record<string, unknown>; image_url?: string; release_year?: number })
  | (z.infer<typeof storageSchema> & { category: 'storage'; description?: string; specs?: Record<string, unknown>; image_url?: string; release_year?: number })
  | (z.infer<typeof psuSchema> & { category: 'psu'; description?: string; specs?: Record<string, unknown>; image_url?: string; release_year?: number })
  | (z.infer<typeof caseSchema> & { category: 'case'; description?: string; specs?: Record<string, unknown>; image_url?: string; release_year?: number; form_factor?: string })
  | (z.infer<typeof coolingSchema> & { category: 'cooling'; description?: string; specs?: Record<string, unknown>; image_url?: string; release_year?: number })
  | (z.infer<typeof fanSchema> & { category: 'fan'; description?: string; specs?: Record<string, unknown>; image_url?: string; release_year?: number })
  | (z.infer<typeof thermalPasteSchema> & { category: 'thermal_paste'; description?: string; specs?: Record<string, unknown>; image_url?: string; release_year?: number });
