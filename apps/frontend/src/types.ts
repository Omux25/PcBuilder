/**
 * Shared TypeScript interfaces — re-exported from global shared/types.ts
 */

export * from '@shared/types';

import type { Component, ComponentCategory } from '@shared/types';

/** The build configuration — one optional slot per category. */
export type BuildConfig = Partial<Record<ComponentCategory, Component>>;

/** Compatibility issue in the configurator context */
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
