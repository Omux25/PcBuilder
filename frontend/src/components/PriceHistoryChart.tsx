/**
 * PriceHistoryChart — line chart showing price over time per retailer.
 * Uses Recharts. Shows a message when fewer than 2 data points exist.
 */

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from 'recharts';
import type { PriceHistoryEntry } from '../types';
import styles from './PriceHistoryChart.module.css';

interface Props {
  history: PriceHistoryEntry[];
  loading?: boolean;
}

// Distinct colors for up to 6 retailers
const COLORS = ['#89b4fa', '#a6e3a1', '#fab387', '#f38ba8', '#cba6f7', '#94e2d5'];

export function PriceHistoryChart({ history, loading }: Props) {
  if (loading) {
    return <div className={styles.empty}>Chargement de l'historique…</div>;
  }

  if (history.length < 2) {
    return (
      <div className={styles.empty}>
        L'historique des prix n'est pas encore disponible pour ce composant.
      </div>
    );
  }

  // Group by date, pivot retailer prices into columns
  const retailerNames = [...new Set(history.map((h) => h.retailer_name))];

  // Build a map: date → { retailer_name: price }
  const dateMap = new Map<string, Record<string, number>>();
  for (const entry of history) {
    const date = entry.recorded_at.slice(0, 10); // YYYY-MM-DD
    if (!dateMap.has(date)) dateMap.set(date, {});
    dateMap.get(date)![entry.retailer_name] = entry.price;
  }

  const chartData = Array.from(dateMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, prices]) => ({ date, ...prices }));

  return (
    <div className={styles.chart}>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#313244" />
          <XAxis
            dataKey="date"
            tick={{ fill: '#6c7086', fontSize: 11 }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: '#6c7086', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `${v} MAD`}
            width={75}
          />
          <Tooltip
            contentStyle={{ background: '#1e1e2e', border: '1px solid #313244', borderRadius: 6 }}
            labelStyle={{ color: '#cdd6f4', fontSize: 12 }}
            itemStyle={{ fontSize: 12 }}
            formatter={(value) => value != null ? [`${Number(value).toLocaleString()} MAD`] : ['-']}
          />
          <Legend
            wrapperStyle={{ fontSize: 12, color: '#a6adc8' }}
          />
          {retailerNames.map((name, i) => (
            <Line
              key={name}
              type="monotone"
              dataKey={name}
              stroke={COLORS[i % COLORS.length]}
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
