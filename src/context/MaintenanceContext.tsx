import React, { createContext, useContext, useState, ReactNode } from 'react';
import { maintenanceRequests as initialMaintenanceRequests, MaintenanceRequest } from '../constants/mockData';
import { useMockAuth } from './MockAuthContext';
import { useAdmin } from './AdminContext';

type MaintenanceContextType = {
  maintenanceRequests: MaintenanceRequest[];
  addMaintenanceRequest: (category: string, description: string) => void;
};

const MaintenanceContext = createContext<MaintenanceContextType | undefined>(undefined);

export function MaintenanceProvider({ children }: { children: ReactNode }) {
  const [maintenanceRequests, setMaintenanceRequests] = useState<MaintenanceRequest[]>(
    initialMaintenanceRequests
  );
  const { residentId } = useMockAuth();
  const { residents, rooms, addComplaint } = useAdmin();

  const addMaintenanceRequest = (category: string, description: string) => {
    const newRequest: MaintenanceRequest = {
      id: `m${Date.now()}`,
      category,
      description,
      date: new Date().toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
      status: 'Open',
    };
    setMaintenanceRequests((prev) => [newRequest, ...prev]);

    // Mirror this into the admin-side Complaints system so it shows up in
    // the dashboard count, notification bell, and complaints list exactly
    // like a regular complaint — prefixed so admin can still tell it
    // originated as a maintenance request.
    const resident = residents.find((r) => r.id === residentId);
    if (resident) {
      const room = rooms.find((r) => r.id === resident.roomId);
      addComplaint({
        residentName: resident.name,
        room: room?.roomNumber ?? '—',
        category: `Maintenance: ${category}`,
        description,
      });
    }
  };

  return (
    <MaintenanceContext.Provider value={{ maintenanceRequests, addMaintenanceRequest }}>
      {children}
    </MaintenanceContext.Provider>
  );
}

export function useMaintenance() {
  const context = useContext(MaintenanceContext);
  if (!context) {
    throw new Error('useMaintenance must be used within a MaintenanceProvider');
  }
  return context;
}