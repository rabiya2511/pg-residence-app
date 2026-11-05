import { useEffect, useMemo, useState } from 'react';
import { getAuth } from '@react-native-firebase/auth';
import {
  getFirestore, collection, doc, onSnapshot, query, where, setDoc, updateDoc,
} from '@react-native-firebase/firestore';
import { useAdmin } from '../context/AdminContext';
import { useMockAuth } from '../context/MockAuthContext';
import {
  UpiPayment, UpiSettings, isValidUtr, isValidPayeeUpi, monthLabelToDate,
} from '../utils/upiPayments';
import { LateFeeRules, NO_LATE_FEE } from '../utils/lateFee';

const warn = (label: string) => (e: any) => console.warn(label, e?.code ?? e?.message ?? e);
const sortNewest = (a: UpiPayment, b: UpiPayment) => (b.submittedAt ?? 0) - (a.submittedAt ?? 0);

type Result = { ok: boolean; message: string };

// ───────── The PG's UPI details (admin writes, residents of that property read) ─────────
export function useUpiSettings(propertyId?: string | null) {
  const db = getFirestore();
  const [settings, setSettings] = useState<UpiSettings>({ upiId: '', payeeName: '' });
  const [lateFeeRules, setLateFeeRules] = useState<LateFeeRules>(NO_LATE_FEE);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!propertyId) {
      setSettings({ upiId: '', payeeName: '' });
      setLateFeeRules(NO_LATE_FEE);
      setLoaded(true);
      return;
    }
    setLoaded(false);
    return onSnapshot(
      doc(db, 'paymentSettings', propertyId),
      (snap: any) => {
        const exists = typeof snap.exists === 'function' ? snap.exists() : snap.exists;
        const d = exists ? snap.data() : null;
        setSettings({ upiId: d?.upiId ?? '', payeeName: d?.payeeName ?? '' });
        setLateFeeRules({
          perDay: Number(d?.lateFeePerDay) || 0,
          cap: Number(d?.lateFeeCap) || 0,
          graceDays: Number(d?.lateFeeGraceDays) || 0,
        });
        setLoaded(true);
      },
      (e: any) => {
        console.warn('paymentSettings listener:', e?.code);
        setLoaded(true);
      }
    );
  }, [propertyId]);

  const save = async (upiId: string, payeeName: string): Promise<Result> => {
    if (!propertyId) return { ok: false, message: 'No property selected.' };
    if (!isValidPayeeUpi(upiId)) return { ok: false, message: 'Enter a valid UPI ID, for example lokanshpg@okhdfcbank.' };
    if (!payeeName.trim()) return { ok: false, message: 'Enter the name shown on the UPI account.' };
    try {
      await setDoc(
        doc(db, 'paymentSettings', propertyId),
        { propertyId, upiId: upiId.trim().toLowerCase(), payeeName: payeeName.trim(), updatedAt: Date.now() },
        { merge: true }
      );
      return { ok: true, message: 'UPI details saved.' };
    } catch (e: any) {
      warn('save upi settings:')(e);
      return { ok: false, message: 'Could not save. Please try again.' };
    }
  };

  const saveLateFee = async (rules: LateFeeRules): Promise<Result> => {
    if (!propertyId) return { ok: false, message: 'No property selected.' };
    if (rules.perDay < 0 || rules.cap < 0 || rules.graceDays < 0) return { ok: false, message: 'Amounts cannot be negative.' };
    try {
      await setDoc(
        doc(db, 'paymentSettings', propertyId),
        {
          propertyId,
          lateFeePerDay: Math.round(rules.perDay),
          lateFeeCap: Math.round(rules.cap),
          lateFeeGraceDays: Math.round(rules.graceDays),
          updatedAt: Date.now(),
        },
        { merge: true }
      );
      return { ok: true, message: 'Late fee saved.' };
    } catch (e: any) {
      warn('save late fee:')(e);
      return { ok: false, message: 'Could not save. Please try again.' };
    }
  };

  return { settings, lateFeeRules, loaded, save, saveLateFee };
}

// ───────── Resident side: my own submissions ─────────
export function useMyUpiPayments() {
  const { residentId } = useMockAuth();
  const { residents, rooms } = useAdmin();
  const db = getFirestore();
  const [rows, setRows] = useState<UpiPayment[]>([]);

  useEffect(() => {
    if (!residentId) {
      setRows([]);
      return;
    }
    return onSnapshot(
      query(collection(db, 'upiPayments'), where('residentId', '==', residentId)),
      (snap: any) => setRows(snap.docs.map((d: any) => ({ ...d.data(), id: d.id }))),
      (e: any) => console.warn('my upiPayments listener:', e?.code)
    );
  }, [residentId]);

  const payments = useMemo(() => [...rows].sort(sortNewest), [rows]);

  const submit = async (month: string, amount: number, upiRef: string, lateFee: number = 0): Promise<Result> => {
    const resident = residents.find((r) => r.id === residentId);
    if (!resident || !residentId) return { ok: false, message: 'Your resident profile is not loaded yet.' };
    if (!isValidUtr(upiRef)) return { ok: false, message: 'The UPI reference must be exactly 12 digits.' };
    if (!(amount > 0)) return { ok: false, message: 'There is no amount to pay.' };

    // One live submission per month: wait for the admin before sending another.
    const live = payments.find((p) => p.month === month && (p.status === 'Under Verification' || p.status === 'Verified'));
    if (live) {
      return {
        ok: false,
        message:
          live.status === 'Verified'
            ? `${month} rent is already confirmed.`
            : 'You already sent a payment for this month. Please wait while the admin verifies it.',
      };
    }

    const room = rooms.find((r) => r.id === resident.roomId);
    // The id contains the reference, so the same UPI reference can never be used twice
    // (a second attempt is refused by the database rules).
    const id = `${resident.propertyId}_${upiRef}`;
    const entry: UpiPayment = {
      id,
      residentId,
      propertyId: resident.propertyId,
      residentName: resident.name,
      ...(room ? { room: room.roomNumber } : {}),
      month,
      amount: Math.round(amount),
      ...(lateFee > 0 ? { lateFee: Math.round(lateFee) } : {}),
      upiRef,
      status: 'Under Verification',
      submittedAt: Date.now(),
    };
    try {
      await setDoc(doc(db, 'upiPayments', id), entry);
      return { ok: true, message: 'Sent for verification.' };
    } catch (e: any) {
      if (e?.code === 'firestore/permission-denied') {
        return { ok: false, message: 'This UPI reference was already used. Check the number in your UPI app.' };
      }
      warn('submit upi payment:')(e);
      return { ok: false, message: 'Could not send. Check your internet and try again.' };
    }
  };

  return { payments, submit };
}

// ───────── Admin side: every submission of the active property ─────────
export function useAdminUpiPayments() {
  const { activePropertyId, paymentRecords, recordRentPayment } = useAdmin();
  const db = getFirestore();
  const [rows, setRows] = useState<UpiPayment[]>([]);

  useEffect(() => {
    if (!activePropertyId) {
      setRows([]);
      return;
    }
    return onSnapshot(
      query(collection(db, 'upiPayments'), where('propertyId', '==', activePropertyId)),
      (snap: any) => setRows(snap.docs.map((d: any) => ({ ...d.data(), id: d.id }))),
      (e: any) => console.warn('admin upiPayments listener:', e?.code)
    );
  }, [activePropertyId]);

  const payments = useMemo(() => [...rows].sort(sortNewest), [rows]);
  const pending = useMemo(() => payments.filter((p) => p.status === 'Under Verification'), [payments]);

  /** Confirm: the month is marked Paid (method UPI, reference as transaction id) and the submission closes. */
  const confirm = async (p: UpiPayment): Promise<Result> => {
    const monthDate = monthLabelToDate(p.month);
    if (!monthDate) return { ok: false, message: 'The month on this payment could not be read.' };
    const alreadyPaid = paymentRecords.find(
      (r) => r.residentId === p.residentId && r.month === p.month && r.status === 'Paid'
    );
    if (alreadyPaid) {
      return {
        ok: false,
        message: `${p.month} is already marked Paid for ${p.residentName}. Reject this one as a duplicate.`,
      };
    }
    try {
      const record = recordRentPayment(p.residentId, 'UPI', 'admin', {
        transactionId: p.upiRef,
        lateFee: p.lateFee ?? 0, // exactly what the resident was asked to pay when they sent it
        forMonth: monthDate,
        paidAt: new Date(p.submittedAt),
      });
      await updateDoc(doc(db, 'upiPayments', p.id), {
        status: 'Verified',
        reviewedAt: Date.now(),
        reviewedBy: getAuth().currentUser?.uid ?? null,
        paymentRecordId: record.id,
      });
      return { ok: true, message: `${p.month} rent marked as paid.` };
    } catch (e: any) {
      warn('confirm upi payment:')(e);
      return { ok: false, message: 'Could not confirm. Please try again.' };
    }
  };

  const reject = async (p: UpiPayment, reason: string): Promise<Result> => {
    if (!reason.trim()) return { ok: false, message: 'Write a short reason so the resident knows what to fix.' };
    try {
      await updateDoc(doc(db, 'upiPayments', p.id), {
        status: 'Rejected',
        reviewedAt: Date.now(),
        reviewedBy: getAuth().currentUser?.uid ?? null,
        reviewNote: reason.trim(),
      });
      return { ok: true, message: 'Payment rejected.' };
    } catch (e: any) {
      warn('reject upi payment:')(e);
      return { ok: false, message: 'Could not reject. Please try again.' };
    }
  };

  return { payments, pending, confirm, reject };
}
