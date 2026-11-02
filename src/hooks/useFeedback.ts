import { useEffect, useMemo, useState } from 'react';
import { getFirestore, collection, doc, onSnapshot, query, where, setDoc, updateDoc } from '@react-native-firebase/firestore';
import { useAdmin } from '../context/AdminContext';
import { useMockAuth } from '../context/MockAuthContext';

export const FEEDBACK_CATEGORIES = [
  'Room Cleanliness',
  'Food Quality',
  'Maintenance Service',
  'Staff Behaviour',
  'Housekeeping',
  'Wi-Fi Facilities',
  'Overall PG Experience',
];

export type FeedbackItem = {
  id: string;
  residentId: string;
  propertyId: string;
  residentName: string;
  anonymous: boolean;
  category: string;
  rating: number;
  text: string;
  reviewed?: boolean;
  adminNote?: string;
  createdAt: number;
};

// Resident side: submit feedback and see own history.
export function useFeedback() {
  const { residentId } = useMockAuth();
  const { residents } = useAdmin();
  const db = getFirestore();
  const [rows, setRows] = useState<FeedbackItem[]>([]);

  useEffect(() => {
    if (!residentId) {
      setRows([]);
      return;
    }
    return onSnapshot(
      query(collection(db, 'feedback'), where('residentId', '==', residentId)),
      (snap: any) => setRows(snap.docs.map((d: any) => ({ ...d.data(), id: d.id }))),
      (e: any) => console.warn('feedback listener:', e?.code)
    );
  }, [residentId]);

  const history = useMemo(() => [...rows].sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0)), [rows]);

  const submit = async (category: string, rating: number, text: string, anonymous: boolean): Promise<boolean> => {
    const resident = residents.find((r) => r.id === residentId);
    if (!resident) return false;
    const id = doc(collection(db, 'feedback')).id;
    try {
      await setDoc(doc(db, 'feedback', id), {
        id,
        residentId: resident.id,
        propertyId: resident.propertyId,
        residentName: resident.name,
        anonymous,
        category,
        rating,
        text,
        reviewed: false,
        createdAt: Date.now(),
      });
      return true;
    } catch (e: any) {
      console.warn('submit feedback:', e?.code);
      return false;
    }
  };

  return { history, submit };
}

// Admin side: every feedback entry of the active property.
export function useAdminFeedback() {
  const { activePropertyId } = useAdmin();
  const db = getFirestore();
  const [rows, setRows] = useState<FeedbackItem[]>([]);

  useEffect(() => {
    if (!activePropertyId) {
      setRows([]);
      return;
    }
    return onSnapshot(
      query(collection(db, 'feedback'), where('propertyId', '==', activePropertyId)),
      (snap: any) => setRows(snap.docs.map((d: any) => ({ ...d.data(), id: d.id }))),
      (e: any) => console.warn('admin feedback listener:', e?.code)
    );
  }, [activePropertyId]);

  const items = useMemo(() => [...rows].sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0)), [rows]);
  const newCount = items.filter((f) => !f.reviewed).length;

  const review = (id: string, adminNote: string) =>
    updateDoc(doc(db, 'feedback', id), { reviewed: true, adminNote: adminNote.trim() }).catch((e: any) =>
      console.warn('review feedback:', e?.code)
    );

  return { items, newCount, review };
}