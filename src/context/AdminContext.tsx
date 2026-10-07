import React, { createContext, useContext, useState, useEffect, useMemo, useRef, ReactNode } from 'react';
import { Alert } from 'react-native';
import { getAuth } from '@react-native-firebase/auth';
import {
  getFirestore, collection, doc, onSnapshot, query, where, setDoc, updateDoc, writeBatch,
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

// Input accepted by addComplaint. residentId / propertyId are optional so older
// callers (e.g. MaintenanceContext) keep working; when omitted they are looked up.
export type AddComplaintInput = {
  residentName: string;
  room: string;
  category: string;
  description: string;
  residentId?: string;
  propertyId?: string;
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
  rooms: Room[];
  archivedResidents: ArchivedResident[];
  markRentPaid: (residentId: string) => void;
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
  addProperty: (name: string, details?: NewPropertyDetails) => Property;
  updatePropertyDetails: (propertyId: string, updates: PropertyDetailsUpdates) => void;
  addPropertyImages: (propertyId: string, uris: string[]) => void;
  removePropertyImage: (propertyId: string, uri: string) => void;
  deleteProperty: (propertyId: string) => Promise<{ ok: boolean; message?: string }>;
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
    if (!constraint) {
      setData([]);
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
  const sessionKey = `${idsKey}|${sessionResidentId ?? ''}`;

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
    const ids = adminPropertyIds?.slice(0, MAX_IN) ?? [];
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
    adminPropertyIds ??
    Array.from(new Set([...publicProps.map((p) => p.id), ...(ownPropertyId ? [ownPropertyId] : [])]));
  const rooms = useCollection<Room>(
    'rooms', () => inConstraint('propertyId', roomPropertyIds), roomPropertyIds.join(',')
  ).data;

  // ───────── Payments, complaints, notifications, guests, identity documents ─────────
  const scopeConstraint = () =>
    adminPropertyIds
      ? inConstraint('propertyId', adminPropertyIds)
      : sessionResidentId
      ? where('residentId', '==', sessionResidentId)
      : null;
  const adminOnlyConstraint = () => inConstraint('propertyId', adminPropertyIds);

  const paymentsQ = useCollection<any>('payments', scopeConstraint, sessionKey);
  const complaintsQ = useCollection<any>('complaints', scopeConstraint, sessionKey);
  const notifQ = useCollection<any>('notifications', adminOnlyConstraint, idsKey);
  const guestsQ = useCollection<any>('dailyGuests', adminOnlyConstraint, idsKey);
  const idDocsQ = useCollection<any>('identityDocuments', adminOnlyConstraint, idsKey);

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

  // ───────── Monthly rent records: make sure every active resident has one for this month ─────────
  const generatedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!isAdminSession || !residentsLoaded || !paymentsQ.loaded) return;
    const now = new Date();
    const label = getMonthLabel(now);
    residents.forEach((r) => {
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
  }, [residents, paymentsQ.data, residentsLoaded, paymentsQ.loaded, isAdminSession]);

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

  // ───────── Rent payments ─────────
  const markRentPaid = (residentId: string) => {
    recordRentPayment(residentId, 'Cash');
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
      amount: existing?.amount ?? options?.amount ?? resident?.monthlyRent ?? 0,
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
    const propertyId = input.propertyId || resident?.propertyId || adminPropertyIds?.[0] || '';

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
      clean({ ...newComplaint, propertyId, createdAt: Date.now() })
    ).catch(warn('addComplaint:'));

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

  const recordDailyGuestPayment = (guestId: string, amount: number, method: AdminDailyGuestPaymentMethod) => {
    const g = dailyGuests.find((x) => x.id === guestId);
    if (!g || amount <= 0) return;
    const newAdvance = Math.min(g.totalAmount, (g.advanceAmount ?? 0) + amount);
    updateDoc(doc(db, 'dailyGuests', guestId), {
      advanceAmount: newAdvance,
      paymentMethod: method,
      paymentStatus: newAdvance >= g.totalAmount ? 'Paid' : 'Pending',
    }).catch(warn('recordDailyGuestPayment:'));
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
  const deleteProperty = async (propertyId: string): Promise<{ ok: boolean; message?: string }> => {
    const liveResidents = residents.filter((r) => r.propertyId === propertyId).length;
    if (liveResidents > 0) {
      return {
        ok: false,
        message: `${liveResidents} resident${liveResidents > 1 ? 's' : ''} still live in this property. Transfer or archive them first.`,
      };
    }
    const liveGuests = dailyGuests.filter(
      (g) => g.propertyId === propertyId && (isDailyGuestActiveNow(g) || g.checkInTimestamp > Date.now())
    ).length;
    if (liveGuests > 0) {
      return { ok: false, message: 'This property still has current or upcoming day guests.' };
    }

    // Stops the "create empty New PG" effect from re-creating it while it is being deleted.
    creatingRef.current.add(propertyId);
    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, 'properties', propertyId));
      rooms
        .filter((r) => r.propertyId === propertyId)
        .forEach((r) => batch.delete(doc(db, 'rooms', r.id)));
      await batch.commit();
    } catch (e: any) {
      creatingRef.current.delete(propertyId);
      return { ok: false, message: e?.code === 'firestore/permission-denied' ? 'Not allowed to delete this property.' : 'Could not delete. Check your connection and try again.' };
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
        rooms,
        archivedResidents,
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
        addProperty,
        updatePropertyDetails,
        addPropertyImages,
        removePropertyImage,
        deleteProperty,
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