import React, { createContext, useContext, useState, ReactNode } from 'react';
import { SavedUpi, SavedCard } from '../constants/mockData';

function detectCardType(cardNumber: string): SavedCard['cardType'] {
  if (/^4/.test(cardNumber)) return 'Visa';
  if (/^5/.test(cardNumber)) return 'Mastercard';
  if (/^6/.test(cardNumber)) return 'RuPay';
  return 'Other';
}

type PaymentMethodsContextType = {
  savedUpiIds: SavedUpi[];
  savedCards: SavedCard[];
  addUpiId: (upiId: string) => SavedUpi;
  addCard: (cardNumber: string, cardHolderName: string, expiryMonth: string, expiryYear: string) => SavedCard;
};

const PaymentMethodsContext = createContext<PaymentMethodsContextType | undefined>(undefined);

export function PaymentMethodsProvider({ children }: { children: ReactNode }) {
  const [savedUpiIds, setSavedUpiIds] = useState<SavedUpi[]>([]);
  const [savedCards, setSavedCards] = useState<SavedCard[]>([]);

  const addUpiId = (upiId: string) => {
    const newEntry: SavedUpi = { id: `upi${Date.now()}`, upiId };
    setSavedUpiIds((prev) => [...prev, newEntry]);
    return newEntry;
  };

  const addCard = (cardNumber: string, cardHolderName: string, expiryMonth: string, expiryYear: string) => {
    const last4 = cardNumber.replace(/\s/g, '').slice(-4);
    const newCard: SavedCard = {
      id: `card${Date.now()}`,
      cardNumberLast4: last4,
      cardHolderName,
      expiryMonth,
      expiryYear,
      cardType: detectCardType(cardNumber.replace(/\s/g, '')),
    };
    setSavedCards((prev) => [...prev, newCard]);
    return newCard;
  };

  return (
    <PaymentMethodsContext.Provider value={{ savedUpiIds, savedCards, addUpiId, addCard }}>
      {children}
    </PaymentMethodsContext.Provider>
  );
}

export function usePaymentMethods() {
  const context = useContext(PaymentMethodsContext);
  if (!context) {
    throw new Error('usePaymentMethods must be used within a PaymentMethodsProvider');
  }
  return context;
}