export type ExitStatus = 'Pending' | 'Approved' | 'Rejected';
export type SettlementStatus = 'Refund Pending' | 'Refunded' | 'Amount Owed' | 'Settled';

export const NOTICE_PERIOD_DAYS = 30;
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

// The settlement the admin has finalized for the CURRENT notice, or null.
export function finalizedSettlement(r: any): any | null {
  const s = r?.exitSettlement;
  if (!s || !s.finalizedAt) return null;
  return (s.for ?? 0) === (r?.vacateSubmittedAt ?? 0) ? s : null;
}

// Everything still unpaid for this resident (after any deduction the admin entered on a month).
export function pendingRentFor(residentId: string, paymentRecords: any[]): number {
  return paymentRecords
    .filter((p) => p.residentId === residentId && p.status !== 'Paid')
    .reduce((sum, p) => {
      const amount = Number(p.amount) || 0;
      const deduction = Math.min(amount, Number(p.deduction) || 0);
      return sum + Math.max(0, amount - deduction);
    }, 0);
}

export type NoticeInfo = { given: number; required: number; short: number };

// Days of notice between the day the notice was submitted and the vacating date.
export function noticeInfo(submittedAt: number | null | undefined, vacatingDate: string | null | undefined): NoticeInfo | null {
  if (!submittedAt || !vacatingDate) return null;
  const v = parseDisplayDate(vacatingDate);
  if (!v) return null;
  const s = new Date(submittedAt);
  const start = new Date(s.getFullYear(), s.getMonth(), s.getDate()).getTime();
  const given = Math.max(0, Math.round((v.getTime() - start) / DAY_MS));
  return { given, required: NOTICE_PERIOD_DAYS, short: Math.max(0, NOTICE_PERIOD_DAYS - given) };
}

export type Settlement = {
  deposit: number;
  advance: number;            // credit: advance balance held for the resident
  emergencyDeduction: number;
  pendingRent: number;
  maintenance: number;
  additional: number;
  totalDeductions: number;
  refund: number;             // what goes back to the resident
  amountOwed: number;         // what the resident still owes when deductions exceed deposit + advance
};

// Refundable amount = deposit + advance balance - all approved deductions.
export function computeSettlement(input: {
  deposit: number;
  emergencyPercent: number | null | undefined;
  pendingRent: number;
  additional: number;
  advance?: number;
  maintenance?: number;
}): Settlement {
  const deposit = Math.max(0, Number(input.deposit) || 0);
  const advance = Math.max(0, Math.round(Number(input.advance) || 0));
  const emergencyDeduction = input.emergencyPercent
    ? Math.round((deposit * input.emergencyPercent) / 100)
    : 0;
  const pendingRent = Math.max(0, Math.round(input.pendingRent) || 0);
  const maintenance = Math.max(0, Math.round(Number(input.maintenance) || 0));
  const additional = Math.max(0, Math.round(input.additional) || 0);
  const totalDeductions = emergencyDeduction + pendingRent + maintenance + additional;
  const net = deposit + advance - totalDeductions;
  return {
    deposit,
    advance,
    emergencyDeduction,
    pendingRent,
    maintenance,
    additional,
    totalDeductions,
    refund: Math.max(0, net),
    amountOwed: Math.max(0, -net),
  };
}

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
export const formatINR = inr;

// The lines of a saved settlement, in order, for the statement card and the share text.
export function settlementLines(s: any): { label: string; value: number; kind: 'plain' | 'plus' | 'minus' }[] {
  const lines: { label: string; value: number; kind: 'plain' | 'plus' | 'minus' }[] = [
    { label: 'Security deposit', value: Number(s.deposit) || 0, kind: 'plain' },
  ];
  if ((s.advance ?? 0) > 0) lines.push({ label: 'Advance balance', value: s.advance, kind: 'plus' });
  if ((s.emergencyDeduction ?? 0) > 0) {
    lines.push({ label: `Emergency deduction (${s.emergencyPercent ?? 0}%)`, value: s.emergencyDeduction, kind: 'minus' });
  }
  if ((s.pendingRent ?? 0) > 0) lines.push({ label: 'Pending rent', value: s.pendingRent, kind: 'minus' });
  if ((s.maintenance ?? 0) > 0) lines.push({ label: 'Pending maintenance', value: s.maintenance, kind: 'minus' });
  const extra = s.additionalDeductions ?? s.additional ?? 0;
  if (extra > 0) {
    lines.push({
      label: s.additionalNote ? `Other deductions (${s.additionalNote})` : 'Other deductions',
      value: extra,
      kind: 'minus',
    });
  }
  return lines;
}

// Plain-text statement, used by the Share button.
export function statementText(residentName: string, room: string, pgName: string, s: any): string {
  const rows = settlementLines(s).map(
    (l) => `${l.label}: ${l.kind === 'minus' ? '- ' : l.kind === 'plus' ? '+ ' : ''}${inr(l.value)}`
  );
  const result = (s.amountOwed ?? 0) > 0 ? `Amount owed by resident: ${inr(s.amountOwed)}` : `Refundable amount: ${inr(s.refund ?? 0)}`;
  return [
    'FINAL SETTLEMENT STATEMENT',
    pgName,
    `Resident: ${residentName}${room ? ` (Room ${room})` : ''}`,
    `Finalized on: ${s.finalizedOn ?? s.completedOn ?? ''}`,
    '',
    ...rows,
    '',
    result,
    `Status: ${s.status ?? ''}${s.refundedOn ? ` on ${s.refundedOn}` : ''}${s.refundRef ? ` (ref ${s.refundRef})` : ''}`,
  ].join('\n');
}