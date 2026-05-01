// @ts-nocheck
import { describe, it, expect } from 'bun:test';
import { extractDna, scoreDnaMatch, findBestMatch, tokenToRegex } from '../componentMatcher.js';

// ── tokenToRegex ──────────────────────────────────────────────────────────────

describe('tokenToRegex', () => {
  it('matches token with space between letters and digits', () => {
    expect(tokenToRegex('rtx4090').test('gigabyte geforce rtx 4090 gaming oc 24g')).toBe(true);
  });

  it('matches token without space', () => {
    expect(tokenToRegex('rtx4090').test('gigabyte rtx4090 gaming')).toBe(true);
  });

  it('does NOT match a different model number', () => {
    expect(tokenToRegex('rtx4080').test('gigabyte geforce rtx 4090 gaming')).toBe(false);
  });

  it('rx7900xtx does NOT match rx7900xt product', () => {
    expect(tokenToRegex('rx7900xtx').test('sapphire pulse rx 7900 xt 20gb')).toBe(false);
  });

  it('rx7900xt does NOT match rx7900xtx product', () => {
    expect(tokenToRegex('rx7900xt').test('sapphire pulse rx 7900 xtx 24gb')).toBe(false);
  });

  it('7600x does NOT match 7600 product', () => {
    expect(tokenToRegex('7600x').test('amd ryzen 5 7600 box')).toBe(false);
  });

  it('7600 does NOT match 7600x product', () => {
    expect(tokenToRegex('7600').test('amd ryzen 5 7600x tray')).toBe(false);
  });

  it('ryzen5 matches "ryzen 5" with space', () => {
    expect(tokenToRegex('ryzen5').test('amd ryzen 5 7600x')).toBe(true);
  });

  it('lga1700 matches "lga 1700" with space', () => {
    expect(tokenToRegex('lga1700').test('msi z790 tomahawk lga 1700')).toBe(true);
  });
});

// ── extractDna ────────────────────────────────────────────────────────────────

describe('extractDna — GPU', () => {
  it('extracts RTX chipset token', () => {
    expect(extractDna('NVIDIA GeForce RTX 4090 GAMING OC 24G', 'gpu')).toContain('rtx4090');
  });

  it('extracts RTX Ti SUPER variant as single token', () => {
    expect(extractDna('MSI GeForce RTX 4070 Ti SUPER 16G', 'gpu')).toContain('rtx4070tisuper');
  });

  it('extracts AMD RX chipset', () => {
    expect(extractDna('Sapphire PULSE RX 7900 XTX 24GB', 'gpu')).toContain('rx7900xtx');
  });

  it('extracts RX without suffix', () => {
    expect(extractDna('Gigabyte RX 6600 EAGLE 8G', 'gpu')).toContain('rx6600');
  });
});

describe('extractDna — CPU', () => {
  it('extracts Ryzen family + model', () => {
    const tokens = extractDna('AMD Ryzen 5 7600X', 'cpu');
    expect(tokens).toContain('ryzen5');
    expect(tokens).toContain('7600x');
  });

  it('extracts Intel Core i7 + model', () => {
    const tokens = extractDna('Intel Core i7-13700K', 'cpu');
    expect(tokens).toContain('i7');
    expect(tokens).toContain('13700k');
  });

  it('extracts Ryzen 9 3D V-Cache', () => {
    const tokens = extractDna('AMD Ryzen 9 7950X3D', 'cpu');
    expect(tokens).toContain('ryzen9');
    expect(tokens).toContain('7950x3d');
  });

  it('extracts Intel Core Ultra 9 family + model', () => {
    const tokens = extractDna('Intel Core Ultra 9 285K', 'cpu');
    expect(tokens).toContain('ultra9');
    expect(tokens).toContain('285k');
  });

  it('extracts Intel Core Ultra 7 family + model', () => {
    const tokens = extractDna('Intel Core Ultra 7 265K', 'cpu');
    expect(tokens).toContain('ultra7');
    expect(tokens).toContain('265k');
  });

  it('extracts Intel Core Ultra 5 family + model', () => {
    const tokens = extractDna('Intel Core Ultra 5 245KF', 'cpu');
    expect(tokens).toContain('ultra5');
    expect(tokens).toContain('245kf');
  });
});

describe('extractDna — RAM', () => {
  it('extracts capacity + type + speed', () => {
    const tokens = extractDna('Corsair Vengeance DDR5 32GB 6000MHz', 'ram');
    expect(tokens).toContain('32gb');
    expect(tokens).toContain('ddr5');
    expect(tokens).toContain('6000');
  });

  it('handles kit notation 2x16GB → 32gb', () => {
    const tokens = extractDna('G.Skill Trident Z5 2x16GB DDR5 6000', 'ram');
    expect(tokens).toContain('32gb');
    expect(tokens).toContain('ddr5');
  });

  it('extracts DDR4 speed', () => {
    const tokens = extractDna('Kingston Fury Beast DDR4 16GB 3200MHz', 'ram');
    expect(tokens).toContain('16gb');
    expect(tokens).toContain('ddr4');
    expect(tokens).toContain('3200');
  });
});

describe('extractDna — Storage', () => {
  it('extracts TB capacity + nvme', () => {
    const tokens = extractDna('Samsung 990 Pro 2TB NVMe M.2', 'storage');
    expect(tokens).toContain('2tb');
    expect(tokens).toContain('nvme');
  });

  it('extracts GB capacity + sata', () => {
    const tokens = extractDna('Seagate Barracuda 500GB SATA SSD', 'storage');
    expect(tokens).toContain('500gb');
    expect(tokens).toContain('sata');
  });
});

describe('extractDna — PSU', () => {
  it('extracts wattage + gold', () => {
    const tokens = extractDna('Corsair RM850x 850W 80+ Gold', 'psu');
    expect(tokens).toContain('850w');
    expect(tokens).toContain('gold');
  });

  it('extracts platinum rating', () => {
    const tokens = extractDna('Seasonic Focus GX 750W Platinum', 'psu');
    expect(tokens).toContain('750w');
    expect(tokens).toContain('platinum');
  });
});

describe('extractDna — Motherboard', () => {
  it('extracts chipset + socket', () => {
    const tokens = extractDna('ASUS ROG STRIX B650E-F GAMING WIFI AM5', 'motherboard');
    expect(tokens).toContain('b650e');
    expect(tokens).toContain('am5');
  });

  it('extracts Z790 + LGA1700', () => {
    const tokens = extractDna('MSI MAG Z790 TOMAHAWK WIFI LGA1700', 'motherboard');
    expect(tokens).toContain('z790');
    expect(tokens).toContain('lga1700');
  });
});

// ── scoreDnaMatch — the critical false-positive prevention tests ──────────────

describe('scoreDnaMatch — GPU false positive prevention', () => {
  it('RTX 4070 does NOT match RTX 4080 catalog entry', () => {
    const { score } = scoreDnaMatch(
      'MSI GeForce RTX 4070 VENTUS 2X 12G',
      'NVIDIA GeForce RTX 4080',
      'gpu',
    );
    expect(score).toBeLessThan(1.0);
  });

  it('RTX 4090 matches RTX 4090 catalog entry', () => {
    const { score } = scoreDnaMatch(
      'Gigabyte GeForce RTX 4090 GAMING OC 24G',
      'NVIDIA GeForce RTX 4090',
      'gpu',
    );
    expect(score).toBe(1.0);
  });

  it('RX 7900 XTX does NOT match RX 7900 XT', () => {
    const { score } = scoreDnaMatch(
      'Sapphire PULSE RX 7900 XTX 24GB',
      'AMD Radeon RX 7900 XT',
      'gpu',
    );
    expect(score).toBeLessThan(1.0);
  });
});

describe('scoreDnaMatch — CPU false positive prevention', () => {
  it('Ryzen 5 7600X does NOT match Ryzen 5 7600', () => {
    const { score } = scoreDnaMatch(
      'AMD Ryzen 5 7600X Box',
      'AMD Ryzen 5 7600',
      'cpu',
    );
    // 7600x token won't match 7600 catalog entry
    expect(score).toBeLessThan(1.0);
  });

  it('i5-13400 does NOT match i5-13400F', () => {
    const { score } = scoreDnaMatch(
      'Intel Core i5-13400 Box',
      'Intel Core i5-13400F',
      'cpu',
    );
    expect(score).toBeLessThan(1.0);
  });

  it('Ryzen 5 7600X matches its own catalog entry', () => {
    const { score } = scoreDnaMatch(
      'AMD Ryzen 5 7600X Tray',
      'AMD Ryzen 5 7600X',
      'cpu',
    );
    expect(score).toBe(1.0);
  });

  it('Core Ultra 9 285K matches its own catalog entry', () => {
    const { score } = scoreDnaMatch(
      'Intel Core Ultra 9 285K (3.7 GHz / 5.7 GHz) TRAY',
      'Intel Core Ultra 9 285K',
      'cpu',
    );
    expect(score).toBe(1.0);
  });

  it('Core Ultra 7 265K does NOT match Core Ultra 9 285K', () => {
    const { score } = scoreDnaMatch(
      'Intel Core Ultra 7 265K Box',
      'Intel Core Ultra 9 285K',
      'cpu',
    );
    expect(score).toBeLessThan(1.0);
  });
});

describe('scoreDnaMatch — RAM false positive prevention', () => {
  it('32GB DDR5 6000 does NOT match 16GB DDR5 6000', () => {
    const { score } = scoreDnaMatch(
      'Corsair Vengeance DDR5 32GB 6000MHz',
      'Corsair Vengeance DDR5 16GB 6000MHz',
      'ram',
    );
    expect(score).toBeLessThan(1.0);
  });

  it('DDR5 does NOT match DDR4 catalog entry', () => {
    const { score } = scoreDnaMatch(
      'Kingston Fury Beast DDR5 32GB 5600',
      'Kingston Fury Beast DDR4 32GB 3200',
      'ram',
    );
    expect(score).toBeLessThan(1.0);
  });
});

// ── findBestMatch ─────────────────────────────────────────────────────────────

describe('findBestMatch', () => {
  const catalog = [
    { id: 1, name: 'GeForce RTX 4070', brand: 'NVIDIA', category: 'gpu' },
    { id: 2, name: 'GeForce RTX 4080', brand: 'NVIDIA', category: 'gpu' },
    { id: 3, name: 'GeForce RTX 4090', brand: 'NVIDIA', category: 'gpu' },
    { id: 4, name: 'Ryzen 5 7600X', brand: 'AMD', category: 'cpu' },
    { id: 5, name: 'Ryzen 7 7700X', brand: 'AMD', category: 'cpu' },
    { id: 6, name: 'Vengeance DDR5 32GB 6000MHz', brand: 'Corsair', category: 'ram' },
    { id: 7, name: 'Vengeance DDR5 16GB 6000MHz', brand: 'Corsair', category: 'ram' },
  ];

  it('matches RTX 4090 product to RTX 4090 catalog entry', () => {
    const result = findBestMatch('Gigabyte RTX 4090 GAMING OC 24G', catalog);
    expect(result?.componentId).toBe(3);
  });

  it('does NOT match RTX 4070 product to RTX 4080 catalog entry', () => {
    const result = findBestMatch('MSI RTX 4070 VENTUS 12G', catalog);
    expect(result?.componentId).toBe(1); // should match 4070, not 4080
  });

  it('matches Ryzen 5 7600X product to correct CPU', () => {
    const result = findBestMatch('AMD Ryzen 5 7600X Box', catalog);
    expect(result?.componentId).toBe(4);
  });

  it('matches 32GB RAM to 32GB catalog entry, not 16GB', () => {
    const result = findBestMatch('Corsair Vengeance DDR5 32GB 6000', catalog);
    expect(result?.componentId).toBe(6);
  });

  it('returns null when no match meets the threshold', () => {
    const result = findBestMatch('Some Random Product XYZ', catalog);
    expect(result).toBeNull();
  });
});

// ── PC Hardware Edge Case Suite (Gemini recommendation) ──────────────────────
// These are the most notorious hardware naming traps. If these pass, the
// matcher can handle anything the Moroccan market throws at it.

describe('Edge Cases — GPU suffix traps', () => {
  const gpuCatalog = [
    { id: 1, name: 'GeForce RTX 4070',          brand: 'NVIDIA', category: 'gpu' },
    { id: 2, name: 'GeForce RTX 4070 SUPER',     brand: 'NVIDIA', category: 'gpu' },
    { id: 3, name: 'GeForce RTX 4070 Ti',        brand: 'NVIDIA', category: 'gpu' },
    { id: 4, name: 'GeForce RTX 4070 Ti SUPER',  brand: 'NVIDIA', category: 'gpu' },
  ];

  it('plain 4070 matches only plain 4070', () => {
    expect(findBestMatch('Palit GeForce RTX 4070 Dual OC 12GB', gpuCatalog)?.componentId).toBe(1);
  });

  it('4070 SUPER matches only SUPER', () => {
    expect(findBestMatch('Zotac Gaming RTX 4070 SUPER Twin Edge OC', gpuCatalog)?.componentId).toBe(2);
  });

  it('4070 Ti matches only Ti (not Ti SUPER)', () => {
    expect(findBestMatch('ASUS TUF RTX 4070 Ti OC 12GB', gpuCatalog)?.componentId).toBe(3);
  });

  it('4070 Ti SUPER matches only Ti SUPER', () => {
    expect(findBestMatch('MSI RTX 4070 Ti SUPER Gaming X Slim 16G', gpuCatalog)?.componentId).toBe(4);
  });
});

describe('Edge Cases — CPU KF/KS/F suffix traps', () => {
  const cpuCatalog = [
    { id: 10, name: 'Core i9-14900K',  brand: 'Intel', category: 'cpu' },
    { id: 11, name: 'Core i9-14900KF', brand: 'Intel', category: 'cpu' },
    { id: 12, name: 'Core i5-13600K',  brand: 'Intel', category: 'cpu' },
    { id: 13, name: 'Core i5-13600KF', brand: 'Intel', category: 'cpu' },
    { id: 14, name: 'Core i5-13400F',  brand: 'Intel', category: 'cpu' },
  ];

  it('14900K matches only 14900K (not 14900KF)', () => {
    expect(findBestMatch('Intel Core i9-14900K Box', cpuCatalog)?.componentId).toBe(10);
  });

  it('14900KF matches only 14900KF', () => {
    expect(findBestMatch('Intel Core i9-14900KF Tray', cpuCatalog)?.componentId).toBe(11);
  });

  it('13600K matches only 13600K (not 13600KF)', () => {
    expect(findBestMatch('Intel Core i5-13600K Box', cpuCatalog)?.componentId).toBe(12);
  });

  it('13600KF matches only 13600KF', () => {
    expect(findBestMatch('Intel Core i5-13600KF Tray', cpuCatalog)?.componentId).toBe(13);
  });

  it('13400F matches only 13400F', () => {
    expect(findBestMatch('Intel Core i5-13400F Box', cpuCatalog)?.componentId).toBe(14);
  });
});

describe('Edge Cases — Motherboard chipset traps (B650 vs B650E vs B650M)', () => {
  const mbCatalog = [
    { id: 20, name: 'B650 GAMING PLUS WIFI',  brand: 'MSI',    category: 'motherboard' },
    { id: 21, name: 'B650E PG Riptide WiFi',  brand: 'ASRock', category: 'motherboard' },
    { id: 22, name: 'B650M DS3H',             brand: 'Gigabyte', category: 'motherboard' },
    { id: 23, name: 'Z790 AORUS MASTER',      brand: 'Gigabyte', category: 'motherboard' },
  ];

  it('B650 matches B650 (not B650E)', () => {
    expect(findBestMatch('MSI B650 GAMING PLUS WIFI AM5', mbCatalog)?.componentId).toBe(20);
  });

  it('B650E matches B650E (not plain B650)', () => {
    expect(findBestMatch('ASRock B650E PG Riptide WiFi AM5', mbCatalog)?.componentId).toBe(21);
  });

  it('Z790 matches Z790 (not B650)', () => {
    expect(findBestMatch('Gigabyte Z790 AORUS MASTER LGA1700', mbCatalog)?.componentId).toBe(23);
  });
});

describe('Edge Cases — RAM capacity traps', () => {
  const ramCatalog = [
    { id: 30, name: 'Vengeance LPX 8GB DDR4-3200',  brand: 'Corsair', category: 'ram' },
    { id: 31, name: 'Vengeance LPX 16GB DDR4-3200', brand: 'Corsair', category: 'ram' },
    { id: 32, name: 'Vengeance LPX 32GB DDR4-3200', brand: 'Corsair', category: 'ram' },
  ];

  it('2x8GB kit resolves to 16GB catalog entry', () => {
    expect(findBestMatch('Corsair Vengeance LPX 2x8GB DDR4 3200MHz', ramCatalog)?.componentId).toBe(31);
  });

  it('2x16GB kit resolves to 32GB catalog entry', () => {
    expect(findBestMatch('Corsair Vengeance LPX 2x16GB DDR4 3200MHz', ramCatalog)?.componentId).toBe(32);
  });

  it('8GB single stick matches 8GB entry', () => {
    expect(findBestMatch('Corsair Vengeance LPX 8GB DDR4 3200MHz', ramCatalog)?.componentId).toBe(30);
  });

  it('16GB does NOT match 32GB entry', () => {
    const result = findBestMatch('Corsair Vengeance LPX 16GB DDR4 3200MHz', ramCatalog);
    expect(result?.componentId).toBe(31);
    expect(result?.componentId).not.toBe(32);
  });
});

describe('Edge Cases — Storage generation traps (970 vs 980 vs 990)', () => {
  const storageCatalog = [
    { id: 40, name: '970 EVO Plus 1TB', brand: 'Samsung', category: 'storage' },
    { id: 41, name: '980 PRO 1TB',      brand: 'Samsung', category: 'storage' },
    { id: 42, name: '990 PRO 1TB',      brand: 'Samsung', category: 'storage' },
    { id: 43, name: 'WD_BLACK SN770 1TB', brand: 'WD',    category: 'storage' },
    { id: 44, name: 'WD_BLACK SN850X 1TB', brand: 'WD',   category: 'storage' },
  ];

  it('970 EVO Plus matches 970 (not 980 or 990)', () => {
    expect(findBestMatch('Samsung 970 EVO Plus 1TB NVMe M.2', storageCatalog)?.componentId).toBe(40);
  });

  it('980 PRO matches 980 (not 970 or 990)', () => {
    expect(findBestMatch('Samsung 980 PRO 1TB NVMe PCIe 4.0', storageCatalog)?.componentId).toBe(41);
  });

  it('990 PRO matches 990 (not 980)', () => {
    expect(findBestMatch('Samsung 990 PRO 1TB NVMe M.2', storageCatalog)?.componentId).toBe(42);
  });

  it('SN770 matches SN770 (not SN850X)', () => {
    expect(findBestMatch('WD Black SN770 1TB NVMe', storageCatalog)?.componentId).toBe(43);
  });

  it('SN850X matches SN850X (not SN770)', () => {
    expect(findBestMatch('WD Black SN850X 1TB NVMe PCIe 4.0', storageCatalog)?.componentId).toBe(44);
  });
});

describe('Edge Cases — Garbage rejection', () => {
  const catalog = [
    { id: 1, name: 'GeForce RTX 4090', brand: 'NVIDIA', category: 'gpu' },
    { id: 2, name: 'Ryzen 5 7600X',    brand: 'AMD',    category: 'cpu' },
  ];

  it('rejects a peripheral (mouse)', () => {
    expect(findBestMatch('Logitech G502 HERO Gaming Mouse', catalog)).toBeNull();
  });

  it('rejects a cable', () => {
    expect(findBestMatch('Câble HDMI 2.1 8K 2m Noir', catalog)).toBeNull();
  });

  it('rejects thermal paste', () => {
    expect(findBestMatch('Pâte thermique Arctic MX-4 4g', catalog)).toBeNull();
  });

  it('rejects a pre-built PC bundle', () => {
    expect(findBestMatch('PC Gamer Ryzen 5 7600X RTX 4090 32GB DDR5 1TB NVMe', catalog)).toBeNull();
  });
});
