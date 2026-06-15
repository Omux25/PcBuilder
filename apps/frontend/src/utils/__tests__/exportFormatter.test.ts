import { describe, test, expect } from 'bun:test';
import { formatToReddit, formatToDiscord, formatToBBCode } from '../exportFormatter';
import type { BuildConfig } from '../../types';

describe('Export Formatter Utilities', () => {
  const dummyBuild: BuildConfig = {
    cpu: {
      id: 101,
      name: 'Intel Core i5-13600K',
      brand: 'Intel',
      slug: 'intel-core-i5-13600k',
      category: 'cpu',
      lowest_price: 3400,
      primary_price: 3400,
    } as any,
    gpu: {
      id: 202,
      name: 'NVIDIA GeForce RTX 4070',
      brand: 'NVIDIA',
      slug: 'nvidia-geforce-rtx-4070',
      category: 'gpu',
      lowest_price: 7200,
      primary_price: 7200,
    } as any
  };

  const totalPrice = 10600;

  test('formatToReddit creates a markdown table', () => {
    const markdown = formatToReddit(dummyBuild, totalPrice);
    expect(markdown).toContain('| Composant | Modèle | Prix |');
    expect(markdown).toContain('| Processeur | Intel Core i5-13600K | 3,400 DH |');
    expect(markdown).toContain('| Carte Graphique | NVIDIA GeForce RTX 4070 | 7,200 DH |');
    expect(markdown).toContain('| **Total** | | **10,600 DH** |');
  });

  test('formatToDiscord creates a bold list', () => {
    const list = formatToDiscord(dummyBuild, totalPrice);
    expect(list).toContain('- **Processeur**: Intel Core i5-13600K - 3,400 DH');
    expect(list).toContain('- **Carte Graphique**: NVIDIA GeForce RTX 4070 - 7,200 DH');
    expect(list).toContain('- **Total**: **10,600 DH**');
  });

  test('formatToBBCode creates standard BBCode table tags', () => {
    const bbcode = formatToBBCode(dummyBuild, totalPrice);
    expect(bbcode).toContain('[table]');
    expect(bbcode).toContain('[tr][td]Processeur[/td][td]Intel Core i5-13600K[/td][td]3,400 DH[/td][/tr]');
    expect(bbcode).toContain('[tr][td]Carte Graphique[/td][td]NVIDIA GeForce RTX 4070[/td][td]7,200 DH[/td][/tr]');
    expect(bbcode).toContain('[tr][td][b]Total[/b][/td][td][/td][td][b]10,600 DH[/b][/td][/tr]');
    expect(bbcode).toContain('[/table]');
  });
});
