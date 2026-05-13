/**
 * variantExtractor.ts — Extracts human-readable variant labels and structured
 * variant details from scraped product names.
 *
 * The variant label is what gets shown in the price comparison table:
 *   "Sapphire Pulse"  for a GPU
 *   "Tray"            for a CPU
 *   "2x16GB CL30"     for RAM
 *
 * The variant details JSONB stores structured metadata for filtering.
 */

// ── GPU ───────────────────────────────────────────────────────────────────────

const GPU_AIB_PARTNERS = [
  'Sapphire', 'ASRock', 'Gigabyte', 'MSI', 'ASUS', 'Palit', 'Zotac',
  'PowerColor', 'XFX', 'EVGA', 'PNY', 'Inno3D', 'Gainward', 'Colorful',
  'Galax', 'KFA2', 'Manli', 'Biostar', 'Arktek', 'OCPC',
];

const GPU_MODEL_TIERS: Record<string, string[]> = {
  Sapphire: ['Nitro+', 'Pulse', 'Pure'],
  ASUS: ['ROG Strix', 'TUF Gaming', 'Dual', 'Prime', 'ProArt'],
  MSI: ['Gaming X Trio', 'Gaming X', 'Gaming', 'Ventus 3X', 'Ventus 2X', 'Ventus', 'Mech', 'Shadow'],
  Gigabyte: ['Aorus Master', 'Aorus Elite', 'Aorus', 'Gaming OC', 'Eagle OC', 'Eagle', 'Windforce OC', 'Windforce'],
  Palit: ['GameRock', 'GamingPro', 'Dual', 'StormX'],
  Zotac: ['AMP Extreme', 'AMP Holo', 'AMP', 'Twin Edge OC', 'Twin Edge'],
  PowerColor: ['Red Devil', 'Red Dragon', 'Fighter'],
  XFX: ['Speedster MERC', 'Speedster SWFT', 'Speedster Swift', 'Qick'],
  PNY: ['XLR8 Gaming Verto', 'XLR8', 'Verto'],
};

export interface GpuVariantDetails {
  [key: string]: unknown;
  aib_partner?: string;
  model_tier?: string;
  cooling_slots?: string; // "2-slot" | "2.5-slot" | "3-slot"
  vram_gb?: number;
}

export function extractGpuVariant(productName: string, description?: string): { label: string; details: GpuVariantDetails } {
  const details: GpuVariantDetails = {};
  const n = productName;

  // Detect AIB partner
  for (const partner of GPU_AIB_PARTNERS) {
    if (n.toLowerCase().includes(partner.toLowerCase())) {
      details.aib_partner = partner;
      break;
    }
  }

  // Detect model tier
  if (details.aib_partner && GPU_MODEL_TIERS[details.aib_partner]) {
    for (const tier of GPU_MODEL_TIERS[details.aib_partner]) {
      if (n.toLowerCase().includes(tier.toLowerCase())) {
        details.model_tier = tier;
        break;
      }
    }
  }

  // Detect VRAM — handles: 24GB, 24G, 24Go, 24 GB, 24 Go, 24GDDR6
  // Bare "G" suffix only matched when followed by word boundary or GDDR to avoid
  // false positives on words like "Gaming".
  // Falls back to description when name doesn't contain VRAM.
  const vramRegex = /\b(\d+)\s*(?:gb|go|g(?:ddr|\b))/i;
  const vramMatch = n.match(vramRegex) ?? (description ? description.match(vramRegex) : null);
  if (vramMatch) details.vram_gb = parseInt(vramMatch[1]);

  // Build label
  const parts: string[] = [];
  if (details.aib_partner) parts.push(details.aib_partner);
  if (details.model_tier) parts.push(details.model_tier);
  if (details.vram_gb) parts.push(`${details.vram_gb}GB`);

  const label = parts.length > 0 ? parts.join(' ') : productName.slice(0, 60);
  return { label, details };
}

// ── CPU ───────────────────────────────────────────────────────────────────────

export type CpuPackaging = 'BOX' | 'Tray' | 'MPK' | 'OEM';

export interface CpuVariantDetails {
  [key: string]: unknown;
  packaging: CpuPackaging;
  has_igpu?: boolean;
  has_3d_vcache?: boolean;
  unlocked_multiplier?: boolean;
}

export function extractCpuVariant(productName: string): { label: string; details: CpuVariantDetails } {
  const n = productName.toLowerCase();
  const details: CpuVariantDetails = { packaging: 'BOX' };

  // Packaging
  if (n.includes('tray')) details.packaging = 'Tray';
  else if (n.includes('mpk')) details.packaging = 'MPK';
  else if (n.includes('oem')) details.packaging = 'OEM';
  else if (n.includes('box')) details.packaging = 'BOX';

  // iGPU — Intel F-series has no iGPU, AMD G-series has iGPU
  const hasF = /\b\d{4,5}[a-z]*f\b/i.test(productName);
  const hasG = /\b\d{4,5}g\b/i.test(productName) || n.includes(' g ');
  if (hasF) details.has_igpu = false;
  else if (hasG) details.has_igpu = true;

  // 3D V-Cache
  if (n.includes('x3d')) details.has_3d_vcache = true;

  // Unlocked multiplier — Intel K/KF/KS, AMD X-series
  if (/\b\d{4,5}k[fs]?\b/i.test(productName) || /ryzen.*\d{4}x/i.test(productName)) {
    details.unlocked_multiplier = true;
  }

  return { label: details.packaging, details };
}

// ── RAM ───────────────────────────────────────────────────────────────────────

export interface RamVariantDetails {
  [key: string]: unknown;
  kit_config?: string;   // "2x16GB", "1x32GB"
  memory_profile?: string; // "XMP" | "EXPO" | "JEDEC"
  cas_latency?: number;
  color?: string;
}

export function extractRamVariant(productName: string): { label: string; details: RamVariantDetails } {
  const n = productName.toLowerCase();
  const details: RamVariantDetails = {};

  // Kit config
  const kitMatch = productName.match(/(\d+)\s*[xX×]\s*(\d+)\s*[Gg][Bb]/);
  if (kitMatch) details.kit_config = `${kitMatch[1]}x${kitMatch[2]}GB`;

  // Memory profile
  if (n.includes('expo')) details.memory_profile = 'EXPO';
  else if (n.includes('xmp')) details.memory_profile = 'XMP';

  // CAS latency
  const clMatch = productName.match(/CL\s*(\d+)/i);
  if (clMatch) details.cas_latency = parseInt(clMatch[1]);

  // Color
  if (n.includes('white') || n.includes('blanc')) details.color = 'White';
  else if (n.includes('black') || n.includes('noir')) details.color = 'Black';
  else if (n.includes('silver') || n.includes('argent')) details.color = 'Silver';

  // Build label
  const parts: string[] = [];
  if (details.kit_config) parts.push(details.kit_config);
  if (details.memory_profile) parts.push(details.memory_profile);
  if (details.cas_latency) parts.push(`CL${details.cas_latency}`);
  if (details.color) parts.push(details.color);

  const label = parts.length > 0 ? parts.join(' ') : '';
  return { label, details };
}

// ── Storage ───────────────────────────────────────────────────────────────────

export interface StorageVariantDetails {
  [key: string]: unknown;
  form_factor?: string;  // "M.2 2280" | "M.2 2230" | "2.5 SATA"
  pcie_gen?: string;     // "Gen3" | "Gen4" | "Gen5" | "SATA"
  has_heatsink?: boolean;
}

export function extractStorageVariant(productName: string): { label: string; details: StorageVariantDetails } {
  const n = productName.toLowerCase();
  const details: StorageVariantDetails = {};

  // Form factor
  if (n.includes('2230')) details.form_factor = 'M.2 2230';
  else if (n.includes('m.2') || n.includes('nvme') || n.includes('m2')) details.form_factor = 'M.2 2280';
  else if (n.includes('2.5') || n.includes('sata')) details.form_factor = '2.5" SATA';

  // PCIe gen
  if (n.includes('gen5') || n.includes('pcie 5') || n.includes('pcie5')) details.pcie_gen = 'Gen5';
  else if (n.includes('gen4') || n.includes('pcie 4') || n.includes('pcie4')) details.pcie_gen = 'Gen4';
  else if (n.includes('gen3') || n.includes('pcie 3') || n.includes('pcie3')) details.pcie_gen = 'Gen3';
  else if (n.includes('sata')) details.pcie_gen = 'SATA';

  // Heatsink
  if (n.includes('heatsink') || n.includes('dissipateur') || n.includes('avec dissip')) {
    details.has_heatsink = true;
  }

  const parts: string[] = [];
  if (details.pcie_gen) parts.push(details.pcie_gen);
  if (details.has_heatsink) parts.push('+ Heatsink');

  const label = parts.join(' ');
  return { label, details };
}

// ── PSU ───────────────────────────────────────────────────────────────────────

export interface PsuVariantDetails {
  [key: string]: unknown;
  modularity?: string;   // "Non-modular" | "Semi-modular" | "Fully modular"
  atx_version?: string;  // "ATX 2.0" | "ATX 3.0" | "ATX 3.1"
  color?: string;
}

export function extractPsuVariant(productName: string): { label: string; details: PsuVariantDetails } {
  const n = productName.toLowerCase();
  const details: PsuVariantDetails = {};

  // Modularity
  if (n.includes('full modular') || n.includes('fully modular') || n.includes('full modulaire')) {
    details.modularity = 'Fully modular';
  } else if (n.includes('semi modular') || n.includes('semi-modular') || n.includes('semi modulaire')) {
    details.modularity = 'Semi-modular';
  } else {
    details.modularity = 'Non-modular';
  }

  // ATX version
  if (n.includes('atx 3.1') || n.includes('atx3.1')) details.atx_version = 'ATX 3.1';
  else if (n.includes('atx 3.0') || n.includes('atx3.0') || n.includes('pcie5') || n.includes('pcie 5')) {
    details.atx_version = 'ATX 3.0';
  }

  // Color
  if (n.includes('white') || n.includes('blanc')) details.color = 'White';
  else if (n.includes('black') || n.includes('noir')) details.color = 'Black';

  const parts: string[] = [];
  if (details.modularity && details.modularity !== 'Non-modular') parts.push(details.modularity);
  if (details.atx_version) parts.push(details.atx_version);
  if (details.color) parts.push(details.color);

  const label = parts.join(' ');
  return { label, details };
}

// ── Cooling ───────────────────────────────────────────────────────────────────

export interface CoolingVariantDetails {
  [key: string]: unknown;
  color?: string;
  size_mm?: number;
}

export function extractCoolingVariant(productName: string): { label: string; details: CoolingVariantDetails } {
  const n = productName.toLowerCase();
  const details: CoolingVariantDetails = {};

  const sizeMatch = productName.match(/\b(120|140|240|280|360|420)\s*mm\b/i);
  if (sizeMatch) details.size_mm = parseInt(sizeMatch[1]);

  if (n.includes('white') || n.includes('blanc')) details.color = 'White';
  else if (n.includes('black') || n.includes('noir')) details.color = 'Black';

  const parts: string[] = [];
  if (details.size_mm) parts.push(`${details.size_mm}mm`);
  if (details.color) parts.push(details.color);

  return { label: parts.join(' '), details };
}

// ── Case ──────────────────────────────────────────────────────────────────────

export interface CaseVariantDetails {
  [key: string]: unknown;
  color?: string;
}

export function extractCaseVariant(productName: string): { label: string; details: CaseVariantDetails } {
  const n = productName.toLowerCase();
  const details: CaseVariantDetails = {};

  if (n.includes('white') || n.includes('blanc') || n.includes('snow')) details.color = 'White';
  else if (n.includes('black') || n.includes('noir')) details.color = 'Black';
  else if (n.includes('pink') || n.includes('rose')) details.color = 'Pink';

  return { label: details.color ?? '', details };
}

// ── Motherboard ───────────────────────────────────────────────────────────────

export interface MotherboardVariantDetails {
  [key: string]: unknown;
  ddr_standard?: 'DDR4' | 'DDR5';
  revision?: string;
}

export function extractMotherboardVariant(productName: string): { label: string; details: MotherboardVariantDetails } {
  const n = productName.toLowerCase();
  const details: MotherboardVariantDetails = {};

  if (n.includes('ddr5')) details.ddr_standard = 'DDR5';
  else if (n.includes('ddr4') || n.includes('d4')) details.ddr_standard = 'DDR4';

  const revMatch = productName.match(/\bR(?:ev\.?\s*)?(\d+\.\d+)\b/i);
  if (revMatch) details.revision = `Rev ${revMatch[1]}`;

  const parts: string[] = [];
  if (details.ddr_standard) parts.push(details.ddr_standard);
  if (details.revision) parts.push(details.revision);

  return { label: parts.join(' '), details };
}

// ── Main dispatcher ───────────────────────────────────────────────────────────

export interface VariantInfo {
  label: string;
  details: Record<string, unknown>;
}

/**
 * Extracts variant label and details from a scraped product name,
 * dispatching to the appropriate category-specific extractor.
 * Falls back to description when the name lacks detail (e.g. VRAM size).
 */
export function extractVariant(productName: string, category: string, description?: string): VariantInfo {
  if (!productName) return { label: '', details: {} };

  switch (category) {
    case 'gpu': return extractGpuVariant(productName, description);
    case 'cpu': return extractCpuVariant(productName);
    case 'ram': return extractRamVariant(productName);
    case 'storage': return extractStorageVariant(productName);
    case 'psu': return extractPsuVariant(productName);
    case 'cooling': return extractCoolingVariant(productName);
    case 'case': return extractCaseVariant(productName);
    case 'motherboard': return extractMotherboardVariant(productName);
    default: return { label: '', details: {} };
  }
}
