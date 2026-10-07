import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { getFirestore, doc, onSnapshot, setDoc } from '@react-native-firebase/firestore';
import { useMockAuth } from './MockAuthContext';

type MealRatings = Record<string, number>; // key: "day-mealType", value: 1-5

type FoodContextType = {
  ratings: MealRatings;
  rateMeal: (day: string, mealType: string, rating: number) => void;
  getRating: (day: string, mealType: string) => number;
};

const FoodContext = createContext<FoodContextType | undefined>(undefined);

const mealKey = (day: string, mealType: string) => `${day}-${mealType}`;

export function FoodProvider({ children }: { children: ReactNode }) {
  const { residentId } = useMockAuth();
  const [ratings, setRatings] = useState<MealRatings>({});

  useEffect(() => {
    if (!residentId) {
      setRatings({});
      return;
    }
    return onSnapshot(
      doc(getFirestore(), 'mealRatings', residentId),
      (snap: any) => {
        const exists = typeof snap.exists === 'function' ? snap.exists() : !!snap.exists;
        setRatings(exists ? snap.data()?.ratings ?? {} : {});
      },
      (e: any) => console.warn('food ratings listener:', e?.code)
    );
  }, [residentId]);

  const rateMeal = (day: string, mealType: string, rating: number) => {
    if (!residentId) return;
    setRatings((prev) => ({ ...prev, [mealKey(day, mealType)]: rating })); // instant
    setDoc(
      doc(getFirestore(), 'mealRatings', residentId),
      { residentId, ratings: { [mealKey(day, mealType)]: rating } },
      { merge: true }
    ).catch((e: any) => console.warn('rateMeal:', e?.code));
  };

  const getRating = (day: string, mealType: string) => ratings[mealKey(day, mealType)] ?? 0;

  return (
    <FoodContext.Provider value={{ ratings, rateMeal, getRating }}>
      {children}
    </FoodContext.Provider>
  );
}

export function useFood() {
  const context = useContext(FoodContext);
  if (!context) throw new Error('useFood must be used within a FoodProvider');
  return context;
}