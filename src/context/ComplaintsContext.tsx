import React, { createContext, useContext, useMemo, useState, ReactNode } from 'react';
import { complaints as initialComplaints, Complaint } from '../constants/mockData';
import { useAdmin } from './AdminContext';
import { useMockAuth } from './MockAuthContext';

type ComplaintsContextType = {
  complaints: Complaint[];
  addComplaint: (category: string, description: string) => void;
};

const ComplaintsContext = createContext<ComplaintsContextType | undefined>(undefined);

// Must be mounted inside <AdminProvider> and <MockAuthProvider> (it already is in App.tsx).
export function ComplaintsProvider({ children }: { children: ReactNode }) {
  const { residentId } = useMockAuth();
  const {
    residents,
    rooms,
    complaints: adminComplaints,
    addComplaint: addAdminComplaint,
  } = useAdmin();

  const [localComplaints, setLocalComplaints] = useState<Complaint[]>(initialComplaints);

  const addComplaint = (category: string, description: string) => {
    // Who is raising it: the logged-in resident's name and room, so the admin
    // sees "Priya Patel · B-302" exactly like every other complaint.
    const resident = residents.find((r) => r.id === residentId);
    const room = rooms.find((r) => r.id === resident?.roomId);

    // Creates the complaint on the admin side (dashboard count, Complaints tab,
    // Open Complaints report and the bell notification) and returns its id.
    const sharedId = addAdminComplaint({
      residentName: resident?.name ?? 'Resident',
      room: room?.roomNumber ?? '-',
      category,
      description,
    });

    const newComplaint: Complaint = {
      id: sharedId,
      category,
      description,
      date: new Date().toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
      status: 'Open',
    };
    setLocalComplaints((prev) => [newComplaint, ...prev]);
  };

  // The resident's list always shows the admin's current status for a complaint
  // (Open -> In Progress -> Resolved), matched by the shared id.
  const complaints = useMemo(
    () =>
      localComplaints.map((c) => {
        const adminVersion = adminComplaints.find((a) => a.id === c.id);
        return adminVersion ? { ...c, status: adminVersion.status as Complaint['status'] } : c;
      }),
    [localComplaints, adminComplaints]
  );

  return (
    <ComplaintsContext.Provider value={{ complaints, addComplaint }}>
      {children}
    </ComplaintsContext.Provider>
  );
}

export function useComplaints() {
  const context = useContext(ComplaintsContext);
  if (!context) {
    throw new Error('useComplaints must be used within a ComplaintsProvider');
  }
  return context;
}