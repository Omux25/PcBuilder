/**
 * PriceHistoryChart — line chart showing price over time per retailer.
 * Uses Recharts. Supports period toggle: 7j / 30j / 1 an.
 * Data is aggregated to one point per day per retailer (min price).
 */

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from 'recharts';
import type { PriceHistoryEntry } from '../types';
import { Skeleton } from './Skeleton';
import { UI } from '../ui-strings';
import styles from './PriceHistoryChart.module.css';

export type HistoryPeriod = '7d' | '30d' | '1y';

export const PERIOD_DAYS: Record<HistoryPeriod, number> = {
  '7d': 7,
  '30d': 30,
  '1y': 365,
};

interface Props {
  history: PriceHistoryEntry[];
  loading?: boolean;
  period: HistoryPeriod;
  onPeriodChange: (p: HistoryPeriod) => void;
}

function getCssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

const RETAILER_COLORS = [
  '--accent-blue', '--success-soft', '--warning-soft',
  '--danger-soft', '--text-2', '--text-muted',
] as const;

const PERIODS: { key: HistoryPeriod; label: string }[] = [
  { key: '7d', label: UI.priceHistory.period7d },
  { key: '30d', label: UI.priceHistory.period30d },
  { key: '1y', label: UI.priceHistory.period1y },
];

export function PriceHistoryChart({ history, loading, period, onPeriodChange }: Props) {
  const periodToggle = (
    <div className={styles.periodToggle}>
      {PERIODS.map(p => (
        <button
          key={p.key}
          className={`${styles.periodBtn} ${period === p.key ? styles.periodBtnActive : ''}`}
          onClick={() => onPeriodChange(p.key)}
        >
          {p.label}
        </button>
      ))}
    </div>
  );

  if (loading) {
    return (
      <div>
        {periodToggle}
        <div className={styles.chart}><Skeleton height={220} /></div>
      </div>
    );
  }

  if (history.length < 2) {
    return (
      <div>
        {periodToggle}
        <div className={styles.empty}>{UI.priceHistory.noData}</div>
      </div>
    );
  }

  const retailerNames = [...new Set(history.map(h => h.retailer_name))];

  // Format date label based on period
  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    if (period === '1y') {
      return d.toLocaleDateString('fr-MA', { month: 'short', year: '2-digit' });
    }
    return d.toLocaleDateString('fr-MA', { month: '2-digit', day: '2-digit' });
  };

  const dateMap = new Map<string, Record<string, number>>();
  for (const entry of history) {
    const date = formatDate(entry.recorded_at);
    if (!dateMap.has(date)) dateMap.set(date, {});
    // Keep lowest price if multiple entries collapse to same label (1y month grouping)
    const existing = dateMap.get(date)![entry.retailer_name];
    const price = Number(entry.price);
    if (existing === undefined || price < existing) {
      dateMap.get(date)![entry.retailer_name] = price;
    }
  }

  const chartData = Array.from(dateMap.entries())
    .map(([date, prices]) => ({ date, ...prices }));

  const gridColor = getCssVar('--border');
  const tickColor = getCssVar('--text-dim');
  const tooltipBg = getCssVar('--surface-2');
  const tooltipBdr = getCssVar('--border-2');
  const legendColor = getCssVar('--text-muted');

  return (
    <div>
      {periodToggle}
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
    </div>
  );
}
