import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';
import {
  getFirestore, collection, doc, onSnapshot, query, where, setDoc, updateDoc,
} from '@react-native-firebase/firestore';
import { useAdmin } from '../context/AdminContext';
import { useMockAuth } from '../context/MockAuthContext';
import { uploadImage } from '../utils/uploadImage';

export type LaundryStatus =
  | 'Requested'
  | 'Pickup Scheduled'
  | 'Collected'
  | 'Processing'
  | 'Ready'
  | 'Delivered'
  | 'Cancelled';

export const SERVICE_TYPES = ['Wash & Fold', 'Wash & Iron', 'Iron Only', 'Dry Clean'];
export const PICKUP_SLOTS = ['8 – 10 AM', '10 AM – 12 PM', '2 – 4 PM', '4 – 6 PM'];

export type LaundryRequest = {
  id: string;
  residentId: string;
  residentName: string;
  room: string;
  propertyId: string;
  numClothes: number;
  serviceType: string;
  notes: string;
  imageUrl: string | null;
  pickupDate: string;
  pickupDateTs: number;
  pickupSlot: string;
  expectedDelivery: string | null;
  charges: number | null;
  paymentStatus: 'Unpaid' | 'Paid';
  adminRemarks: string | null;
  status: LaundryStatus;
  statusHistory: { status: LaundryStatus; at: number }[];
  createdAt: number;
};

const toRequest = (d: any): LaundryRequest => ({
  id: d.id,
  residentId: d.residentId ?? '',
  residentName: d.residentName ?? '',
  room: d.room ?? '',
  propertyId: d.propertyId ?? '',
  numClothes: d.numClothes ?? 0,
  serviceType: d.serviceType ?? '',
  notes: d.notes ?? '',
  imageUrl: d.imageUrl ?? null,
  pickupDate: d.pickupDate ?? '',
  pickupDateTs: d.pickupDateTs ?? 0,
  pickupSlot: d.pickupSlot ?? '',
  expectedDelivery: d.expectedDelivery ?? null,
  charges: d.charges ?? null,
  paymentStatus: d.paymentStatus === 'Paid' ? 'Paid' : 'Unpaid',
  adminRemarks: d.adminRemarks ?? null,
  status: (d.status ?? 'Requested') as LaundryStatus,
  statusHistory: Array.isArray(d.statusHistory) ? d.statusHistory : [],
  createdAt: d.createdAt ?? 0,
});

const byNewest = (a: LaundryRequest, b: LaundryRequest) => b.createdAt - a.createdAt;

export type NewLaundryInput = {
  numClothes: number;
  serviceType: string;
  notes: string;
  imageUri: string | null;
  pickupDate: string;
  pickupDateTs: number;
  pickupSlot: string;
};

// ───────────── Resident: own requests ─────────────
export function useMyLaundry() {
  const { residentId } = useMockAuth();
  const { residents, rooms } = useAdmin();
  const db = getFirestore();
  const [rows, setRows] = useState<LaundryRequest[]>([]);
  const [loaded, setLoaded] = useState(false);
  const savingRef = useRef(false);

  useEffect(() => {
    setLoaded(false);
    setRows([]);
    if (!residentId) {
      setLoaded(true);
      return;
    }
    return onSnapshot(
      query(collection(db, 'laundryRequests'), where('residentId', '==', residentId)),
      (snap: any) => {
        setRows(snap.docs.map((d: any) => toRequest({ ...d.data(), id: d.id })));
        setLoaded(true);
      },
      (e: any) => {
        console.warn('laundry listener:', e?.code);
        setLoaded(true);
      }
    );
  }, [residentId]);

  const requests = useMemo(() => [...rows].sort(byNewest), [rows]);

  const addRequest = async (input: NewLaundryInput): Promise<{ ok: boolean; message?: string }> => {
    const resident = residents.find((r) => r.id === residentId);
    if (!resident) return { ok: false, message: 'Your resident record is still loading. Please try again in a moment.' };
    if (savingRef.current) return { ok: false, message: 'Your request is already being sent. Please wait.' };

    const clash = rows.some(
      (r) =>
        r.pickupDateTs === input.pickupDateTs &&
        r.pickupSlot === input.pickupSlot &&
        r.status !== 'Cancelled' &&
        r.status !== 'Delivered'
    );
    if (clash) return { ok: false, message: 'You already have a laundry pickup booked for that date and time.' };

    savingRef.current = true;
    try {
      const id = doc(collection(db, 'laundryRequests')).id;
      const room = rooms.find((r) => r.id === resident.roomId);
      const now = Date.now();
      await Promise.race([
        setDoc(doc(db, 'laundryRequests', id), {
          id,
          residentId: resident.id,
          residentName: resident.name ?? '',
          room: room?.roomNumber ?? '',
          propertyId: resident.propertyId,
          numClothes: input.numClothes,
          serviceType: input.serviceType,
          notes: input.notes.trim(),
          imageUrl: null,
          pickupDate: input.pickupDate,
          pickupDateTs: input.pickupDateTs,
          pickupSlot: input.pickupSlot,
          expectedDelivery: null,
          charges: null,
          paymentStatus: 'Unpaid',
          adminRemarks: null,
          status: 'Requested',
          statusHistory: [{ status: 'Requested', at: now }],
          createdAt: now,
        }),
        // If the phone is offline the write is queued and never answers, so don't wait forever.
        new Promise((resolve) => setTimeout(resolve, 10000)),
      ]);

      // Optional photo: saved after the request, so a slow upload never blocks it.
      if (input.imageUri) {
        uploadImage(input.imageUri, `laundry/${id}/photo-${Date.now()}.jpg`)
          .then((url) => updateDoc(doc(db, 'laundryRequests', id), { imageUrl: url }))
          .catch((e: any) => {
            console.warn('laundry photo upload failed:', e?.code ?? e?.message);
            Alert.alert('Photo upload failed', 'The request was sent, but its photo could not be uploaded.');
          });
      }
      return { ok: true };
    } catch (e: any) {
      console.warn('addLaundryRequest:', e?.code ?? e?.message);
      return {
        ok: false,
        message:
          e?.code === 'firestore/permission-denied'
            ? 'You are not allowed to send this request. Please contact your PG admin.'
            : 'Could not send the request. Check your connection and try again.',
      };
    } finally {
      savingRef.current = false;
    }
  };

  const cancelRequest = async (id: string): Promise<{ ok: boolean; message?: string }> => {
    const current = rows.find((r) => r.id === id);
    if (!current || (current.status !== 'Requested' && current.status !== 'Pickup Scheduled')) {
      return { ok: false, message: 'This request can no longer be cancelled.' };
    }
    try {
      const now = Date.now();
      await updateDoc(doc(db, 'laundryRequests', id), {
        status: 'Cancelled',
        cancelledAt: now,
        statusHistory: [...current.statusHistory, { status: 'Cancelled', at: now }],
      });
      return { ok: true };
    } catch (e: any) {
      console.warn('cancelLaundry:', e?.code ?? e?.message);
      return { ok: false, message: 'Could not cancel the request. Please try again.' };
    }
  };

  return { requests, loaded, addRequest, cancelRequest };
}

// ───────────── Admin: requests of the active property ─────────────
export function useAdminLaundry() {
  const { activePropertyId } = useAdmin();
  const db = getFirestore();
  const [rows, setRows] = useState<LaundryRequest[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLoaded(false);
    setRows([]);
    if (!activePropertyId) {
      setLoaded(true);
      return;
    }
    return onSnapshot(
      query(collection(db, 'laundryRequests'), where('propertyId', '==', activePropertyId)),
      (snap: any) => {
        setRows(snap.docs.map((d: any) => toRequest({ ...d.data(), id: d.id })));
        setLoaded(true);
      },
      (e: any) => {
        console.warn('admin laundry listener:', e?.code);
        setLoaded(true);
      }
    );
  }, [activePropertyId]);

  const requests = useMemo(() => [...rows].sort(byNewest), [rows]);
  const newRequests = useMemo(() => requests.filter((r) => r.status === 'Requested'), [requests]);

  // Only acts when the request is still in the state the button was shown for
  // (the resident may have cancelled it a second ago). Records every status change.
  const update = async (
    id: string,
    expected: LaundryStatus,
    patch: Record<string, any>,
    newStatus?: LaundryStatus
  ): Promise<{ ok: boolean; message?: string }> => {
    const current = rows.find((r) => r.id === id);
    if (!current || current.status !== expected) {
      return { ok: false, message: 'This request was just updated. The list has been refreshed.' };
    }
    const data: Record<string, any> = { ...patch };
    if (newStatus) {
      data.status = newStatus;
      data.statusHistory = [...current.statusHistory, { status: newStatus, at: Date.now() }];
    }
    try {
      await Promise.race([
        updateDoc(doc(db, 'laundryRequests', id), data),
        new Promise((_, reject) => setTimeout(() => reject({ code: 'timeout' }), 10000)),
      ]);
      return { ok: true };
    } catch (e: any) {
      console.warn('laundry update failed:', e?.code ?? e?.message);
      return {
        ok: false,
        message:
          e?.code === 'firestore/permission-denied'
            ? 'Not allowed. Publish the latest Firestore rules and try again.'
            : 'Check your connection and try again.',
      };
    }
  };

  return { requests, newRequests, loaded, update };
}