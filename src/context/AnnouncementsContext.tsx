import React, { createContext, useContext, useState, useMemo, ReactNode } from 'react';
import { announcements as initialAnnouncements, Announcement } from '../constants/mockData';
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
  // useAdmin()'s residents list is scoped by adminPropertyIds when an admin
  // is logged in, and passed through unscoped when it's null (resident
  // session) — so this lookup works correctly for both roles.
  const { residents } = useAdmin();

  const [announcementsList, setAnnouncementsList] = useState<Announcement[]>(initialAnnouncements);
  const [pendingResidentNotice, setPendingResidentNotice] = useState<Announcement | null>(null);

  // Which property's notices this session should see:
  // - Admin: their own property/properties
  // - Resident: whichever property their own resident record belongs to
  const visiblePropertyIds = useMemo(() => {
    if (adminPropertyIds) return adminPropertyIds;
    if (residentId) {
      const resident = residents.find((r) => r.id === residentId);
      return resident ? [resident.propertyId] : [];
    }
    return null;
  }, [adminPropertyIds, residentId, residents]);

  const scopedAnnouncements = useMemo(
    () =>
      visiblePropertyIds
        ? announcementsList.filter((a) => visiblePropertyIds.includes(a.propertyId))
        : announcementsList,
    [announcementsList, visiblePropertyIds]
  );

  const addAnnouncement = (announcement: Omit<Announcement, 'id' | 'date' | 'propertyId'>) => {
    const propertyId = adminPropertyIds?.[0];
    if (!propertyId) return; // only an admin session can send a notice

    const newAnnouncement: Announcement = {
      ...announcement,
      id: `a${Date.now()}`,
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      propertyId,
    };
    setAnnouncementsList((prev) => [newAnnouncement, ...prev]);
    setPendingResidentNotice(newAnnouncement);
  };

  const clearPendingResidentNotice = () => setPendingResidentNotice(null);

  return (
    <AnnouncementsContext.Provider
      value={{ announcements: scopedAnnouncements, addAnnouncement, pendingResidentNotice, clearPendingResidentNotice }}
    >
      {children}
    </AnnouncementsContext.Provider>
  );
}

export function useAnnouncements() {
  const context = useContext(AnnouncementsContext);
  if (!context) {
    throw new Error('useAnnouncements must be used within an AnnouncementsProvider');
  }
  return context;
}