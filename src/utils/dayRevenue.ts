import { AdminDailyGuest } from '../constants/mockData';

// Amount actually collected from a day guest.
export function guestCollected(guest: AdminDailyGuest): number {
  return guest.paymentStatus === 'Paid' ? guest.totalAmount : guest.advanceAmount ?? 0;
}

// Day Revenue shows TODAY only: earlier days are closed automatically,
// and guests cleared with "Clear All" stay hidden until restored.
export function isTodayRevenueGuest(guest: AdminDailyGuest): boolean {
  if ((guest as any).dayRevenueCleared) return false;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = start.getTime() + 24 * 60 * 60 * 1000;
  const t = guest.checkInTimestamp ?? 0;
  return t >= start.getTime() && t < end;
}

export function todayDayRevenue(guests: AdminDailyGuest[]): number {
  return guests.filter(isTodayRevenueGuest).reduce((s, g) => s + guestCollected(g), 0);
}