export function extractBrand(name: string): string {
  const n = name.trim();
  const lower = n.toLowerCase();

  // 1. Explicit sub-brand to parent brand mapping
  const SUB_BRANDS: Record<string, string> = {
    'rog': 'ASUS', 'tuf': 'ASUS', 'strix': 'ASUS', 'proart': 'ASUS', 'prime': 'ASUS',
    'mpg': 'MSI', 'mag': 'MSI', 'meg': 'MSI', 'optix': 'MSI',
    'aorus': 'Gigabyte', 'gaming oc': 'Gigabyte', 'eagle': 'Gigabyte', 'windforce': 'Gigabyte',
    'masterliquid': 'Cooler Master', 'masterbox': 'Cooler Master', 'masterfan': 'Cooler Master', 'hyper': 'Cooler Master',
    'vengance': 'Corsair', 'dominator': 'Corsair', 'icue': 'Corsair', 'hydroshift': 'Lian Li', 'titan': 'Corsair',
    'trident': 'G.Skill', 'ripjaws': 'G.Skill',
    'fury': 'Kingston', 'renegade': 'Kingston',
    'sn550': 'WD', 'sn570': 'WD', 'sn580': 'WD', 'sn770': 'WD', 'sn850': 'WD',
    '970 evo': 'Samsung', '980 pro': 'Samsung', '990 pro': 'Samsung'
  };

  for (const [sub, parent] of Object.entries(SUB_BRANDS)) {
    if (lower.includes(sub)) return parent;
  }

  // 2. Search for major brands anywhere in the name (not just at the start)
  const BRANDS = ['AMD', 'Intel', 'NVIDIA', 'ASUS', 'MSI', 'Gigabyte', 'ASRock', 'EVGA', 'Corsair', 'G.Skill', 'Kingston', 'Crucial', 'TeamGroup', 'Team Group', 'Lexar', 'ADATA', 'Samsung', 'WD', 'Seagate', 'Sabrent', 'Silicon Power', 'Seasonic', 'be quiet!', 'Cooler Master', 'Thermaltake', 'Antec', 'DeepCool', 'Fractal', 'NZXT', 'Lian Li', 'Phanteks', 'Aerocool', 'Silverstone', 'Noctua', 'Arctic', 'Thermalright', 'Scythe', 'ID-Cooling', 'APNX', 'Arktek', 'Inno3D', 'Palit', 'Zotac', 'Sapphire', 'PowerColor', 'XFX', 'PNY', 'Gainward', 'Colorful', 'Galax', 'KFA2', 'Acer', 'HP', 'Toshiba', 'Patriot', 'Klevv', 'Geil', 'Mushkin', 'FSP', 'Super Flower', 'XPG', 'Cougar', 'Chieftec', 'LC Power', '1stPlayer', 'Kolink', 'Sharkoon', 'BitFenix', 'Mars Gaming', 'M.RED', 'Enermax', 'Xigmatek', 'Montech', 'Biostar', 'Verbatim', 'Abkoncore', 'XTRMLAB', 'OCPC', 'HIKSEMI', 'FANXIANG', 'Setup Game', 'Hyte', 'Yeyian', 'HAVN', 'Itek', 'Spirit of Gamer', 'Western Digital', 'Razer', 'Innovation IT', 'Viper'];

  for (const brand of BRANDS) {
    const bLower = brand.toLowerCase();
    // Check for word boundary match, but handle special characters like !
    const escapedBrand = bLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = bLower.includes('!')
      ? new RegExp(`\\b${escapedBrand}`, 'i')
      : new RegExp(`\\b${escapedBrand}\\b`, 'i');
    if (regex.test(lower)) return brand;
  }

  // No brand found
  return '';
}
