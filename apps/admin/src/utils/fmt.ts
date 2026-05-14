/**
 * Shared formatting utilities for the admin panel.
 * All number/price formatters deliberately avoid thousands separators
 * (no dots or commas) per product requirement.
 */

/** Format a plain integer — no thousands separator. */
export function fmtNum(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return '—';
  return String(Math.round(n));
}

/** Format a price in MAD — no thousands separator. */
export function fmtPrice(n: number | string | null | undefined): string {
  if (n == null || n === '') return '—';
  const v = Number(n);
  if (isNaN(v)) return '—';
  return `${Math.round(v)} MAD`;
}

/** Format a price range in MAD — no thousands separator. */
export function fmtPriceRange(
  min: number | null | undefined,
  max: number | null | undefined,
): string {
  if (min == null) return '—';
  const minStr = Math.round(min);
  if (max == null || min === max) return `${minStr} MAD`;
  return `${minStr} – ${Math.round(max)} MAD`;
}

/** Format a datetime string for display — consistent across all admin pages. */
export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/** Format a date only (no time). */
export function fmtDateOnly(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}
