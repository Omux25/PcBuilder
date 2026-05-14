/**
 * Shared formatting utilities for the frontend.
 * Ensures consistent price/date display across all components.
 */

/** Format a price in Moroccan Dirham (MAD) with consistent formatting (no thousands separators). */
export function formatPrice(amount: number): string {
  return `${Math.floor(amount)} MAD`;
}

/** Format a price as a short label (alias for formatPrice for consistency). */
export function formatPriceShort(amount: number): string {
  return formatPrice(amount);
}

/** Format a date string for display. */
export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-MA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/** Format a date string as YYYY-MM-DD (for charts). */
export function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('fr-MA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}
