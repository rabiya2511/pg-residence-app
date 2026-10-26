import React, { createContext, useContext, useState, useEffect, useMemo, useRef, ReactNode } from 'react';
import { Alert, AppState } from 'react-native';
import { getAuth } from '@react-native-firebase/auth';
import {
  getFirestore, collection, doc, onSnapshot, query, where, setDoc, updateDoc, writeBatch, getDocs,
} from '@react-native-firebase/firestore';
import {
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
import { uploadImage } from '../utils/uploadImage';
import { useMockAuth } from './MockAuthContext';
import { useActivePropertyId, setActivePropertyId } from './activeProperty';

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
  reminder?: boolean;   // true for the "vacating soon" reminders
  daysLeft?: number;    // 2, 1 or 0
  message?: string;     // ready-to-show text for reminders
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

// Input accepted by addComplaint. residentId / propertyId are optional so older
// callers (e.g. MaintenanceContext) keep working; when omitted they are looked up.
export type AddComplaintInput = {
  residentName: string;
  room: string;
  category: string;
  description: string;
  residentId?: string;
  propertyId?: string;
  // Local photo URIs (camera / gallery). Uploaded to Storage after the complaint is saved.
  photoUris?: string[];
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

// Optional details when recording a rent payment (e.g. at registration, where the
// resident is not in the list yet and the amount / reference come from the form).
export type RecordRentPaymentOptions = {
  amount?: number;
  transactionId?: string;
  dueDay?: number;
  propertyId?: string;
  residentName?: string;
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
  /** The branch the admin is currently working in. Every list below is for this property only. */
  activePropertyId: string | null;
  activeProperty: Property | undefined;
  setActiveProperty: (propertyId: string) => void;
  rooms: Room[];
  archivedResidents: ArchivedResident[];
  markRentPaid: (residentId: string) => void;
  /** Sets (or clears, with 0) a deduction on THIS resident's rent for the current month. Pending shows rent minus deduction. */
  setRentDeduction: (residentId: string, amount: number, reason?: string) => void;
  recordRentPayment: (
    residentId: string,
    method: string,
    source?: 'resident' | 'admin',
    options?: RecordRentPaymentOptions
  ) => AdminPaymentRecord;
  markNotificationRead: (notificationId: string) => void;
  markAllNotificationsRead: () => void;
  markVacateNotificationRead: (notificationId: string) => void;
  markAllVacateNotificationsRead: () => void;
  markComplaintNotificationRead: (notificationId: string) => void;
  markAllComplaintNotificationsRead: () => void;
  updateComplaintStatus: (complaintId: string, status: AdminComplaint['status']) => void;
  markComplaintViewed: (complaintId: string) => void;
  /** Permanently deletes complaints of the active property ('resolved' = only resolved ones). Returns how many were removed. */
  clearComplaints: (mode: 'resolved' | 'all') => Promise<{ ok: boolean; count: number; message?: string }>;
  /** Hides every payment received so far from the Monthly Revenue screen. Rent records, dues and guest records are kept. */
  clearRevenueData: () => Promise<{ ok: boolean; count: number; message?: string }>;
  /** Brings back everything hidden by clearRevenueData. */
  restoreRevenueData: () => Promise<{ ok: boolean; count: number; message?: string }>;
  /**
   * Creates a new Open complaint directly on the admin-side Complaints
   * system, and fires a matching AdminComplaintNotification for the bell
   * icon. Used by MaintenanceContext so a resident's maintenance request
   * also shows up in the dashboard complaint count, notification bell, and
   * complaints list, exactly like a regular complaint — and used for
   * regular resident-submitted complaints too, so both flow through one
   * notification path.
   */
  addComplaint: (input: AddComplaintInput) => string;
  addResident: (resident: Omit<AdminResident, 'id'>) => AdminResident;
  /**
   * Registers a new resident and, when the first month's rent is paid at
   * check-in, records that payment (with its method and reference) in the same step.
   */
  registerResident: (
    resident: Omit<AdminResident, 'id'>,
    firstPayment?: { amount: number; method: string; transactionId?: string }
  ) => AdminResident;
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
  updateDailyGuest: (guestId: string, updates: Partial<AdminDailyGuest>) => void;
  uploadDailyGuestImage: (guestId: string, field: string, uri: string) => void;
  addProperty: (name: string, details?: NewPropertyDetails) => Property;
  updatePropertyDetails: (propertyId: string, updates: PropertyDetailsUpdates) => void;
  addPropertyImages: (propertyId: string, uris: string[]) => void;
  removePropertyImage: (propertyId: string, uri: string) => void;
  deleteProperty: (propertyId: string) => Promise<{ ok: boolean; message?: string }>;
  addRoom: (propertyId: string, floor: number, roomNumber: string, capacity: number) => Room;
  updateRoom: (roomId: string, updates: Partial<Room>) => void;
  /** Deletes a room. Refused while a resident or a current/upcoming day guest is still assigned to it. */
  deleteRoom: (roomId: string) => Promise<{ ok: boolean; message?: string }>;
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
  if (guest.checkedOut) return false; // checked out: the bed is free again
  const now = Date.now();
  // ...the rest stays as it is

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

// True while a resident is pre-booked: the flag is on AND the joining date is still in the future.
// On the joining date itself they count as active.
export function isPreBookedNow(r: { isPreBooking?: boolean; joiningDate: string }): boolean {
  if (!r.isPreBooking) return false;
  const jd = parseDisplayDate(r.joiningDate);
  if (!jd) return false;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return jd.getTime() > today;
}

// ───────────────────────── Firestore helpers ─────────────────────────

const EMPTY_ADDRESS: PropertyAddress = { streetNo: '', landmark: '', city: '', pinCode: '' };
const MAX_IN = 30; // Firestore 'in' queries accept at most 30 values
const warn = (label: string) => (e: any) => console.warn(label, e?.code ?? e?.message ?? e);

// Firestore rejects `undefined` anywhere in a document, so strip it (recursively) before writing.
function clean<T>(v: T): T {
  if (Array.isArray(v)) return v.map(clean) as any;
  if (v && typeof v === 'object') {
    return Object.fromEntries(
      Object.entries(v as any)
        .filter(([, x]) => x !== undefined)
        .map(([k, x]) => [k, clean(x)])
    ) as any;
  }
  return v;
}

function last10(phone: string): string {
  return phone.replace(/[^\d]/g, '').slice(-10);
}

function snapExists(snap: any): boolean {
  return typeof snap.exists === 'function' ? snap.exists() : !!snap.exists;
}

const byNewest = (a: any, b: any) => (b.createdAt ?? 0) - (a.createdAt ?? 0);

function inConstraint(field: string, ids: string[] | null | undefined): any {
  return ids && ids.length > 0 ? where(field, 'in', ids.slice(0, MAX_IN)) : null;
}

const paymentDocId = (residentId: string, monthLabel: string) =>
  `pr_${residentId}_${monthLabel.replace(/\s/g, '_')}`;

// Live list of documents from one collection. Return null from getConstraint to switch it off.
// `loaded` is true only once the SERVER has answered THIS exact query (not the empty local cache,
// and not an answer to an earlier query). Without that, code that reacts to "loaded + empty list"
// can wrongly think a document is missing right after the query changes.
function useCollection<T = any>(name: string, getConstraint: () => any, depKey: string) {
  const [data, setData] = useState<T[]>([]);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  useEffect(() => {
    const constraint = getConstraint();
    setData([]); // never show the previous query's documents (e.g. the previous property)
    if (!constraint) {
      setLoadedKey(depKey);
      return;
    }
    return onSnapshot(
      query(collection(getFirestore(), name), constraint),
      (snap: any) => {
        setData(snap.docs.map((d: any) => ({ ...d.data(), id: d.id })) as T[]);
        if (!snap.metadata.fromCache) setLoadedKey(depKey);
      },
      warn(`${name} listener:`)
    );
  }, [name, depKey]);
  return { data, loaded: loadedKey === depKey };
}

// ───────────────────────── Provider ─────────────────────────

export function AdminProvider({ children }: { children: ReactNode }) {
  const {
    adminPropertyIds,
    addPropertyToCurrentAdmin,
    removePropertyFromCurrentAdmin,
    residentId: sessionResidentId,
  } = useMockAuth();
  const db = getFirestore();
  const isAdminSession = !!adminPropertyIds;
  const idsKey = adminPropertyIds?.join(',') ?? '';

  // ───────── Active property: an admin works in ONE property at a time ─────────
  // Everything below (residents, rooms, rent, complaints, guests, notifications ...) is
  // loaded for the active property only, so properties never mix their data.
  const rawActiveId = useActivePropertyId();
  const activeId: string | null = adminPropertyIds
    ? rawActiveId && adminPropertyIds.includes(rawActiveId)
      ? rawActiveId
      : adminPropertyIds[0] ?? null
    : null;
  const scopedIds: string[] | null = adminPropertyIds ? (activeId ? [activeId] : []) : null;
  const scopeKey = activeId ?? '';
  const sessionKey = `${scopeKey}|${sessionResidentId ?? ''}`;

  // The choice is saved on the admin's users/{uid} document so it survives restarts.
  const [remoteActive, setRemoteActive] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    setRemoteActive(undefined);
    if (!isAdminSession) return;
    const uid = getAuth().currentUser?.uid;
    if (!uid) return;
    let first = true;
    return onSnapshot(
      doc(db, 'users', uid),
      (snap: any) => {
        if (snap.metadata.fromCache) return; // only trust what the server says
        const v: string | null = snapExists(snap) ? snap.data()?.activePropertyId ?? null : null;
        setRemoteActive(v);
        if (first) {
          first = false;
          if (v) setActivePropertyId(v); // restore the last chosen property
        }
      },
      warn('users listener:')
    );
  }, [isAdminSession]);

  useEffect(() => {
    if (!isAdminSession || !activeId || remoteActive === undefined || remoteActive === activeId) return;
    const uid = getAuth().currentUser?.uid;
    if (!uid) return;
    updateDoc(doc(db, 'users', uid), { activePropertyId: activeId }).catch(warn('save active property:'));
  }, [activeId, remoteActive, isAdminSession]);

  const setActiveProperty = (propertyId: string) => setActivePropertyId(propertyId);

  // ───────── Properties ─────────
  const publicPropsQ = useCollection<Property>(
    'properties', () => where('isPublic', '==', true), 'public'
  );
  const adminPropsQ = useCollection<Property>(
    'properties', () => inConstraint('id', adminPropertyIds), idsKey
  );
  const publicProps = publicPropsQ.data;
  const adminProps = adminPropsQ.data;

  // Brand-new owner: create the empty "New PG" placeholder for their first property id.
  const creatingRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!adminPropertyIds || !adminPropsQ.loaded) return;
    const uid = getAuth().currentUser?.uid;
    if (!uid) return;

    adminPropertyIds
      .filter((id) => !adminProps.some((p) => p.id === id) && !creatingRef.current.has(id))
      .forEach((id) => {
        creatingRef.current.add(id);
        setDoc(doc(db, 'properties', id), {
          id,
          name: 'New PG',
          address: '',
          addressDetails: EMPTY_ADDRESS,
          images: [],
          isPublic: false,
          ownerUid: uid,
        }).catch(warn('create placeholder property:'));
      });
  }, [adminPropsQ.loaded, adminProps, idsKey]);

  // ───────── Residents (admin: all in their properties, resident: only their own record) ─────────
  const [rawResidents, setRawResidents] = useState<any[]>([]);
  const [residentsLoaded, setResidentsLoaded] = useState(false);
  useEffect(() => {
    setResidentsLoaded(false);
    setRawResidents([]); // drop the previous property's residents straight away
    const ids = scopedIds ?? [];
    let unsub: (() => void) | undefined;
    if (adminPropertyIds && ids.length > 0) {
      unsub = onSnapshot(
        query(collection(db, 'residents'), where('propertyId', 'in', ids)),
        (snap: any) => {
          setRawResidents(snap.docs.map((d: any) => ({ ...d.data(), id: d.id })));
          if (!snap.metadata.fromCache) setResidentsLoaded(true);
        },
        warn('residents listener:')
      );
    } else if (!adminPropertyIds && sessionResidentId) {
      unsub = onSnapshot(
        doc(db, 'residents', sessionResidentId),
        (snap: any) => {
          setRawResidents(snapExists(snap) ? [{ ...snap.data(), id: snap.id }] : []);
          if (!snap.metadata.fromCache) setResidentsLoaded(true);
        },
        warn('resident listener:')
      );
    } else {
      setRawResidents([]);
      setResidentsLoaded(true);
    }
    return () => unsub?.();
  }, [sessionKey]);

  const residents = useMemo(
    () => rawResidents.filter((r) => !r.archived).sort(byNewest) as AdminResident[],
    [rawResidents]
  );
  const archivedResidents = useMemo(
    () => rawResidents.filter((r) => r.archived).sort(byNewest) as ArchivedResident[],
    [rawResidents]
  );
  const archivedIdSet = useMemo(() => new Set(archivedResidents.map((r) => r.id)), [archivedResidents]);

  // ───────── Rooms (admin: their properties; resident: public properties + their own) ─────────
  const ownPropertyId: string | undefined = rawResidents.find((r) => r.id === sessionResidentId)?.propertyId;
  const roomPropertyIds =
    scopedIds ??
    Array.from(new Set([...publicProps.map((p) => p.id), ...(ownPropertyId ? [ownPropertyId] : [])]));
  const rooms = useCollection<Room>(
    'rooms', () => inConstraint('propertyId', roomPropertyIds), roomPropertyIds.join(',')
  ).data;

  // ───────── Payments, complaints, notifications, guests, identity documents ─────────
  const scopeConstraint = () =>
    scopedIds
      ? inConstraint('propertyId', scopedIds)
      : sessionResidentId
      ? where('residentId', '==', sessionResidentId)
      : null;
  const adminOnlyConstraint = () => inConstraint('propertyId', scopedIds);

  const paymentsQ = useCollection<any>('payments', scopeConstraint, sessionKey);
  const complaintsQ = useCollection<any>('complaints', scopeConstraint, sessionKey);
  const notifQ = useCollection<any>('notifications', adminOnlyConstraint, scopeKey);
  const guestsQ = useCollection<any>('dailyGuests', adminOnlyConstraint, scopeKey);
  const idDocsQ = useCollection<any>('identityDocuments', adminOnlyConstraint, scopeKey);

  const dailyGuests = useMemo(() => [...guestsQ.data].sort(byNewest) as AdminDailyGuest[], [guestsQ.data]);
  const complaints = useMemo(() => [...complaintsQ.data].sort(byNewest) as AdminComplaint[], [complaintsQ.data]);

  // Archived residents keep their PAID history (so past revenue is not lost), but
  // their unpaid records are hidden so they don't count as dues.
  const paymentRecords = useMemo(
    () =>
      paymentsQ.data
        .filter((p) => !archivedIdSet.has(p.residentId) || p.status === 'Paid')
        .sort(byNewest) as AdminPaymentRecord[],
    [paymentsQ.data, archivedIdSet]
  );

  const paymentNotifications = useMemo(
    () => notifQ.data.filter((n) => n.kind === 'payment').sort(byNewest) as AdminPaymentNotification[],
    [notifQ.data]
  );
  const vacateNotifications = useMemo(
    () => notifQ.data.filter((n) => n.kind === 'vacate').sort(byNewest) as AdminVacateNotification[],
    [notifQ.data]
  );
  const complaintNotifications = useMemo(
    () => notifQ.data.filter((n) => n.kind === 'complaint').sort(byNewest) as AdminComplaintNotification[],
    [notifQ.data]
  );

  // Photos being uploaded show instantly from the local file until the cloud copy is ready.
  const [pendingUris, setPendingUris] = useState<Record<string, string>>({});
  const identityDocuments = useMemo(
    () =>
      idDocsQ.data.map((d) => {
        const residentId = d.residentId ?? d.id;
        return {
          residentId,
          frontUri: pendingUris[`${residentId}-front`] ?? d.frontUri ?? null,
          backUri: pendingUris[`${residentId}-back`] ?? d.backUri ?? null,
        };
      }) as AdminIdentityDocument[],
    [idDocsQ.data, pendingUris]
  );

  // Ticks when the calendar day changes, or when the app comes back to the foreground,
  // so pre-bookings switch to active on their joining date without a restart.
  const [dayKey, setDayKey] = useState(() => new Date().toDateString());
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') setDayKey(new Date().toDateString());
    });
    const timer = setInterval(() => setDayKey(new Date().toDateString()), 60 * 1000);
    return () => {
      sub.remove();
      clearInterval(timer);
    };
  }, []);

  // When a pre-booked resident's joining date arrives, make them a normal active resident.
  const activatedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!isAdminSession || !residentsLoaded) return;
    residents.forEach((r) => {
      if (!r.isPreBooking || activatedRef.current.has(r.id)) return;
      if (isPreBookedNow(r)) return; // joining date is still ahead
      activatedRef.current.add(r.id);
      updateDoc(doc(db, 'residents', r.id), {
        isPreBooking: false,
        activatedOn: formatDisplayDate(new Date()),
      }).catch(warn('activate pre-booking:'));
    });
  }, [residents, residentsLoaded, isAdminSession, dayKey]);

  // ───────── Monthly rent records: make sure every active resident has one for this month ─────────
  const generatedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!isAdminSession || !residentsLoaded || !paymentsQ.loaded) return;
    const now = new Date();
    const label = getMonthLabel(now);
    residents.forEach((r) => {
      if (isPreBookedNow(r)) return; // no rent until they actually join
      const id = paymentDocId(r.id, label);
      if (generatedRef.current.has(id)) return;
      if (paymentsQ.data.some((p) => p.residentId === r.id && p.month === label)) return;
      generatedRef.current.add(id);
      const due = getDueDateForMonth(now, r.rentDueDay);
      setDoc(
        doc(db, 'payments', id),
        clean({
          id,
          residentId: r.id,
          propertyId: r.propertyId,
          month: label,
          amount: r.monthlyRent,
          dueDate: formatDisplayDate(due),
          paidOn: null,
          status: now.getTime() > due.getTime() ? 'Overdue' : 'Pending',
          createdAt: Date.now(),
        })
      ).catch(warn('generate rent record:'));
    });
  }, [residents, paymentsQ.data, residentsLoaded, paymentsQ.loaded, isAdminSession, dayKey]);

  // ───────── Notifications ─────────
  const pushNotification = (
    kind: 'payment' | 'vacate' | 'complaint',
    n: { id: string } & Record<string, any>,
    propertyId: string
  ) => setDoc(doc(db, 'notifications', n.id), clean({ ...n, kind, propertyId })).catch(warn('notification:'));

  const markNotificationRead = (id: string) =>
    updateDoc(doc(db, 'notifications', id), { read: true }).catch(warn('mark read:'));

  const markAllRead = (kind: string) => {
    const unread = notifQ.data.filter((n) => n.kind === kind && !n.read);
    if (unread.length === 0) return;
    const batch = writeBatch(db);
    unread.forEach((n) => batch.update(doc(db, 'notifications', n.id), { read: true }));
    batch.commit().catch(warn('mark all read:'));
  };

  const markAllNotificationsRead = () => markAllRead('payment');
  const markVacateNotificationRead = markNotificationRead;
  const markAllVacateNotificationsRead = () => markAllRead('vacate');
  const markComplaintNotificationRead = markNotificationRead;
  const markAllComplaintNotificationsRead = () => markAllRead('complaint');

  // ───────── Vacate reminders: from 2 days before the vacating date up to the vacating day ─────────
  const remindedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!isAdminSession || !residentsLoaded || !notifQ.loaded) return;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    residents.forEach((r) => {
      if (!r.vacatingDate) return;
      const vd = parseDisplayDate(r.vacatingDate);
      if (!vd) return;
      const daysLeft = Math.round((vd.getTime() - today) / (1000 * 60 * 60 * 24));
      if (daysLeft < 0 || daysLeft > 2) return; // only the 2 days before, plus the day itself

      const id = `vr_${r.id}_${vd.getTime()}_${daysLeft}`;
      if (remindedRef.current.has(id)) return;
      if (notifQ.data.some((n) => n.id === id)) return; // already created (and maybe already read)
      remindedRef.current.add(id);

      const when = daysLeft === 0 ? 'today' : daysLeft === 1 ? 'tomorrow' : 'in 2 days';
      pushNotification(
        'vacate',
        {
          id,
          residentId: r.id,
          residentName: r.name,
          vacatingDate: r.vacatingDate,
          isEmergency: r.emergencyVacateDeductionPercent != null,
          deductionPercent: r.emergencyVacateDeductionPercent ?? null,
          reason: r.vacateReason ?? null,
          read: false,
          createdAt: Date.now(),
          reminder: true,
          daysLeft,
          message: `${r.name} is vacating ${when} (${r.vacatingDate}).`,
        },
        r.propertyId
      );
    });
  }, [residents, notifQ.data, residentsLoaded, notifQ.loaded, isAdminSession, dayKey]);

  // ───────── Rent payments ─────────
  const markRentPaid = (residentId: string) => {
    recordRentPayment(residentId, 'Cash');
  };

  // Deduction on one resident's rent for the current month (e.g. 500 off a 9000 rent -> 8500 due).
  const setRentDeduction = (residentId: string, amount: number, reason: string = '') => {
    const resident = rawResidents.find((r) => r.id === residentId);
    if (!resident) return;
    const now = new Date();
    const label = getMonthLabel(now);
    const existing = paymentsQ.data.find((p) => p.residentId === residentId && p.month === label);
    const recordId = existing?.id ?? paymentDocId(residentId, label);
    const base = existing?.amount ?? resident.monthlyRent;
    const deduction = Math.max(0, Math.min(Math.round(amount) || 0, base));
    const due = getDueDateForMonth(now, resident.rentDueDay);
    setDoc(
      doc(db, 'payments', recordId),
      clean({
        ...(existing
          ? {}
          : {
              id: recordId,
              residentId,
              propertyId: resident.propertyId,
              month: label,
              amount: resident.monthlyRent,
              dueDate: formatDisplayDate(due),
              paidOn: null,
              status: now.getTime() > due.getTime() ? 'Overdue' : 'Pending',
              createdAt: Date.now(),
            }),
        deduction,
        deductionReason: deduction > 0 ? reason.trim() || null : null,
      }),
      { merge: true }
    ).catch(warn('setRentDeduction:'));
  };

  const recordRentPayment = (
    residentId: string,
    method: string,
    source: 'resident' | 'admin' = 'admin',
    options?: RecordRentPaymentOptions
  ): AdminPaymentRecord => {
    const now = new Date();
    const label = getMonthLabel(now);
    const resident = rawResidents.find((r) => r.id === residentId);
    const propertyId = options?.propertyId ?? resident?.propertyId ?? '';
    const residentName = options?.residentName ?? resident?.name;
    const dueDateObj = getDueDateForMonth(now, options?.dueDay ?? resident?.rentDueDay ?? 5);
    const paidOnStr = formatDisplayDate(now);

    const timing: PaymentTiming =
      now.getTime() < dueDateObj.getTime()
        ? 'Early'
        : now.toDateString() === dueDateObj.toDateString()
        ? 'On Time'
        : 'Late';

    const existing = paymentsQ.data.find((p) => p.residentId === residentId && p.month === label);
    const recordId = existing?.id ?? paymentDocId(residentId, label);

    const record: AdminPaymentRecord = {
      id: recordId,
      residentId,
      month: label,
      // Any deduction agreed for this month comes off what is actually collected.
      amount: Math.max(0, (existing?.amount ?? options?.amount ?? resident?.monthlyRent ?? 0) - (existing?.deduction ?? 0)),
      dueDate: existing?.dueDate ?? formatDisplayDate(dueDateObj),
      paidOn: paidOnStr,
      status: 'Paid',
      timing,
      method,
      transactionId: options?.transactionId || `TXN${Date.now()}`,
    };

    setDoc(
      doc(db, 'payments', recordId),
      clean({ ...record, propertyId, createdAt: existing?.createdAt ?? Date.now() }),
      { merge: true }
    ).catch(warn('recordRentPayment:'));
    updateDoc(doc(db, 'residents', residentId), { rentStatus: 'Paid' }).catch(warn('rentStatus:'));

    if (source === 'resident' && residentName) {
      pushNotification(
        'payment',
        {
          id: `pn_${residentId}_${Date.now()}`,
          residentId,
          residentName,
          amount: record.amount,
          month: record.month,
          paidOn: paidOnStr,
          method,
          read: false,
          createdAt: Date.now(),
          type: 'Rent',
        },
        propertyId
      );
    }
    return record;
  };

  // ───────── Complaints ─────────
  const updateComplaintStatus = (complaintId: string, status: AdminComplaint['status']) => {
    const today = formatDisplayDate(new Date());
    updateDoc(
      doc(db, 'complaints', complaintId),
      clean({
        status,
        ...(status === 'In Progress' ? { inProgressOn: today } : {}),
        ...(status === 'Resolved' ? { resolvedOn: null } : {}),
        ...(status === 'Open' ? { inProgressOn: null, resolvedOn: null } : {}),
      })
    ).catch(warn('updateComplaintStatus:'));
  };

  const markComplaintViewed = (complaintId: string) => {
    updateDoc(doc(db, 'complaints', complaintId), { viewed: true }).catch(warn('markComplaintViewed:'));
  };

  // Runs many small writes in batches (Firestore allows at most 500 per batch).
  const runInBatches = async (ops: ((b: ReturnType<typeof writeBatch>) => void)[]) => {
    for (let i = 0; i < ops.length; i += 400) {
      const batch = writeBatch(db);
      ops.slice(i, i + 400).forEach((op) => op(batch));
      await batch.commit();
    }
  };

  const clearComplaints = async (mode: 'resolved' | 'all') => {
    const targets = complaintsQ.data.filter((x) => mode === 'all' || x.status === 'Resolved');
    if (targets.length === 0) return { ok: true, count: 0 };
    const ids = new Set(targets.map((x) => x.id));
    const ops: ((b: ReturnType<typeof writeBatch>) => void)[] = [
      ...targets.map((x) => (b: any) => b.delete(doc(db, 'complaints', x.id))),
      // the bell entries that belong to those complaints go too
      ...notifQ.data
        .filter((n) => n.kind === 'complaint' && ids.has(n.complaintId))
        .map((n) => (b: any) => b.delete(doc(db, 'notifications', n.id))),
    ];
    try {
      await runInBatches(ops);
      return { ok: true, count: targets.length };
    } catch (e: any) {
      console.warn('clearComplaints failed:', e?.code ?? e?.message);
      return {
        ok: false,
        count: 0,
        message:
          e?.code === 'firestore/permission-denied'
            ? 'Not allowed. Publish the latest Firestore rules and try again.'
            : 'Could not clear the complaints. Check your connection and try again.',
      };
    }
  };

  const clearRevenueData = async () => {
    const paid = paymentsQ.data.filter((p) => p.status === 'Paid' && !p.revenueCleared);
    const guests = guestsQ.data.filter((g) => (g.advanceAmount ?? 0) > 0 || (g.payments?.length ?? 0) > 0);
    const now = Date.now();
    const ops: ((b: any) => void)[] = [
      ...paid.map((p) => (b: any) => b.update(doc(db, 'payments', p.id), { revenueCleared: true })),
      ...guests.map((g) => (b: any) => b.update(doc(db, 'dailyGuests', g.id), { revenueClearedAt: now })),
    ];
    if (ops.length === 0) return { ok: true, count: 0 };
    try {
      await runInBatches(ops);
      return { ok: true, count: ops.length };
    } catch (e: any) {
      console.warn('clearRevenueData failed:', e?.code ?? e?.message);
      return { ok: false, count: 0, message: 'Could not clear the revenue data. Check your connection and try again.' };
    }
  };

  const restoreRevenueData = async () => {
    const paid = paymentsQ.data.filter((p) => p.revenueCleared);
    const guests = guestsQ.data.filter((g) => (g.revenueClearedAt ?? 0) > 0);
    const ops: ((b: any) => void)[] = [
      ...paid.map((p) => (b: any) => b.update(doc(db, 'payments', p.id), { revenueCleared: false })),
      ...guests.map((g) => (b: any) => b.update(doc(db, 'dailyGuests', g.id), { revenueClearedAt: 0 })),
    ];
    if (ops.length === 0) return { ok: true, count: 0 };
    try {
      await runInBatches(ops);
      return { ok: true, count: ops.length };
    } catch (e: any) {
      console.warn('restoreRevenueData failed:', e?.code ?? e?.message);
      return { ok: false, count: 0, message: 'Could not restore the revenue data. Check your connection and try again.' };
    }
  };

  const addComplaint = (input: AddComplaintInput): string => {
    const id = doc(collection(db, 'complaints')).id;

    // Prefer the ID passed in; otherwise use the signed-in resident's own record.
    // Matching by name is only a last resort (e.g. an admin filing for a resident).
    const resident = input.residentId
      ? rawResidents.find((r) => r.id === input.residentId)
      : sessionResidentId
      ? rawResidents.find((r) => r.id === sessionResidentId)
      : rawResidents.find((r) => r.name === input.residentName);

    const residentId = input.residentId || resident?.id || '';
    const propertyId = input.propertyId || resident?.propertyId || activeId || '';

    const newComplaint: AdminComplaint = {
      id,
      residentName: input.residentName,
      residentId,
      room: input.room,
      category: input.category,
      description: input.description,
      date: formatDisplayDate(new Date()),
      status: 'Open',
      viewed: false,
    };
    setDoc(
      doc(db, 'complaints', id),
      // residentPhone is kept on the complaint so the admin can still WhatsApp the resident
      // even if the resident record is later removed.
      clean({ ...newComplaint, propertyId, residentPhone: resident?.phone ?? null, createdAt: Date.now() })
    ).catch(warn('addComplaint:'));

    // Photos: upload each one, then attach the cloud links to the complaint.
    const localPhotos = (input.photoUris ?? []).filter(Boolean);
    if (localPhotos.length > 0) {
      Promise.all(
        localPhotos.map((uri, i) =>
          /^https?:/.test(uri) ? Promise.resolve(uri) : uploadImage(uri, `complaints/${id}/photo-${i}-${Date.now()}.jpg`)
        )
      )
        .then((urls) => updateDoc(doc(db, 'complaints', id), { photos: urls }))
        .catch((e: any) => {
          console.warn('complaint photo upload failed:', e?.code ?? e?.message);
          Alert.alert('Photo upload failed', 'The complaint was saved, but its photos could not be uploaded.');
        });
    }

    pushNotification(
      'complaint',
      {
        id: `cn_${id}`,
        complaintId: id,
        residentName: input.residentName,
        room: input.room,
        category: input.category,
        description: input.description,
        read: false,
        createdAt: Date.now(),
      },
      propertyId
    );
    return id;
  };

  // ───────── Residents ─────────
  const addResident = (resident: Omit<AdminResident, 'id'>): AdminResident => {
    const id = doc(collection(db, 'residents')).id;
    const newResident: AdminResident = { ...resident, id };
    const batch = writeBatch(db);
    batch.set(
      doc(db, 'residents', id),
      clean({ ...newResident, phoneKey: last10(resident.phone), archived: false, createdAt: Date.now() })
    );
    batch.set(doc(db, 'identityDocuments', id), {
      residentId: id, propertyId: resident.propertyId, frontUri: null, backUri: null,
    });
    batch.commit().catch(warn('addResident:'));
    return newResident;
  };

  const registerResident = (
    resident: Omit<AdminResident, 'id'>,
    firstPayment?: { amount: number; method: string; transactionId?: string }
  ): AdminResident => {
    // Rent counts as paid only when the first-month payment covers the full rent.
    const rentPaid = !!firstPayment && resident.monthlyRent > 0 && firstPayment.amount >= resident.monthlyRent;
    const newResident = addResident({ ...resident, rentStatus: rentPaid ? 'Paid' : 'Pending' });

    if (firstPayment && rentPaid) {
      const now = new Date();
      const label = getMonthLabel(now);
      const dueDateObj = getDueDateForMonth(now, resident.rentDueDay);
      const timing: PaymentTiming =
        now.getTime() < dueDateObj.getTime()
          ? 'Early'
          : now.toDateString() === dueDateObj.toDateString()
          ? 'On Time'
          : 'Late';
      const id = paymentDocId(newResident.id, label);
      setDoc(
        doc(db, 'payments', id),
        clean({
          id,
          residentId: newResident.id,
          propertyId: resident.propertyId,
          month: label,
          amount: resident.monthlyRent,
          dueDate: formatDisplayDate(dueDateObj),
          paidOn: formatDisplayDate(now),
          status: 'Paid',
          timing,
          method: firstPayment.method,
          transactionId: firstPayment.transactionId?.trim() || `TXN${Date.now()}`,
          createdAt: Date.now(),
        })
      ).catch(warn('first payment:'));
    }
    return newResident;
  };

  const updateResident = (residentId: string, updates: Partial<AdminResident>) => {
    const patch: Record<string, any> = { ...updates };
    delete patch.id;
    if (updates.phone) patch.phoneKey = last10(updates.phone);
    updateDoc(doc(db, 'residents', residentId), clean(patch)).catch(warn('updateResident:'));
    if (updates.propertyId) {
      setDoc(doc(db, 'identityDocuments', residentId), { residentId, propertyId: updates.propertyId }, { merge: true })
        .catch(warn('identity propertyId:'));
    }
  };

  // Removes the resident and everything attached to them (same as permanent delete).
  const deleteResident = (residentId: string) => permanentlyDeleteResident(residentId);

  const archiveResident = (residentId: string, reason: string | null = null) => {
    const resident = rawResidents.find((r) => r.id === residentId);
    if (!resident) return;
    const today = formatDisplayDate(new Date());
    // Close any open room stay so the history stays accurate.
    const closedHistory = resident.roomHistory?.map((h: RoomAssignmentRecord) =>
      h.toDate === null ? { ...h, toDate: today } : h
    );
    updateDoc(
      doc(db, 'residents', residentId),
      clean({
        archived: true,
        archivedOn: today,
        archivedReason: reason,
        ...(closedHistory ? { roomHistory: closedHistory } : {}),
      })
    ).catch(warn('archiveResident:'));
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
              toDate: archived.archivedOn,
            },
          ];
    const newEntry: RoomAssignmentRecord = {
      id: `rh_${residentId}_${Date.now()}`,
      propertyId: targetPropertyId,
      roomId: targetRoomId,
      fromDate: joiningDate,
      toDate: null,
    };

    updateDoc(
      doc(db, 'residents', residentId),
      clean({
        archived: false,
        archivedOn: null,
        archivedReason: null,
        propertyId: targetPropertyId,
        roomId: targetRoomId,
        joiningDate,
        monthlyRent: input.monthlyRent ?? archived.monthlyRent,
        rentStatus: 'Pending',
        vacatingDate: null,
        vacateReason: null,
        emergencyVacateDeductionPercent: null,
        roomHistory: [...previousHistory, newEntry],
      })
    ).catch(warn('restoreResident:'));
    setDoc(doc(db, 'identityDocuments', residentId), { residentId, propertyId: targetPropertyId }, { merge: true })
      .catch(warn('restore identity doc:'));
    return { ok: true };
  };

  const permanentlyDeleteResident = (residentId: string) => {
    const batch = writeBatch(db);
    batch.delete(doc(db, 'residents', residentId));
    batch.delete(doc(db, 'identityDocuments', residentId));
    paymentsQ.data
      .filter((p) => p.residentId === residentId)
      .forEach((p) => batch.delete(doc(db, 'payments', p.id)));
    notifQ.data
      .filter((n) => n.residentId === residentId && n.kind !== 'complaint')
      .forEach((n) => batch.delete(doc(db, 'notifications', n.id)));
    batch.commit().catch(warn('permanentlyDeleteResident:'));
  };

  const submitVacateNotice = (
    residentId: string,
    vacatingDate: string | null,
    isEmergency: boolean = false,
    reason: string | null = null
  ) => {
    // Remove reminders left over from an earlier vacating date or a cancelled notice.
    const oldReminders = notifQ.data.filter(
      (n) => n.kind === 'vacate' && n.reminder && n.residentId === residentId
    );
    if (oldReminders.length > 0) {
      const cleanup = writeBatch(db);
      oldReminders.forEach((n) => cleanup.delete(doc(db, 'notifications', n.id)));
      cleanup.commit().catch(warn('clear vacate reminders:'));
    }
    if (vacatingDate) {
      // A new date was set: let reminders for it be created afresh.
      remindedRef.current.forEach((rid) => {
        if (rid.startsWith(`vr_${residentId}_`)) remindedRef.current.delete(rid);
      });
    }

    const resident = rawResidents.find((r) => r.id === residentId);

    let deductionPercent: number | null = null;
    if (vacatingDate && isEmergency) {
      const vacateDateObj = parseDisplayDate(vacatingDate);
      if (vacateDateObj) {
        const daysNotice = Math.floor((vacateDateObj.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        deductionPercent = getEmergencyVacateDeductionPercent(Math.max(0, daysNotice));
      }
    }

    updateDoc(doc(db, 'residents', residentId), {
      vacatingDate,
      vacateReason: vacatingDate ? reason : null,
      emergencyVacateDeductionPercent: vacatingDate ? deductionPercent : null,
    }).catch(warn('submitVacateNotice:'));

    if (vacatingDate && resident) {
      pushNotification(
        'vacate',
        {
          id: `vn_${residentId}_${Date.now()}`,
          residentId,
          residentName: resident.name,
          vacatingDate,
          isEmergency,
          deductionPercent,
          reason,
          read: false,
          createdAt: Date.now(),
        },
        resident.propertyId
      );
    }
  };

  const transferResidentRoom = (residentId: string, newPropertyId: string, newRoomId: string) => {
    const resident = rawResidents.find((r) => r.id === residentId);
    if (!resident || resident.roomId === newRoomId) return;

    const today = formatDisplayDate(new Date());
    const existingHistory: RoomAssignmentRecord[] = resident.roomHistory ?? [];
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

    updateDoc(doc(db, 'residents', residentId), {
      propertyId: newPropertyId,
      roomId: newRoomId,
      roomHistory: [...historyWithClosedCurrent, newEntry],
    }).catch(warn('transferResidentRoom:'));
    setDoc(doc(db, 'identityDocuments', residentId), { residentId, propertyId: newPropertyId }, { merge: true })
      .catch(warn('transfer identity doc:'));
  };

  // ───────── Identity documents (photos go to Firebase Storage) ─────────
  const setIdentityDocumentUri = (residentId: string, side: 'front' | 'back', uri: string) => {
    const key = `${residentId}-${side}`;
    const field = side === 'front' ? 'frontUri' : 'backUri';
    const propertyId = rawResidents.find((r) => r.id === residentId)?.propertyId;
    const dropPending = () =>
      setPendingUris((prev) => {
        const { [key]: _removed, ...rest } = prev;
        return rest;
      });

    setPendingUris((prev) => ({ ...prev, [key]: uri }));
    (/^https?:/.test(uri)
      ? Promise.resolve(uri)
      : uploadImage(uri, `identity/${residentId}/${side}-${Date.now()}.jpg`)
    )
      .then((url) =>
        setDoc(doc(db, 'identityDocuments', residentId), clean({ residentId, propertyId, [field]: url }), { merge: true })
      )
      .then(dropPending)
      .catch((e: any) => {
        console.warn('identity upload failed:', e?.code ?? e?.message);
        dropPending();
        Alert.alert('Upload failed', 'The photo could not be uploaded. Check your internet connection and try again.');
      });
  };

  const clearIdentityDocumentUri = (residentId: string, side: 'front' | 'back') => {
    const key = `${residentId}-${side}`;
    setPendingUris((prev) => {
      const { [key]: _removed, ...rest } = prev;
      return rest;
    });
    setDoc(doc(db, 'identityDocuments', residentId), { [side === 'front' ? 'frontUri' : 'backUri']: null }, { merge: true })
      .catch(warn('clearIdentityDocumentUri:'));
  };

  // ───────── Day guests ─────────
  const addDailyGuest = (guest: Omit<AdminDailyGuest, 'id'>): AdminDailyGuest => {
    const id = doc(collection(db, 'dailyGuests')).id;
    const newGuest: AdminDailyGuest = { ...guest, id };
    setDoc(doc(db, 'dailyGuests', id), clean({ ...newGuest, createdAt: Date.now() })).catch(warn('addDailyGuest:'));
    return newGuest;
  };

    // A payment goes to the stay rent first; anything left over goes to the security deposit.
  const recordDailyGuestPayment = (guestId: string, amount: number, method: AdminDailyGuestPaymentMethod) => {
    const g = dailyGuests.find((x) => x.id === guestId);
    if (!g || amount <= 0) return;

    const deposit = g.securityDeposit ?? 0;
    const depositPaidSoFar = g.depositPaid ?? (g.advanceDepositStatus === 'Paid' ? deposit : 0);
    const stayDue = Math.max(0, g.totalAmount - (g.advanceAmount ?? 0));
    const toStay = Math.min(stayDue, amount);
    const toDeposit = Math.min(Math.max(0, deposit - depositPaidSoFar), amount - toStay);
    if (toStay + toDeposit <= 0) return;

    const newAdvance = (g.advanceAmount ?? 0) + toStay;
    const newDepositPaid = depositPaidSoFar + toDeposit;

    updateDoc(
      doc(db, 'dailyGuests', guestId),
      clean({
        advanceAmount: newAdvance,
        depositPaid: newDepositPaid,
        advanceDepositStatus: deposit > 0 ? (newDepositPaid >= deposit ? 'Paid' : 'Not Paid') : 'No Advance',
        paymentMethod: method,
        paymentStatus: newAdvance >= g.totalAmount ? 'Paid' : 'Pending',
        ...(toStay > 0 ? { payments: [...(g.payments ?? []), { amount: toStay, method, at: Date.now() }] } : {}),
      })
    ).catch(warn('recordDailyGuestPayment:'));
  };

  const updateDailyGuest = (guestId: string, updates: Partial<AdminDailyGuest>) => {
    const patch: Record<string, any> = { ...updates };
    delete patch.id;
    updateDoc(doc(db, 'dailyGuests', guestId), clean(patch)).catch(warn('updateDailyGuest:'));
  };

  // Uploads a local photo to Storage, then swaps the document's field for the cloud link.
  const uploadDailyGuestImage = (guestId: string, field: string, uri: string) => {
    if (!uri || /^https?:/.test(uri)) return;
    uploadImage(uri, `dailyGuests/${guestId}/${field}-${Date.now()}.jpg`)
      .then((url) => updateDoc(doc(db, 'dailyGuests', guestId), { [field]: url }))
      .catch(warn('uploadDailyGuestImage:'));
  };

  // ───────── Properties and rooms ─────────
  const addProperty = (name: string, details: NewPropertyDetails = {}): Property => {
    const addressDetails = details.addressDetails ?? EMPTY_ADDRESS;
    const id = doc(collection(db, 'properties')).id;
    const newProperty: Property = {
      id,
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
    setDoc(
      doc(db, 'properties', id),
      clean({ ...newProperty, isPublic: false, ownerUid: getAuth().currentUser?.uid })
    ).catch(warn('addProperty:'));
    addPropertyToCurrentAdmin(id);
    setActivePropertyId(id); // switch to the new (empty) property right away
    return newProperty;
  };

  const updatePropertyDetails = (propertyId: string, updates: PropertyDetailsUpdates) => {
    const patch: Record<string, any> = { ...updates };
    if (updates.addressDetails) patch.address = formatPropertyAddress(updates.addressDetails);
    updateDoc(doc(db, 'properties', propertyId), clean(patch)).catch(warn('updatePropertyDetails:'));
  };

  const addPropertyImages = (propertyId: string, uris: string[]) => {
    const current = adminProps.find((p) => p.id === propertyId);
    if (!current) return;
    updateDoc(doc(db, 'properties', propertyId), { images: [...current.images, ...uris] })
      .catch(warn('addPropertyImages:'));
  };

  const removePropertyImage = (propertyId: string, uri: string) => {
    const current = adminProps.find((p) => p.id === propertyId);
    if (!current) return;
    updateDoc(doc(db, 'properties', propertyId), { images: current.images.filter((i) => i !== uri) })
      .catch(warn('removePropertyImage:'));
  };

  // Deletes a property and its rooms. Refused while anyone is still living there.
  // Checks the database itself, because only the ACTIVE property's data is held in memory.
  const deleteProperty = async (propertyId: string): Promise<{ ok: boolean; message?: string }> => {
    let propertyRoomIds: string[] = [];
    try {
      const [resSnap, guestSnap, roomSnap] = await Promise.all([
        getDocs(query(collection(db, 'residents'), where('propertyId', '==', propertyId))),
        getDocs(query(collection(db, 'dailyGuests'), where('propertyId', '==', propertyId))),
        getDocs(query(collection(db, 'rooms'), where('propertyId', '==', propertyId))),
      ]);
      const liveResidents = resSnap.docs.filter((d: any) => !d.data().archived).length;
      if (liveResidents > 0) {
        return {
          ok: false,
          message: `${liveResidents} resident${liveResidents > 1 ? 's' : ''} still live in this property. Transfer or archive them first.`,
        };
      }
      const liveGuests = guestSnap.docs.filter((d: any) => {
        const g = d.data() as AdminDailyGuest;
        return isDailyGuestActiveNow(g) || g.checkInTimestamp > Date.now();
      }).length;
      if (liveGuests > 0) {
        return { ok: false, message: 'This property still has current or upcoming day guests.' };
      }
      propertyRoomIds = roomSnap.docs.map((d: any) => d.id);
    } catch (e: any) {
      console.warn('deleteProperty check failed:', e?.code ?? e?.message);
      return { ok: false, message: 'Could not check this property. Check your connection and try again.' };
    }

    // Stops the "create empty New PG" effect from re-creating it while it is being deleted.
    creatingRef.current.add(propertyId);
    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, 'properties', propertyId));
      propertyRoomIds.forEach((roomId) => batch.delete(doc(db, 'rooms', roomId)));
      await batch.commit();
    } catch (e: any) {
      creatingRef.current.delete(propertyId);
      return {
        ok: false,
        message:
          e?.code === 'firestore/permission-denied'
            ? 'Not allowed to delete this property.'
            : 'Could not delete. Check your connection and try again.',
      };
    }

    // Remove it from this admin's list only AFTER the delete succeeded.
    removePropertyFromCurrentAdmin(propertyId);
    return { ok: true };
  };

  const addRoom = (propertyId: string, floor: number, roomNumber: string, capacity: number): Room => {
    const newRoom: Room = { id: `${propertyId}-${roomNumber}`, propertyId, floor, roomNumber, capacity };
    setDoc(doc(db, 'rooms', newRoom.id), newRoom).catch(warn('addRoom:'));
    return newRoom;
  };

  const updateRoom = (roomId: string, updates: Partial<Room>) => {
    const patch: Record<string, any> = { ...updates };
    delete patch.id;
    updateDoc(doc(db, 'rooms', roomId), clean(patch)).catch(warn('updateRoom:'));
  };

  // Deletes one room. Checks the database itself (not just what is loaded) so nobody is left in a room that no longer exists.
  const deleteRoom = async (roomId: string): Promise<{ ok: boolean; message?: string }> => {
    const room = rooms.find((r) => r.id === roomId);
    if (!room) return { ok: false, message: 'Room not found.' };
    try {
      const [resSnap, guestSnap] = await Promise.all([
        getDocs(query(collection(db, 'residents'), where('propertyId', '==', room.propertyId), where('roomId', '==', roomId))),
        getDocs(query(collection(db, 'dailyGuests'), where('propertyId', '==', room.propertyId), where('roomId', '==', roomId))),
      ]);
      const residentsInRoom = resSnap.docs.filter((d: any) => !d.data().archived).length;
      if (residentsInRoom > 0) {
        return {
          ok: false,
          message: `Room ${room.roomNumber} still has ${residentsInRoom} resident${residentsInRoom > 1 ? 's' : ''}. Move, vacate or archive them first.`,
        };
      }
      const guestsInRoom = guestSnap.docs.filter((d: any) => {
        const g = d.data() as AdminDailyGuest;
        return isDailyGuestActiveNow(g) || (!g.checkedOut && g.checkInTimestamp > Date.now());
      }).length;
      if (guestsInRoom > 0) {
        return { ok: false, message: `Room ${room.roomNumber} still has current or upcoming day guests.` };
      }
      const batch = writeBatch(db);
      batch.delete(doc(db, 'rooms', roomId));
      await batch.commit();
      return { ok: true };
    } catch (e: any) {
      console.warn('deleteRoom failed:', e?.code ?? e?.message);
      return {
        ok: false,
        message:
          e?.code === 'firestore/permission-denied'
            ? 'Not allowed to delete this room.'
            : 'Could not delete the room. Check your connection and try again.',
      };
    }
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
    const batch = writeBatch(db);
    let remaining = totalRooms;
    for (let floor = 1; floor <= floors && remaining > 0; floor++) {
      const countThisFloor = Math.min(roomsPerFloor, remaining);
      for (let i = 1; i <= countThisFloor; i++) {
        const roomNumber = `${floor}${String(i).padStart(2, '0')}`;
        const id = `${propertyId}-${roomNumber}`;
        batch.set(doc(db, 'rooms', id), { id, propertyId, floor, roomNumber, capacity: defaultCapacity });
        remaining--;
      }
    }
    batch.commit().catch(warn('generateRoomsForProperty:'));
  };

  // ───────── Self-service booking ─────────
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

    // The new resident is not in local state yet, so pass what recordRentPayment would look up.
    recordRentPayment(newResident.id, input.method, 'resident', {
      amount: monthlyRent,
      dueDay: 5,
      propertyId: input.propertyId,
      residentName: input.name,
    });
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

    pushNotification(
      'payment',
      {
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
      },
      input.propertyId
    );
    return newGuest;
  };

  return (
    <AdminContext.Provider
      value={{
        residents,
        complaints,
        identityDocuments,
        dailyGuests,
        paymentRecords,
        paymentNotifications,
        vacateNotifications,
        complaintNotifications,
        properties: isAdminSession ? adminProps : publicProps,
        publicProperties: publicProps,
        activePropertyId: activeId,
        activeProperty: adminProps.find((p) => p.id === activeId),
        setActiveProperty,
        rooms,
        archivedResidents,
        markRentPaid,
        setRentDeduction,
        recordRentPayment,
        markNotificationRead,
        markAllNotificationsRead,
        markVacateNotificationRead,
        markAllVacateNotificationsRead,
        markComplaintNotificationRead,
        markAllComplaintNotificationsRead,
        updateComplaintStatus,
        markComplaintViewed,
        clearComplaints,
        clearRevenueData,
        restoreRevenueData,
        addComplaint,
        addResident,
        registerResident,
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
        updateDailyGuest,
        uploadDailyGuestImage,
        addProperty,
        updatePropertyDetails,
        addPropertyImages,
        removePropertyImage,
        deleteProperty,
        addRoom,
        updateRoom,
        deleteRoom,
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