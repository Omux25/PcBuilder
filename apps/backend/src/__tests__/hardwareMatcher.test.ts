import { describe, it, expect } from 'bun:test';
import { calculateStrictScore, findStrictMatch, type CatalogComponent } from '../core/utils/hardwareMatcher';

describe('HardwareMatcher', () => {
  const catalog: CatalogComponent[] = [
    { id: 1, name: 'ROG STRIX B650-A GAMING WIFI', brand: 'ASUS', category: 'motherboard' },
    { id: 2, name: 'PRIME B650-PLUS', brand: 'ASUS', category: 'motherboard' },
    { id: 3, name: 'B650M DS3H', brand: 'Gigabyte', category: 'motherboard' },
    { id: 4, name: 'RTX 4070 SUPER VENTUS 2X OC', brand: 'MSI', category: 'gpu' },
    { id: 5, name: 'GeForce RTX 4070 SUPER', brand: 'NVIDIA', category: 'gpu' },
  ];

  it('should match exact sub-tier perfectly (100%)', () => {
    const scraped = 'ASUS ROG STRIX B650-A GAMING WIFI';
    const score = calculateStrictScore(scraped, catalog[0]);
    expect(score.total).toBe(100);
    expect(score.seriesMatch).toBe(true);
  });

  it('should reject different sub-tier from same brand/chipset', () => {
    // Scraped "PRIME" should NOT match "ROG STRIX"
    const scraped = 'ASUS PRIME B650-A';
    const score = calculateStrictScore(scraped, catalog[0]);
    expect(score.total).toBeLessThan(95);
    expect(score.rejectionReason).toContain('Offer contains extra series tokens: prime');
  });

  it('should reject generic component matching a specific sub-tier offer', () => {
    // Catalog has generic "B650M DS3H" (no series token)
    // Scraped has "AORUS" (Premium series)
    const scraped = 'Gigabyte B650M AORUS ELITE';
    const score = calculateStrictScore(scraped, catalog[2]);
    expect(score.total).toBeLessThan(95);
    expect(score.rejectionReason).toContain('Offer contains extra series tokens: aorus, elite');
  });

  it('should reject specific sub-tier component matching a generic offer', () => {
    // Catalog has "PRIME B650-PLUS"
    // Scraped is just "ASUS B650-PLUS"
    const scraped = 'ASUS B650-PLUS';
    const score = calculateStrictScore(scraped, catalog[1]);
    expect(score.total).toBeLessThan(95);
    // "PLUS" is in both, so it's not a missing token. Only "PRIME" is missing.
    expect(score.rejectionReason).toContain('Offer missing catalog series tokens: prime');
  });

  it('should handle GPU chip brand exceptions', () => {
    // Scraped MSI RTX 4070 SUPER should match NVIDIA RTX 4070 SUPER if sub-tier is absent
    const scraped = 'MSI GeForce RTX 4070 SUPER';
    const score = calculateStrictScore(scraped, catalog[4]);
    expect(score.total).toBe(100); 
  });

  it('should reject GPU if sub-tier is present in offer but not in master', () => {
    const scraped = 'MSI RTX 4070 SUPER VENTUS 2X';
    const score = calculateStrictScore(scraped, catalog[4]); // catalog[4] is generic NVIDIA RTX 4070 SUPER
    expect(score.total).toBeLessThan(95);
  });

  it('should reject if multiple masters match with same score (ambiguity)', () => {
    const localCatalog: CatalogComponent[] = [
      { id: 10, name: 'Vengeance LPX 16GB DDR4 3200', brand: 'Corsair', category: 'ram' },
      { id: 11, name: 'Vengeance RGB Pro 16GB DDR4 3200', brand: 'Corsair', category: 'ram' },
    ];
    const scraped = 'Corsair Vengeance 16GB 3200MHz';
    // This scraped name is missing both "LPX" and "RGB Pro", but "Vengeance" is in both.
    // Wait, if it's missing "LPX", it rejects master 10.
    // If it's missing "RGB Pro", it rejects master 11.
    // So it should match nothing.
    const match = findStrictMatch(scraped, localCatalog);
    expect(match).toBeNull();
  });

  it('should reject if brand mismatch', () => {
    const scraped = 'Gigabyte RTX 4070 SUPER VENTUS';
    // VENTUS is MSI. Catalog 4 is MSI.
    const score = calculateStrictScore(scraped, catalog[3]);
    expect(score.total).toBeLessThan(20);
    expect(score.rejectionReason).toContain('Brand mismatch: Gigabyte vs MSI');
  });

  it('should not reject CPU with Prism cooler because Prism is not a CPU series token', () => {
    const cpuCatalog: CatalogComponent = {
      id: 116,
      name: 'Ryzen 9 3900X',
      brand: 'AMD',
      category: 'cpu'
    };
    const scraped = 'AMD Ryzen 9 3900X Wraith Prism LED RGB';
    const score = calculateStrictScore(scraped, cpuCatalog);
    expect(score.total).toBe(100);
    expect(score.seriesMatch).toBe(true);
  });

  it('should extract Prism series token for case/cooling components', () => {
    const scrapedCase = 'Lian Li O11 Dynamic EVO RGB Prism Black';
    const caseCatalog: CatalogComponent = {
      id: 200,
      name: 'O11 Dynamic EVO RGB Prism',
      brand: 'Lian Li',
      category: 'case'
    };
    const score = calculateStrictScore(scrapedCase, caseCatalog);
    expect(score.total).toBe(100);
    expect(score.seriesMatch).toBe(true);
  });
});
