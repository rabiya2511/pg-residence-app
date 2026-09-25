import React, { createContext, useContext, useState, ReactNode } from 'react';
import { residentDocuments as initialDocuments, ResidentDocument } from '../constants/mockData';

type DocumentsContextType = {
  documents: ResidentDocument[];
  uploadDocument: (id: string, fileUri: string) => void;
};

const DocumentsContext = createContext<DocumentsContextType | undefined>(undefined);

export function DocumentsProvider({ children }: { children: ReactNode }) {
  const [documents, setDocuments] = useState<ResidentDocument[]>(initialDocuments);

  const uploadDocument = (id: string, fileUri: string) => {
    setDocuments((prev) =>
      prev.map((doc) =>
        doc.id === id
          ? {
              ...doc,
              status: 'Uploaded',
              fileUri,
              uploadedOn: new Date().toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              }),
            }
          : doc
      )
    );
  };

  return (
    <DocumentsContext.Provider value={{ documents, uploadDocument }}>
      {children}
    </DocumentsContext.Provider>
  );
}

export function useDocuments() {
  const context = useContext(DocumentsContext);
  if (!context) {
    throw new Error('useDocuments must be used within a DocumentsProvider');
  }
  return context;
}