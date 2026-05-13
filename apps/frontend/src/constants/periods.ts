export type HistoryPeriod = '7d' | '30d' | '1y';

export const PERIOD_DAYS: Record<HistoryPeriod, number> = {
  '7d': 7,
  '30d': 30,
  '1y': 365,
};
