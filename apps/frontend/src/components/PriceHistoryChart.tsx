import { useState } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from 'recharts';
import type { HistoryPeriod } from '../constants/periods';
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
  if (typeof window === 'undefined') return '#888';
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#888';
}

const RETAILER_COLORS = [
  '#3b82f6', // UltraPC - Vibrant Indigo/Blue
  '#10b981', // NextLevel - Emerald
  '#f59e0b', // SetupGame - Amber
  '#ef4444', // PC Gamer Casa - Coral/Red
  '#a855f7', // Purple
  '#ec4899', // Pink
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
        <div className={styles.chart}><Skeleton height={260} /></div>
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
  // Extract all timestamps that have actual recordings in this range
  const recordedDays = history.map(h => {
    const d = new Date(h.recorded_at);
    d.setHours(0,0,0,0);
    return d.getTime();
  });
  const uniqueRecordedDays = [...new Set(recordedDays)].sort();

  const byRetailer = new Map<string, PriceHistoryEntry[]>();
  for (const h of history) {
    if (!byRetailer.has(h.retailer_name)) byRetailer.set(h.retailer_name, []);
    byRetailer.get(h.retailer_name)!.push(h);
  }

  // Create chart data ONLY for dates that have actual recordings.
  // This avoids huge flat periods of missing stock backfilling/padding.
  const chartData = uniqueRecordedDays.map(ts => {
    const dateObj = new Date(ts);
    const dataPoint: any = {
      timestamp: ts,
      date: dateObj.toLocaleDateString('fr-MA', {
        month: '2-digit',
        day: '2-digit',
      })
    };

    for (const name of retailerNames) {
      const entries = byRetailer.get(name)!;
      // Find exact or latest recording for this day
      const dayEntries = entries.filter(e => {
        const ed = new Date(e.recorded_at);
        ed.setHours(0,0,0,0);
        return ed.getTime() === ts;
      });

      if (dayEntries.length > 0) {
        const sorted = dayEntries.sort((a,b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime());
        dataPoint[name] = Number(sorted[0].price);
        dataPoint[`${name}_in_stock`] = sorted[0].in_stock;
        dataPoint[`${name}_has_record`] = true;
      } else {
        // Find latest previous historical price
        const prevEntries = entries.filter(e => new Date(e.recorded_at).getTime() < ts + 86400000);
        if (prevEntries.length > 0) {
          const sorted = prevEntries.sort((a,b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime());
          dataPoint[name] = Number(sorted[0].price);
          dataPoint[`${name}_in_stock`] = sorted[0].in_stock;
          dataPoint[`${name}_has_record`] = false;
        } else {
          dataPoint[name] = null;
          dataPoint[`${name}_in_stock`] = false;
          dataPoint[`${name}_has_record`] = false;
        }
      }
    }
    return dataPoint;
  });

  const gridColor = getCssVar('--border');
  const tickColor = getCssVar('--text-dim');
  const legendColor = getCssVar('--text-muted');

  return (
    <div>
      {periodToggle}
      <div className={styles.chart}>
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart 
            data={chartData} 
            margin={{ top: 15, right: 10, left: -20, bottom: 5 }}
            onMouseLeave={() => setHoveredRetailer(null)}
          >
            <defs>
              {retailerNames.map((name, i) => {
                const color = RETAILER_COLORS[i % RETAILER_COLORS.length];
                const id = `grad-${name.replace(/\s+/g, '-')}`;
                return (
                  <linearGradient key={id} id={id} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={color} stopOpacity={0.25}/>
                    <stop offset="95%" stopColor={color} stopOpacity={0.0}/>
                  </linearGradient>
                );
              })}
            </defs>

            <CartesianGrid strokeDasharray="6 6" stroke={gridColor} vertical={false} opacity={0.15} />
            <XAxis 
              dataKey="date" 
              tick={{ fill: tickColor, fontSize: 10, fontWeight: 500 }} 
              tickLine={false}
              axisLine={false}
              dy={10}
            />
            <YAxis
              tick={{ fill: tickColor, fontSize: 10, fontWeight: 500 }}
              tickLine={false}
              axisLine={false}
              dx={-5}
              tickFormatter={v => `${v} DH`}
              width={75}
              domain={['auto', 'auto']}
              padding={{ top: 20, bottom: 10 }}
            />
            <Tooltip
              contentStyle={{ 
                background: 'rgba(23, 23, 23, 0.85)', 
                backdropFilter: 'blur(12px)',
                border: `1px solid rgba(255, 255, 255, 0.08)`, 
                borderRadius: 12,
                boxShadow: '0 12px 32px rgba(0, 0, 0, 0.4)',
                padding: '10px 14px'
              }}
              labelStyle={{ color: 'var(--text)', fontSize: 12, fontWeight: 700, marginBottom: 6, opacity: 0.9 }}
              itemStyle={{ fontSize: 12, padding: '3px 0' }}
              cursor={{ stroke: 'rgba(255, 255, 255, 0.06)', strokeWidth: 1.5, strokeDasharray: '3 3' }}
              formatter={(value, name, props) => {
                const inStock = props.payload[`${name}_in_stock`];
                if (value === null) return [
                  <span key={name as string} style={{ color: 'var(--text-dim)', opacity: 0.5, fontStyle: 'italic' }}>Non disponible</span>,
                  name
                ];
                if (!inStock) return [
                  <span key={name as string} style={{ color: 'var(--text-dim)', opacity: 0.65 }}>
                    {Number(value).toLocaleString()} MAD <span style={{ fontSize: '10px', color: '#ef4444', fontWeight: 600, marginLeft: 4 }}>(Rupture)</span>
                  </span>,
                  name
                ];
                return [
                  <span key={name as string} style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{Number(value).toLocaleString()} MAD</span>,
                  name
                ];
              }}
            />
            <Legend 
              wrapperStyle={{ fontSize: 11, color: legendColor, paddingTop: 18 }}
              iconType="circle"
              iconSize={8}
              align="center"
              onMouseEnter={(e: any) => setHoveredRetailer(e.value)}
              onMouseLeave={() => setHoveredRetailer(null)}
            />
            {retailerNames.map((name, i) => {
              const color = RETAILER_COLORS[i % RETAILER_COLORS.length];
              const isFocused = hoveredRetailer === null || hoveredRetailer === name;
              const gradId = `url(#grad-${name.replace(/\s+/g, '-')})`;
              
              return (
                <Area
                  key={name}
                  type="monotone"
                  dataKey={name}
                  stroke={color}
                  strokeWidth={isFocused ? 2.5 : 1.25}
                  strokeOpacity={isFocused ? 1 : 0.15}
                  fill={gradId}
                  fillOpacity={isFocused ? 1 : 0.1}
                  // Render active dots on each date point that contains actual history entries in the db
                  dot={(props: any) => {
                    const hasRecord = props.payload[`${name}_has_record`];
                    if (!hasRecord) return null;
                    return (
                      <circle
                        cx={props.cx}
                        cy={props.cy}
                        r={3}
                        fill={color}
                        stroke="none"
                        fillOpacity={isFocused ? 1 : 0.3}
                      />
                    );
                  }}
                  activeDot={{ r: 5, strokeWidth: 0, fill: color }}
                  connectNulls={true}
                  animationDuration={450}
                />
              );
            })}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
