import React, { createContext, useContext, useState, ReactNode } from 'react';

type MealRatings = Record<string, number>; // key: "day-mealType", value: 1-5

type FoodContextType = {
  ratings: MealRatings;
  rateMeal: (day: string, mealType: string, rating: number) => void;
  getRating: (day: string, mealType: string) => number;
};

const FoodContext = createContext<FoodContextType | undefined>(undefined);

function mealKey(day: string, mealType: string) {
  return `${day}-${mealType}`;
}

export function FoodProvider({ children }: { children: ReactNode }) {
  const [ratings, setRatings] = useState<MealRatings>({});

  const rateMeal = (day: string, mealType: string, rating: number) => {
    setRatings((prev) => ({ ...prev, [mealKey(day, mealType)]: rating }));
  };

  const getRating = (day: string, mealType: string) => {
    return ratings[mealKey(day, mealType)] ?? 0;
  };

  return (
    <FoodContext.Provider value={{ ratings, rateMeal, getRating }}>
      {children}
    </FoodContext.Provider>
  );
}

export function useFood() {
  const context = useContext(FoodContext);
  if (!context) {
    throw new Error('useFood must be used within a FoodProvider');
  }
  return context;
} 