import React, { createContext, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import {
  getFirestore, collection, doc, onSnapshot, query, where, setDoc,
} from '@react-native-firebase/firestore';
import { MaintenanceRequest } from '../constants/mockData';
import { useMockAuth } from './MockAuthContext';
import { useAdmin } from './AdminContext';

type MaintenanceContextType = {
  maintenanceRequests: MaintenanceRequest[];
  addMaintenanceRequest: (category: string, description: string) => void;
};

const MaintenanceContext = createContext<MaintenanceContextType | undefined>(undefined);

export function MaintenanceProvider({ children }: { children: ReactNode }) {
  const { residentId } = useMockAuth();
  const { residents, rooms, complaints, addComplaint } = useAdmin();
  const db = getFirestore();
  const [rows, setRows] = useState<any[]>([]);

  // The logged-in resident's own requests, live.
  useEffect(() => {
    if (!residentId) {
      setRows([]);
      return;
    }
    const q = query(collection(db, 'maintenanceRequests'), where('residentId', '==', residentId));
    return onSnapshot(
      q,
      (snap: any) => setRows(snap.docs.map((d: any) => ({ ...d.data(), id: d.id }))),
      (e: any) => console.warn('maintenance listener:', e?.code)
    );
  }, [residentId]);

  // Each request is linked to its admin-side complaint, so the status the admin sets
  // (Open -> In Progress -> Resolved) shows up here automatically.
  const maintenanceRequests = useMemo<MaintenanceRequest[]>(
    () =>
      [...rows]
        .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
        .map((r) => ({
          id: r.id,
          category: r.category,
          description: r.description,
          date: r.date,
          status: complaints.find((c) => c.id === r.complaintId)?.status ?? r.status,
        })),
    [rows, complaints]
  );

  const addMaintenanceRequest = (category: string, description: string) => {
    const resident = residents.find((r) => r.id === residentId);
    if (!resident) return;
    const room = rooms.find((r) => r.id === resident.roomId);

    // Mirror into the admin Complaints system (dashboard count, bell, complaints list),
    // prefixed so the admin can tell it started as a maintenance request.
    const complaintId = addComplaint({
      residentName: resident.name,
      room: room?.roomNumber ?? '—',
      category: `Maintenance: ${category}`,
      description,
    });

    const id = doc(collection(db, 'maintenanceRequests')).id;
    setDoc(doc(db, 'maintenanceRequests', id), {
      id,
      residentId: resident.id,
      propertyId: resident.propertyId,
      complaintId,
      category,
      description,
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      status: 'Open',
      createdAt: Date.now(),
    }).catch((e: any) => console.warn('addMaintenanceRequest:', e?.code));
  };

  return (
    <MaintenanceContext.Provider value={{ maintenanceRequests, addMaintenanceRequest }}>
      {children}
    </MaintenanceContext.Provider>
  );
}

export function useMaintenance() {
  const context = useContext(MaintenanceContext);
  if (!context) throw new Error('useMaintenance must be used within a MaintenanceProvider');
  return context;
}