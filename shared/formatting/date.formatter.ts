/**
 * Shared date formatting utilities.
 */

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
