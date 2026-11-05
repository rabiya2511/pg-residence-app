// One description of a chart, drawn on screen (ChartCard) and inside PDF exports (chartToHtml).
export type ChartDatum = { label: string; value: number; color?: string };

export type ChartSpec = {
  kind: 'bar' | 'line' | 'donut';
  title: string;
  subtitle?: string;
  data: ChartDatum[];
  /** Values are rupees (shown as ₹1.2k / ₹1.5L). */
  money?: boolean;
  /** Values are percentages 0-100 (line charts use a fixed 0-100 scale). */
  percent?: boolean;
};

// Same palette on screen and in PDFs.
export const CHART_COLORS = ['#2143B4', '#059669', '#D97706', '#DC2626', '#7C3AED', '#0891B2'];

export function fmtCompact(n: number, money = false, percent = false): string {
  const v = Math.round(n);
  if (percent) return `${v}%`;
  const p = money ? '₹' : '';
  if (v >= 100000) return `${p}${(v / 100000).toFixed(v >= 1000000 ? 0 : 1)}L`;
  if (v >= 1000) return `${p}${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k`;
  return `${p}${v}`;
}

export function fmtFull(n: number, money = false, percent = false): string {
  if (percent) return `${Math.round(n)}%`;
  return `${money ? '₹' : ''}${Math.round(n).toLocaleString('en-IN')}`;
}

export const shortLabel = (s: string, max = 8) => (s.length > max ? `${s.slice(0, max - 1)}…` : s);
