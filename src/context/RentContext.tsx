import React, { createContext, useContext, ReactNode } from 'react';
import { useAdmin } from './AdminContext';
import { useMockAuth } from './MockAuthContext';
import { PaymentRecord } from '../constants/mockData';
import { useMyUpiPayments, useUpiSettings } from '../hooks/useUpiPayments';
import { UpiPayment } from '../utils/upiPayments';
import { computeLateFee, daysLate } from '../utils/lateFee';
import { parseDue } from '../utils/dues';

type RentStatusType = {
  /** What the resident actually has to pay: rent minus any deduction the admin entered. */
  amount: number;
  /** Rent before the deduction, the deduction itself and the admin's note (for display). */
  grossAmount: number;
  deduction: number;
  deductionReason: string | null;
  monthLabel: string;
  dueDate: Date;
  dueInDays: number;
  status: 'Pending' | 'Paid' | 'Overdue' | 'Under Verification';
  isPaid: boolean;
  /** Late fee on this month's rent (already included in `amount`), the days it is based on, and whether the admin waived it. */
  lateFee: number;
  lateFeeDays: number;
  lateFeeWaived: boolean;
  /** The resident's UPI payment for this month that the admin has not confirmed yet, if any. */
  pendingVerification: UpiPayment | null;
  /** The admin's latest rejection for this month (cleared once a new payment is sent or the month is paid). */
  rejectedPayment: UpiPayment | null;
  /** Everything still unpaid across all months (current + earlier). */
  totalOutstanding: number;
  /** Number of unpaid months. */
  unpaidMonths: number;
  /** Most recent paid record, or null. */
  lastPayment: PaymentRecord | null;
};

type RentContextType = {
  rentStatus: RentStatusType;
  paymentHistory: PaymentRecord[];
};

const RentContext = createContext<RentContextType | undefined>(undefined);

const msPerDay = 1000 * 60 * 60 * 24;

export function RentProvider({ children }: { children: ReactNode }) {
  const { residents, paymentRecords } = useAdmin();
  const { residentId } = useMockAuth();
  const { payments: upiPayments } = useMyUpiPayments();

  const resident = residents.find((r) => r.id === residentId);
  const { lateFeeRules } = useUpiSettings(resident?.propertyId);

  const now = new Date();
  const currentMonthLabel = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const currentRecord = paymentRecords.find(
    (p) => p.residentId === residentId && p.month === currentMonthLabel
  );

  // Due date this month. A due day like 31 is clamped to the month's last day
  // (otherwise February 31 would roll over into March).
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dueDateObj = resident
    ? new Date(now.getFullYear(), now.getMonth(), Math.min(resident.rentDueDay || 5, daysInMonth))
    : now;
  const dueInDays = Math.ceil((dueDateObj.getTime() - now.getTime()) / msPerDay);

  // An unpaid record still holds the full rent plus the deduction the admin entered on the Rent screen;
  // a paid record already holds the amount actually paid (rent minus deduction).
  const recordAmount = currentRecord?.amount ?? resident?.monthlyRent ?? 0;
  const deduction = Math.min(recordAmount, Number((currentRecord as any)?.deduction) || 0);
  const isPaid = currentRecord?.status === 'Paid';
  // Late fee: stored on the record once paid; otherwise worked out from today's date unless the admin waived it.
  const lateFeeWaived = !!(currentRecord as any)?.lateFeeWaived;
  const paidLateFee = isPaid ? Number((currentRecord as any)?.lateFee) || 0 : 0;
  const lateFee = isPaid ? paidLateFee : computeLateFee(dueDateObj, now, lateFeeRules, lateFeeWaived);
  const lateFeeDays = isPaid || lateFeeWaived ? 0 : daysLate(dueDateObj, now, lateFeeRules.graceDays);
  const amountToPay = isPaid ? recordAmount : Math.max(0, recordAmount - deduction) + lateFee;

  const paymentHistory: PaymentRecord[] = paymentRecords
    .filter((p) => p.residentId === residentId && p.status === 'Paid')
    .map((p) => ({
      id: p.id,
      month: p.month,
      amount: p.amount,
      paidOn: p.paidOn ?? '',
      status: 'Paid',
      method: p.method,
      transactionId: p.transactionId,
    }));

  const lastPayment =
    [...paymentHistory].sort(
      (a, b) => (Date.parse(b.paidOn) || 0) - (Date.parse(a.paidOn) || 0)
    )[0] ?? null;

  // Total outstanding = every unpaid month for this resident (after admin deductions).
  const unpaid = paymentRecords.filter((p) => p.residentId === residentId && p.status !== 'Paid');
  const totalOutstanding = unpaid.reduce((sum, p) => {
    const d = Math.min(p.amount, Number((p as any).deduction) || 0);
    const fee = computeLateFee(parseDue(p.dueDate), now, lateFeeRules, !!(p as any).lateFeeWaived);
    return sum + Math.max(0, p.amount - d) + fee;
  }, 0);

  // Latest UPI submission for this month decides whether the resident is waiting on the admin.
  const thisMonthUpi = upiPayments.filter((p) => p.month === currentMonthLabel);
  const pendingVerification = isPaid ? null : thisMonthUpi.find((p) => p.status === 'Under Verification') ?? null;
  const latestUpi = thisMonthUpi[0] ?? null; // already newest first
  const rejectedPayment = !isPaid && !pendingVerification && latestUpi?.status === 'Rejected' ? latestUpi : null;

  const rentStatus: RentStatusType = {
    amount: amountToPay,
    grossAmount: isPaid ? recordAmount + deduction - paidLateFee : recordAmount,
    deduction,
    deductionReason: deduction > 0 ? (currentRecord as any)?.deductionReason ?? null : null,
    monthLabel: `${now.toLocaleDateString('en-US', { month: 'long' })} Rent`,
    dueDate: dueDateObj,
    dueInDays,
    status: isPaid ? 'Paid' : pendingVerification ? 'Under Verification' : dueInDays < 0 ? 'Overdue' : 'Pending',
    isPaid,
    lateFee,
    lateFeeDays,
    lateFeeWaived,
    pendingVerification,
    rejectedPayment,
    totalOutstanding,
    unpaidMonths: unpaid.length,
    lastPayment,
  };

  return (
    <RentContext.Provider value={{ rentStatus, paymentHistory }}>
      {children}
    </RentContext.Provider>
  );
}

export function useRent() {
  const context = useContext(RentContext);
  if (!context) {
    throw new Error('useRent must be used within a RentProvider');
  }
  return context;
}