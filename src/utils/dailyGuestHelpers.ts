import { AdminDailyGuest, DAILY_GUEST_RATE } from '../constants/mockData';

const MONTHS_3 = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
export const DAY_MS = 24 * 60 * 60 * 1000;

// Parses "25 Sep 2026" and "Sep 25, 2026".
export function parseGuestDate(str?: string | null): Date | null {
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

export const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
export const diffDays = (a: Date, b: Date) => Math.round((startOfDay(a).getTime() - startOfDay(b).getTime()) / DAY_MS);
export const formatGuestDate = (d: Date) =>
  d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

export const guestRate = (g: AdminDailyGuest): number =>
  g.dailyRate ?? (g.numDays > 0 ? Math.round(g.totalAmount / g.numDays) : DAILY_GUEST_RATE);

export const stayCheckIn = (g: AdminDailyGuest): Date => startOfDay(new Date(g.checkInTimestamp));
export const stayEnd = (g: AdminDailyGuest): Date => parseGuestDate(g.vacatingDate) ?? addDays(stayCheckIn(g), g.numDays);

export type StayState = 'upcoming' | 'active' | 'ended' | 'checkedOut';

// upcoming = not arrived yet, active = staying now, ended = vacating date passed but not checked out.
export function stayState(g: AdminDailyGuest, now: number = Date.now()): StayState {
  if (g.checkedOut) return 'checkedOut';
  if (now < g.checkInTimestamp) return 'upcoming';
  const end = stayEnd(g);
  const endOfLastDay = new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59, 999).getTime();
  return now > endOfLastDay ? 'ended' : 'active';
}

// Older guests only have advanceDepositStatus, so "Paid" there means the whole deposit was paid.
export const depositPaidOf = (g: AdminDailyGuest): number =>
  g.depositPaid ?? (g.advanceDepositStatus === 'Paid' ? g.securityDeposit ?? 0 : 0);

export function guestDue(g: AdminDailyGuest) {
  const stayDue = Math.max(0, g.totalAmount - (g.advanceAmount ?? 0));
  const depositDue = Math.max(0, (g.securityDeposit ?? 0) - depositPaidOf(g));
  return { stayDue, depositDue, total: stayDue + depositDue };
}

export const rangesOverlap = (aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) =>
  aStart.getTime() <= bEnd.getTime() && aEnd.getTime() >= bStart.getTime();