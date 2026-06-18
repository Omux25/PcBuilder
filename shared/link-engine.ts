/**
 * Central Link Engine — single source of truth for URL generation.
 * Shareable across backend, frontend, and tasks.
 */

import { CATEGORY_SLUGS } from './constants/build.constants';
import type { ComponentCategory } from './types';

export interface ComponentWithSlugAndCategory {
  category: string;
  slug: string;
}

export const LinkEngine = {
  /**
   * Generates a clean, unified product detail URL.
   * Format: /composants/:categorySlug/:slug
   */
  getProductUrl(component: ComponentWithSlugAndCategory): string {
    if (!component || !component.category || !component.slug) {
      return '#';
    }
    const catSlug = CATEGORY_SLUGS[component.category as ComponentCategory] || component.category;
    return `/composants/${catSlug}/${component.slug}`;
  },

  /**
   * Generates a category browse URL, optionally with a specific slotKey.
   */
  getCategoryBrowseUrl(category: string, slotKey?: string): string {
    if (!category) return '/composants';
    const catSlug = CATEGORY_SLUGS[category as ComponentCategory] || category;
    return slotKey ? `/parcourir/${catSlug}/${slotKey}` : `/parcourir/${catSlug}`;
  },

  /**
   * Generates the build configurator share URL.
   */
  getBuildShareUrl(baseUrl: string, queryParams: string): string {
    const base = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    return `${base}/configurateur?${queryParams}`;
  }
};
