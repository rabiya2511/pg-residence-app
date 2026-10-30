import React, { createContext, useContext, useEffect, useMemo, useRef, useState, ReactNode } from 'react';
import {
  getFirestore, collection, doc, onSnapshot, query, where, setDoc, deleteDoc,
} from '@react-native-firebase/firestore';
import { Announcement } from '../constants/mockData';
import { useMockAuth } from './MockAuthContext';
import { useAdmin } from './AdminContext';

// A notice can optionally expire (epoch ms). Expired notices are hidden and the admin session removes them.
export type NoticeWithExpiry = Announcement & { expiresAt?: number };

type AnnouncementsContextType = {
  announcements: NoticeWithExpiry[];
  addAnnouncement: (
    announcement: Omit<Announcement, 'id' | 'date' | 'propertyId'>,
    options?: { autoClearAfterDays?: number }
  ) => void;
  deleteAnnouncement: (id: string) => void;
  clearAllAnnouncements: () => Promise<void>;
  pendingResidentNotice: Announcement | null;
  clearPendingResidentNotice: () => void;
};

const AnnouncementsContext = createContext<AnnouncementsContextType | undefined>(undefined);

const DAY_MS = 24 * 60 * 60 * 1000;

export function AnnouncementsProvider({ children }: { children: ReactNode }) {
  const { adminPropertyIds, residentId } = useMockAuth();
  const { residents } = useAdmin(); // resident session: contains just their own record
  const db = getFirestore();

  const [list, setList] = useState<NoticeWithExpiry[]>([]);
  const [now, setNow] = useState(Date.now());
  const [pendingResidentNotice, setPendingResidentNotice] = useState<Announcement | null>(null);
  const serverLoadedRef = useRef(false);

  // Re-check expiry every minute so an expired notice disappears while the app is open.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60 * 1000);
    return () => clearInterval(t);
  }, []);

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
        setList(rows as NoticeWithExpiry[]);

        // Admin session: permanently delete notices whose time is up.
        if (isAdmin && !snap.metadata.fromCache) {
          const t = Date.now();
          rows
            .filter((r: any) => r.expiresAt && r.expiresAt <= t)
            .forEach((r: any) =>
              deleteDoc(doc(db, 'announcements', r.id)).catch((e: any) =>
                console.warn('expire announcement:', e?.code)
              )
            );
        }

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

  // Hide expired notices from everyone.
  const activeList = useMemo(
    () => list.filter((n) => !n.expiresAt || n.expiresAt > now),
    [list, now]
  );

  const addAnnouncement = (
    announcement: Omit<Announcement, 'id' | 'date' | 'propertyId'>,
    options?: { autoClearAfterDays?: number }
  ) => {
    const propertyId = adminPropertyIds?.[0];
    if (!propertyId) return; // only an admin session can send a notice

    const id = doc(collection(db, 'announcements')).id;
    const newAnnouncement: Announcement = {
      ...announcement,
      id,
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      propertyId,
    };
    const createdAt = Date.now();
    const payload: any = { ...newAnnouncement, createdAt };
    if (options?.autoClearAfterDays) payload.expiresAt = createdAt + options.autoClearAfterDays * DAY_MS;

    setDoc(doc(db, 'announcements', id), payload).catch((e: any) =>
      console.warn('addAnnouncement:', e?.code)
    );
    setPendingResidentNotice(newAnnouncement); // drives the admin-side delivery popup
  };

  const deleteAnnouncement = (id: string) => {
    if (!isAdmin) return;
    deleteDoc(doc(db, 'announcements', id)).catch((e: any) => console.warn('deleteAnnouncement:', e?.code));
  };

  const clearAllAnnouncements = async () => {
    if (!isAdmin) return;
    await Promise.all(
      list.map((n) =>
        deleteDoc(doc(db, 'announcements', n.id)).catch((e: any) => console.warn('clearAll:', e?.code))
      )
    );
  };

  return (
    <AnnouncementsContext.Provider
      value={{
        announcements: activeList,
        addAnnouncement,
        deleteAnnouncement,
        clearAllAnnouncements,
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