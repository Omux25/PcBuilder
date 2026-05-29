// \u2500\u2500 Motherboard chipset \u2192 socket + DDR type lookup table \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
//
// Rules:
//   - DDR4_ONLY: chipset only ever shipped with DDR4 slots
//   - DDR5_ONLY: chipset only ever shipped with DDR5 slots
//   - BOTH: manufacturer sold DDR4 and DDR5 variants of the same board model.
//     In this case we rely on the product name: if it contains "D4" or "DDR4"
//     \u2192 DDR4; if it contains "D5" or "DDR5" \u2192 DDR5; otherwise \u2192 DDR5 (the
//     default/newer variant that ships without a suffix).
//
// Sources: Intel ARK, AMD product pages, PCPartPicker chipset specs.

type DdrPolicy = 'DDR3_ONLY' | 'DDR4_ONLY' | 'DDR5_ONLY' | 'BOTH';

interface ChipsetInfo {
  socket: string;
  ddr: DdrPolicy;
  /** Default max XMP/EXPO frequency when we can't read it from the name */
  defaultMaxMhz: number;
}

const CHIPSET_MAP: Record<string, ChipsetInfo> = {
  // \u2500\u2500 AMD AM4 (DDR4 only) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  A320: { socket: 'AM4', ddr: 'DDR4_ONLY', defaultMaxMhz: 3200 },
  A520: { socket: 'AM4', ddr: 'DDR4_ONLY', defaultMaxMhz: 4600 },
  B350: { socket: 'AM4', ddr: 'DDR4_ONLY', defaultMaxMhz: 3200 },
  B450: { socket: 'AM4', ddr: 'DDR4_ONLY', defaultMaxMhz: 4400 },
  B550: { socket: 'AM4', ddr: 'DDR4_ONLY', defaultMaxMhz: 5100 },
  X370: { socket: 'AM4', ddr: 'DDR4_ONLY', defaultMaxMhz: 3200 },
  X470: { socket: 'AM4', ddr: 'DDR4_ONLY', defaultMaxMhz: 3600 },
  X570: { socket: 'AM4', ddr: 'DDR4_ONLY', defaultMaxMhz: 5100 },
  // \u2500\u2500 AMD AM5 (DDR5 only) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  A620: { socket: 'AM5', ddr: 'DDR5_ONLY', defaultMaxMhz: 6400 },
  A850: { socket: 'AM5', ddr: 'DDR5_ONLY', defaultMaxMhz: 8000 },
  B650: { socket: 'AM5', ddr: 'DDR5_ONLY', defaultMaxMhz: 6400 },
  B650E: { socket: 'AM5', ddr: 'DDR5_ONLY', defaultMaxMhz: 6400 },
  B840: { socket: 'AM5', ddr: 'DDR5_ONLY', defaultMaxMhz: 8000 },
  B850: { socket: 'AM5', ddr: 'DDR5_ONLY', defaultMaxMhz: 8000 },
  X570S: { socket: 'AM4', ddr: 'DDR4_ONLY', defaultMaxMhz: 5100 }, // refresh of X570
  X670: { socket: 'AM5', ddr: 'DDR5_ONLY', defaultMaxMhz: 6400 },
  X670E: { socket: 'AM5', ddr: 'DDR5_ONLY', defaultMaxMhz: 6400 },
  X870: { socket: 'AM5', ddr: 'DDR5_ONLY', defaultMaxMhz: 8000 },
  X870E: { socket: 'AM5', ddr: 'DDR5_ONLY', defaultMaxMhz: 8000 },
  // \u2500\u2500 AMD Threadripper \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  TRX40: { socket: 'sTRX4', ddr: 'DDR4_ONLY', defaultMaxMhz: 3200 },
  TRX50: { socket: 'sTR5', ddr: 'DDR5_ONLY', defaultMaxMhz: 5600 },
  WRX80: { socket: 'sWRX8', ddr: 'DDR4_ONLY', defaultMaxMhz: 3200 },
  WRX90: { socket: 'sWRX9', ddr: 'DDR5_ONLY', defaultMaxMhz: 5600 },
  X399: { socket: 'TR4', ddr: 'DDR4_ONLY', defaultMaxMhz: 3200 },
  // \u2500\u2500 Intel LGA1151 (8th/9th gen, DDR4 only) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  B360: { socket: 'LGA1151', ddr: 'DDR4_ONLY', defaultMaxMhz: 2666 },
  B365: { socket: 'LGA1151', ddr: 'DDR4_ONLY', defaultMaxMhz: 2666 },
  H310: { socket: 'LGA1151', ddr: 'DDR4_ONLY', defaultMaxMhz: 2400 },
  H370: { socket: 'LGA1151', ddr: 'DDR4_ONLY', defaultMaxMhz: 2666 },
  Z370: { socket: 'LGA1151', ddr: 'DDR4_ONLY', defaultMaxMhz: 4000 },
  Z390: { socket: 'LGA1151', ddr: 'DDR4_ONLY', defaultMaxMhz: 4266 },
  B150: { socket: 'LGA1151', ddr: 'DDR4_ONLY', defaultMaxMhz: 2133 },
  B250: { socket: 'LGA1151', ddr: 'DDR4_ONLY', defaultMaxMhz: 2400 },
  H110: { socket: 'LGA1151', ddr: 'DDR4_ONLY', defaultMaxMhz: 2133 },
  H170: { socket: 'LGA1151', ddr: 'DDR4_ONLY', defaultMaxMhz: 2133 },
  H270: { socket: 'LGA1151', ddr: 'DDR4_ONLY', defaultMaxMhz: 2400 },
  Z170: { socket: 'LGA1151', ddr: 'DDR4_ONLY', defaultMaxMhz: 3466 },
  Z270: { socket: 'LGA1151', ddr: 'DDR4_ONLY', defaultMaxMhz: 3800 },
  // ── Intel LGA1150 (4th/5th gen, DDR3 only) ──────────────────────
  H81: { socket: 'LGA1150', ddr: 'DDR3_ONLY', defaultMaxMhz: 1600 },
  B85: { socket: 'LGA1150', ddr: 'DDR3_ONLY', defaultMaxMhz: 1600 },
  H87: { socket: 'LGA1150', ddr: 'DDR3_ONLY', defaultMaxMhz: 1600 },
  Z87: { socket: 'LGA1150', ddr: 'DDR3_ONLY', defaultMaxMhz: 2800 },
  H97: { socket: 'LGA1150', ddr: 'DDR3_ONLY', defaultMaxMhz: 1600 },
  Z97: { socket: 'LGA1150', ddr: 'DDR3_ONLY', defaultMaxMhz: 3200 },
  // ── Intel LGA1155 (2nd/3rd gen, DDR3 only) ──────────────────────
  H61: { socket: 'LGA1155', ddr: 'DDR3_ONLY', defaultMaxMhz: 1333 },
  B75: { socket: 'LGA1155', ddr: 'DDR3_ONLY', defaultMaxMhz: 1600 },
  Z77: { socket: 'LGA1155', ddr: 'DDR3_ONLY', defaultMaxMhz: 2400 },
  // \u2500\u2500 Intel LGA1200 (10th/11th gen, DDR4 only) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  B460: { socket: 'LGA1200', ddr: 'DDR4_ONLY', defaultMaxMhz: 2933 },
  B560: { socket: 'LGA1200', ddr: 'DDR4_ONLY', defaultMaxMhz: 4800 },
  H410: { socket: 'LGA1200', ddr: 'DDR4_ONLY', defaultMaxMhz: 2933 },
  H470: { socket: 'LGA1200', ddr: 'DDR4_ONLY', defaultMaxMhz: 2933 },
  H510: { socket: 'LGA1200', ddr: 'DDR4_ONLY', defaultMaxMhz: 3200 },
  H570: { socket: 'LGA1200', ddr: 'DDR4_ONLY', defaultMaxMhz: 3200 },
  Z490: { socket: 'LGA1200', ddr: 'DDR4_ONLY', defaultMaxMhz: 4800 },
  Z590: { socket: 'LGA1200', ddr: 'DDR4_ONLY', defaultMaxMhz: 5333 },
  // \u2500\u2500 Intel LGA1700 (12th/13th/14th gen \u2014 DDR4 and DDR5 variants exist) \u2500\u2500\u2500\u2500
  B660: { socket: 'LGA1700', ddr: 'BOTH', defaultMaxMhz: 4800 },
  B760: { socket: 'LGA1700', ddr: 'BOTH', defaultMaxMhz: 5600 },
  H610: { socket: 'LGA1700', ddr: 'BOTH', defaultMaxMhz: 4800 },
  H670: { socket: 'LGA1700', ddr: 'BOTH', defaultMaxMhz: 4800 },
  H770: { socket: 'LGA1700', ddr: 'BOTH', defaultMaxMhz: 5600 },
  Z690: { socket: 'LGA1700', ddr: 'BOTH', defaultMaxMhz: 6400 },
  Z790: { socket: 'LGA1700', ddr: 'BOTH', defaultMaxMhz: 7200 },
  // \u2500\u2500 Intel LGA1851 (Core Ultra 200 series) \u2014 DDR5 only \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  H810: { socket: 'LGA1851', ddr: 'DDR5_ONLY', defaultMaxMhz: 6400 },
  B860: { socket: 'LGA1851', ddr: 'DDR5_ONLY', defaultMaxMhz: 6400 },
  Z890: { socket: 'LGA1851', ddr: 'DDR5_ONLY', defaultMaxMhz: 9200 },
  // ── Intel LGA2066 HEDT ──────────────────
  X299: { socket: 'LGA2066', ddr: 'DDR4_ONLY', defaultMaxMhz: 4266 },
};

const SORTED_CHIPSETS = Object.keys(CHIPSET_MAP).sort((a, b) => b.length - a.length);

/**
 * Extract socket, supported_ram_types, and max_ram_frequency from a motherboard
 * product name using a two-layer approach:
 *
 *   Layer 1 — Explicit DDR suffix in name (highest confidence):
 *     "B760M DS3H DDR4" → DDR4,  "B760M DS3H DDR5" → DDR5
 *
 *   Layer 2 — Chipset lookup table:
 *     B650 → AM5 + DDR5_ONLY,  Z790 → LGA1700 + BOTH
 *     For BOTH chipsets: name contains "D4"/"DDR4" → DDR4, else → DDR5
 *
 * Returns null only if no chipset can be identified at all.
 */
export function extractMotherboardSpecs(name: string, brand?: string): {
  socket: string | null;
  chipset: string | null;
  supported_ram_types: string[];
  max_ram_frequency: number;
  form_factor: string;
  ram_slots: number;
} | null {
  const upper = name.toUpperCase();
  const bUpper = brand ? brand.toUpperCase() : '';
  const hasAsus = upper.includes('ASUS') || bUpper.includes('ASUS');
  const hasGigabyte = upper.includes('GIGABYTE') || bUpper.includes('GIGABYTE');
  const hasMsi = upper.includes('MSI') || bUpper.includes('MSI');
  const hasAsrock = upper.includes('ASROCK') || bUpper.includes('ASROCK');
  const hasBiostar = upper.includes('BIOSTAR') || bUpper.includes('BIOSTAR');

  // ── Layer 1: explicit DDR suffix anywhere in the name ────────────────────
  const hasExplicitDdr3 = /\bDDR3\b/.test(upper) || /\bD3\b/.test(upper);
  const hasExplicitDdr4 = /\bDDR4\b/.test(upper) || /\bD4\b/.test(upper);
  const hasExplicitDdr5 = /\bDDR5\b/.test(upper) || /\bD5\b/.test(upper);

  // ── Extract chipset token ─────────────────────────────────────────
  // Match patterns like: B650, B650E, B650M, X670E, Z790, H610M, X570S, TRX40, WRX80, X399, H81, Z97, H61
  const chipsetMatch = upper.match(
    /\b(TRX\d{2}|WRX\d{2}|X399|[ABXZH]\d{2,3}(?:[EIM]|S(?=\b))?)\b/
  );

  let rawChipset = chipsetMatch ? chipsetMatch[1] : null;
  let info: ChipsetInfo | undefined = undefined;
  let resolvedChipset: string | null = null;

  if (rawChipset) {
    const directKey = rawChipset;
    const cleanedKey1 = rawChipset.replace(/[EIM]$/, '');
    const cleanedKey2 = rawChipset.replace(/[EIMS]{1,2}$/, '');
    
    if (CHIPSET_MAP[directKey]) {
      info = CHIPSET_MAP[directKey];
      resolvedChipset = directKey;
    } else if (CHIPSET_MAP[cleanedKey1]) {
      info = CHIPSET_MAP[cleanedKey1];
      resolvedChipset = cleanedKey1;
    } else if (CHIPSET_MAP[cleanedKey2]) {
      info = CHIPSET_MAP[cleanedKey2];
      resolvedChipset = cleanedKey2;
    }
  }

  // Fallback: If no chipset was found with word-boundary regex, do a substring lookup (longest first)
  if (!info) {
    for (const cs of SORTED_CHIPSETS) {
      if (upper.includes(cs)) {
        rawChipset = cs;
        info = CHIPSET_MAP[cs];
        resolvedChipset = cs;
        break;
      }
    }
  }

  // If still not found, check named series fallbacks or Biostar
  if (!info) {
    // Named series fallback: ROG MAXIMUS XII/XIII/XIV/XV/XVI → Z490/Z590/Z690/Z790/Z890, Zenith II → TRX40
    if (/MAXIMUS\s+XII\b/.test(upper)) return extractMotherboardSpecs('Z490', brand);
    if (/MAXIMUS\s+XIII\b/.test(upper)) return extractMotherboardSpecs('Z590', brand);
    if (/MAXIMUS\s+XIV\b/.test(upper)) return extractMotherboardSpecs('Z690', brand);
    if (/MAXIMUS\s+XV\b/.test(upper)) return extractMotherboardSpecs('Z790', brand);
    if (/MAXIMUS\s+XVI\b/.test(upper)) return extractMotherboardSpecs('Z890', brand);
    if (/ZENITH\s+II\b/.test(upper)) return extractMotherboardSpecs('TRX40', brand);
    if (/ZENITH\s+III\b/.test(upper)) return extractMotherboardSpecs('TRX50', brand);
    if (/CROSSHAIR\s+VIII\b/.test(upper) || /CROSSHAIR\s+Viii\b/.test(upper)) return extractMotherboardSpecs('X570', brand);
    // Biostar boards
    const biostarMatch = upper.match(/\b([ABXZH]\d{3})/);
    if (biostarMatch && biostarMatch[1] !== upper && CHIPSET_MAP[biostarMatch[1]]) {
      return extractMotherboardSpecs(biostarMatch[1], brand);
    }
    // ASUS Pro WS WRX80E / WRX90E
    if (/WRX80/.test(upper)) return extractMotherboardSpecs('WRX80', brand);
    if (/WRX90/.test(upper)) return extractMotherboardSpecs('WRX90', brand);
    return null;
  }

  // ── Resolve DDR type ──────────────────────────────────────────────────────
  let ramTypes: string[];
  let maxMhz: number;

  if (info.ddr === 'DDR3_ONLY') {
    ramTypes = ['DDR3'];
    maxMhz = info.defaultMaxMhz;
  } else if (info.ddr === 'DDR4_ONLY') {
    ramTypes = ['DDR4'];
    maxMhz = info.defaultMaxMhz;
  } else if (info.ddr === 'DDR5_ONLY') {
    ramTypes = ['DDR5'];
    maxMhz = info.defaultMaxMhz;
  } else {
    // BOTH — use explicit suffix if present, otherwise default to chipset-based policy
    if (hasExplicitDdr4) {
      ramTypes = ['DDR4'];
      maxMhz = info.defaultMaxMhz;
    } else if (hasExplicitDdr5) {
      ramTypes = ['DDR5'];
      maxMhz = info.defaultMaxMhz;
    } else {
      // Default fallback when there is no explicit suffix:
      // For older/budget LGA1700 chipsets (H610, B660), default to DDR4 (by far the most common).
      // For newer/mainstream LGA1700 chipsets (B760, H670, H770, Z690, Z790), default to DDR5.
      if (resolvedChipset && (resolvedChipset.startsWith('H610') || resolvedChipset.startsWith('B660'))) {
        ramTypes = ['DDR4'];
      } else {
        ramTypes = ['DDR5'];
      }
      maxMhz = info.defaultMaxMhz;
    }
  }

  if (hasExplicitDdr4 && ramTypes[0] !== 'DDR4') {
    ramTypes = ['DDR4'];
  } else if (hasExplicitDdr5 && ramTypes[0] !== 'DDR5') {
    ramTypes = ['DDR5'];
  } else if (hasExplicitDdr3 && ramTypes[0] !== 'DDR3') {
    ramTypes = ['DDR3'];
  }

  // ── Resolve Form Factor & Slots ───────────────────────────────────────────
  let form_factor = 'ATX';
  if (upper.match(/\b(ITX|MINI-ITX)\b/) || upper.match(/[ABXZH]\d{2,3}I/)) {
    form_factor = 'ITX';
  } else if (upper.match(/\b(MATX|MICRO-ATX|M-ATX)\b/) || upper.match(/[ABXZH]\d{2,3}M/)) {
    form_factor = 'mATX';
  } else if (upper.match(/\b(EATX|E-ATX)\b/)) {
    form_factor = 'E-ATX';
  }

  let ram_slots = 4;

  // 1. High-end Platforms (Threadripper, etc.)
  if (info.socket === 'sTR5' || info.socket === 'sWRX8' || info.socket === 'sWRX9' || info.socket === 'TR4' || info.socket === 'sTRX4') {
    ram_slots = 8;
  } else if (form_factor === 'ITX') {
    // 2. Form Factor based defaults
    ram_slots = 2;
  } else {
    // 3. Brand-specific and model-specific high-fidelity slot count rules
    if (hasBiostar) {
      if (!upper.match(/\b(VALKYRIE|RACING|SILVER)\b/)) {
        ram_slots = 2;
      }
    } else if (hasAsrock && (upper.match(/\b(HDV|DVS|HVS)\b/) || upper.match(/[- ]X\b/) || upper.includes('H310CM'))) {
      ram_slots = 2;
    } else if (hasMsi && (
      upper.match(/\bPRO[ -]([AH]\d{3}M|[ABH]\d{3}M[ -][EB])\b/) || 
      upper.match(/\b(A520M[ -]A[ -]PRO|B450M[ -]A[ -]PRO)\b/) ||
      (form_factor === 'mATX' && (
        upper.includes('-A PRO') || upper.includes('A-PRO') || upper.includes('A PRO') ||
        upper.includes('-M2') || upper.includes('PRO-M2')
      ))
    )) {
      ram_slots = 2;
    } else if (hasAsus && (
      upper.match(/\bPRIME[ -]([AH]\d{3}M|[ABXZH]\d{3}M[ -][KDRE])\b/)
    )) {
      ram_slots = 2;
    } else if (hasGigabyte && (
      upper.match(/\b(H\d{3}M|A\d{3}M)[ -][KHS2]\b/) ||
      upper.match(/\b([ABXZH]\d{3}M?)[ -](K|H|S2|S2H|D2H|D3H)\b/)
    )) {
      ram_slots = 2;
    } else {
      // 4. Chipset based default fallbacks
      const entryChipsets = [
        'H610', 'H510', 'H410', 'H310', 'H110', 
        'A320', 'A520',
        'B250', 'B150', 'H270', 'H170',
        'H81', 'B85', 'H61', 'B75'
      ];
      const strictTwoSlotChipsets = ['H610', 'H510', 'H410', 'H310', 'H110', 'A320', 'H81', 'H61'];
      const isEntryChipset = rawChipset ? entryChipsets.includes(rawChipset.replace(/[EIMS]$/, '')) : false;
      const isStrictTwoSlot = rawChipset ? strictTwoSlotChipsets.includes(rawChipset.replace(/[EIMS]$/, '')) : false;
      
      if (isStrictTwoSlot) {
        ram_slots = 2;
      } else if (isEntryChipset) {
        // Entry chipsets default to 2 slots unless they have keywords indicating 4
        if (!upper.match(/\b(DS3H|PLUS|STEEL|PHANTOM|MORTAR|TOMAHAWK|ELITE|MASTER|AORUS|MAX)\b/)) {
          ram_slots = 2;
        }
      } else {
        // Mainstream chipsets (B, X, Z) default to 4 slots.
        // We only override to 2 for specific budget series and suffixes on B-series boards.
        const isHighEndChipset = upper.match(/\b([XZ]\d{3})\b/);
        const isBudgetSeries = !isHighEndChipset && upper.match(/\b(PRIME|PRO|GAMING|S2H|DS2H|DS2V|S2|H|K|V|R|E)\b/) 
           && !upper.match(/\b(X|AX|PLUS|WIFI|AC|AORUS|ROG|STRIX|TUF|MAG|MPG|MEG|MORTAR|TOMAHAWK|STEEL|PHANTOM|LEGEND|4)\b/i);
        
        if (isBudgetSeries) {
          const isB550 = upper.includes('B550');
          if (isB550) {
            ram_slots = 4;
          } else if (upper.match(/[- ](K|H|V|R|E|M-K|M-H|M-V|M-R|M-E)\b/) || upper.match(/\b(PRO-V?H|DS2H|DS2V|S2H|S2V)\b/)) {
            ram_slots = 2;
          } else if (upper.match(/\bGAMING\b/) && form_factor === 'mATX') {
            ram_slots = 2;
          }
        }
      }
    }
  }

  return {
    socket: info.socket,
    chipset: resolvedChipset,
    supported_ram_types: ramTypes,
    max_ram_frequency: maxMhz,
    form_factor,
    ram_slots,
  };
}
