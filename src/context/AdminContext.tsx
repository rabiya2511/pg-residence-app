import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import {
  adminResidents as initialResidents,
  adminComplaints as initialComplaints,
  adminIdentityDocuments as initialIdentityDocuments,
  adminDailyGuests as initialDailyGuests,
  adminPaymentHistory as initialPaymentRecords,
  properties as initialProperties,
  initialRooms,
  MONTHLY_RENT_BY_CAPACITY,
  DAILY_GUEST_RATE,
  getEmergencyVacateDeductionPercent,
  formatPropertyAddress,
  AdminResident,
  AdminComplaint,
  AdminIdentityDocument,
  AdminDailyGuest,
  AdminDailyGuestPaymentMethod,
  AdminPaymentRecord,
  PaymentTiming,
  Property,
  PropertyAddress,
  Room,
  RoomAssignmentRecord,
  AdminGender,
} from '../constants/mockData';
import { useMockAuth } from './MockAuthContext';
export type AdminPaymentNotification = {
  id: string;
  residentId: string;
  residentName: string;
  amount: number;
  month: string;
  paidOn: string;
  method: string;
  read: boolean;
  createdAt: number;
  type?: 'Rent' | 'Day Guest';
};

export type AdminVacateNotification = {
  id: string;
  residentId: string;
  residentName: string;
  vacatingDate: string;
  isEmergency: boolean;
  deductionPercent: number | null;
  reason: string | null;
  read: boolean;
  createdAt: number;
};

// Fired every time a complaint is created (including maintenance requests,
// which are mirrored into complaints via addComplaint) — this is what feeds
// the admin bell icon so complaints/maintenance show up there too, not just
// payment and vacate notices.
export type AdminComplaintNotification = {
  id: string;
  complaintId: string;
  residentName: string;
  room: string;
  category: string;
  description: string;
  read: boolean;
  createdAt: number;
};

type BookMonthlyResidentInput = {
  name: string;
  phone: string;
  email: string;
  gender: AdminGender;
  propertyId: string;
  roomId: string;
  method: string;
  joiningDate: Date;
  securityDeposit: number;
};

type BookDayGuestInput = {
  name: string;
  phone: string;
  email: string;
  gender: AdminGender;
  propertyId: string;
  roomId: string;
  numDays: number;
  method: string;
  joiningDate: Date;
};

// Details that can be supplied when creating a new property.
// (Moved to module level so the context interface AND the implementation
// share the exact same type — this fixes the ts(2322) error.)
export type NewPropertyDetails = {
  addressDetails?: PropertyAddress;
  floors?: number;
  branchManager?: string;
  contactPhone?: string;
  standardRent?: number;
  googleReviewLink?: string;
  houseGuidelines?: string;
  logoUri?: string | null;
  upiId?: string | null;
  whatsappGroupLink?: string | null;
};

// Fields that can be changed on an existing property.
export type PropertyDetailsUpdates = {
  name?: string;
  addressDetails?: PropertyAddress;
  floors?: number;
  branchManager?: string;
  contactPhone?: string;
  standardRent?: number;
  googleReviewLink?: string;
  houseGuidelines?: string;
  logoUri?: string | null;
  upiId?: string | null;
  whatsappGroupLink?: string | null;
};

// A resident who has been soft-deleted ("archived"). Their data is kept so they
// can be restored if they come back later.
export type ArchivedResident = AdminResident & {
  archivedOn: string;
  archivedReason: string | null;
};

// Optional changes when bringing an archived resident back.
export type RestoreResidentInput = {
  propertyId?: string;
  roomId?: string;
  joiningDate?: string; // "dd MMM yyyy"
  monthlyRent?: number;
};

type AdminContextType = {
  residents: AdminResident[];
  complaints: AdminComplaint[];
  identityDocuments: AdminIdentityDocument[];
  dailyGuests: AdminDailyGuest[];
  paymentRecords: AdminPaymentRecord[];
  paymentNotifications: AdminPaymentNotification[];
  vacateNotifications: AdminVacateNotification[];
  complaintNotifications: AdminComplaintNotification[];
  properties: Property[];
  publicProperties: Property[];
  rooms: Room[];
  archivedResidents: ArchivedResident[];
  markRentPaid: (residentId: string) => void;
  recordRentPayment: (residentId: string, method: string, source?: 'resident' | 'admin') => AdminPaymentRecord;
  markNotificationRead: (notificationId: string) => void;
  markAllNotificationsRead: () => void;
  markVacateNotificationRead: (notificationId: string) => void;
  markAllVacateNotificationsRead: () => void;
  markComplaintNotificationRead: (notificationId: string) => void;
  markAllComplaintNotificationsRead: () => void;
  updateComplaintStatus: (complaintId: string, status: AdminComplaint['status']) => void;
  markComplaintViewed: (complaintId: string) => void;
  /**
   * Creates a new Open complaint directly on the admin-side Complaints
   * system, and fires a matching AdminComplaintNotification for the bell
   * icon. Used by MaintenanceContext so a resident's maintenance request
   * also shows up in the dashboard complaint count, notification bell, and
   * complaints list, exactly like a regular complaint — and used for
   * regular resident-submitted complaints too, so both flow through one
   * notification path.
   */
  addComplaint: (input: { residentName: string; room: string; category: string; description: string }) => void;
  addResident: (resident: Omit<AdminResident, 'id'>) => AdminResident;
  updateResident: (residentId: string, updates: Partial<AdminResident>) => void;
  deleteResident: (residentId: string) => void;
  /** Soft delete: moves the resident out of the active list and frees their bed, but keeps all their data. */
  archiveResident: (residentId: string, reason?: string | null) => void;
  /** Brings an archived resident back as an active resident (fails if the room is full). */
  restoreResident: (residentId: string, input?: RestoreResidentInput) => { ok: boolean; message?: string };
  /** Permanent delete: removes the resident (active or archived) and their documents, payments and notifications. */
  permanentlyDeleteResident: (residentId: string) => void;
  submitVacateNotice: (
    residentId: string,
    vacatingDate: string | null,
    isEmergency?: boolean,
    reason?: string | null
  ) => void;
  setIdentityDocumentUri: (residentId: string, side: 'front' | 'back', uri: string) => void;
  clearIdentityDocumentUri: (residentId: string, side: 'front' | 'back') => void;
  addDailyGuest: (guest: Omit<AdminDailyGuest, 'id'>) => AdminDailyGuest;
  recordDailyGuestPayment: (
    guestId: string,
    amount: number,
    method: AdminDailyGuestPaymentMethod
  ) => void;
  addProperty: (name: string, details?: NewPropertyDetails) => Property;
  updatePropertyDetails: (propertyId: string, updates: PropertyDetailsUpdates) => void;
  addPropertyImages: (propertyId: string, uris: string[]) => void;
  removePropertyImage: (propertyId: string, uri: string) => void;
  addRoom: (propertyId: string, floor: number, roomNumber: string, capacity: number) => Room;
  updateRoom: (roomId: string, updates: Partial<Room>) => void;
  /**
   * Auto-generates `totalRooms` rooms for a brand-new property, distributed
   * evenly across `floors`, each with `defaultCapacity` beds.
   */
  generateRoomsForProperty: (
    propertyId: string,
    floors: number,
    totalRooms: number,
    defaultCapacity?: number
  ) => void;
  bookMonthlyResident: (input: BookMonthlyResidentInput) => AdminResident;
  bookDayGuestSelf: (input: BookDayGuestInput) => AdminDailyGuest;
  /**
   * Records a resident moving to a different room. Closes out their current
   * room assignment in roomHistory (dated today) and opens a new one. If
   * this resident has never had a tracked transfer before, their original
   * room (since joiningDate) is backfilled as the first closed entry, so
   * "previous stay" always has something real to show the first time they
   * move.
   */
  transferResidentRoom: (residentId: string, newPropertyId: string, newRoomId: string) => void;
};

const AdminContext = createContext<AdminContextType | undefined>(undefined);

function getMonthLabel(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function getDueDateForMonth(date: Date, dueDay: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), dueDay);
}

function formatDisplayDate(date: Date): string {
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

// Parses "25 Sep 2026" (dd MMM yyyy — matches formatDisplayDate output)
function parseDisplayDate(str: string): Date | null {
  const MONTHS_3 = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const m = str.match(/^(\d{1,2})\s+([A-Za-z]{3})[A-Za-z]*\s+(\d{4})$/);
  if (!m) return null;
  const monthIdx = MONTHS_3.findIndex((mo) => mo.toLowerCase() === m[2].toLowerCase());
  if (monthIdx === -1) return null;
  return new Date(Number(m[3]), monthIdx, Number(m[1]));
}

// Whether a day guest's stay currently occupies their room — checked in
// already, and either no vacating date yet or that date hasn't passed.
// Used by room-occupancy screens to count active guests alongside residents.
export function isDailyGuestActiveNow(guest: AdminDailyGuest): boolean {
  const now = Date.now();

  if (now < guest.checkInTimestamp) return false; // upcoming, not checked in yet

  if (!guest.vacatingDate) return true; // no end date recorded — treat as still active

  const vacateDateObj = parseDisplayDate(guest.vacatingDate);
  if (!vacateDateObj) return true; // unparseable date — fail open rather than hide an active guest

  // Active through the end of their vacating day, not just up to midnight.
  const endOfVacateDay = new Date(
    vacateDateObj.getFullYear(),
    vacateDateObj.getMonth(),
    vacateDateObj.getDate(),
    23, 59, 59, 999
  ).getTime();

  return now <= endOfVacateDay;
}

export function AdminProvider({ children }: { children: ReactNode }) {
  const { adminPropertyIds, addPropertyToCurrentAdmin, mainAdminPropertyIds } = useMockAuth();

  const [residents, setResidents] = useState<AdminResident[]>(initialResidents);
  const [complaints, setComplaints] = useState<AdminComplaint[]>(initialComplaints);
  const [identityDocuments, setIdentityDocuments] = useState<AdminIdentityDocument[]>(
    initialIdentityDocuments
  );

  const [dailyGuests, setDailyGuests] = useState<AdminDailyGuest[]>(initialDailyGuests);
  const [paymentRecords, setPaymentRecords] = useState<AdminPaymentRecord[]>(initialPaymentRecords);
  const [paymentNotifications, setPaymentNotifications] = useState<AdminPaymentNotification[]>([]);
  const [vacateNotifications, setVacateNotifications] = useState<AdminVacateNotification[]>([]);
  const [complaintNotifications, setComplaintNotifications] = useState<AdminComplaintNotification[]>([]);
  const [properties, setProperties] = useState<Property[]>(initialProperties);
  const [rooms, setRooms] = useState<Room[]>(initialRooms);
  const [archivedResidents, setArchivedResidents] = useState<ArchivedResident[]>([]);

  useEffect(() => {
    const now = new Date();
    const currentMonthLabel = getMonthLabel(now);

    setPaymentRecords((prev) => {
      const missing = residents.filter(
        (r) => !prev.some((p) => p.residentId === r.id && p.month === currentMonthLabel)
      );
      if (missing.length === 0) return prev;

      const newRecords: AdminPaymentRecord[] = missing.map((r) => {
        const dueDateObj = getDueDateForMonth(now, r.rentDueDay);
        return {
          id: `pr_${r.id}_${currentMonthLabel.replace(/\s/g, '_')}`,
          residentId: r.id,
          month: currentMonthLabel,
          amount: r.monthlyRent,
          dueDate: formatDisplayDate(dueDateObj),
          paidOn: null,
          status: now.getTime() > dueDateObj.getTime() ? 'Overdue' : 'Pending',
        };
      });

      return [...newRecords, ...prev];
    });
  }, [residents]);

  useEffect(() => {
    if (!adminPropertyIds) return;
    setProperties((prev) => {
      const missingIds = adminPropertyIds.filter((id) => !prev.some((p) => p.id === id));
      if (missingIds.length === 0) return prev;
      const emptyAddress: PropertyAddress = { streetNo: '', landmark: '', city: '', pinCode: '' };
      const newProperties: Property[] = missingIds.map((id) => ({
        id,
        name: 'New PG',
        address: '',
        addressDetails: emptyAddress,
        images: [],
      }));
      return [...prev, ...newProperties];
    });
  }, [adminPropertyIds]);

  const markRentPaid = (residentId: string) => {
    recordRentPayment(residentId, 'Cash');
  };

  const recordRentPayment = (
    residentId: string,
    method: string,
    source: 'resident' | 'admin' = 'admin'
  ): AdminPaymentRecord => {
    const now = new Date();
    const currentMonthLabel = getMonthLabel(now);
    const resident = residents.find((r) => r.id === residentId);
    const dueDateObj = getDueDateForMonth(now, resident?.rentDueDay ?? 5);
    const paidOnStr = formatDisplayDate(now);

    const timing: PaymentTiming =
      now.getTime() < dueDateObj.getTime()
        ? 'Early'
        : now.toDateString() === dueDateObj.toDateString()
        ? 'On Time'
        : 'Late';

    const existing = paymentRecords.find(
      (p) => p.residentId === residentId && p.month === currentMonthLabel
    );

    const record: AdminPaymentRecord = existing
      ? { ...existing, paidOn: paidOnStr, status: 'Paid', timing, method, transactionId: `TXN${Date.now()}` }
      : {
          id: `pr_${residentId}_${Date.now()}`,
          residentId,
          month: currentMonthLabel,
          amount: resident?.monthlyRent ?? 0,
          dueDate: formatDisplayDate(dueDateObj),
          paidOn: paidOnStr,
          status: 'Paid',
          timing,
          method,
          transactionId: `TXN${Date.now()}`,
        };

    setPaymentRecords((prev) => {
      const idx = prev.findIndex((p) => p.id === record.id);
      if (idx === -1) return [record, ...prev];
      const copy = [...prev];
      copy[idx] = record;
      return copy;
    });

    setResidents((prev) =>
      prev.map((r) => (r.id === residentId ? { ...r, rentStatus: 'Paid' } : r))
    );

    if (source === 'resident' && resident) {
      const notification: AdminPaymentNotification = {
        id: `pn_${residentId}_${Date.now()}`,
        residentId,
        residentName: resident.name,
        amount: record.amount,
        month: record.month,
        paidOn: paidOnStr,
        method,
        read: false,
        createdAt: Date.now(),
        type: 'Rent',
      };
      setPaymentNotifications((prev) => [notification, ...prev]);
    }

    return record;
  };

  const markNotificationRead = (notificationId: string) => {
    setPaymentNotifications((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
    );
  };

  const markAllNotificationsRead = () => {
    setPaymentNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const markVacateNotificationRead = (notificationId: string) => {
    setVacateNotifications((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
    );
  };

  const markAllVacateNotificationsRead = () => {
    setVacateNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const markComplaintNotificationRead = (notificationId: string) => {
    setComplaintNotifications((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
    );
  };

  const markAllComplaintNotificationsRead = () => {
    setComplaintNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const updateComplaintStatus = (complaintId: string, status: AdminComplaint['status']) => {
    setComplaints((prev) =>
      prev.map((c) => (c.id === complaintId ? { ...c, status } : c))
    );
  };

  const markComplaintViewed = (complaintId: string) => {
    setComplaints((prev) =>
      prev.map((c) => (c.id === complaintId ? { ...c, viewed: true } : c))
    );
  };

  const addComplaint = (input: { residentName: string; room: string; category: string; description: string }) => {
    const newComplaint: AdminComplaint = {
      id: `c${Date.now()}`,
      residentName: input.residentName,
      room: input.room,
      category: input.category,
      description: input.description,
      date: formatDisplayDate(new Date()),
      status: 'Open',
      viewed: false,
    };
    setComplaints((prev) => [newComplaint, ...prev]);

    const notification: AdminComplaintNotification = {
      id: `cn_${newComplaint.id}`,
      complaintId: newComplaint.id,
      residentName: input.residentName,
      room: input.room,
      category: input.category,
      description: input.description,
      read: false,
      createdAt: Date.now(),
    };
    setComplaintNotifications((prev) => [notification, ...prev]);
  };

  const addResident = (resident: Omit<AdminResident, 'id'>): AdminResident => {
    const newResident: AdminResident = {
      ...resident,
      id: `r${Date.now()}`,
    };
    setResidents((prev) => [newResident, ...prev]);
    setIdentityDocuments((prev) => [...prev, { residentId: newResident.id, frontUri: null, backUri: null }]);
    return newResident;
  };

  const updateResident = (residentId: string, updates: Partial<AdminResident>) => {
    setResidents((prev) =>
      prev.map((r) => (r.id === residentId ? { ...r, ...updates } : r))
    );
  };
  const deleteResident = (residentId: string) => {
    setResidents((prev) => prev.filter((r) => r.id !== residentId));
  };

  const archiveResident = (residentId: string, reason: string | null = null) => {
    const resident = residents.find((r) => r.id === residentId);
    if (!resident) return;

    const today = formatDisplayDate(new Date());
    // Close any open room stay so the history stays accurate.
    const closedHistory = resident.roomHistory?.map((h) => (h.toDate === null ? { ...h, toDate: today } : h));

    const archived: ArchivedResident = {
      ...resident,
      ...(closedHistory ? { roomHistory: closedHistory } : {}),
      archivedOn: today,
      archivedReason: reason,
    };

    setArchivedResidents((prev) => [archived, ...prev]);
    setResidents((prev) => prev.filter((r) => r.id !== residentId));
  };

  const restoreResident = (
    residentId: string,
    input: RestoreResidentInput = {}
  ): { ok: boolean; message?: string } => {
    const archived = archivedResidents.find((r) => r.id === residentId);
    if (!archived) return { ok: false, message: 'Resident not found in the archive.' };

    const targetPropertyId = input.propertyId ?? archived.propertyId;
    const targetRoomId = input.roomId ?? archived.roomId;
    const room = rooms.find((r) => r.id === targetRoomId);
    if (!room) return { ok: false, message: 'That room no longer exists. Please choose another room.' };

    const occupants =
      residents.filter((r) => r.roomId === targetRoomId).length +
      dailyGuests.filter((g) => g.roomId === targetRoomId && isDailyGuestActiveNow(g)).length;
    if (occupants >= room.capacity) {
      return { ok: false, message: 'That room is full now. Please choose a room with a free bed.' };
    }

    const today = formatDisplayDate(new Date());
    const joiningDate = input.joiningDate ?? today;
    const { archivedOn, archivedReason, ...rest } = archived;

    // Keep the earlier stay in the room history and open a new one.
    const previousHistory: RoomAssignmentRecord[] =
      archived.roomHistory && archived.roomHistory.length > 0
        ? archived.roomHistory
        : [
            {
              id: `rh_${residentId}_orig`,
              propertyId: archived.propertyId,
              roomId: archived.roomId,
              fromDate: archived.joiningDate,
              toDate: archivedOn,
            },
          ];
    const newEntry: RoomAssignmentRecord = {
      id: `rh_${residentId}_${Date.now()}`,
      propertyId: targetPropertyId,
      roomId: targetRoomId,
      fromDate: joiningDate,
      toDate: null,
    };

    const restored: AdminResident = {
      ...rest,
      propertyId: targetPropertyId,
      roomId: targetRoomId,
      joiningDate,
      monthlyRent: input.monthlyRent ?? archived.monthlyRent,
      rentStatus: 'Pending',
      vacatingDate: null,
      vacateReason: null,
      emergencyVacateDeductionPercent: null,
      roomHistory: [...previousHistory, newEntry],
    };

    setResidents((prev) => [restored, ...prev]);
    setArchivedResidents((prev) => prev.filter((r) => r.id !== residentId));
    setIdentityDocuments((prev) =>
      prev.some((d) => d.residentId === residentId)
        ? prev
        : [...prev, { residentId, frontUri: null, backUri: null }]
    );
    return { ok: true };
  };

  const permanentlyDeleteResident = (residentId: string) => {
    setResidents((prev) => prev.filter((r) => r.id !== residentId));
    setArchivedResidents((prev) => prev.filter((r) => r.id !== residentId));
    setIdentityDocuments((prev) => prev.filter((d) => d.residentId !== residentId));
    setPaymentRecords((prev) => prev.filter((p) => p.residentId !== residentId));
    setPaymentNotifications((prev) => prev.filter((n) => n.residentId !== residentId));
    setVacateNotifications((prev) => prev.filter((n) => n.residentId !== residentId));
  };

  const submitVacateNotice = (
    residentId: string,
    vacatingDate: string | null,
    isEmergency: boolean = false,
    reason: string | null = null
  ) => {
    const resident = residents.find((r) => r.id === residentId);

    let deductionPercent: number | null = null;
    if (vacatingDate && isEmergency) {
      const vacateDateObj = parseDisplayDate(vacatingDate);
      if (vacateDateObj) {
        const now = new Date();
        const daysNotice = Math.floor((vacateDateObj.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        deductionPercent = getEmergencyVacateDeductionPercent(Math.max(0, daysNotice));
      }
    }

    setResidents((prev) =>
      prev.map((r) =>
        r.id === residentId
          ? {
              ...r,
              vacatingDate,
              vacateReason: vacatingDate ? reason : null,
              emergencyVacateDeductionPercent: vacatingDate ? deductionPercent : null,
            }
          : r
      )
    );

    if (vacatingDate && resident) {
      const notification: AdminVacateNotification = {
        id: `vn_${residentId}_${Date.now()}`,
        residentId,
        residentName: resident.name,
        vacatingDate,
        isEmergency,
        deductionPercent,
        reason,
        read: false,
        createdAt: Date.now(),
      };
      setVacateNotifications((prev) => [notification, ...prev]);
    }
  };

  const setIdentityDocumentUri = (residentId: string, side: 'front' | 'back', uri: string) => {
    setIdentityDocuments((prev) =>
      prev.map((d) =>
        d.residentId === residentId
          ? { ...d, [side === 'front' ? 'frontUri' : 'backUri']: uri }
          : d
      )
    );
  };

  const clearIdentityDocumentUri = (residentId: string, side: 'front' | 'back') => {
    setIdentityDocuments((prev) =>
      prev.map((d) =>
        d.residentId === residentId
          ? { ...d, [side === 'front' ? 'frontUri' : 'backUri']: null }
          : d
      )
    );
  };

  const addDailyGuest = (guest: Omit<AdminDailyGuest, 'id'>): AdminDailyGuest => {
    const newGuest: AdminDailyGuest = {
      ...guest,
      id: `dg${Date.now()}`,
    };
    setDailyGuests((prev) => [newGuest, ...prev]);
    return newGuest;
  };

  const recordDailyGuestPayment = (
    guestId: string,
    amount: number,
    method: AdminDailyGuestPaymentMethod
  ) => {
    setDailyGuests((prev) =>
      prev.map((g) => {
        if (g.id !== guestId || amount <= 0) return g;
        const newAdvance = Math.min(g.totalAmount, (g.advanceAmount ?? 0) + amount);
        const isFullyPaid = newAdvance >= g.totalAmount;
        return {
          ...g,
          advanceAmount: newAdvance,
          paymentMethod: method,
          paymentStatus: isFullyPaid ? 'Paid' : 'Pending',
        };
      })
    );
  };

  const addProperty = (name: string, details: NewPropertyDetails = {}): Property => {
    const addressDetails = details.addressDetails ?? { streetNo: '', landmark: '', city: '', pinCode: '' };
    const newProperty: Property = {
      id: `prop${Date.now()}`,
      name,
      address: formatPropertyAddress(addressDetails),
      addressDetails,
      images: [],
      floors: details.floors,
      branchManager: details.branchManager,
      contactPhone: details.contactPhone,
      standardRent: details.standardRent,
      googleReviewLink: details.googleReviewLink,
      houseGuidelines: details.houseGuidelines,
      logoUri: details.logoUri ?? null,
      upiId: details.upiId ?? null,
      whatsappGroupLink: details.whatsappGroupLink ?? null,
    };
    setProperties((prev) => [...prev, newProperty]);
    addPropertyToCurrentAdmin(newProperty.id);
    return newProperty;
  };

  const updatePropertyDetails = (propertyId: string, updates: PropertyDetailsUpdates) => {
    setProperties((prev) =>
      prev.map((p) =>
        p.id === propertyId
          ? {
              ...p,
              ...(updates.name !== undefined ? { name: updates.name } : {}),
              ...(updates.addressDetails
                ? { addressDetails: updates.addressDetails, address: formatPropertyAddress(updates.addressDetails) }
                : {}),
              ...(updates.floors !== undefined ? { floors: updates.floors } : {}),
              ...(updates.branchManager !== undefined ? { branchManager: updates.branchManager } : {}),
              ...(updates.contactPhone !== undefined ? { contactPhone: updates.contactPhone } : {}),
              ...(updates.standardRent !== undefined ? { standardRent: updates.standardRent } : {}),
              ...(updates.googleReviewLink !== undefined ? { googleReviewLink: updates.googleReviewLink } : {}),
              ...(updates.houseGuidelines !== undefined ? { houseGuidelines: updates.houseGuidelines } : {}),
              ...(updates.logoUri !== undefined ? { logoUri: updates.logoUri } : {}),
              ...(updates.upiId !== undefined ? { upiId: updates.upiId } : {}),
              ...(updates.whatsappGroupLink !== undefined ? { whatsappGroupLink: updates.whatsappGroupLink } : {}),
            }
          : p
      )
    );
  };

  const addPropertyImages = (propertyId: string, uris: string[]) => {
    setProperties((prev) =>
      prev.map((p) => (p.id === propertyId ? { ...p, images: [...p.images, ...uris] } : p))
    );
  };

  const removePropertyImage = (propertyId: string, uri: string) => {
    setProperties((prev) =>
      prev.map((p) =>
        p.id === propertyId ? { ...p, images: p.images.filter((img) => img !== uri) } : p
      )
    );
  };

  const addRoom = (propertyId: string, floor: number, roomNumber: string, capacity: number): Room => {
    const newRoom: Room = {
      id: `${propertyId}-${roomNumber}-${Date.now()}`,
      propertyId,
      floor,
      roomNumber,
      capacity,
    };
    setRooms((prev) => [...prev, newRoom]);
    return newRoom;
  };

  const updateRoom = (roomId: string, updates: Partial<Room>) => {
    setRooms((prev) => prev.map((r) => (r.id === roomId ? { ...r, ...updates } : r)));
  };

  /**
   * Auto-generates `totalRooms` rooms for a brand-new property, distributed
   * evenly across `floors` (1..floors), each with `defaultCapacity` beds
   * (e.g. 2 = "2 Sharing"). Room numbers follow a {floor}{01, 02, ...}
   * pattern (Floor 1 → 101, 102...; Floor 2 → 201, 202...). Admin can still
   * add/edit individual rooms afterward via the existing Add/Edit Room screen.
   */
  const generateRoomsForProperty = (
    propertyId: string,
    floors: number,
    totalRooms: number,
    defaultCapacity: number = 2
  ) => {
    if (floors <= 0 || totalRooms <= 0) return;

    const roomsPerFloor = Math.ceil(totalRooms / floors);
    const newRooms: Room[] = [];
    let remaining = totalRooms;

    for (let floor = 1; floor <= floors && remaining > 0; floor++) {
      const countThisFloor = Math.min(roomsPerFloor, remaining);
      for (let i = 1; i <= countThisFloor; i++) {
        const roomNumber = `${floor}${String(i).padStart(2, '0')}`;
        newRooms.push({
          id: `${propertyId}-${roomNumber}-${Date.now()}-${floor}-${i}`,
          propertyId,
          floor,
          roomNumber,
          capacity: defaultCapacity,
        });
        remaining--;
      }
    }

    setRooms((prev) => [...prev, ...newRooms]);
  };

  const bookMonthlyResident = (input: BookMonthlyResidentInput): AdminResident => {
    const room = rooms.find((r) => r.id === input.roomId);
    const monthlyRent = room ? MONTHLY_RENT_BY_CAPACITY[room.capacity] ?? 8500 : 8500;

    const newResident = addResident({
      name: input.name,
      phone: input.phone,
      email: input.email,
      gender: input.gender,
      propertyId: input.propertyId,
      roomId: input.roomId,
      joiningDate: formatDisplayDate(input.joiningDate),
      monthlyRent,
      rentDueDay: 5,
      rentStatus: 'Pending',
      vacatingDate: null,
      securityDeposit: input.securityDeposit,
      vacateReason: null,
      emergencyVacateDeductionPercent: null,
    });

    recordRentPayment(newResident.id, input.method, 'resident');

    return newResident;
  };

  const bookDayGuestSelf = (input: BookDayGuestInput): AdminDailyGuest => {
    const totalAmount = input.numDays * DAILY_GUEST_RATE;
    const vacatingDateObj = new Date(
      input.joiningDate.getFullYear(),
      input.joiningDate.getMonth(),
      input.joiningDate.getDate() + input.numDays
    );

    const newGuest = addDailyGuest({
      name: input.name,
      phone: input.phone,
      email: input.email,
      gender: input.gender,
      propertyId: input.propertyId,
      roomId: input.roomId,
      checkInDate: formatDisplayDate(input.joiningDate),
      checkInTimestamp: input.joiningDate.getTime(),
      vacatingDate: formatDisplayDate(vacatingDateObj),
      numDays: input.numDays,
      totalAmount,
      identityFrontUri: null,
      identityBackUri: null,
      advanceAmount: totalAmount,
      paymentStatus: 'Paid',
      paymentMethod: input.method as AdminDailyGuestPaymentMethod,
    });

    const notification: AdminPaymentNotification = {
      id: `pn_${newGuest.id}_${Date.now()}`,
      residentId: newGuest.id,
      residentName: newGuest.name,
      amount: totalAmount,
      month: `${input.numDays} day stay`,
      paidOn: formatDisplayDate(new Date()),
      method: input.method,
      read: false,
      createdAt: Date.now(),
      type: 'Day Guest',
    };
    setPaymentNotifications((prev) => [notification, ...prev]);

    return newGuest;
  };

  const transferResidentRoom = (residentId: string, newPropertyId: string, newRoomId: string) => {
    const resident = residents.find((r) => r.id === residentId);
    if (!resident || resident.roomId === newRoomId) return;

    const today = formatDisplayDate(new Date());
    const existingHistory = resident.roomHistory ?? [];

    const historyWithClosedCurrent: RoomAssignmentRecord[] =
      existingHistory.length > 0
        ? existingHistory.map((h) => (h.toDate === null ? { ...h, toDate: today } : h))
        : [
            {
              id: `rh_${residentId}_orig`,
              propertyId: resident.propertyId,
              roomId: resident.roomId,
              fromDate: resident.joiningDate,
              toDate: today,
            },
          ];

    const newEntry: RoomAssignmentRecord = {
      id: `rh_${residentId}_${Date.now()}`,
      propertyId: newPropertyId,
      roomId: newRoomId,
      fromDate: today,
      toDate: null,
    };

    setResidents((prev) =>
      prev.map((r) =>
        r.id === residentId
          ? {
              ...r,
              propertyId: newPropertyId,
              roomId: newRoomId,
              roomHistory: [...historyWithClosedCurrent, newEntry],
            }
          : r
      )
    );
  };

  const scopedResidents = useMemo(
    () =>
      adminPropertyIds
        ? residents.filter((r) => adminPropertyIds.includes(r.propertyId))
        : residents,
    [residents, adminPropertyIds]
  );

  const scopedResidentIds = useMemo(
    () => new Set(scopedResidents.map((r) => r.id)),
    [scopedResidents]
  );

  const scopedResidentNames = useMemo(
    () => new Set(scopedResidents.map((r) => r.name)),
    [scopedResidents]
  );

  const scopedDailyGuests = useMemo(
    () =>
      adminPropertyIds
        ? dailyGuests.filter((g) => adminPropertyIds.includes(g.propertyId))
        : dailyGuests,
    [dailyGuests, adminPropertyIds]
  );

  const scopedArchivedResidents = useMemo(
    () =>
      adminPropertyIds
        ? archivedResidents.filter((r) => adminPropertyIds.includes(r.propertyId))
        : archivedResidents,
    [archivedResidents, adminPropertyIds]
  );

  const archivedIdSet = useMemo(() => new Set(archivedResidents.map((r) => r.id)), [archivedResidents]);
  const scopedArchivedIdSet = useMemo(
    () => new Set(scopedArchivedResidents.map((r) => r.id)),
    [scopedArchivedResidents]
  );

  // Archived residents keep their PAID history (so past revenue is not lost),
  // but their unpaid records are hidden so they don't count as dues.
  const scopedPaymentRecords = useMemo(() => {
    const visible = paymentRecords.filter(
      (p) => !archivedIdSet.has(p.residentId) || p.status === 'Paid'
    );
    if (!adminPropertyIds) return visible;
    return visible.filter(
      (p) => scopedResidentIds.has(p.residentId) || scopedArchivedIdSet.has(p.residentId)
    );
  }, [paymentRecords, adminPropertyIds, scopedResidentIds, archivedIdSet, scopedArchivedIdSet]);

  const scopedIdentityDocuments = useMemo(
    () =>
      adminPropertyIds
        ? identityDocuments.filter((d) => scopedResidentIds.has(d.residentId))
        : identityDocuments,
    [identityDocuments, adminPropertyIds, scopedResidentIds]
  );

  const scopedPaymentNotifications = useMemo(
    () =>
      adminPropertyIds
        ? paymentNotifications.filter((n) => scopedResidentIds.has(n.residentId))
        : paymentNotifications,
    [paymentNotifications, adminPropertyIds, scopedResidentIds]
  );

  const scopedVacateNotifications = useMemo(
    () =>
      adminPropertyIds
        ? vacateNotifications.filter((n) => scopedResidentIds.has(n.residentId))
        : vacateNotifications,
    [vacateNotifications, adminPropertyIds, scopedResidentIds]
  );

  // AdminComplaintNotification has no residentId field (same shape as
  // AdminComplaint) — scoped by matching name against this property's
  // residents, same caveat as scopedComplaints below.
  const scopedComplaintNotifications = useMemo(
    () =>
      adminPropertyIds
        ? complaintNotifications.filter((n) => scopedResidentNames.has(n.residentName))
        : complaintNotifications,
    [complaintNotifications, adminPropertyIds, scopedResidentNames]
  );

  const scopedComplaints = useMemo(
    () =>
      adminPropertyIds
        ? complaints.filter((c) => scopedResidentNames.has(c.residentName))
        : complaints,
    [complaints, adminPropertyIds, scopedResidentNames]
  );

  const scopedProperties = useMemo(
    () =>
      adminPropertyIds
        ? properties.filter((p) => adminPropertyIds.includes(p.id))
        : properties,
    [properties, adminPropertyIds]
  );

  const publicProperties = useMemo(
    () => properties.filter((p) => mainAdminPropertyIds.includes(p.id)),
    [properties, mainAdminPropertyIds]
  );

  const scopedRooms = useMemo(
    () =>
      adminPropertyIds
        ? rooms.filter((r) => adminPropertyIds.includes(r.propertyId))
        : rooms,
    [rooms, adminPropertyIds]
  );

  return (
    <AdminContext.Provider
      value={{
        residents: scopedResidents,
        complaints: scopedComplaints,
        identityDocuments: scopedIdentityDocuments,
        dailyGuests: scopedDailyGuests,
        paymentRecords: scopedPaymentRecords,
        paymentNotifications: scopedPaymentNotifications,
        vacateNotifications: scopedVacateNotifications,
        complaintNotifications: scopedComplaintNotifications,
        properties: scopedProperties,
        publicProperties,
        rooms: scopedRooms,
        archivedResidents: scopedArchivedResidents,
        markRentPaid,
        recordRentPayment,
        markNotificationRead,
        markAllNotificationsRead,
        markVacateNotificationRead,
        markAllVacateNotificationsRead,
        markComplaintNotificationRead,
        markAllComplaintNotificationsRead,
        updateComplaintStatus,
        markComplaintViewed,
        addComplaint,
        addResident,
        updateResident,
        deleteResident,
        archiveResident,
        restoreResident,
        permanentlyDeleteResident,
        submitVacateNotice,
        setIdentityDocumentUri,
        clearIdentityDocumentUri,
        addDailyGuest,
        recordDailyGuestPayment,
        addProperty,
        updatePropertyDetails,
        addPropertyImages,
        removePropertyImage,
        addRoom,
        updateRoom,
        generateRoomsForProperty,
        bookMonthlyResident,
        bookDayGuestSelf,
        transferResidentRoom,
      }}
    >
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin() {
  const context = useContext(AdminContext);
  if (!context) {
    throw new Error('useAdmin must be used within an AdminProvider');
  }
  return context;
}