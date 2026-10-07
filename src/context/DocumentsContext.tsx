import React, { createContext, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import {
  getFirestore, collection, doc, onSnapshot, query, where, setDoc,
} from '@react-native-firebase/firestore';
import { residentDocuments as documentTemplates, ResidentDocument } from '../constants/mockData';
import { uploadImage } from '../utils/uploadImage';
import { useMockAuth } from './MockAuthContext';
import { useAdmin } from './AdminContext';

type DocumentsContextType = {
  documents: ResidentDocument[];
  uploadDocument: (id: string, fileUri: string) => void;
};

const DocumentsContext = createContext<DocumentsContextType | undefined>(undefined);

export function DocumentsProvider({ children }: { children: ReactNode }) {
  const { residentId } = useMockAuth();
  const { residents } = useAdmin();
  const db = getFirestore();
  const [saved, setSaved] = useState<Record<string, any>>({}); // keyed by document type id ("d1"...)
  const [localUris, setLocalUris] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!residentId) {
      setSaved({});
      return;
    }
    const q = query(collection(db, 'residentDocuments'), where('residentId', '==', residentId));
    return onSnapshot(
      q,
      (snap: any) => {
        const map: Record<string, any> = {};
        snap.docs.forEach((d: any) => (map[d.data().docTypeId] = d.data()));
        setSaved(map);
      },
      (e: any) => console.warn('documents listener:', e?.code)
    );
  }, [residentId]);

  // The list of document types stays fixed; each one shows its saved status from Firestore.
  const documents = useMemo<ResidentDocument[]>(
    () =>
      documentTemplates.map((t) => {
        const s = saved[t.id];
        return {
          ...t,
          status: s?.status ?? 'Pending',
          uploadedOn: s?.uploadedOn ?? null,
          fileUri: localUris[t.id] ?? s?.fileUri ?? null,
        };
      }),
    [saved, localUris]
  );

  const uploadDocument = (id: string, fileUri: string) => {
    if (!residentId) return;
    const template = documentTemplates.find((t) => t.id === id);
    const propertyId = residents.find((r) => r.id === residentId)?.propertyId ?? null;
    const uploadedOn = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    setLocalUris((prev) => ({ ...prev, [id]: fileUri })); // show it instantly
    uploadImage(fileUri, `documents/${residentId}/${id}-${Date.now()}`)
      .then((url) =>
        setDoc(doc(db, 'residentDocuments', `${residentId}_${id}`), {
          residentId,
          propertyId,
          docTypeId: id,
          name: template?.name ?? id,
          status: 'Uploaded',
          uploadedOn,
          fileUri: url,
        })
      )
      .catch((e: any) => console.warn('uploadDocument:', e?.code ?? e?.message))
      .finally(() =>
        setLocalUris((prev) => {
          const { [id]: _removed, ...rest } = prev;
          return rest;
        })
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
  if (!context) throw new Error('useDocuments must be used within a DocumentsProvider');
  return context;
}