import type { BuildConfig, Component } from '../types.js';

/** Compute total estimated price from the current build. */
export function calculateBuildTotalPrice(build: BuildConfig): number {
  return Object.entries(build).reduce((sum, [, comp]) => {
    if (!comp) return sum;
    const price = (comp as Component & { lowest_price?: number | null }).lowest_price;
    return price ? sum + price : sum;
  }, 0);
}
