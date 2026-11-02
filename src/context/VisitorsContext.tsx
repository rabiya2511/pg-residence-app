import React, { createContext, useContext, useEffect, useMemo, useRef, useState, ReactNode } from 'react';
import {
  getFirestore, collection, doc, onSnapshot, query, where, setDoc, updateDoc,
} from '@react-native-firebase/firestore';
import { useAdmin } from './AdminContext';
import { useMockAuth } from './MockAuthContext';

export type VisitorStatus =
  | 'Pending'
  | 'Approved'
  | 'Rejected'
  | 'Cancelled'
  | 'Checked In'
  | 'Checked Out';

export type VisitorRequest = {
  id: string;
  visitorName: string;
  visitorPhone: string;
  relationship: string;
  purpose: string;
  numVisitors: number;
  expectedDate: string;      // "05 Nov 2026"
  expectedDateTs: number;    // midnight of that day, for duplicate checks
  expectedArrival: string;   // "6:30 PM"
  expectedDeparture: string; // "" when not given
  instructions: string;
  status: VisitorStatus;
  rejectReason: string | null;
  checkInTime: string | null;
  checkOutTime: string | null;
  createdAt: number;
};

export type NewVisitorInput = {
  visitorName: string;
  visitorPhone: string;
  relationship: string;
  purpose: string;
  numVisitors: number;
  expectedDate: string;
  expectedDateTs: number;
  expectedArrival: string;
  expectedDeparture: string;
  instructions: string;
};

type VisitorsContextType = {
  visitorLogs: VisitorRequest[];
  addVisitorRequest: (input: NewVisitorInput) => Promise<{ ok: boolean; message?: string }>;
  /** A resident can cancel a request that is still Pending or Approved (nobody has entered yet). */
  cancelVisitor: (id: string) => Promise<{ ok: boolean; message?: string }>;
};

const VisitorsContext = createContext<VisitorsContextType | undefined>(undefined);

// Must be mounted inside <AdminProvider> and <MockAuthProvider>.
export function VisitorsProvider({ children }: { children: ReactNode }) {
  const { residentId } = useMockAuth();
  const { residents, rooms } = useAdmin(); // in a resident session this is just their own record
  const db = getFirestore();
  const [rows, setRows] = useState<any[]>([]);
  const savingRef = useRef(false);

  // The logged-in resident's own visitor requests, live.
  useEffect(() => {
    if (!residentId) {
      setRows([]);
      return;
    }
    return onSnapshot(
      query(collection(db, 'visitors'), where('residentId', '==', residentId)),
      (snap: any) => setRows(snap.docs.map((d: any) => ({ ...d.data(), id: d.id }))),
      (e: any) => console.warn('visitors listener:', e?.code)
    );
  }, [residentId]);

  // Newest first. Older records (made before approvals existed) still show up.
  const visitorLogs = useMemo<VisitorRequest[]>(
    () =>
      [...rows]
        .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
        .map((v) => ({
          id: v.id,
          visitorName: v.visitorName ?? '',
          visitorPhone: v.visitorPhone ?? '',
          relationship: v.relationship ?? '',
          purpose: v.purpose ?? '',
          numVisitors: v.numVisitors ?? 1,
          expectedDate: v.expectedDate ?? v.date ?? '',
          expectedDateTs: v.expectedDateTs ?? 0,
          expectedArrival: v.expectedArrival ?? v.checkInTime ?? '',
          expectedDeparture: v.expectedDeparture ?? '',
          instructions: v.instructions ?? '',
          status: (v.status ?? 'Pending') as VisitorStatus,
          rejectReason: v.rejectReason ?? null,
          checkInTime: v.checkInTime ?? null,
          checkOutTime: v.checkOutTime ?? null,
          createdAt: v.createdAt ?? 0,
        })),
    [rows]
  );

  const addVisitorRequest = async (input: NewVisitorInput): Promise<{ ok: boolean; message?: string }> => {
    const resident = residents.find((r) => r.id === residentId);
    if (!resident) {
      return { ok: false, message: 'Your resident record is still loading. Please try again in a moment.' };
    }
    if (savingRef.current) {
      return { ok: false, message: 'Your request is already being sent. Please wait.' };
    }
    const name = input.visitorName.trim().toLowerCase();
    const duplicate = rows.some(
      (v) =>
        (v.status === 'Pending' || v.status === 'Approved') &&
        (v.visitorName ?? '').trim().toLowerCase() === name &&
        v.expectedDateTs === input.expectedDateTs
    );
    if (duplicate) {
      return { ok: false, message: `You already have an active request for ${input.visitorName.trim()} on that date.` };
    }

    savingRef.current = true;
    try {
      const id = doc(collection(db, 'visitors')).id;
      const room = rooms.find((r) => r.id === resident.roomId);
      await Promise.race([
        setDoc(doc(db, 'visitors', id), {
          id,
          residentId: resident.id,
          residentName: resident.name ?? '',
          room: room?.roomNumber ?? '',
          propertyId: resident.propertyId, // lets the PG owner see and approve it
          visitorName: input.visitorName.trim(),
          visitorPhone: input.visitorPhone,
          relationship: input.relationship,
          purpose: input.purpose.trim(),
          numVisitors: input.numVisitors,
          expectedDate: input.expectedDate,
          expectedDateTs: input.expectedDateTs,
          expectedArrival: input.expectedArrival,
          expectedDeparture: input.expectedDeparture,
          instructions: input.instructions.trim(),
          status: 'Pending',
          rejectReason: null,
          checkInTime: null,
          checkOutTime: null,
          createdAt: Date.now(),
        }),
        // If the phone is offline the write is queued and never answers, so don't wait forever.
        new Promise((resolve) => setTimeout(resolve, 10000)),
      ]);
      return { ok: true };
    } catch (e: any) {
      console.warn('addVisitorRequest:', e?.code ?? e?.message);
      return {
        ok: false,
        message:
          e?.code === 'firestore/permission-denied'
            ? 'You are not allowed to send this request. Please contact your PG admin.'
            : 'Could not send the request. Check your connection and try again.',
      };
    } finally {
      savingRef.current = false;
    }
  };

  const cancelVisitor = async (id: string): Promise<{ ok: boolean; message?: string }> => {
    const current = rows.find((v) => v.id === id);
    if (!current || (current.status !== 'Pending' && current.status !== 'Approved')) {
      return { ok: false, message: 'This request can no longer be cancelled.' };
    }
    try {
      await updateDoc(doc(db, 'visitors', id), { status: 'Cancelled', cancelledAt: Date.now() });
      return { ok: true };
    } catch (e: any) {
      console.warn('cancelVisitor:', e?.code ?? e?.message);
      return { ok: false, message: 'Could not cancel the request. Please try again.' };
    }
  };

  return (
    <VisitorsContext.Provider value={{ visitorLogs, addVisitorRequest, cancelVisitor }}>
      {children}
    </VisitorsContext.Provider>
  );
}

export function useVisitors() {
  const context = useContext(VisitorsContext);
  if (!context) {
    throw new Error('useVisitors must be used within a VisitorsProvider');
  }
  return context;
}