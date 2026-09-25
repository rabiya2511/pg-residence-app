import React, { createContext, useContext, useState, ReactNode } from 'react';
import { maintenanceRequests as initialMaintenanceRequests, MaintenanceRequest } from '../constants/mockData';

type MaintenanceContextType = {
  maintenanceRequests: MaintenanceRequest[];
  addMaintenanceRequest: (category: string, description: string) => void;
};

const MaintenanceContext = createContext<MaintenanceContextType | undefined>(undefined);

export function MaintenanceProvider({ children }: { children: ReactNode }) {
  const [maintenanceRequests, setMaintenanceRequests] = useState<MaintenanceRequest[]>(
    initialMaintenanceRequests
  );

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