/**
 * Central Link Engine — single source of truth for URL generation.
 * Shareable across backend, frontend, and tasks.
 */

export interface ComponentWithSlugAndCategory {
  category: string;
  slug: string;
}

export const LinkEngine = {
  /**
   * Generates a clean, unified product detail URL.
   * Format: /components/:category/:slug
   */
  getProductUrl(component: ComponentWithSlugAndCategory): string {
    if (!component || !component.category || !component.slug) {
      return '#';
    }
    return `/components/${component.category}/${component.slug}`;
  },

  /**
   * Generates a category browse URL, optionally with a specific slotKey.
   */
  getCategoryBrowseUrl(category: string, slotKey?: string): string {
    if (!category) return '/components';
    return slotKey ? `/browse/${category}/${slotKey}` : `/browse/${category}`;
  },

  /**
   * Generates the build configurator share URL.
   */
  getBuildShareUrl(baseUrl: string, queryParams: string): string {
    const base = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    return `${base}/build?${queryParams}`;
  }
};
