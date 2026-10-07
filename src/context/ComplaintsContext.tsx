import React, { createContext, useContext, useMemo, ReactNode } from 'react';
import { Complaint } from '../constants/mockData';
import { useAdmin } from './AdminContext';
import { useMockAuth } from './MockAuthContext';

type ComplaintsContextType = {
  complaints: Complaint[];
  addComplaint: (category: string, description: string) => void;
};

const ComplaintsContext = createContext<ComplaintsContextType | undefined>(undefined);

// Must be mounted inside <AdminProvider> and <MockAuthProvider>.
export function ComplaintsProvider({ children }: { children: ReactNode }) {
  const { residentId } = useMockAuth();
  const { residents, rooms, complaints: adminComplaints, addComplaint: addAdminComplaint } = useAdmin();

  const addComplaint = (category: string, description: string) => {
    const resident = residents.find((r) => r.id === residentId);
    const room = rooms.find((r) => r.id === resident?.roomId);
    // Creates the complaint in Firestore (admin dashboard, Complaints tab, bell notification).
    addAdminComplaint({
      residentName: resident?.name ?? 'Resident',
      room: room?.roomNumber ?? '-',
      category,
      description,
      residentId: resident?.id ?? '',
      propertyId: resident?.propertyId ?? '',
    });
  };

  // The resident's list is the same live data the admin works on, so the status
  // (Open -> In Progress -> Resolved) is always current.
  // Maintenance requests are also stored as complaints (prefixed "Maintenance:"),
  // but they belong on the Maintenance screen, so they are left out here.
  const complaints = useMemo<Complaint[]>(
    () =>
      adminComplaints
        .filter((c) => !residentId || c.residentId === residentId)
        .filter((c) => !c.category.startsWith('Maintenance:'))
        .map((c) => ({
          id: c.id,
          category: c.category,
          description: c.description,
          date: c.date,
          status: c.status,
        })),
    [adminComplaints, residentId]
  );

  return (
    <ComplaintsContext.Provider value={{ complaints, addComplaint }}>
      {children}
    </ComplaintsContext.Provider>
  );
}

export function useComplaints() {
  const context = useContext(ComplaintsContext);
  if (!context) throw new Error('useComplaints must be used within a ComplaintsProvider');
  return context;
}