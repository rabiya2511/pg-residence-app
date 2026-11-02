import { useEffect, useMemo, useRef, useState } from 'react';
import {
  getFirestore, collection, doc, onSnapshot, query, where, writeBatch,
} from '@react-native-firebase/firestore';
import { useAdmin } from '../context/AdminContext';
import { useMockAuth } from '../context/MockAuthContext';
import { uploadFile, deleteFile } from '../utils/uploadFile';

export const DOC_CATEGORIES = [
  'Rental Agreement',
  'Deposit Receipt',
  'PG Rules',
  'Checkout Clearance',
  'Final Settlement Statement',
  'Important Document',
] as const;

export type IssuedDocument = {
  id: string;
  groupId: string;           // copies sent together ("all residents") share one groupId
  scope: 'resident' | 'all';
  propertyId: string;
  residentId: string;
  residentName: string;
  category: string;
  title: string;
  fileUrl: string;
  fileName: string;
  mimeType: string;
  storagePath: string;
  expiryDate: string | null; // "12 Nov 2026"
  expiryTs: number | null;   // end of that day
  issuedOn: string;
  issuedAt: number;
};

export type DocStatus = { label: 'Valid' | 'Expiring soon' | 'Expired'; kind: 'ok' | 'warn' | 'bad' };

export function docStatus(expiryTs: number | null): DocStatus {
  if (!expiryTs) return { label: 'Valid', kind: 'ok' };
  const now = Date.now();
  if (expiryTs < now) return { label: 'Expired', kind: 'bad' };
  if (expiryTs - now <= 30 * 24 * 60 * 60 * 1000) return { label: 'Expiring soon', kind: 'warn' };
  return { label: 'Valid', kind: 'ok' };
}

const fmt = (d: Date) => d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

const toDoc = (d: any): IssuedDocument => ({
  id: d.id,
  groupId: d.groupId ?? d.id,
  scope: d.scope === 'all' ? 'all' : 'resident',
  propertyId: d.propertyId ?? '',
  residentId: d.residentId ?? '',
  residentName: d.residentName ?? '',
  category: d.category ?? 'Important Document',
  title: d.title ?? '',
  fileUrl: d.fileUrl ?? '',
  fileName: d.fileName ?? '',
  mimeType: d.mimeType ?? '',
  storagePath: d.storagePath ?? '',
  expiryDate: d.expiryDate ?? null,
  expiryTs: d.expiryTs ?? null,
  issuedOn: d.issuedOn ?? '',
  issuedAt: d.issuedAt ?? 0,
});

const byNewest = (a: IssuedDocument, b: IssuedDocument) => b.issuedAt - a.issuedAt;

// ───────────── Resident: documents issued to me ─────────────
export function useMyIssuedDocuments() {
  const { residentId } = useMockAuth();
  const db = getFirestore();
  const [rows, setRows] = useState<IssuedDocument[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLoaded(false);
    setRows([]);
    if (!residentId) {
      setLoaded(true);
      return;
    }
    return onSnapshot(
      query(collection(db, 'issuedDocuments'), where('residentId', '==', residentId)),
      (snap: any) => {
        setRows(snap.docs.map((d: any) => toDoc({ ...d.data(), id: d.id })));
        setLoaded(true);
      },
      (e: any) => {
        console.warn('issued documents listener:', e?.code);
        setLoaded(true);
      }
    );
  }, [residentId]);

  return { docs: useMemo(() => [...rows].sort(byNewest), [rows]), loaded };
}

// ───────────── Admin: documents of the active property ─────────────
export type DocGroup = { groupId: string; doc: IssuedDocument; count: number; docs: IssuedDocument[] };

export type IssueInput = {
  recipient: 'all' | string; // 'all' or one resident id
  category: string;
  title: string;
  fileUri: string;
  fileName: string;
  mimeType: string;
  expiry: Date | null;
};

export function useAdminIssuedDocuments() {
  const { activePropertyId, residents } = useAdmin();
  const db = getFirestore();
  const [rows, setRows] = useState<IssuedDocument[]>([]);
  const [loaded, setLoaded] = useState(false);
  const busyRef = useRef(false);

  useEffect(() => {
    setLoaded(false);
    setRows([]);
    if (!activePropertyId) {
      setLoaded(true);
      return;
    }
    return onSnapshot(
      query(collection(db, 'issuedDocuments'), where('propertyId', '==', activePropertyId)),
      (snap: any) => {
        setRows(snap.docs.map((d: any) => toDoc({ ...d.data(), id: d.id })));
        setLoaded(true);
      },
      (e: any) => {
        console.warn('admin issued documents listener:', e?.code);
        setLoaded(true);
      }
    );
  }, [activePropertyId]);

  const groups = useMemo<DocGroup[]>(() => {
    const map = new Map<string, DocGroup>();
    [...rows].sort(byNewest).forEach((d) => {
      const g = map.get(d.groupId);
      if (g) {
        g.count += 1;
        g.docs.push(d);
      } else {
        map.set(d.groupId, { groupId: d.groupId, doc: d, count: 1, docs: [d] });
      }
    });
    return Array.from(map.values());
  }, [rows]);

  const issue = async (input: IssueInput): Promise<{ ok: boolean; message?: string }> => {
    if (!activePropertyId) return { ok: false, message: 'No property selected.' };
    if (busyRef.current) return { ok: false, message: 'A document is already being sent. Please wait.' };

    const targets =
      input.recipient === 'all' ? residents : residents.filter((r) => r.id === input.recipient);
    if (targets.length === 0) return { ok: false, message: 'There is no resident to send this document to.' };

    busyRef.current = true;
    const safeName = input.fileName.replace(/[^\w.\-]/g, '_');
    const storagePath = `issuedDocuments/${activePropertyId}/${Date.now()}-${safeName}`;
    try {
      // One copy of the file in storage, however many residents receive it.
      const fileUrl = await Promise.race([
        uploadFile(input.fileUri, storagePath, input.mimeType || undefined),
        new Promise<never>((_, reject) => setTimeout(() => reject({ code: 'timeout' }), 60000)),
      ]);

      const now = Date.now();
      const expiryTs = input.expiry
        ? new Date(input.expiry.getFullYear(), input.expiry.getMonth(), input.expiry.getDate(), 23, 59, 59, 999).getTime()
        : null;
      const groupId = doc(collection(db, 'issuedDocuments')).id;
      const scope = input.recipient === 'all' ? 'all' : 'resident';

      try {
        for (let i = 0; i < targets.length; i += 400) {
          const batch = writeBatch(db);
          targets.slice(i, i + 400).forEach((r, idx) => {
            const id = i === 0 && idx === 0 ? groupId : doc(collection(db, 'issuedDocuments')).id;
            batch.set(doc(db, 'issuedDocuments', id), {
              id,
              groupId,
              scope,
              propertyId: activePropertyId,
              residentId: r.id,
              residentName: r.name ?? '',
              category: input.category,
              title: input.title.trim(),
              fileUrl,
              fileName: input.fileName,
              mimeType: input.mimeType,
              storagePath,
              expiryDate: input.expiry ? fmt(input.expiry) : null,
              expiryTs,
              issuedOn: fmt(new Date(now)),
              issuedAt: now,
            });
          });
          await batch.commit();
        }
      } catch (e) {
        deleteFile(storagePath); // nothing points to the file, so do not leave it behind
        throw e;
      }
      return { ok: true };
    } catch (e: any) {
      console.warn('issue document failed:', e?.code ?? e?.message);
      return {
        ok: false,
        message:
          e?.code === 'timeout'
            ? 'The upload is taking too long. Check your connection and try again.'
            : e?.code === 'firestore/permission-denied' || e?.code === 'storage/unauthorized'
            ? 'Not allowed. Publish the latest Firestore and Storage rules and try again.'
            : 'Could not send the document. Check your connection and try again.',
      };
    } finally {
      busyRef.current = false;
    }
  };

  // Removes every copy of a document (and its file).
  const remove = async (groupId: string): Promise<{ ok: boolean; message?: string }> => {
    const g = groups.find((x) => x.groupId === groupId);
    if (!g) return { ok: false, message: 'Document not found.' };
    try {
      for (let i = 0; i < g.docs.length; i += 400) {
        const batch = writeBatch(db);
        g.docs.slice(i, i + 400).forEach((d) => batch.delete(doc(db, 'issuedDocuments', d.id)));
        await batch.commit();
      }
      if (g.doc.storagePath) deleteFile(g.doc.storagePath);
      return { ok: true };
    } catch (e: any) {
      console.warn('remove document failed:', e?.code ?? e?.message);
      return { ok: false, message: 'Could not delete the document. Check your connection and try again.' };
    }
  };

  return { groups, loaded, issue, remove };
}