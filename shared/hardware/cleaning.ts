import { decodeHtml } from '../decode-html.js';
import { extractRamSpecs } from './specs/ram.js';
import { extractPsuSpecs } from './specs/psu.js';


/**
 * Standard category keywords used for stripping prefixes/suffixes.
 */
export const CATEGORY_WORDS = new Set([
  'boitier', 'bo\u00eetier', 'boitiers', 'bo\u00eetiers',
  'watercooler', 'watercooling',
  'processeur', 'processeurs',
  'carte graphique', 'cartes graphiques',
  'alimentation', 'alimentations',
  'stockage',
  'memoire', 'm\u00e9moire', 'memoires', 'm\u00e9moires',
  'aircooler', 'air cooler',
  'carte m\u00e8re', 'carte mere', 'cartes m\u00e8res', 'cartes meres',
  'disque', 'disques',
  'pate thermique', 'p\u00e2te thermique'
]);

export function cleanName(rawName: string, brand: string, category?: string): string {
  let name = decodeHtml(rawName);

  // Strip French Retail prefixes
  name = name
    .replace(/l['\u2019]alimentation\s+/gi, '')
    .replace(/le\s+processeur\s+/gi, '')
    .replace(/les\s+processeurs\s+/gi, '')
    .replace(/la\s+carte\s+graphique\s+/gi, '')
    .replace(/les\s+cartes\s+graphiques\s+/gi, '')
    .replace(/la\s+carte\s*m[e\u00e8]re\s+/gi, '')
    .replace(/les\s+cartes\s*m[e\u00e8]re\s+/gi, '')
    .replace(/carte\s*m[e\u00e8]re\s+/gi, '');

  // Strip leading em-dash prefix (retailer category prefix artifact)
  // e.g. "\u2013 Matrexx 55 V3" \u2192 "Matrexx 55 V3"
  name = name.replace(/^[\u2013\-]\s+/, '');

  // Strip SKU codes appended after pipe
  // e.g. "AddGame Spider S5 16GB ... | AG16GB56C40S5UB" \u2192 "AddGame Spider S5 16GB ..."
  name = name.replace(/\s*\|.*$/, '').trim();

  // Strip category prefix patterns (handle both "Category - Name" and "Category Name")
  name = name
    .replace(/^(processeurs?|cartes?\s*graphiques?|cartes?\s*m[e\u00e8]res?|m[e\u00e9]moires?\s*vives?|disques?\s*durs?|alimentations?|[Bb]o\u00eetiers?|refroidissement|ventilateurs?\s*bo\u00eetier|p[\u00e2a]tes?\s*thermique)\s*[\-\u2013]\s+/gi, '')
    .replace(/^(processeurs?|cartes?\s*graphiques?|cartes?\s*m[e\u00e8]res?|m[e\u00e9]moires?\s*vives?|disques?\s*durs?|alimentations?|[Bb]o\u00eetiers?|refroidissement|ventilateurs?\s*bo\u00eetier|p[\u00e2a]tes?\s*thermique)\s+/gi, '');

  // Strip category breadcrumb suffixes appended by retailers (UltraPC, NextLevel, etc.)
  name = name
    .replace(/Processeurs?\s*$/gi, '')
    .replace(/Cartes?\s*[Gg]raphiques?\s*$/gi, '')
    .replace(/Cartes?\s*[Mm][e\u00e8]res?\s*$/gi, '')
    .replace(/M[e\u00e9]moire\s*[Vv]ive\s*(PC|DDR[45])?\s*\w*\s*$/gi, '')
    .replace(/Disques?\s*(durs?\s*(et\s*SSD)?|SSD)\s*\w*\s*$/gi, '')
    .replace(/Alimentations?\s*(PC)?\s*\w*\s*$/gi, '')
    .replace(/[Bb]o\u00eetiers?\s*(PC|[Gg]amer)?\s*\w*\s*$/gi, '')
    .replace(/Refroidissement\s*$/gi, '')
    .replace(/Ventilateurs?\s*[Bb]o\u00eetier\s*\w*\s*$/gi, '')
    .replace(/P[\u00e2a]te\s*[Tt]hermique\s*$/gi, '')
    // UltraPC appends ", Ultra Pc Gamer Maroc" to alt text
    .replace(/,?\s*Ultra\s*Pc\s*Gamer\s*Maroc\s*$/gi, '')
    // SetupGame appends "Setup Game" or "Setup-Game" branding
    .replace(/\s*[\-\u2013]\s*Setup\s*Game\s*\w*\s*$/gi, '')
    .replace(/\s*Setup\s*Game\s*\w*\s*$/gi, '');

  // Strip marketing/promo noise at the start
  name = name.replace(/^(PROMO\s*!+\s*|SOLDES?\s*!+\s*|NEW\s*!+\s*)/gi, '');

  // Strip common French marketing phrases globally
  name = name.replace(/\s*[\-\u2013]?\s*Am\u00e9liorez\s*vos\s*performances\s*PC\b/gi, ' ');
  name = name.replace(/\s*[\-\u2013]?\s*M\u00e9moire\s*Vive\s*pour\s*PC\b/gi, ' ');

  // Strip marketing noise in parentheses anywhere
  name = name.replace(/\s*\((Livraison\s*Gratuite|Promo|Solde|New|Nouveau|Gratuit)[^)]*\)\s*/gi, ' ');

  // Remove brand if present (handles double-brand like "AMD AMD Ryzen")
  if (brand) {
    const bRegex = new RegExp(`\\b(${brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}|processeur)\\b`, 'gi');
    name = name.replace(bRegex, '');
    // Run twice to catch double-brand
    name = name.replace(bRegex, '');
    
    // Normalize SG / Setup Game redundancy
    if (brand.toLowerCase() === 'setup game' || brand.toLowerCase() === 'sg') {
      name = name.replace(/\bsg\b/gi, '');
      name = name.replace(/\bsetup\s*game\b/gi, '');
    }
  }

  // Remove retail noise + Colors + Technical specs
  name = name
    .replace(/\s*(BOX|Tray|MPK|OEM|Bulk|no\s*fan|WOF|wraith\s*\w+|edition|noir|blanc|white|black|silver|argent|grey|gris|sans\s*emballage|sans\s*refroidisseur|avec\s*dissipateur(\s*thermique)?)\s*/gi, ' ')
    .replace(/\s*\(\s*\)\s*/g, ' ') // Strip empty parentheses
    // French marketing phrases: (jusqu'\u00e0 4.7 GHz)
    .replace(/\s*\(jusqu['\u2019]?\u00e0?\s*[\d.,]+\s*GHz\)\s*/gi, ' ')
    .replace(/\s*\(jusqu['\u2019]?\u00e0?\s*[\d.,]+\s*GHz[^)]*\)\s*/gi, ' ')
    .replace(/\s*\(\d+\.?\d*\s*GHz\s*\/\s*\d+\.?\d*\s*GHz\)\s*/gi, '') // (3.7 GHz / 4.6 GHz)
    .replace(/\s*\(\d+\.?\d*\s*GHz[^)]*\)\s*/gi, '') // (3.7 GHz Max)
    .replace(/\s*\(\d+\.?\d*\s*GHz[^)]*\.{3}?\s*/gi, '') // (3.7 GHz /... truncated
    .replace(/\s*\(\d+\.?\d*\s*GHz[^)]*$/, '') 
    // English boost speed phrases: (Up To 5.0 GHz)
    .replace(/\s*\(up\s+to\s+[\d.,]+\s*GHz[^)]*\)\s*/gi, '')
    .replace(/\s+\d+\.?\d*\s*GHz\s*\/\s*\d+\.?\d*\s*GHz\s*/gi, ' ') // 3.7 GHz / 4.6 GHz
    .replace(/\s+\d+\.?\d*\s*GHz\s*$/i, '') // Trailing GHz
    .replace(/\s*[\-\u2013]\s*ed\s*$/i, '') // "- Ed"
    // Strip trailing cache noise
    .replace(/\s+\d+\s*MB\s*$/i, '') // e.g. "6MB"
    // Strip trailing ellipsis
    .replace(/\s*\.{2,}\s*$/, '')
    // Strip spec text appended after em-dash: "\u2013 32 C\u0153urs / 64 threads"
    .replace(/\s*[\-\u2013]\s*\d+\s*[Cc][\u0153o]urs?.*$/i, '')
    // Strip inline core/thread count: "8C 16T"
    .replace(/\s+\d+[Cc]\s+\d+[Tt]\b/g, '')
    // Strip trailing LED/RGB noise
    .replace(/\s+[Ll]ed\s+RGB\s*$/g, '')
    .replace(/\s+[Ll]ed\s*$/g, '')
    // Compatibility info in parens
    .replace(/\s*\((Micro\s*ATX|Mini\s*ITX|ATX|ITX|LGA\d+|AM[45])\)\s*/gi, ' ')
    // Souris Gaming / Clavier Gaming suffixes
    .replace(/\s*\((Souris|Clavier|Casque|\u00c9cran)\s*Gaming\)\s*/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Normalize Intel CPU model names:
  name = name.replace(/\b(Core\s+(?:Ultra\s+)?i\d|i\d)-(\d)/gi, '$1 $2');
  name = name.replace(/^(i\d)\s+(\d)/i, 'Core $1 $2');
  name = name.replace(/^(I\d)-(\d)/i, 'Core $1 $2');

  // Strip DDR4/DDR5 suffix from motherboard names only
  if (/\b[ABXZH]\d{3,4}[A-Z]?\b/.test(name)) {
    name = name.replace(/\s+DDR[45]\s*$/i, '');
    name = name.replace(/\s+D[45]\s*$/i, '');
  }

  // Strip socket suffix leaked from retailer names
  name = name.replace(/\s*Socket\s*(AM[45]|LGA\s*(1151|1200|1700|1851))\s*$/i, '');
  name = name.replace(/\s*(AM[45]|LGA(1151|1200|1700|1851))\s*$/i, '');

  // Normalize capitalization
  {
    const ACRONYMS: Record<string, string> = {
      'rtx': 'RTX', 'gtx': 'GTX', 'rx': 'RX',
      'ddr4': 'DDR4', 'ddr5': 'DDR5',
      'gddr5': 'GDDR5', 'gddr6': 'GDDR6', 'gddr6x': 'GDDR6X', 'gddr7': 'GDDR7',
      'lpddr5': 'LPDDR5', 'lpddr4': 'LPDDR4',
      'gb': 'GB', 'go': 'Go', 'tb': 'TB', 'to': 'To', 'mb': 'MB', 'mo': 'Mo',
      'mhz': 'MHz', 'ghz': 'GHz',
      'cl16': 'CL16', 'cl18': 'CL18', 'cl30': 'CL30', 'cl32': 'CL32',
      'cl34': 'CL34', 'cl36': 'CL36', 'cl38': 'CL38', 'cl40': 'CL40',
      'cl42': 'CL42', 'cl46': 'CL46',
      'nvme': 'NVMe', 'm.2': 'M.2', 'pcie': 'PCIe', 'sata': 'SATA',
      'usb': 'USB', 'hdmi': 'HDMI',
      'atx': 'ATX', 'matx': 'mATX', 'itx': 'ITX', 'eatx': 'E-ATX',
      'ssd': 'SSD', 'hdd': 'HDD',
      'rgb': 'RGB', 'argb': 'ARGB',
      'aio': 'AIO', 'tdp': 'TDP',
      'amd': 'AMD', 'nvidia': 'NVIDIA',
      'tuf': 'TUF', 'rog': 'ROG', 'meg': 'MEG', 'mag': 'MAG', 'mpg': 'MPG',
      'aorus': 'AORUS', 'xlr8': 'XLR8',
      'lga1700': 'LGA1700', 'lga1851': 'LGA1851', 'lga1200': 'LGA1200', 'lga1151': 'LGA1151',
      'am4': 'AM4', 'am5': 'AM5',
      'wifi': 'WiFi', 'dp': 'DP',
      'oc': 'OC', 'soc': 'SOC', 'lhr': 'LHR',
      'xmp': 'XMP', 'expo': 'EXPO',
      'cpu': 'CPU', 'gpu': 'GPU', 'psu': 'PSU', 'ram': 'RAM',
    };

    name = name.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
    name = name.replace(/(\d)([a-wyz])/g, (_, d, l) => d + l.toUpperCase()); 

    name = name.replace(/(\d)(Gb)\b/g, '$1GB');
    name = name.replace(/(\d)(Go)\b/g, '$1Go');
    name = name.replace(/(\d)(Tb)\b/g, '$1TB');
    name = name.replace(/(\d)(To)\b/g, '$1To');
    name = name.replace(/(\d)(Mb)\b/g, '$1MB');
    name = name.replace(/(\d)(Mo)\b/g, '$1Mo');
    name = name.replace(/(\d)(Mhz)\b/g, '$1MHz');
    name = name.replace(/(\d)(Ghz)\b/g, '$1GHz');
    name = name.replace(/(\d)(W)\b/g, '$1W');
    name = name.replace(/(\d)(Mm)\b/g, '$1mm');
    name = name.replace(/(\d)(Nm)\b/g, '$1nm');

    for (const [lower, correct] of Object.entries(ACRONYMS)) {
      if (lower === 'm.2') continue;
      name = name.replace(new RegExp(`\\b${lower}\\b`, 'gi'), correct);
    }
    name = name.replace(/\bM\.2\b/gi, 'M.2');

    name = name.replace(/\bGeforce\b/gi, 'GeForce');
    name = name.replace(/\bI([3579])\b/g, 'i$1');
    name = name.replace(/\bCore\s+I([3579])\b/g, 'Core i$1');
    name = name.replace(/\b(\d{3,5})([a-zA-Z][a-zA-Z0-9]*)\b/g, (match, num, suffix) => {
      const suffixLower = suffix.toLowerCase();
      const units = new Set(['gb', 'go', 'tb', 'to', 'mb', 'mo', 'mhz', 'ghz', 'w', 'mm', 'nm']);
      if (units.has(suffixLower)) return match;
      if (/^x\d+$/i.test(suffixLower)) return match;
      return `${num}${suffix.toUpperCase()}`;
    });
    name = name.replace(/\((\d+)\s+X\s+(\d+)/g, '($1x$2');
    name = name.replace(/\b([1-9][0-9]?)X\b(?!\s*[A-Z]{2})/g, '$1x');
  }

  // \u2500\u2500 RAM-specific normalization \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  if (category === 'ram') {
    name = name.replace(/^RAM\s+/i, '').trim();
    name = name.replace(/^U-?Dimm\s+/i, '').replace(/^Dimm\s+/i, '').trim();

    // Extract specs before stripping anything
    const ramSpecs = extractRamSpecs(name);
    const { capacity_gb, kit_count, ram_type, frequency_mhz, cas_latency } = ramSpecs;

    // Strip ALL variations of kit/capacity notation to get the base model name
    // This prevents "16GB (2x8GB)" from leaving "16GB" behind when we strip "(2x8GB)"
    name = name
      .replace(/\s*\(\s*\d+\s*[xX\u00d7*]\s*\d+\s*[Gg][BbOo]\s*\)/gi, ' ')
      .replace(/\s*\(\s*\d+\s*[Gg][BbOo]\s*[xX\u00d7*]\s*\d+\s*\)/gi, ' ')
      .replace(/\s*\d+\s*[xX\u00d7*]\s*\d+\s*[Gg][BbOo]\b/gi, ' ')
      .replace(/\s*\d+\s*[Gg][BbOo]\s*[xX\u00d7*]\s*\d+\b/gi, ' ')
      .replace(/\b\d+\s*[Gg][BbOo]\b/gi, ' ');

    // Strip other specs
    name = name
      .replace(/\bCL\d+\b/gi, ' ')
      .replace(/\bC\d{2}\b/gi, ' ') // Catch standalone 'C' prefix like C40
      .replace(/\bDDR[45]\b/gi, ' ')
      .replace(/\b\d{4}\s*MHz\b/gi, ' ');

    // Standard noise cleaning
    name = name
      .replace(/\s*[\-\u2013]\s*(Am\u00e9liorez\s*vos\s*performances\s*PC|M\u00e9moire\s*Vive\s*pour\s*PC|Performance\s*optimis\u00e9e).*$/gi, '')
      .replace(/\s*[\-\u2013]\s*[A-Z]\d[\-\u2013A-Za-z0-9]+(?:[\-\u2013][A-Za-z0-9]+)*/g, '')
      .replace(/\s*[\-\u2013]\s*[A-Z][a-z][a-z0-9A-Z]{4,}[-\w]*\s*$/g, '')
      .replace(/\s+[A-Z][a-z][a-z0-9A-Z]{4,}[/\-][\w]+\s*$/g, '')
      .replace(/\s*\([A-Za-z_][A-Za-z0-9_\-]{4,}\)\s*/g, ' ')
      .replace(/\s*[\-\u2013]?\s*M[\u00e9e]oire\s+[Vv]ive\s*.*$/gi, '')
      .replace(/\s+[Aa]vec\s+[Hh]eatsink\s*.*$/gi, '')
      .replace(/\s+[Aa]vec\s+[Hh]eatspreader\s*$/gi, '')
      .replace(/\s+Dram\b/gi, '')
      .replace(/\s+Memory\b/gi, '')
      .replace(/\bRvb\b/gi, 'RGB')
      .replace(/\bU-?Dimm\b/gi, '')
      .replace(/\bPc\s+Portable\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    // Reconstruct canonical name with preserved specs
    const specParts = [];
    if (capacity_gb) {
      if (kit_count > 1) {
        specParts.push(`${capacity_gb}GB (${kit_count}x${capacity_gb / kit_count}GB)`);
      } else {
        specParts.push(`${capacity_gb}GB`);
      }
    }
    if (ram_type) specParts.push(ram_type);
    if (frequency_mhz) specParts.push(`${frequency_mhz}MHz`);
    if (cas_latency) specParts.push(`CL${cas_latency}`);

    const model = name.replace(/\s*[\-\u2013]\s*$/, '').trim();
    name = model ? `${model} ${specParts.join(' ')}` : specParts.join(' ');

    name = name
      .replace(/\s*[\-\u2013]\s*RGB\b/gi, ' RGB')
      .replace(/\s*[\-\u2013]\s*Or\b/gi, ' Or')
      .replace(/^[\-\u2013]\s*/, '')
      .replace(/\s+[\-\u2013]\s+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // ── CASE-specific normalization ────────────────────────────────────────────
  if (category === 'case') {
    // Strip generic case terminology
    name = name
      .replace(/\s*[\-\u2013]\s*Bo[\u00eeti]tier\s*(PC|Gamer|Mid-Tower|Moyen Tour|Grand Tour|Mini-Tour)?\s*(ATX|mATX|Micro-ATX|Mini-ITX|ITX)?\s*(Verre Tremp[\u00e9e]|Tempered Glass|TG)?\s*$/gi, '')
      .replace(/\b(Bo[\u00eeti]tier|Case|Chassis|Mid-Tower|Moyen Tour|Grand Tour|Full Tower|Mini-Tour|Mini Tower)\b/gi, '')
      .replace(/\b(Verre Tremp[\u00e9e]|Tempered Glass|TG|Glass)\b/gi, '')
      .replace(/\s*(ATX|mATX|Micro-?ATX|Mini-?ITX|ITX)\s*$/gi, '')
      .replace(/\s+PC\s*$/gi, '')
      .replace(/\s+Gamer\s*$/gi, '')
      .replace(/\s+De\s+Pc\s*$/gi, '')
      .replace(/\s*\(?(sans alimentation|no psu|sans alim)\)?\s*/gi, '')
      .replace(/\s+avec\s+fen[e\u00eatre]tre\s*/gi, '')
      .replace(/\b(Moyen Tour|Grand Tour|Mini Tour)\b/gi, '')
      .replace(/\s+[\-\u2013]\s*$/g, '')
      .replace(/\s+[\-\u2013]\s+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // ── PSU-specific normalization ────────────────────────────────────────────
  if (category === 'psu') {
    // 1. Strip branding from the name again (aggressive)
    if (brand) {
      const bRegex = new RegExp(`\\b(${brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})\\b`, 'gi');
      name = name.replace(bRegex, '');
    }
    
    // 2. Strip standard PSU noise
    name = name
      .replace(/\s*\(\s*\d+\s*(ans?|mois)\s*garantie\s*\)\s*/gi, ' ')
      .replace(/\s*garantie\s*constructeur\s*\d+\s*ans?\s*/gi, ' ')
      .replace(/\s*garantie\s*\d+\s*(ans?|mois)\s*/gi, ' ')
      .replace(/\s*Entre\s*(\d+\s*W\s*)?Et\s*\d+\s*W\s*/gi, ' ')
      .replace(/\s*Plus\s*De\s*\d+\s*W\s*/gi, ' ')
      .replace(/\balimentation\b/gi, ' ')
      .replace(/\befficacit[\u00e9e]\b/gi, ' ')
      .replace(/\b85%\b/gi, ' ')
      .replace(/\b100%\b/gi, ' ')
      .replace(/\bmodulaire\b/gi, ' ')
      .replace(/\bmodular\b/gi, ' ')
      .replace(/\bsemi\b/gi, ' ')
      .replace(/\bfull\b/gi, ' ')
      .replace(/\bnon\b/gi, ' ')
      .replace(/\bATX\s*\d+\.?\d*[a-z]?\s*/gi, ' ')
      .replace(/\bGen\s*\d\b/gi, ' ')
      .replace(/\bPg\d\b/gi, ' ')
      .replace(/\bPCIe\s*\d\.?0?\b/gi, ' ')
      .replace(/\bPC\s+Core\b/gi, ' ');

    // 3. Extract specs before stripping from model name
    const psuSpecs = extractPsuSpecs(name);
    const { wattage, efficiency } = psuSpecs;

    // 4. Strip wattage and efficiency markers from the base name to isolate the model
    // We use a global match to catch all duplicates
    name = name
      .replace(/\b\d{2,4}\s*W\b/gi, ' ')
      .replace(/\b80\s*Plus\s*(Titanium|Platinum|Gold|Silver|Bronze|White|Standard)?\b/gi, ' ')
      .replace(/\b(Titanium|Platinum|Gold|Silver|Bronze|White)\b/gi, ' ')
      .replace(/\b80\+\b/g, ' ');

    // 5. Final cleaning of the model part
    name = name
      .replace(/\s+[\-\u2013]\s+/g, ' ')
      .replace(/[\-\u2013]\s*$/, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // 6. Reconstruct canonical name
    const specParts = [];
    if (wattage) specParts.push(`${wattage}W`);
    if (efficiency) specParts.push(efficiency);

    name = name ? `${name} ${specParts.join(' ')}` : specParts.join(' ');
  }

  if (name.length < 2) name = rawName;

  return name.charAt(0).toUpperCase() + name.slice(1);
}
