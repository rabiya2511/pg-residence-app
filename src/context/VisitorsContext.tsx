import React, { createContext, useContext, useState, ReactNode } from 'react';
import { visitorLogs as initialVisitorLogs, VisitorLog } from '../constants/mockData';

type VisitorsContextType = {
  visitorLogs: VisitorLog[];
  addVisitor: (visitorName: string, purpose: string) => void;
  checkOutVisitor: (id: string) => void;
};
const VisitorsContext = createContext<VisitorsContextType | undefined>(undefined);

export function VisitorsProvider({ children }: { children: ReactNode }) {
  const [visitorLogs, setVisitorLogs] = useState<VisitorLog[]>(initialVisitorLogs);

  const addVisitor = (visitorName: string, purpose: string) => {
    const now = new Date();
    const newVisitor: VisitorLog = {
      id: `v${Date.now()}`,
      visitorName,
      purpose,
      checkInTime: now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
      checkOutTime: null,
      date: now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      status: 'Checked In',
    };
    setVisitorLogs((prev) => [newVisitor, ...prev]);
  };

    const checkOutVisitor = (id: string) => {
    setVisitorLogs((prev) =>
      prev.map((visitor) =>
        visitor.id === id
          ? {
              ...visitor,
              status: 'Checked Out',
              checkOutTime: new Date().toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
              }),
            }
          : visitor
      )
    );
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