import React, { createContext, useContext, ReactNode } from 'react';
import { useAdmin } from './AdminContext';
import { useMockAuth } from './MockAuthContext';
import { PaymentRecord } from '../constants/mockData';

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
  status: 'Pending' | 'Paid' | 'Overdue';
  isPaid: boolean;
};

type RentContextType = {
  rentStatus: RentStatusType;
  paymentHistory: PaymentRecord[];
  markRentAsPaid: (method: string) => PaymentRecord;
};

const RentContext = createContext<RentContextType | undefined>(undefined);

const paymentMethodLabels: Record<string, string> = {
  upi: 'UPI',
  card: 'Credit / Debit Card',
  netbanking: 'Net Banking',
};

const msPerDay = 1000 * 60 * 60 * 24;

export function RentProvider({ children }: { children: ReactNode }) {
  const { residents, paymentRecords, recordRentPayment } = useAdmin();
  const { residentId } = useMockAuth();

  const resident = residents.find((r) => r.id === residentId);

  const now = new Date();
  const currentMonthLabel = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const currentRecord = paymentRecords.find(
    (p) => p.residentId === residentId && p.month === currentMonthLabel
  );

  const dueDateObj = resident
    ? new Date(now.getFullYear(), now.getMonth(), resident.rentDueDay)
    : now;
  const dueInDays = Math.ceil((dueDateObj.getTime() - now.getTime()) / msPerDay);

  // An unpaid record still holds the full rent plus the deduction the admin entered on the Rent screen;
  // a paid record already holds the amount actually paid (rent minus deduction).
  const recordAmount = currentRecord?.amount ?? resident?.monthlyRent ?? 0;
  const deduction = Math.min(recordAmount, Number((currentRecord as any)?.deduction) || 0);
  const isPaid = currentRecord?.status === 'Paid';
  const amountToPay = isPaid ? recordAmount : Math.max(0, recordAmount - deduction);

  const rentStatus: RentStatusType = {
    amount: amountToPay,
    grossAmount: isPaid ? recordAmount + deduction : recordAmount,
    deduction,
    deductionReason: deduction > 0 ? (currentRecord as any)?.deductionReason ?? null : null,
    monthLabel: `${now.toLocaleDateString('en-US', { month: 'long' })} Rent`,
    dueDate: dueDateObj,
    dueInDays,
    status: isPaid ? 'Paid' : dueInDays < 0 ? 'Overdue' : 'Pending',
    isPaid,
  };

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

  const markRentAsPaid = (method: string): PaymentRecord => {
    if (!residentId) {
      throw new Error('No resident is currently logged in — cannot record payment.');
    }
    const label = paymentMethodLabels[method] ?? method;
    const record = recordRentPayment(residentId, label, 'resident');
    return {
      id: record.id,
      month: record.month,
      amount: record.amount,
      paidOn: record.paidOn ?? '',
      status: 'Paid',
      method: record.method,
      transactionId: record.transactionId,
    };
  };

  return (
    <RentContext.Provider value={{ rentStatus, paymentHistory, markRentAsPaid }}>
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