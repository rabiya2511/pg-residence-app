import React, { createContext, useContext, useEffect, useMemo, useRef, useState, ReactNode } from 'react';
import {
  getFirestore, collection, doc, onSnapshot, query, where, setDoc,
} from '@react-native-firebase/firestore';
import { Announcement } from '../constants/mockData';
import { useMockAuth } from './MockAuthContext';
import { useAdmin } from './AdminContext';

type AnnouncementsContextType = {
  announcements: Announcement[];
  addAnnouncement: (announcement: Omit<Announcement, 'id' | 'date' | 'propertyId'>) => void;
  pendingResidentNotice: Announcement | null;
  clearPendingResidentNotice: () => void;
};

const AnnouncementsContext = createContext<AnnouncementsContextType | undefined>(undefined);

export function AnnouncementsProvider({ children }: { children: ReactNode }) {
  const { adminPropertyIds, residentId } = useMockAuth();
  const { residents } = useAdmin(); // resident session: contains just their own record
  const db = getFirestore();

  const [list, setList] = useState<Announcement[]>([]);
  const [pendingResidentNotice, setPendingResidentNotice] = useState<Announcement | null>(null);
  const serverLoadedRef = useRef(false);

  // Admin: their properties. Resident: the property their record belongs to.
  const ownPropertyId = residents.find((r) => r.id === residentId)?.propertyId ?? null;
  const visibleIds = useMemo(
    () => adminPropertyIds ?? (ownPropertyId ? [ownPropertyId] : []),
    [adminPropertyIds, ownPropertyId]
  );
  const key = visibleIds.join(',');
  const isAdmin = !!adminPropertyIds;

  useEffect(() => {
    serverLoadedRef.current = false;
    if (visibleIds.length === 0) {
      setList([]);
      return;
    }
    const q = query(collection(db, 'announcements'), where('propertyId', 'in', visibleIds.slice(0, 30)));
    return onSnapshot(
      q,
      (snap: any) => {
        const rows = snap.docs.map((d: any) => ({ ...d.data(), id: d.id }));
        rows.sort((a: any, b: any) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
        setList(rows as Announcement[]);

        // A resident with the app open gets the "New Notice" popup when a notice arrives live.
        if (!isAdmin && serverLoadedRef.current && !snap.metadata.fromCache) {
          const added = snap.docChanges().filter((c: any) => c.type === 'added');
          if (added.length > 0) {
            const last = added[added.length - 1].doc;
            setPendingResidentNotice({ ...last.data(), id: last.id } as Announcement);
          }
        }
        if (!snap.metadata.fromCache) serverLoadedRef.current = true;
      },
      (e: any) => console.warn('announcements listener:', e?.code)
    );
  }, [key, isAdmin]);

  const addAnnouncement = (announcement: Omit<Announcement, 'id' | 'date' | 'propertyId'>) => {
    const propertyId = adminPropertyIds?.[0];
    if (!propertyId) return; // only an admin session can send a notice

    const id = doc(collection(db, 'announcements')).id;
    const newAnnouncement: Announcement = {
      ...announcement,
      id,
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      propertyId,
    };
    setDoc(doc(db, 'announcements', id), { ...newAnnouncement, createdAt: Date.now() }).catch((e: any) =>
      console.warn('addAnnouncement:', e?.code)
    );
    setPendingResidentNotice(newAnnouncement); // drives the admin-side delivery popup
  };

  return (
    <AnnouncementsContext.Provider
      value={{
        announcements: list,
        addAnnouncement,
        pendingResidentNotice,
        clearPendingResidentNotice: () => setPendingResidentNotice(null),
      }}
    >
      {children}
    </AnnouncementsContext.Provider>
  );
}

export function useAnnouncements() {
  const context = useContext(AnnouncementsContext);
  if (!context) throw new Error('useAnnouncements must be used within an AnnouncementsProvider');
  return context;
}