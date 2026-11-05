import React, { createContext, useContext, useMemo, ReactNode } from 'react';
import { getFirestore, doc, updateDoc } from '@react-native-firebase/firestore';
import { Complaint } from '../constants/mockData';
import { useAdmin } from './AdminContext';
import { useMockAuth } from './MockAuthContext';

// A complaint as the resident sees it: the basics plus progress, the admin's reply and the rating.
export type ResidentComplaint = Complaint & {
  photos: string[];
  inProgressOn: string | null;
  resolvedOn: string | null;
  reopenedOn: string | null;
  adminComment: string | null;
  adminCommentOn: string | null;
  rating: number | null;
  feedback: string | null;
};

type ComplaintsContextType = {
  complaints: ResidentComplaint[];
  addComplaint: (category: string, description: string, photoUris?: string[], title?: string) => void;
  /** Sends a resolved complaint back to Open (the admin sees it as new again). */
  reopenComplaint: (id: string) => Promise<boolean>;
  /** Satisfaction rating (1 to 5) for a resolved complaint. */
  rateComplaint: (id: string, rating: number, feedback?: string) => Promise<boolean>;
};

const ComplaintsContext = createContext<ComplaintsContextType | undefined>(undefined);

const today = () =>
  new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

// Must be mounted inside <AdminProvider> and <MockAuthProvider>.
export function ComplaintsProvider({ children }: { children: ReactNode }) {
  const { residentId } = useMockAuth();
  const { residents, rooms, complaints: adminComplaints, addComplaint: addAdminComplaint } = useAdmin();
  const db = getFirestore();

  const addComplaint = (category: string, description: string, photoUris: string[] = [], title?: string) => {
    const resident = residents.find((r) => r.id === residentId);
    const room = rooms.find((r) => r.id === resident?.roomId);
    // Creates the complaint in Firestore (admin dashboard, Complaints tab, bell notification).
    addAdminComplaint({
      residentName: resident?.name ?? 'Resident',
      room: room?.roomNumber ?? '-',
      category,
      description,
      title,
      photoUris,
    });
  };

  const reopenComplaint = async (id: string) => {
    try {
      await updateDoc(doc(db, 'complaints', id), {
        status: 'Open',
        inProgressOn: null,
        resolvedOn: null,
        reopenedOn: today(),
        viewed: false,
      });
      return true;
    } catch (e: any) {
      console.warn('reopenComplaint:', e?.code ?? e?.message);
      return false;
    }
  };

  const rateComplaint = async (id: string, rating: number, feedback: string = '') => {
    try {
      await updateDoc(doc(db, 'complaints', id), {
        rating,
        feedback: feedback.trim() || null,
        ratedOn: today(),
      });
      return true;
    } catch (e: any) {
      console.warn('rateComplaint:', e?.code ?? e?.message);
      return false;
    }
  };

  // The resident's list is the same live data the admin works on, so the status
  // (Open -> In Progress -> Resolved) is always current.
  // Maintenance requests are also stored as complaints (prefixed "Maintenance:"),
  // but they belong on the Maintenance screen, so they are left out here.
  const complaints = useMemo<ResidentComplaint[]>(
    () =>
      adminComplaints
        .filter((c) => !residentId || c.residentId === residentId)
        .filter((c) => !c.category.startsWith('Maintenance:'))
        .map((c: any) => ({
          id: c.id,
          category: c.category,
          description: c.description,
          date: c.date,
          status: c.status,
          title: c.title ?? undefined,
          stage: c.stage ?? undefined,
          assignedTo: c.assignedTo ?? null,
          history: Array.isArray(c.history) ? c.history : [],
          photos: Array.isArray(c.photos) ? c.photos : [],
          inProgressOn: c.inProgressOn ?? null,
          resolvedOn: c.resolvedOn ?? null,
          reopenedOn: c.reopenedOn ?? null,
          adminComment: c.adminComment ?? null,
          adminCommentOn: c.adminCommentOn ?? null,
          rating: typeof c.rating === 'number' ? c.rating : null,
          feedback: c.feedback ?? null,
        })),
    [adminComplaints, residentId]
  );

  return (
    <ComplaintsContext.Provider value={{ complaints, addComplaint, reopenComplaint, rateComplaint }}>
      {children}
    </ComplaintsContext.Provider>
  );
}

export function useComplaints() {
  const context = useContext(ComplaintsContext);
  if (!context) throw new Error('useComplaints must be used within a ComplaintsProvider');
  return context;
}