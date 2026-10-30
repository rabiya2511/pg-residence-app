// Single source of truth for "who owes rent and how much".
// Used by the Pending Dues screen AND the dashboard so their counts and amounts always agree.
import { AdminResident } from '../constants/mockData';

export type Due = {
  resident: AdminResident;
  roomId: string;
  roomNumber: string;
  floor: number | null;
  capacity: number | null;
  /** Rent still to be collected: unpaid months, minus any agreed deduction. */
  outstanding: number;
  /** Rent before any deduction, and the deduction the admin entered (with the note), for display. */
  gross: number;
  deduction: number;
  deductionReason: string | null;
  months: number;
  oldestDue: Date;
  daysOverdue: number;
  status: 'Overdue' | 'Pending';
};

const MONTHS_3 = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const DAY_MS = 24 * 60 * 60 * 1000;

// Parses "25 Sep 2026" and "Sep 25, 2026".
export function parseDue(str: string | null | undefined): Date | null {
  if (!str) return null;
  const s = str.trim();
  const a = s.match(/^(\d{1,2})\s+([A-Za-z]{3})[A-Za-z]*,?\s+(\d{4})$/);
  if (a) {
    const m = MONTHS_3.indexOf(a[2].toLowerCase());
    return m === -1 ? null : new Date(Number(a[3]), m, Number(a[1]));
  }
  const b = s.match(/^([A-Za-z]{3})[A-Za-z]*\s+(\d{1,2}),?\s+(\d{4})$/);
  if (b) {
    const m = MONTHS_3.indexOf(b[1].toLowerCase());
    return m === -1 ? null : new Date(Number(b[3]), m, Number(b[2]));
  }
  return null;
}

const monthLabel = (d: Date) => d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
const net = (p: any) => Math.max(0, (Number(p.amount) || 0) - (Number(p.deduction) || 0));

/**
 * Every resident whose rent is not Paid, with the exact amount outstanding:
 *  - each unpaid monthly record counts (its amount minus the deduction agreed for that month);
 *  - if this month has no record yet, this month's rent is added so it is never missed;
 *  - months already marked Paid never count.
 */
export function computeDues(residents: AdminResident[], rooms: any[], paymentRecords: any[]): Due[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const thisMonth = monthLabel(now);

  return residents
    .filter((r) => r.rentStatus !== 'Paid')
    .map((r) => {
      const room = rooms.find((rm) => rm.id === r.roomId);
      const mine = paymentRecords.filter((p) => p.residentId === r.id);
      const unpaid = mine.filter((p) => p.status !== 'Paid');
      const hasThisMonth = mine.some((p) => p.month === thisMonth);

      let outstanding = unpaid.reduce((sum, p) => sum + net(p), 0);
      let gross = unpaid.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
      const deduction = unpaid.reduce((sum, p) => sum + (Number(p.deduction) || 0), 0);
      const deductionReason: string | null =
        unpaid.map((p) => p.deductionReason).filter((x) => !!x).join('; ') || null;
      let months = unpaid.length;
      const dueDates = unpaid.map((p) => parseDue(p.dueDate)).filter((d): d is Date => !!d);

      if (!hasThisMonth) {
        outstanding += r.monthlyRent;
        gross += r.monthlyRent;
        months += 1;
        dueDates.push(new Date(now.getFullYear(), now.getMonth(), r.rentDueDay || 5));
      }

      const oldestDue =
        dueDates.length > 0
          ? new Date(Math.min(...dueDates.map((d) => d.getTime())))
          : new Date(now.getFullYear(), now.getMonth(), r.rentDueDay || 5);
      const daysOverdue = Math.max(0, Math.floor((today - oldestDue.getTime()) / DAY_MS));

      return {
        resident: r,
        roomId: room ? room.id : 'unassigned',
        roomNumber: room ? room.roomNumber : '—',
        floor: room ? room.floor : null,
        capacity: room ? room.capacity : null,
        outstanding,
        gross,
        deduction,
        deductionReason,
        months: Math.max(1, months),
        oldestDue,
        daysOverdue,
        status: daysOverdue > 0 ? 'Overdue' : 'Pending',
      } as Due;
    });
}