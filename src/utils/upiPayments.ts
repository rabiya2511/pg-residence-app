// Shared helpers for the UPI "pay, then admin verifies" flow.

export type UpiStatus = 'Under Verification' | 'Verified' | 'Rejected';

export type UpiPayment = {
  /** `${propertyId}_${upiRef}` - the same reference can never be submitted twice. */
  id: string;
  residentId: string;
  propertyId: string;
  residentName: string;
  room?: string;
  month: string; // "October 2026"
  amount: number; // what the resident was asked to pay (rent after any deduction, plus any late fee)
  /** The late fee that is part of `amount` (0 / missing when none). */
  lateFee?: number;
  upiRef: string; // 12-digit UPI reference (UTR) from the payment app
  status: UpiStatus;
  submittedAt: number;
  reviewedAt?: number;
  reviewNote?: string;
  /** The payments/{id} record that was marked Paid when the admin confirmed. */
  paymentRecordId?: string;
};

export type UpiSettings = { upiId: string; payeeName: string };

const MONTHS_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** "October 2026" -> 1 Oct 2026 (null when the label cannot be read). */
export function monthLabelToDate(label: string): Date | null {
  const [name, year] = (label || '').split(' ');
  const m = MONTHS_LONG.findIndex((x) => x === name);
  const y = Number(year);
  if (m === -1 || !y) return null;
  return new Date(y, m, 1);
}

export const currentMonthLabel = (d: Date = new Date()) =>
  d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

/** UPI reference numbers (UTR / transaction ref) are 12 digits. */
export const sanitizeUtr = (text: string) => text.replace(/\D/g, '').slice(0, 12);
export const isValidUtr = (v: string) => /^\d{12}$/.test(v);

/** Payee UPI id, e.g. lokanshpg@okhdfcbank */
export const isValidPayeeUpi = (v: string) => /^[a-z0-9._-]{2,}@[a-z][a-z0-9]{1,}$/i.test(v.trim());

/** upi://pay link - opens a UPI app on a phone, and is what the QR code carries. */
export function buildUpiUri(upiId: string, payeeName: string, amount: number, note: string): string {
  const q = [
    `pa=${encodeURIComponent(upiId.trim())}`,
    `pn=${encodeURIComponent(payeeName.trim() || 'PG Rent')}`,
    `am=${encodeURIComponent(String(Math.round(amount)))}`,
    'cu=INR',
    `tn=${encodeURIComponent(note)}`,
  ];
  return `upi://pay?${q.join('&')}`;
}

export const upiStatusColor = (s: string): { bg: string; text: string } => {
  switch (s) {
    case 'Verified': return { bg: '#D1FAE5', text: '#059669' };
    case 'Rejected': return { bg: '#FEE2E2', text: '#DC2626' };
    default: return { bg: '#FEF3C7', text: '#D97706' };
  }
};

export const fmtWhen = (ts: number) =>
  new Date(ts).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: 'numeric', minute: '2-digit' });
