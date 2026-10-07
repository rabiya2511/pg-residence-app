import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { getAuth } from '@react-native-firebase/auth';
import {
  getFirestore, collection, doc, onSnapshot, setDoc,
} from '@react-native-firebase/firestore';
import { SavedUpi, SavedCard } from '../constants/mockData';
import { useMockAuth } from './MockAuthContext';

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
  const { role } = useMockAuth(); // changes on login/logout, so the lists reload for the new user
  const [savedUpiIds, setSavedUpiIds] = useState<SavedUpi[]>([]);
  const [savedCards, setSavedCards] = useState<SavedCard[]>([]);

  useEffect(() => {
    const uid = getAuth().currentUser?.uid;
    if (!uid) {
      setSavedUpiIds([]);
      setSavedCards([]);
      return;
    }
    const db = getFirestore();
    const unsubUpi = onSnapshot(
      collection(db, 'users', uid, 'savedUpi'),
      (snap: any) => setSavedUpiIds(snap.docs.map((d: any) => ({ ...d.data(), id: d.id }))),
      (e: any) => console.warn('savedUpi listener:', e?.code)
    );
    const unsubCards = onSnapshot(
      collection(db, 'users', uid, 'savedCards'),
      (snap: any) => setSavedCards(snap.docs.map((d: any) => ({ ...d.data(), id: d.id }))),
      (e: any) => console.warn('savedCards listener:', e?.code)
    );
    return () => {
      unsubUpi();
      unsubCards();
    };
  }, [role]);

  const addUpiId = (upiId: string): SavedUpi => {
    const uid = getAuth().currentUser?.uid;
    const db = getFirestore();
    const id = doc(collection(db, 'users', uid ?? 'none', 'savedUpi')).id;
    const entry: SavedUpi = { id, upiId };
    if (uid) setDoc(doc(db, 'users', uid, 'savedUpi', id), entry).catch((e: any) => console.warn('addUpiId:', e?.code));
    return entry;
  };

  const addCard = (cardNumber: string, cardHolderName: string, expiryMonth: string, expiryYear: string): SavedCard => {
    const uid = getAuth().currentUser?.uid;
    const db = getFirestore();
    const digits = cardNumber.replace(/\s/g, '');
    const id = doc(collection(db, 'users', uid ?? 'none', 'savedCards')).id;
    const card: SavedCard = {
      id,
      cardNumberLast4: digits.slice(-4),
      cardHolderName,
      expiryMonth,
      expiryYear,
      cardType: detectCardType(digits),
    };
    if (uid) setDoc(doc(db, 'users', uid, 'savedCards', id), card).catch((e: any) => console.warn('addCard:', e?.code));
    return card;
  };

  return (
    <PaymentMethodsContext.Provider value={{ savedUpiIds, savedCards, addUpiId, addCard }}>
      {children}
    </PaymentMethodsContext.Provider>
  );
}

export function usePaymentMethods() {
  const context = useContext(PaymentMethodsContext);
  if (!context) throw new Error('usePaymentMethods must be used within a PaymentMethodsProvider');
  return context;
}