import React, { createContext, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import {
  getFirestore, collection, doc, onSnapshot, query, where, setDoc, updateDoc,
} from '@react-native-firebase/firestore';
import { VisitorLog } from '../constants/mockData';
import { useAdmin } from './AdminContext';
import { useMockAuth } from './MockAuthContext';

type VisitorsContextType = {
  visitorLogs: VisitorLog[];
  addVisitor: (visitorName: string, purpose: string) => void;
  checkOutVisitor: (id: string) => void;
};
const VisitorsContext = createContext<VisitorsContextType | undefined>(undefined);

const timeNow = () => new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

// Must be mounted inside <AdminProvider> and <MockAuthProvider>.
export function VisitorsProvider({ children }: { children: ReactNode }) {
  const { residentId } = useMockAuth();
  const { residents } = useAdmin(); // in a resident session this is just their own record
  const db = getFirestore();
  const [rows, setRows] = useState<any[]>([]);

  // The logged-in resident's own visitor log, live.
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

  // Newest first.
  const visitorLogs = useMemo<VisitorLog[]>(
    () =>
      [...rows]
        .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
        .map((v) => ({
          id: v.id,
          visitorName: v.visitorName,
          purpose: v.purpose,
          checkInTime: v.checkInTime,
          checkOutTime: v.checkOutTime ?? null,
          date: v.date,
          status: v.status,
        })),
    [rows]
  );

  const addVisitor = (visitorName: string, purpose: string) => {
    const resident = residents.find((r) => r.id === residentId);
    if (!resident) return;

    const now = new Date();
    const id = doc(collection(db, 'visitors')).id;
    setDoc(doc(db, 'visitors', id), {
      id,
      residentId: resident.id,
      propertyId: resident.propertyId, // lets the PG owner see visitors too
      visitorName,
      purpose,
      checkInTime: timeNow(),
      checkOutTime: null,
      date: now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      status: 'Checked In',
      createdAt: Date.now(),
    }).catch((e: any) => console.warn('addVisitor:', e?.code));
  };

  const checkOutVisitor = (id: string) => {
    updateDoc(doc(db, 'visitors', id), {
      status: 'Checked Out',
      checkOutTime: timeNow(),
    }).catch((e: any) => console.warn('checkOutVisitor:', e?.code));
  };

  return (
    <VisitorsContext.Provider value={{ visitorLogs, addVisitor, checkOutVisitor }}>
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