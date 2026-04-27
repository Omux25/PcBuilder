/**
 * Zod validation schemas for each component category.
 *
 * Requirements: 8.2, 8.3, 11.2
 */

import { z } from 'zod/v4';

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
} as const;

export type ComponentCategory = keyof typeof componentSchemas;
