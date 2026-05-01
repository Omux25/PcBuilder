/**
 * Date formatting utilities for the frontend.
 * Ensures consistent 'fr-MA' locale and handles invalid data gracefully.
 */

const DATE_FORMATTER = new Intl.DateTimeFormat('fr-MA', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/**
 * Safely formats an ISO date string or Date object.
 * Returns 'Date inconnue' if the input is null, undefined, or invalid.
 */
export function formatDate(input: string | Date | null | undefined): string {
  if (!input) return 'Date inconnue';
  
  const date = input instanceof Date ? input : new Date(input);
  
  if (isNaN(date.getTime())) {
    return 'Date inconnue';
  }
  
  return DATE_FORMATTER.format(date);
}
