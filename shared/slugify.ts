/**
 * Slug utilities for generating URL-safe component identifiers.
 *
 * A slug is a lowercase, hyphen-separated string derived from a component's
 * brand and name. Example: "AMD Ryzen 5 7600X" → "amd-ryzen-5-7600x"
 */

/**
 * Normalizes a component name for order-agnostic comparison and slug generation.
 * Strips filler words, removes duplicate adjacent words, and sorts tokens alphabetically.
 */
export function normalizeName(name: string): string {
  const fillerWords = ['geforce', 'radeon', 'edition'];
  
  // 1. Lowercase and split into tokens
  const tokens = name.toLowerCase().split(/[\s_/-]+/);

  // 2. Strip filler words and empty tokens
  const filtered = tokens.filter(t => t && !fillerWords.includes(t));

  // 3. Alphabetically sort and remove duplicates
  const uniqueSorted = Array.from(new Set(filtered)).sort();

  return uniqueSorted.join(' ');
}

/**
 * Converts a string into a URL-safe slug.
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
 */
export function componentSlug(brand: string | null | undefined, name: string): string {
  const normalized = normalizeName(`${brand || ''} ${name}`);
  return slugify(normalized);
}

/**
 * Ensures a slug is unique within a set of existing slugs.
 * If the base slug already exists, appends a numeric suffix starting at 2.
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
