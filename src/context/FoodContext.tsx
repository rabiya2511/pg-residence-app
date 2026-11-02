import React, { createContext, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import {
  getFirestore, collection, doc, onSnapshot, query, where, setDoc,
} from '@react-native-firebase/firestore';
import { weeklyMenu } from '../constants/mockData';
import { useAdmin } from './AdminContext';
import { useMockAuth } from './MockAuthContext';

type MealRatings = Record<string, number>; // key: "day-mealType", value: 1-5

export const MEAL_TYPES = ['Breakfast', 'Lunch', 'Dinner'] as const;
export const DEFAULT_TIMINGS: Record<string, string> = {
  Breakfast: '7:30 AM – 9:30 AM',
  Lunch: '12:30 PM – 2:30 PM',
  Dinner: '8:00 PM – 10:00 PM',
};

// `items` is one comma-separated string, the same shape MealCard and mockData use.
export type MenuEntry = { day: string; mealType: string; items: string };
export type FoodFeedback = {
  id: string;
  kind: 'Suggestion' | 'Complaint' | 'Quality';
  text: string;
  createdAt: number;
};

type FoodContextType = {
  ratings: MealRatings;
  rateMeal: (day: string, mealType: string, rating: number) => void;
  getRating: (day: string, mealType: string) => number;
  menu: MenuEntry[];
  timings: Record<string, string>;
  note: string;
  feedback: FoodFeedback[];
  submitFeedback: (kind: FoodFeedback['kind'], text: string) => void;
};

const FoodContext = createContext<FoodContextType | undefined>(undefined);

const mealKey = (day: string, mealType: string) => `${day}-${mealType}`;

export function FoodProvider({ children }: { children: ReactNode }) {
  const { residentId } = useMockAuth();
  const { residents } = useAdmin();
  const db = getFirestore();
  const [ratings, setRatings] = useState<MealRatings>({});
  const [menuDoc, setMenuDoc] = useState<any | null>(null);
  const [feedbackRows, setFeedbackRows] = useState<any[]>([]);

  const propertyId = residents.find((r) => r.id === residentId)?.propertyId;

  useEffect(() => {
    if (!residentId) {
      setRatings({});
      return;
    }
    return onSnapshot(
      doc(db, 'mealRatings', residentId),
      (snap: any) => {
        const exists = typeof snap.exists === 'function' ? snap.exists() : !!snap.exists;
        setRatings(exists ? snap.data()?.ratings ?? {} : {});
      },
      (e: any) => console.warn('food ratings listener:', e?.code)
    );
  }, [residentId]);

  // The menu the admin published for this resident's property.
  useEffect(() => {
    if (!propertyId) {
      setMenuDoc(null);
      return;
    }
    return onSnapshot(
      doc(db, 'foodMenus', propertyId),
      (snap: any) => {
        const exists = typeof snap.exists === 'function' ? snap.exists() : !!snap.exists;
        setMenuDoc(exists ? snap.data() : null);
      },
      (e: any) => console.warn('food menu listener:', e?.code)
    );
  }, [propertyId]);

  useEffect(() => {
    if (!residentId) {
      setFeedbackRows([]);
      return;
    }
    return onSnapshot(
      query(collection(db, 'foodFeedback'), where('residentId', '==', residentId)),
      (snap: any) => setFeedbackRows(snap.docs.map((d: any) => ({ ...d.data(), id: d.id }))),
      (e: any) => console.warn('food feedback listener:', e?.code)
    );
  }, [residentId]);

  const rateMeal = (day: string, mealType: string, rating: number) => {
    if (!residentId) return;
    setRatings((prev) => ({ ...prev, [mealKey(day, mealType)]: rating })); // instant
    setDoc(
      doc(db, 'mealRatings', residentId),
      { residentId, ratings: { [mealKey(day, mealType)]: rating } },
      { merge: true }
    ).catch((e: any) => console.warn('rateMeal:', e?.code));
  };

  const getRating = (day: string, mealType: string) => ratings[mealKey(day, mealType)] ?? 0;

  // Admin's published menu wins; any meal the admin left empty falls back to the built-in sample menu.
  const menu = useMemo<MenuEntry[]>(
    () =>
      (weeklyMenu as unknown as MenuEntry[]).map((m) => {
        const published: string[] | undefined = menuDoc?.days?.[m.day]?.[m.mealType];
        return {
          ...m,
          items: published && published.length > 0 ? published.join(', ') : String(m.items),
        };
      }),
    [menuDoc]
  );

  const timings = useMemo(() => ({ ...DEFAULT_TIMINGS, ...(menuDoc?.timings ?? {}) }), [menuDoc]);
  const note: string = menuDoc?.note ?? '';

  const feedback = useMemo<FoodFeedback[]>(
    () =>
      [...feedbackRows]
        .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
        .map((f) => ({ id: f.id, kind: f.kind, text: f.text, createdAt: f.createdAt ?? 0 })),
    [feedbackRows]
  );

  const submitFeedback = (kind: FoodFeedback['kind'], text: string) => {
    const resident = residents.find((r) => r.id === residentId);
    if (!resident) return;
    const id = doc(collection(db, 'foodFeedback')).id;
    setDoc(doc(db, 'foodFeedback', id), {
      id,
      residentId: resident.id,
      propertyId: resident.propertyId,
      residentName: resident.name,
      kind,
      text,
      createdAt: Date.now(),
    }).catch((e: any) => console.warn('submitFeedback:', e?.code));
  };

  return (
    <FoodContext.Provider
      value={{ ratings, rateMeal, getRating, menu, timings, note, feedback, submitFeedback }}
    >
      {children}
    </FoodContext.Provider>
  );
}

export function useFood() {
  const context = useContext(FoodContext);
  if (!context) throw new Error('useFood must be used within a FoodProvider');
  return context;
}