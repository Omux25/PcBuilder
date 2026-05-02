/**
 * PriceHistoryChart — line chart showing price over time per retailer.
 * Uses Recharts. Shows a message when fewer than 2 data points exist.
 */

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from 'recharts';
import type { PriceHistoryEntry } from '../types';
import { Skeleton } from './Skeleton';
import { UI } from '../ui-strings';
import styles from './PriceHistoryChart.module.css';

interface Props {
  history: PriceHistoryEntry[];
  loading?: boolean;
}

function getCssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

const RETAILER_COLORS = [
  '--accent-blue', '--success-soft', '--warning-soft',
  '--danger-soft', '--text-2',       '--text-muted',
] as const;

export function PriceHistoryChart({ history, loading }: Props) {
  if (loading) {
    return <div className={styles.chart}><Skeleton height={220} /></div>;
  }

  if (history.length < 2) {
    return <div className={styles.empty}>{UI.priceHistory.noData}</div>;
  }

  const retailerNames = [...new Set(history.map(h => h.retailer_name))];

  const dateMap = new Map<string, Record<string, number>>();
  for (const entry of history) {
    const date = new Date(entry.recorded_at).toLocaleDateString('fr-MA', {
      year: 'numeric', month: '2-digit', day: '2-digit',
    });
    if (!dateMap.has(date)) dateMap.set(date, {});
    dateMap.get(date)![entry.retailer_name] = entry.price;
  }

  const chartData = Array.from(dateMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, prices]) => ({ date, ...prices }));

  const gridColor   = getCssVar('--border');
  const tickColor   = getCssVar('--text-dim');
  const tooltipBg   = getCssVar('--surface-2');
  const tooltipBdr  = getCssVar('--border-2');
  const legendColor = getCssVar('--text-muted');

  return (
    <div className={styles.chart}>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
          <XAxis dataKey="date" tick={{ fill: tickColor, fontSize: 11 }} tickLine={false} />
          <YAxis
            tick={{ fill: tickColor, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={v => `${v} MAD`}
            width={75}
          />
          <Tooltip
            contentStyle={{ background: tooltipBg, border: `1px solid ${tooltipBdr}`, borderRadius: 6 }}
            labelStyle={{ color: getCssVar('--text-2'), fontSize: 12 }}
            itemStyle={{ fontSize: 12 }}
            formatter={value => value != null ? [`${Number(value).toLocaleString()} MAD`] : ['-']}
          />
          <Legend wrapperStyle={{ fontSize: 12, color: legendColor }} />
          {retailerNames.map((name, i) => (
            <Line
              key={name}
              type="monotone"
              dataKey={name}
              stroke={getCssVar(RETAILER_COLORS[i % RETAILER_COLORS.length])}
              strokeWidth={2}
              dot={false}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
