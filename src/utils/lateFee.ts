// Late fee on rent: per day after the due date (plus any grace days), up to a monthly cap.
// Switched off until the admin sets an amount per day (perDay = 0).

export type LateFeeRules = { perDay: number; cap: number; graceDays: number };

export const NO_LATE_FEE: LateFeeRules = { perDay: 0, cap: 0, graceDays: 0 };

const DAY_MS = 24 * 60 * 60 * 1000;
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** Whole days late (after grace days). Never negative. */
export function daysLate(due: Date, asOf: Date, graceDays = 0): number {
  const diff = Math.floor((startOfDay(asOf) - startOfDay(due)) / DAY_MS);
  return Math.max(0, diff - Math.max(0, graceDays));
}

export function computeLateFee(due: Date | null, asOf: Date, rules: LateFeeRules, waived = false): number {
  if (!due || waived || !(rules.perDay > 0)) return 0;
  const fee = daysLate(due, asOf, rules.graceDays) * rules.perDay;
  return Math.round(rules.cap > 0 ? Math.min(fee, rules.cap) : fee);
}

export const describeLateFee = (r: LateFeeRules) =>
  r.perDay > 0
    ? `₹${r.perDay}/day after the due date${r.graceDays > 0 ? ` (after ${r.graceDays} grace day${r.graceDays === 1 ? '' : 's'})` : ''}${r.cap > 0 ? `, up to ₹${r.cap} a month` : ''}`
    : 'Late fee is off';
