import type { BuildConfig, Component } from '../types';
import { CATEGORY_ORDER } from '../types';

/** Compute total estimated price from the current build. */
export function calculateBuildTotalPrice(build: BuildConfig): number {
  return CATEGORY_ORDER.reduce((sum, cat) => {
    const comp = build[cat];
    if (!comp) return sum;
    const price = (comp as Component & { lowest_price?: number | null }).lowest_price;
    return price ? sum + price : sum;
  }, 0);
}
