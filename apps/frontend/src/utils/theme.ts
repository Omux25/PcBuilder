/**
 * Theme persistence — dark/light mode toggle with localStorage and system preference.
 */

const STORAGE_KEY = 'pcbuilder_theme';
type Theme = 'light' | 'dark';

/** Read saved theme from localStorage, or fall back to system preference. */
export function getInitialTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch { /* ignore */ }

  if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'dark'; // Default to dark for a PC hardware site
}

/** Apply theme to the document and save to localStorage. */
export function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme);
  try {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute('content', theme === 'dark' ? '#09090b' : '#ffffff');
    }
  } catch { /* ignore */ }
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch { /* ignore */ }
}

/** Toggle between light and dark. */
export function toggleTheme(): Theme {
  const current = document.documentElement.getAttribute('data-theme') as Theme | null;
  const next: Theme = current === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  return next;
}
