import type { BuildConfig } from '../types';

const CATEGORY_LABELS: Record<string, string> = {
  cpu: 'Processeur',
  cooling: 'Refroidissement',
  motherboard: 'Carte Mère',
  gpu: 'Carte Graphique',
  case: 'Boîtier',
  psu: 'Alimentation',
  ram: 'Mémoire RAM',
  storage: 'Stockage'
};

function getSlotLabel(key: string): string {
  if (key.startsWith('ram_')) {
    const num = key.split('_')[1];
    return `Mémoire RAM (Slot ${num})`;
  }
  if (key.startsWith('storage_')) {
    const num = key.split('_')[1];
    return `Stockage (Slot ${num})`;
  }
  return CATEGORY_LABELS[key] || key;
}

export function formatToReddit(build: BuildConfig, totalPrice: number): string {
  const rows = [
    '| Composant | Modèle | Prix |',
    '| --- | --- | --- |'
  ];

  for (const [key, comp] of Object.entries(build)) {
    if (!comp) continue;
    const label = getSlotLabel(key);
    const priceVal = comp.lowest_price || comp.primary_price || 0;
    const priceStr = priceVal ? `${Math.floor(priceVal).toLocaleString('en-US')} DH` : '—';
    rows.push(`| ${label} | ${comp.name} | ${priceStr} |`);
  }

  rows.push(`| **Total** | | **${Math.floor(totalPrice).toLocaleString('en-US')} DH** |`);
  return rows.join('\n');
}

export function formatToDiscord(build: BuildConfig, totalPrice: number): string {
  const rows: string[] = [];

  for (const [key, comp] of Object.entries(build)) {
    if (!comp) continue;
    const label = getSlotLabel(key);
    const priceVal = comp.lowest_price || comp.primary_price || 0;
    const priceStr = priceVal ? `${Math.floor(priceVal).toLocaleString('en-US')} DH` : '—';
    rows.push(`- **${label}**: ${comp.name} - ${priceStr}`);
  }

  rows.push(`- **Total**: **${Math.floor(totalPrice).toLocaleString('en-US')} DH**`);
  return rows.join('\n');
}

export function formatToBBCode(build: BuildConfig, totalPrice: number): string {
  const rows: string[] = [
    '[table]',
    '[tr][th]Composant[/th][th]Modèle[/th][th]Prix[/th][/tr]'
  ];

  for (const [key, comp] of Object.entries(build)) {
    if (!comp) continue;
    const label = getSlotLabel(key);
    const priceVal = comp.lowest_price || comp.primary_price || 0;
    const priceStr = priceVal ? `${Math.floor(priceVal).toLocaleString('en-US')} DH` : '—';
    rows.push(`[tr][td]${label}[/td][td]${comp.name}[/td][td]${priceStr}[/td][/tr]`);
  }

  rows.push(`[tr][td][b]Total[/b][/td][td][/td][td][b]${Math.floor(totalPrice).toLocaleString('en-US')} DH[/b][/td][/tr]`);
  rows.push('[/table]');
  return rows.join('\n');
}
