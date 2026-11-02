import React, { createContext, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import {
  getFirestore, collection, doc, onSnapshot, query, where, setDoc,
} from '@react-native-firebase/firestore';
import { residentDocuments as documentTemplates, ResidentDocument } from '../constants/mockData';
import { uploadImage } from '../utils/uploadImage';
import { uploadFile } from '../utils/uploadFile';
import { useMockAuth } from './MockAuthContext';
import { useAdmin } from './AdminContext';

type UploadResult = { ok: boolean; message?: string };

type DocumentsContextType = {
  documents: ResidentDocument[];
  /** Uploads (or replaces) one of the resident's own documents. Resolves once it is saved. */
  uploadDocument: (id: string, fileUri: string, mimeType?: string) => Promise<UploadResult>;
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

  const uploadDocument = async (id: string, fileUri: string, mimeType?: string): Promise<UploadResult> => {
    if (!residentId) return { ok: false, message: 'You are not signed in.' };
    const propertyId = residents.find((r) => r.id === residentId)?.propertyId;
    if (!propertyId) return { ok: false, message: 'Your resident record is still loading. Please try again in a moment.' };

    const template = documentTemplates.find((t) => t.id === id);
    const isPdf = (mimeType ?? '').includes('pdf') || /\.pdf$/i.test(fileUri);
    const uploadedOn = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const path = `documents/${residentId}/${id}-${Date.now()}${isPdf ? '.pdf' : ''}`;

    if (!isPdf) setLocalUris((prev) => ({ ...prev, [id]: fileUri })); // show a photo instantly
    try {
      const url = await Promise.race([
        isPdf ? uploadFile(fileUri, path, 'application/pdf') : uploadImage(fileUri, path),
        new Promise<never>((_, reject) => setTimeout(() => reject({ code: 'timeout' }), 60000)),
      ]);
      await setDoc(doc(db, 'residentDocuments', `${residentId}_${id}`), {
        residentId,
        propertyId,
        docTypeId: id,
        name: template?.name ?? id,
        status: 'Uploaded',
        uploadedOn,
        fileUri: url,
        mimeType: isPdf ? 'application/pdf' : 'image/jpeg',
      });
      return { ok: true };
    } catch (e: any) {
      console.warn('uploadDocument:', e?.code ?? e?.message);
      return {
        ok: false,
        message:
          e?.code === 'timeout'
            ? 'The upload is taking too long. Check your connection and try again.'
            : e?.code === 'storage/unauthorized' || e?.code === 'firestore/permission-denied'
            ? 'You are not allowed to upload this document. Please contact your PG admin.'
            : 'Could not upload the document. Check your connection and try again.',
      };
    } finally {
      setLocalUris((prev) => {
        const { [id]: _removed, ...rest } = prev;
        return rest;
      });
    }
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