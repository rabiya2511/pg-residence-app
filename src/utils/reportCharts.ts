// Builds the numbers behind every report chart from the data already loaded in the app.
import { ChartSpec, CHART_COLORS } from './chartSpec';

const MONTHS_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTHS_3 = MONTHS_FULL.map((m) => m.slice(0, 3));

// "25 Sep 2026" and "Sep 25, 2026"
export function parseAnyDate(str?: string | null): Date | null {
  if (!str) return null;
  const s = str.trim();
  let m = s.match(/^(\d{1,2})\s+([A-Za-z]{3})[A-Za-z]*,?\s+(\d{4})$/);
  if (m) {
    const i = MONTHS_3.findIndex((x) => x.toLowerCase() === m![2].toLowerCase());
    return i === -1 ? null : new Date(Number(m[3]), i, Number(m[1]));
  }
  m = s.match(/^([A-Za-z]{3})[A-Za-z]*\s+(\d{1,2}),?\s+(\d{4})$/);
  if (m) {
    const i = MONTHS_3.findIndex((x) => x.toLowerCase() === m![1].toLowerCase());
    return i === -1 ? null : new Date(Number(m[3]), i, Number(m[2]));
  }
  return null;
}

export type MonthSlot = { key: string; label: string; monthLabel: string; start: Date; end: Date };

/** The last `n` calendar months, oldest first, ending with the current month. */
export function lastMonths(n: number, now: Date = new Date()): MonthSlot[] {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (n - 1 - i), 1);
    const y = d.getFullYear();
    const m = d.getMonth();
    return {
      key: `${y}-${m}`,
      label: `${MONTHS_3[m]}${n > 6 ? ` ${String(y).slice(2)}` : ''}`,
      monthLabel: `${MONTHS_FULL[m]} ${y}`,
      start: new Date(y, m, 1),
      end: new Date(y, m + 1, 0, 23, 59, 59, 999),
    };
  });
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const net = (p: any) => Math.max(0, (Number(p.amount) || 0) - (p.status === 'Paid' ? 0 : Number(p.deduction) || 0));

export type CollectionRow = { slot: MonthSlot; expected: number; collected: number; due: number; percent: number; lateFees: number; payments: number };

/** Expected vs collected rent for each of the last `n` months. */
export function collectionRows(paymentRecords: any[], n: number): CollectionRow[] {
  return lastMonths(n).map((slot) => {
    const recs = paymentRecords.filter((p) => p.month === slot.monthLabel && !(p.status === 'Paid' && p.revenueCleared));
    const expected = sum(recs.map(net));
    const paid = recs.filter((p) => p.status === 'Paid');
    const collected = sum(paid.map((p) => Number(p.amount) || 0));
    return {
      slot,
      expected,
      collected,
      due: Math.max(0, expected - collected),
      percent: expected > 0 ? Math.round((collected / expected) * 100) : 0,
      lateFees: sum(paid.map((p) => Number(p.lateFee) || 0)),
      payments: paid.length,
    };
  });
}

export type OccupancyRow = { slot: MonthSlot; occupied: number; capacity: number; percent: number };

/** Month-end occupancy, worked out from each resident's joining date and the date they left. */
export function occupancyRows(residents: any[], archived: any[], rooms: any[], n: number): OccupancyRow[] {
  const capacity = sum(rooms.map((r) => Number(r.capacity) || 0));
  const people = [...residents, ...archived].map((r) => ({
    from: parseAnyDate(r.joiningDate),
    to: parseAnyDate(r.vacatingDate) ?? (r.archivedOn ? parseAnyDate(r.archivedOn) : null),
  }));
  const now = new Date();
  return lastMonths(n).map((slot) => {
    const at = slot.end.getTime() > now.getTime() ? now : slot.end;
    const occupied = people.filter((p) => p.from && p.from.getTime() <= at.getTime() && (!p.to || p.to.getTime() > at.getTime())).length;
    return { slot, occupied, capacity, percent: capacity > 0 ? Math.min(100, Math.round((occupied / capacity) * 100)) : 0 };
  });
}

const countByMonth = (dates: (Date | null)[], n: number) =>
  lastMonths(n).map((slot) => ({
    label: slot.label,
    value: dates.filter((d) => d && d.getTime() >= slot.start.getTime() && d.getTime() <= slot.end.getTime()).length,
  }));

const group = (items: any[], keyOf: (x: any) => string) => {
  const map = new Map<string, number>();
  items.forEach((x) => map.set(keyOf(x), (map.get(keyOf(x)) ?? 0) + 1));
  return Array.from(map.entries()).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
};

export const collectedByMonthChart = (rows: CollectionRow[]): ChartSpec => ({
  kind: 'bar',
  title: 'Rent collected per month',
  subtitle: `Last ${rows.length} months`,
  money: true,
  data: rows.map((r) => ({ label: r.slot.label, value: r.collected })),
});

export const collectionPercentChart = (rows: CollectionRow[]): ChartSpec => ({
  kind: 'line',
  title: 'Collection rate',
  subtitle: 'Share of each month\'s rent that was collected',
  percent: true,
  data: rows.map((r) => ({ label: r.slot.label, value: r.percent })),
});

export const occupancyTrendChart = (rows: OccupancyRow[]): ChartSpec => ({
  kind: 'line',
  title: 'Occupancy trend',
  subtitle: 'Beds occupied at the end of each month',
  percent: true,
  data: rows.map((r) => ({ label: r.slot.label, value: r.percent })),
});

export const bedsDonut = (occupied: number, total: number): ChartSpec => ({
  kind: 'donut',
  title: 'Beds right now',
  data: [
    { label: 'Occupied', value: occupied, color: CHART_COLORS[0] },
    { label: 'Vacant', value: Math.max(0, total - occupied), color: CHART_COLORS[1] },
  ],
});

export const rentStatusDonut = (residents: any[]): ChartSpec => ({
  kind: 'donut',
  title: 'Rent status',
  data: [
    { label: 'Paid', value: residents.filter((r) => r.rentStatus === 'Paid').length, color: CHART_COLORS[1] },
    { label: 'Pending', value: residents.filter((r) => r.rentStatus === 'Pending').length, color: CHART_COLORS[2] },
    { label: 'Overdue', value: residents.filter((r) => r.rentStatus === 'Overdue').length, color: CHART_COLORS[3] },
  ].filter((d) => d.value > 0),
});

export const genderDonut = (residents: any[]): ChartSpec => ({
  kind: 'donut',
  title: 'Gender split',
  data: group(residents, (r) => r.gender || 'Not set').map((d, i) => ({ ...d, color: CHART_COLORS[i % CHART_COLORS.length] })),
});

export const joinsByMonthChart = (residents: any[]): ChartSpec => ({
  kind: 'bar',
  title: 'New residents per month',
  subtitle: 'Last 6 months, by joining date',
  data: countByMonth(residents.map((r) => parseAnyDate(r.joiningDate)), 6),
});

export const leaversByMonthChart = (residents: any[]): ChartSpec => ({
  kind: 'bar',
  title: 'Check-outs per month',
  subtitle: 'Last 6 months',
  data: countByMonth(residents.map((r) => parseAnyDate(r.vacatingDate)), 6),
});

export const timingDonut = (paid: any[]): ChartSpec => ({
  kind: 'donut',
  title: 'Early / on time / late',
  subtitle: 'Payments in this window',
  data: [
    { label: 'Early', value: paid.filter((p) => p.timing === 'Early').length, color: CHART_COLORS[1] },
    { label: 'On time', value: paid.filter((p) => p.timing === 'On Time').length, color: CHART_COLORS[0] },
    { label: 'Late', value: paid.filter((p) => p.timing === 'Late').length, color: CHART_COLORS[3] },
  ].filter((d) => d.value > 0),
});

export const ageingChart = (dues: { daysOverdue: number; outstanding: number }[]): ChartSpec => {
  const bucket = (lo: number, hi: number) => sum(dues.filter((d) => d.daysOverdue >= lo && d.daysOverdue <= hi).map((d) => d.outstanding));
  return {
    kind: 'bar',
    title: 'Outstanding by age',
    subtitle: 'Days since the oldest unpaid due date',
    money: true,
    data: [
      { label: 'Not due', value: bucket(0, 0), color: CHART_COLORS[0] },
      { label: '1-14 d', value: bucket(1, 14), color: CHART_COLORS[2] },
      { label: '15-30 d', value: bucket(15, 30), color: CHART_COLORS[2] },
      { label: '31-60 d', value: bucket(31, 60), color: CHART_COLORS[3] },
      { label: '60+ d', value: bucket(61, 100000), color: CHART_COLORS[3] },
    ],
  };
};

export const revenueSplitDonut = (rent: number, guests: number): ChartSpec => ({
  kind: 'donut',
  title: 'Rent vs day guests',
  money: true,
  data: [
    { label: 'Rent', value: rent, color: CHART_COLORS[0] },
    { label: 'Day guests', value: guests, color: CHART_COLORS[2] },
  ].filter((d) => d.value > 0),
});

export const revenueByMonthChart = (paymentRecords: any[], guests: any[]): ChartSpec => {
  const slots = lastMonths(6);
  return {
    kind: 'bar',
    title: 'Revenue per month',
    subtitle: 'Rent plus day-guest income, last 6 months',
    money: true,
    data: slots.map((slot) => {
      const rent = sum(
        paymentRecords
          .filter((p) => p.status === 'Paid' && !p.revenueCleared)
          .filter((p) => {
            const d = parseAnyDate(p.paidOn);
            return d && d.getTime() >= slot.start.getTime() && d.getTime() <= slot.end.getTime();
          })
          .map((p) => Number(p.amount) || 0)
      );
      const day = sum(
        guests
          .filter((g) => g.checkInTimestamp >= slot.start.getTime() && g.checkInTimestamp <= slot.end.getTime())
          .map((g) => Number(g.advanceAmount) || 0)
      );
      return { label: slot.label, value: rent + day };
    }),
  };
};

export const complaintStatusDonut = (list: any[]): ChartSpec => ({
  kind: 'donut',
  title: 'Complaints by status',
  data: [
    { label: 'Open', value: list.filter((c) => c.status === 'Open').length, color: CHART_COLORS[3] },
    { label: 'In progress', value: list.filter((c) => c.status === 'In Progress').length, color: CHART_COLORS[2] },
    { label: 'Resolved', value: list.filter((c) => c.status === 'Resolved').length, color: CHART_COLORS[1] },
  ].filter((d) => d.value > 0),
});

export const complaintCategoryChart = (list: any[]): ChartSpec => ({
  kind: 'bar',
  title: 'Complaints by category',
  data: group(list, (c) => c.category || 'Other').slice(0, 6),
});
