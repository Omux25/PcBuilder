import { useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from 'recharts';
import type { HistoryPeriod } from '../constants/periods';
import { PERIOD_DAYS } from '../constants/periods';
import type { PriceHistoryEntry } from '../types';
import { Skeleton } from './Skeleton';
import { UI } from '../ui-strings';
import styles from './PriceHistoryChart.module.css';

interface Props {
  history: PriceHistoryEntry[];
  loading?: boolean;
  period: HistoryPeriod;
  onPeriodChange: (p: HistoryPeriod) => void;
}

function getCssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#888';
}

const RETAILER_COLORS = [
  '#3b82f6', // blue
  '#10b981', // green
  '#f59e0b', // orange
  '#ef4444', // red
  '#8b5cf6', // purple
  '#ec4899', // pink
];

const PERIODS: { key: HistoryPeriod; label: string }[] = [
  { key: '7d', label: UI.priceHistory.period7d },
  { key: '30d', label: UI.priceHistory.period30d },
  { key: '1y', label: UI.priceHistory.period1y },
];

export function PriceHistoryChart({ history, loading, period, onPeriodChange }: Props) {
  const [hoveredRetailer, setHoveredRetailer] = useState<string | null>(null);

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

  if (history.length === 0) {
    return (
      <div>
        {periodToggle}
        <div className={styles.empty}>{UI.priceHistory.noData}</div>
      </div>
    );
  }

  const retailerNames = [...new Set(history.map(h => h.retailer_name))];

  // ── Data Transformation ──────────────────────────────────────────────────
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const startDate = new Date(now);
  startDate.setDate(now.getDate() - PERIOD_DAYS[period]);
  
  const byRetailer = new Map<string, PriceHistoryEntry[]>();
  for (const h of history) {
    if (!byRetailer.has(h.retailer_name)) byRetailer.set(h.retailer_name, []);
    byRetailer.get(h.retailer_name)!.push(h);
  }

  const chartData = [];
  const iterDate = new Date(startDate);
  
  while (iterDate <= now) {
    const ts = iterDate.getTime();
    const dataPoint: any = { 
      timestamp: ts,
      date: iterDate.toLocaleDateString('fr-MA', { 
        month: '2-digit', 
        day: '2-digit',
        ...(period === '1y' ? { year: '2-digit' } : {})
      }) 
    };

    for (const name of retailerNames) {
      const entries = byRetailer.get(name)!;
      // Find the most recent entry before or at this day
      const lastEntry = [...entries]
        .filter(e => new Date(e.recorded_at).setHours(0, 0, 0, 0) <= ts)
        .sort((a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime())[0];
      
      if (lastEntry && lastEntry.in_stock) {
        dataPoint[name] = Number(lastEntry.price);
        dataPoint[`${name}_in_stock`] = true;
      } else {
        dataPoint[name] = null;
        dataPoint[`${name}_in_stock`] = false;
      }
    }
    chartData.push(dataPoint);
    iterDate.setDate(iterDate.getDate() + 1);
  }

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
          <LineChart 
            data={chartData} 
            margin={{ top: 10, right: 30, left: 0, bottom: 5 }}
            onMouseMove={(e: any) => {
              if (e.activeTooltipIndex !== undefined) {
                // Potential for line highlighting logic here
              }
            }}
            onMouseLeave={() => setHoveredRetailer(null)}
          >
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={true} opacity={0.3} />
            <XAxis 
              dataKey="date" 
              tick={{ fill: tickColor, fontSize: 10 }} 
              tickLine={false}
              axisLine={false}
              interval={period === '7d' ? 0 : period === '30d' ? 4 : 29}
            />
            <YAxis
              tick={{ fill: tickColor, fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={v => `${v} MAD`}
              width={65}
              domain={['auto', 'auto']}
              padding={{ top: 20, bottom: 20 }}
            />
            <Tooltip
              contentStyle={{ 
                background: tooltipBg, 
                border: `1px solid ${tooltipBdr}`, 
                borderRadius: 8,
                boxShadow: '0 8px 24px rgba(0,0,0,0.2)'
              }}
              labelStyle={{ color: getCssVar('--text-2'), fontSize: 12, fontWeight: 600, marginBottom: 4 }}
              itemStyle={{ fontSize: 12, padding: '2px 0' }}
              formatter={(value, name, props) => {
                const inStock = props.payload[`${name}_in_stock`];
                if (value === null || !inStock) return [
                  <span key={name as string} style={{ color: tickColor, opacity: 0.5 }}>Épuisé</span>,
                  name
                ];
                return [
                  <span key={name as string} style={{ fontWeight: 600 }}>{Number(value).toLocaleString()} MAD</span>,
                  name
                ];
              }}
            />
            <Legend 
              wrapperStyle={{ fontSize: 11, color: legendColor, paddingTop: 10 }}
              iconType="circle"
              iconSize={8}
              onMouseEnter={(e: any) => setHoveredRetailer(e.value)}
              onMouseLeave={() => setHoveredRetailer(null)}
            />
            {retailerNames.map((name, i) => {
              const dashPatterns = ['0', '5 5', '3 3', '10 5', '5 2 2 2'];
              const color = RETAILER_COLORS[i % RETAILER_COLORS.length];
              const isFocused = hoveredRetailer === null || hoveredRetailer === name;
              
              return (
                <Line
                  key={name}
                  type="stepAfter"
                  dataKey={name}
                  stroke={color}
                  strokeWidth={isFocused ? 3 : 1.5}
                  strokeOpacity={isFocused ? 1 : 0.2}
                  strokeDasharray={dashPatterns[i % dashPatterns.length]}
                  dot={{ r: 2, strokeWidth: 0, fill: color, fillOpacity: isFocused ? 1 : 0.2 }}
                  activeDot={{ r: 5, strokeWidth: 0, fill: color }}
                  connectNulls={false}
                  animationDuration={300}
                />
              );
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
