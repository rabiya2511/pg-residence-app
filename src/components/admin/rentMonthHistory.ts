import { AdminPaymentRecord } from '../../constants/mockData';

const MONTHS_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const MONTHS_3 = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export type RentMonthStatus = 'Early' | 'On Time' | 'Late' | 'Pending';

export type RentMonthRow = {
  monthKey: number; // year*12 + monthIndex
  year: number;
  monthIdx: number;
  label: string; // "February 2026"
  monthShort: string; // "Feb"
  dueDateObj: Date;
  record: AdminPaymentRecord | null;
  isCurrentOrFuture: boolean;
  day: number; // the day to display/plot — real paidOn day if present, else the due day
  statusLabel: RentMonthStatus;
};

// Parses "12 Jan 2026" (dd MMM yyyy — matches joiningDate + formatDisplayDate output)
// Parses "12 Jan 2026" (dd MMM yyyy — matches joiningDate + formatDisplayDate output)
export function parseDMY(str: string): { day: number; month: number; year: number } | null {
  const m = str.match(/^(\d{1,2})\s+([A-Za-z]{3})[A-Za-z]*\s+(\d{4})$/);
  if (!m) return null;
  const monthIdx = MONTHS_3.findIndex((mo) => mo.toLowerCase() === m[2].toLowerCase());
  if (monthIdx === -1) return null;
  return { day: Number(m[1]), month: monthIdx, year: Number(m[3]) };
}

// Parses a paidOn value in EITHER format seen in the app:
//  - "12 Jan 2026"  (dd MMM yyyy — from formatDisplayDate, newly-recorded payments)
//  - "Aug 3, 2026"  (MMM d, yyyy — from seed mock data)
export function parsePaidOn(str: string): { day: number; month: number; year: number } | null {
  const dmy = parseDMY(str);
  if (dmy) return dmy;

  const m = str.match(/^([A-Za-z]{3})[A-Za-z]*\s+(\d{1,2}),\s*(\d{4})$/);
  if (!m) return null;
  const monthIdx = MONTHS_3.findIndex((mo) => mo.toLowerCase() === m[1].toLowerCase());
  if (monthIdx === -1) return null;
  return { day: Number(m[2]), month: monthIdx, year: Number(m[3]) };
}

// Parses the "month" field, e.g. "August 2026"
export function parseMonthLabel(str: string): { month: number; year: number } | null {
  const m = str.match(/^([A-Za-z]+)\s+(\d{4})$/);
  if (!m) return null;
  const monthIdx = MONTHS_LONG.findIndex((mo) => mo.toLowerCase() === m[1].toLowerCase());
  if (monthIdx === -1) return null;
  return { month: monthIdx, year: Number(m[2]) };
}

/**
 * Builds one row per calendar month from the resident's joining month through
 * the current month (inclusive), in chronological order. This is the single
 * source of truth for "what happened each month" — used identically by the
 * trend chart and the monthly history list, so they can never disagree.
 *
 * For each month:
 *  - If a real Paid record exists, use its actual paidOn day and timing.
 *  - If it's the current or a future month with no Paid record, status is
 *    "Pending" and there's nothing to plot yet.
 *  - If it's a past month with no real record, it's treated as paid on time
 *    on the due day (a display fallback for months before real payment
 *    tracking existed) — this is why "day" and "statusLabel" are always
 *    populated for past months even without a record.
 */
export function buildRentMonthRows(
  joiningDate: string,
  rentDueDay: number,
  payments: AdminPaymentRecord[]
): RentMonthRow[] {
  const joined = parseDMY(joiningDate);
  if (!joined) return [];

  const now = new Date();
  const startKey = joined.year * 12 + joined.month;
  const endKey = now.getFullYear() * 12 + now.getMonth();

  const rows: RentMonthRow[] = [];
  for (let key = startKey; key <= endKey; key++) {
    const year = Math.floor(key / 12);
    const monthIdx = key % 12;
    const label = `${MONTHS_LONG[monthIdx]} ${year}`;
    const dueDateObj = new Date(year, monthIdx, rentDueDay);
    const isCurrentOrFuture = key >= endKey;

    const record =
      payments.find((p) => {
        const pm = parseMonthLabel(p.month);
        return pm && pm.month === monthIdx && pm.year === year;
      }) ?? null;

    let day: number;
    let statusLabel: RentMonthStatus;

    if (record?.status === 'Paid' && record.paidOn) {
      const paid = parsePaidOn(record.paidOn);
      day = paid ? paid.day : rentDueDay;
      statusLabel = record.timing ?? 'On Time';
    } else if (isCurrentOrFuture) {
      day = rentDueDay;
      statusLabel = 'Pending';
    } else {
      // Past month, no real record — fallback: treated as paid on time.
      day = rentDueDay;
      statusLabel = 'On Time';
    }

    rows.push({
      monthKey: key,
      year,
      monthIdx,
      label,
      monthShort: MONTHS_3[monthIdx],
      dueDateObj,
      record,
      isCurrentOrFuture,
      day,
      statusLabel,
    });
  }

  return rows;
}