import React, { createContext, useContext, useState, ReactNode } from 'react';
import { complaints as initialComplaints, Complaint } from '../constants/mockData';

type ComplaintsContextType = {
  complaints: Complaint[];
  addComplaint: (category: string, description: string) => void;
};

const ComplaintsContext = createContext<ComplaintsContextType | undefined>(undefined);

export function ComplaintsProvider({ children }: { children: ReactNode }) {
  const [complaints, setComplaints] = useState<Complaint[]>(initialComplaints);

  const addComplaint = (category: string, description: string) => {
    const newComplaint: Complaint = {
      id: `c${Date.now()}`,
      category,
      description,
      date: new Date().toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
      status: 'Open',
    };
    setComplaints((prev) => [newComplaint, ...prev]);
  };

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