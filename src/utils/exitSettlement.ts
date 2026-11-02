export type ExitStatus = 'Pending' | 'Approved' | 'Rejected';

// Final settlement status, set at checkout and moved on by the admin afterwards.
export type SettlementStatus = 'Refund Pending' | 'Refunded' | 'Amount Owed' | 'Dues Received' | 'Settled';

// One month of notice, as the PG rules require.
export const REQUIRED_NOTICE_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;
const MONTHS_3 = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// "25 Sep 2026" -> Date
export function parseDisplayDate(str: string): Date | null {
  const m = (str ?? '').match(/^(\d{1,2})\s+([A-Za-z]{3})[A-Za-z]*\s+(\d{4})$/);
  if (!m) return null;
  const idx = MONTHS_3.findIndex((mo) => mo.toLowerCase() === m[2].toLowerCase());
  return idx === -1 ? null : new Date(Number(m[3]), idx, Number(m[1]));
}

// The admin's decision only counts for the notice it was made on. A new submission has a new
// vacateSubmittedAt, so an old approval or rejection never carries over to it.
export function exitStatusOf(r: any): ExitStatus {
  const d = r?.exitDecision;
  if (d && (d.for ?? 0) === (r?.vacateSubmittedAt ?? 0)) {
    return d.status === 'Approved' || d.status === 'Rejected' ? d.status : 'Pending';
  }
  return 'Pending';
}

// Days between the day the notice was given and the expected checkout day. null when unknown.
export function noticeGivenDays(r: any): number | null {
  const ts = Number(r?.vacateSubmittedAt) || 0;
  const vd = parseDisplayDate(r?.vacatingDate ?? '');
  if (!ts || !vd) return null;
  const s = new Date(ts);
  const start = new Date(s.getFullYear(), s.getMonth(), s.getDate());
  return Math.max(0, Math.round((vd.getTime() - start.getTime()) / DAY_MS));
}

// The deposit the PG is actually holding. A deposit marked "Not Paid" was never collected,
// so there is nothing to refund from it. Older residents with no status count as held.
export function heldDeposit(r: any): number {
  const amount = Math.max(0, Number(r?.securityDeposit) || 0);
  const status = r?.advanceDepositStatus;
  return status === 'Not Paid' || status === 'No Advance' ? 0 : amount;
}

export type UnpaidRent = { id: string; month: string; amount: number; dueDate: string; status: string };

// Every unpaid rent month for this resident (after any deduction the admin entered on that month).
export function unpaidRentRecords(residentId: string, paymentRecords: any[]): UnpaidRent[] {
  return paymentRecords
    .filter((p) => p.residentId === residentId && p.status !== 'Paid')
    .map((p) => {
      const amount = Number(p.amount) || 0;
      const deduction = Math.min(amount, Number(p.deduction) || 0);
      return {
        id: String(p.id),
        month: String(p.month ?? ''),
        amount: Math.max(0, amount - deduction),
        dueDate: String(p.dueDate ?? ''),
        status: String(p.status ?? 'Pending'),
      };
    })
    .filter((p) => p.amount > 0);
}

// Everything still unpaid for this resident.
export function pendingRentFor(residentId: string, paymentRecords: any[]): number {
  return unpaidRentRecords(residentId, paymentRecords).reduce((sum, p) => sum + p.amount, 0);
}

export type Settlement = {
  deposit: number;
  advanceCredit: number;      // advance balance given back to the resident
  emergencyDeduction: number;
  pendingRent: number;
  pendingMaintenance: number;
  additional: number;
  totalDeductions: number;
  refund: number;      // what goes back to the resident
  amountOwed: number;  // what the resident still owes when deductions exceed what the PG holds
};

// Refundable amount = deposit + advance balance - all deductions.
export function computeSettlement(input: {
  deposit: number;
  emergencyPercent: number | null | undefined;
  pendingRent: number;
  additional: number;
  pendingMaintenance?: number;
  advanceCredit?: number;
}): Settlement {
  const deposit = Math.max(0, Number(input.deposit) || 0);
  const advanceCredit = Math.max(0, Math.round(Number(input.advanceCredit) || 0));
  const emergencyDeduction = input.emergencyPercent
    ? Math.round((deposit * input.emergencyPercent) / 100)
    : 0;
  const pendingRent = Math.max(0, Math.round(input.pendingRent) || 0);
  const pendingMaintenance = Math.max(0, Math.round(Number(input.pendingMaintenance) || 0));
  const additional = Math.max(0, Math.round(input.additional) || 0);
  const totalDeductions = emergencyDeduction + pendingRent + pendingMaintenance + additional;
  const net = deposit + advanceCredit - totalDeductions;
  return {
    deposit,
    advanceCredit,
    emergencyDeduction,
    pendingRent,
    pendingMaintenance,
    additional,
    totalDeductions,
    refund: Math.max(0, net),
    amountOwed: Math.max(0, -net),
  };
}