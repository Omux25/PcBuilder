/**
 * Slug utilities for generating URL-safe component identifiers.
 *
 * A slug is a lowercase, hyphen-separated string derived from a component's
 * brand and name. Example: "AMD Ryzen 5 7600X" → "amd-ryzen-5-7600x"
 */

/**
 * Converts a string into a URL-safe slug.
 * - Lowercases the input
 * - Replaces spaces and underscores with hyphens
 * - Strips all characters that are not alphanumeric or hyphens
 * - Collapses multiple consecutive hyphens into one
 * - Trims leading/trailing hyphens
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, '-')        // spaces and underscores → hyphens
    .replace(/[^a-z0-9-]/g, '')     // strip everything except alphanumeric and hyphens
    .replace(/-{2,}/g, '-')         // collapse multiple hyphens
    .replace(/^-+|-+$/g, '');       // trim leading/trailing hyphens
}

/**
 * Generates a slug from a component's brand and name.
 * If brand is provided, it is prepended: "AMD" + "Ryzen 5 7600X" → "amd-ryzen-5-7600x"
 * If brand is absent, only the name is used.
 */
export function componentSlug(brand: string | null | undefined, name: string): string {
  const parts = [brand, name].filter(Boolean).join(' ');
  return slugify(parts);
}

/**
 * Ensures a slug is unique within a set of existing slugs.
 * If the base slug already exists, appends a numeric suffix starting at 2.
 *
 * Example:
 *   base = "amd-ryzen-5-7600x", existing = ["amd-ryzen-5-7600x"]
 *   → returns "amd-ryzen-5-7600x-2"
 */
export function generateUniqueSlug(baseSlug: string, existingSlugs: Set<string>): string {
  if (!existingSlugs.has(baseSlug)) {
    return baseSlug;
  }

  let counter = 2;
  let candidate = `${baseSlug}-${counter}`;
  while (existingSlugs.has(candidate)) {
    counter++;
    candidate = `${baseSlug}-${counter}`;
  }
  return candidate;
}
