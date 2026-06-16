export const NOISE_TOKENS = new Set([
  'noir', 'blanc', 'black', 'white', 'blanche', 'noire',
  'rouge', 'red', 'blue', 'bleu', 'silver', 'argent', 'gold', 'or',
  'pink', 'rose', 'green', 'vert', 'purple', 'violet', 'grey', 'gray', 'gris',
  'kit', 'bundle', 'pack', 'combo', 'oem', 'retail', 'box',
  'edition', 'version',
  'tray', 'mpk', 'wof', 'pib', 'tary', 'traw', 'boxed', 'unlocked', 'sans ventilateur', 'avec ventilateur',
  'wraith stealth', 'wraith spire', 'wraith prism', 'wraith max', 'no fan', 'processeurs', 'processeur', 'processors', 'processor',
  'sans refroidisseur', 'avec fan', 'version tray'
]);

export function tokenizeAndClean(name: string): string {
  // 1. Lowercase and normalize whitespace/punctuation
  const normalized = name.toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // 2. Tokenize by splitting on spaces
  const tokens = normalized.split(' ');

  // 3. Filter out noise tokens
  const cleanTokens = tokens.filter(t => !NOISE_TOKENS.has(t));

  return cleanTokens.join(' ');
}
