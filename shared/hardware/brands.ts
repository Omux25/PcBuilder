const BRANDS = [
  '1stPlayer', 'Abkoncore', 'Acer', 'ADATA', 'Addlink', 'Aerocool', 'AMD', 'Antec', 'Apacer', 'APNX', 'Arctic', 'Arktek',
  'ASRock', 'ASUS', 'be quiet!', 'Biostar', 'BitFenix', 'Chieftec', 'Colorful', 'Cooler Master',
  'Connect', 'Corsair', 'Cougar', 'Crucial', 'DeepCool', 'Dell', 'Deskooze', 'EKWB', 'Enermax', 'EVGA', 'FANXIANG', 'Fractal',
  'FSP', 'G.Skill', 'Gainward', 'Galax', 'Geil', 'Gigabyte', 'Goodram', 'HIKSEMI', 'Hikvision', 'HP', 'HAVN', 'Hybrok', 'Hyte',
  'ID-Cooling', 'Infinity', 'Inno3D', 'Innovation IT', 'Intel', 'Intenso', 'Itek', 'KFA2', 'Kingston', 'Klevv',
  'Kolink', 'LC Power', 'Leadtek', 'Lenovo', 'Lexar', 'Lian Li', 'M.RED', 'Manli', 'Mars Gaming', 'Matrox', 'Montech', 'MSI', 'Mushkin',
  'Noctua', 'Nova', 'Nox', 'NVIDIA', 'NZXT', 'OCPC', 'Palit', 'Patriot', 'Phanteks', 'Philips', 'PNY',
  'PowerColor', 'Razer', 'Reletech', 'Sabrent', 'Samsung', 'Sapphire', 'Scythe', 'Seagate', 'Seasonic',
  'Setup Game', 'Sharkoon', 'Silicon Power', 'Silverstone', 'Sparkle', 'Spirit of Gamer', 'Super Flower',
  'Symphony', 'Team Group', 'TeamGroup', 'Thermal Grizzly', 'Thermalright', 'Thermaltake', 'Tooq', 'Toshiba', 'Transcend', 'Twinmos', 'Verbatim',
  'Viper', 'WD', 'Western Digital', 'XFX', 'Xigmatek', 'XPG', 'XTRMLAB', 'Yeyian', 'Zotac'
];

const PRECOMPUTED_REGEXES = new Map<string, RegExp>();
for (const brand of BRANDS) {
  const bLower = brand.toLowerCase();
  const escapedBrand = bLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = bLower.includes('!')
    ? new RegExp(`\\b${escapedBrand}`, 'i')
    : new RegExp(`\\b${escapedBrand}\\b`, 'i');
  PRECOMPUTED_REGEXES.set(brand, regex);
}

const CHIP_BRANDS = new Set(['Intel', 'AMD', 'NVIDIA']);

export function extractBrand(name: string): string {
  const n = name.trim();
  const lower = n.toLowerCase();

  // 1. Explicit sub-brand to parent brand mapping
  // These are checked first for high-confidence matches.
  const SUB_BRANDS: Record<string, string> = {
    'rog': 'ASUS', 'tuf': 'ASUS', 'strix': 'ASUS', 'proart': 'ASUS', 'prime': 'ASUS',
    'mpg': 'MSI', 'mag': 'MSI', 'meg': 'MSI', 'optix': 'MSI',
    'aorus': 'Gigabyte', 'gaming oc': 'Gigabyte', 'eagle': 'Gigabyte', 'windforce': 'Gigabyte',
    'masterliquid': 'Cooler Master', 'masterbox': 'Cooler Master', 'masterfan': 'Cooler Master', 'hyper ': 'Cooler Master',
    'hyper212': 'Cooler Master',
    'vengance': 'Corsair', 'dominator': 'Corsair', 'icue': 'Corsair', 'hydroshift': 'Lian Li', 'titan': 'Corsair',
    'trident': 'G.Skill', 'ripjaws': 'G.Skill',
    'fury': 'Kingston', 'renegade': 'Kingston', 'hyperx': 'Kingston',
    't-force': 'TeamGroup', 't.force': 'TeamGroup', 'vulcan': 'TeamGroup', 'delta': 'TeamGroup', 'team': 'TeamGroup',
    'sn550': 'WD', 'sn570': 'WD', 'sn580': 'WD', 'sn770': 'WD', 'sn850': 'WD',
    '970 evo': 'Samsung', '980 pro': 'Samsung', '990 pro': 'Samsung',
    'sg ': 'Setup Game', 'sg-': 'Setup Game',
    'arctic frost': 'Connect',
    'frost frgb': 'Connect'
  };

  for (const [sub, parent] of Object.entries(SUB_BRANDS)) {
    if (lower.includes(sub)) return parent;
  }

  // 2. Positional Brand Detection
  // We find ALL matches and pick the one that appears EARLIEST in the string.
  // This handles "Connect Arctic Frost" by picking Connect (index 0) over Arctic (index 8).
  let bestMatch: { brand: string; index: number } | null = null;

  for (const brand of BRANDS) {
    const regex = PRECOMPUTED_REGEXES.get(brand)!;

    const match = lower.match(regex);
    if (match && match.index !== undefined) {
      const isChipBrand = CHIP_BRANDS.has(brand);
      const currentIsChipBrand = bestMatch ? CHIP_BRANDS.has(bestMatch.brand) : false;

      // Prefer non-chip brands (manufacturers) over chip brands (Intel/AMD/NVIDIA),
      // or pick the one that appears earlier in the string if both are of same type.
      if (bestMatch === null || (currentIsChipBrand && !isChipBrand) || (match.index < bestMatch.index && !(isChipBrand && !currentIsChipBrand))) {
        bestMatch = { brand, index: match.index };
      }
    }
  }

  return bestMatch ? bestMatch.brand : '';
}
