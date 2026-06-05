import { describe, test, expect } from 'bun:test';
import { LinkEngine } from '@shared/link-engine';
import { componentSlug } from '@shared/slugify';

describe('LinkEngine & Slug Verification', () => {
  describe('Natural Slugs (order preservation)', () => {
    test('AMD Ryzen 5 7600X slug is naturally ordered', () => {
      const slug = componentSlug('AMD', 'Ryzen 5 7600X');
      expect(slug).toBe('amd-ryzen-5-7600x');
    });

    test('Intel Core i9-13900K is naturally ordered', () => {
      const slug = componentSlug('Intel', 'Core i9-13900K');
      expect(slug).toBe('intel-core-i9-13900k');
    });

    test('Gigabyte GeForce RTX 4070 is naturally ordered (filler stripped)', () => {
      const slug = componentSlug('Gigabyte', 'GeForce RTX 4070');
      expect(slug).toBe('gigabyte-rtx-4070');
    });
  });

  describe('LinkEngine', () => {
    test('getProductUrl generates clean category-slug URL', () => {
      const url = LinkEngine.getProductUrl({
        category: 'cpu',
        slug: 'amd-ryzen-5-7600x'
      });
      expect(url).toBe('/components/cpu/amd-ryzen-5-7600x');
    });

    test('getCategoryBrowseUrl generates correct browse paths', () => {
      expect(LinkEngine.getCategoryBrowseUrl('cpu')).toBe('/browse/cpu');
      expect(LinkEngine.getCategoryBrowseUrl('cpu', 'cpu_slot')).toBe('/browse/cpu/cpu_slot');
    });

    test('getBuildShareUrl appends query string cleanly', () => {
      expect(LinkEngine.getBuildShareUrl('https://pcbuilder.ma/', 'cpu=123')).toBe('https://pcbuilder.ma/build?cpu=123');
      expect(LinkEngine.getBuildShareUrl('https://pcbuilder.ma', 'cpu=123')).toBe('https://pcbuilder.ma/build?cpu=123');
    });
  });
});
