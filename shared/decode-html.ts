/**
 * HTML entity decoder for product names.
 * Handles named entities commonly used by Moroccan retailers (UltraPC,
 * SetupGame, NextLevel PC) plus a generic numeric entity fallback.
 */

const NAMED_ENTITIES: Record<string, string> = {
  // XML core
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'",
  // Typographic quotes & dashes
  lsquo: '\u2018', rsquo: '\u2019', ldquo: '\u201C', rdquo: '\u201D',
  prime: '\u2032', Prime: '\u2033',
  ndash: '\u2013', mdash: '\u2014',
  hellip: '\u2026',
  // Spaces & formatting
  nbsp: ' ', ensp: ' ', emsp: ' ', thinsp: ' ',
  // Symbols
  reg: '\u00AE', copy: '\u00A9', trade: '\u2122',
  bull: '\u2022', middot: '\u00B7', deg: '\u00B0',
  times: '\u00D7', divide: '\u00F7', minus: '\u2212', plusmn: '\u00B1',
  euro: '\u20AC', pound: '\u00A3', yen: '\u00A5',
  // French accented characters (used by retailer product names)
  agrave: '\u00E0', Agrave: '\u00C0',
  acirc: '\u00E2', Acirc: '\u00C2',
  eacute: '\u00E9', Eacute: '\u00C9',
  egrave: '\u00E8', Egrave: '\u00C8',
  ecirc: '\u00EA', Ecirc: '\u00CA',
  iuml: '\u00EF', Iuml: '\u00CF',
  ocirc: '\u00F4', Ocirc: '\u00D4',
  ugrave: '\u00F9', Ugrave: '\u00D9',
  ucirc: '\u00FB', Ucirc: '\u00DB',
  ccedil: '\u00E7', Ccedil: '\u00C7',
  oelig: '\u0153', OElig: '\u0152',
};

export function decodeHtml(html: string): string {
  if (!html) return '';

  return html
    // Named entities: &rsquo; &ndash; etc.
    .replace(/&([a-zA-Z]+);/g, (_match, name: string) => NAMED_ENTITIES[name] ?? _match)
    // Numeric decimal entities: &#39; &#8211; etc.
    .replace(/&#(\d+);/g, (_match, digits: string) => {
      const code = parseInt(digits, 10);
      return code > 0 && code < 0x110000 ? String.fromCodePoint(code) : _match;
    })
    // Numeric hex entities: &#x27; &#x2019; etc.
    .replace(/&#x([0-9a-fA-F]+);/g, (_match, hex: string) => {
      const code = parseInt(hex, 16);
      return code > 0 && code < 0x110000 ? String.fromCodePoint(code) : _match;
    });
}
