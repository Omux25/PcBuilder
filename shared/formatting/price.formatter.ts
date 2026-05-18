/**
 * Shared price formatting utilities.
 */

/** Format a price in Moroccan Dirham (MAD) with consistent formatting (no thousands separators). */
export function formatPrice(amount: number): string {
  return `${Math.floor(amount)} MAD`;
}

/** Format a price as a short label (alias for formatPrice for consistency). */
export function formatPriceShort(amount: number): string {
  return formatPrice(amount);
}
