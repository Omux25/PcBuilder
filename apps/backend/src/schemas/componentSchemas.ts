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
  brand: z.string().optional(),
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
} as const;

export type ComponentCategory = SharedCategory;

// ── Typed input for service layer ────────────────────────────────────────────

/**
 * Union of all validated component shapes.
 * Used as the parameter type for createComponent() and updateComponent()
 * so the service layer has compile-time safety instead of Record<string, unknown>.
 */
export type ComponentInput =
  | (z.infer<typeof cpuSchema>        & { category: 'cpu';         description?: string; specs?: Record<string, unknown>; image_url?: string; release_year?: number })
  | (z.infer<typeof motherboardSchema> & { category: 'motherboard'; description?: string; specs?: Record<string, unknown>; image_url?: string; release_year?: number })
  | (z.infer<typeof gpuSchema>         & { category: 'gpu';         description?: string; specs?: Record<string, unknown>; image_url?: string; release_year?: number })
  | (z.infer<typeof ramSchema>         & { category: 'ram';         description?: string; specs?: Record<string, unknown>; image_url?: string; release_year?: number })
  | (z.infer<typeof storageSchema>     & { category: 'storage';     description?: string; specs?: Record<string, unknown>; image_url?: string; release_year?: number })
  | (z.infer<typeof psuSchema>         & { category: 'psu';         description?: string; specs?: Record<string, unknown>; image_url?: string; release_year?: number })
  | (z.infer<typeof caseSchema>        & { category: 'case';        description?: string; specs?: Record<string, unknown>; image_url?: string; release_year?: number; form_factor?: string })
  | (z.infer<typeof coolingSchema>     & { category: 'cooling';     description?: string; specs?: Record<string, unknown>; image_url?: string; release_year?: number });
