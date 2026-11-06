import { AdminDailyGuest } from '../constants/mockData';

export type GuestPayment = { amount: number; method: string; at: number };

// Every payment received from a day guest, each with the time it was received.
// The advance paid when the guest was booked is not stored as a separate payment, so it is
// worked out as (advance − listed payments) and dated at the moment the guest was added.
// That is what makes an advance collected today count today, even for a stay that starts later.
export function guestPayments(guest: AdminDailyGuest): GuestPayment[] {
  const g: any = guest;
  const bookedAt = Number(g.createdAt) || g.checkInTimestamp || 0;
  const listed: GuestPayment[] = (Array.isArray(g.payments) ? g.payments : []).map((p: any) => ({
    amount: Number(p.amount) || 0,
    method: p.method ?? g.paymentMethod ?? 'Cash',
    at: Number(p.at) || bookedAt,
  }));
  const listedTotal = listed.reduce((s, p) => s + p.amount, 0);
  const advance = Number(g.advanceAmount) || 0;

  const out: GuestPayment[] = [];
  const initial = advance - listedTotal;
  if (initial > 0) out.push({ amount: initial, method: g.paymentMethod ?? 'Cash', at: bookedAt });
  out.push(...listed);

  // Older records marked Paid with no advance amount: the full stay amount counts as paid at booking.
  const received = out.reduce((s, p) => s + p.amount, 0);
  if (g.paymentStatus === 'Paid' && g.totalAmount > received) {
    out.push({ amount: g.totalAmount - received, method: g.paymentMethod ?? 'Cash', at: bookedAt });
  }
  return out.filter((p) => p.amount > 0);
}

// Payments hidden by "Clear All" on the Day Revenue screen. Later payments show again.
function clearedUntil(guest: AdminDailyGuest): number {
  const g: any = guest;
  const at = Number(g.dayRevenueClearedAt) || 0;
  if (at > 0) return at;
  return g.dayRevenueCleared ? Number.POSITIVE_INFINITY : 0; // old flag without a time: hide everything
}

function todayBounds() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return { start: start.getTime(), end: start.getTime() + 24 * 60 * 60 * 1000 };
}

// Money received from this guest TODAY (advance, part payments, balance), whatever the check-in date.
export function guestCollected(guest: AdminDailyGuest): number {
  const { start, end } = todayBounds();
  const hiddenUntil = clearedUntil(guest);
  return guestPayments(guest)
    .filter((p) => p.at >= start && p.at < end && p.at > hiddenUntil)
    .reduce((s, p) => s + p.amount, 0);
}

// Day Revenue shows TODAY only: a guest is listed when money was received from them today.
// Earlier days are closed automatically, and cleared payments stay hidden until restored.
export function isTodayRevenueGuest(guest: AdminDailyGuest): boolean {
  return guestCollected(guest) > 0;
}

export function todayDayRevenue(guests: AdminDailyGuest[]): number {
  return guests.reduce((s, g) => s + guestCollected(g), 0);
}
