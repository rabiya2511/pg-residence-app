import { useEffect, useState } from 'react';
import { getAuth } from '@react-native-firebase/auth';
import {
  getFirestore, collection, doc, onSnapshot, query, where, setDoc, updateDoc, deleteDoc,
} from '@react-native-firebase/firestore';

// Save this file as src/hooks/useReportData.ts

export type Frequency = 'Daily' | 'Weekly' | 'Monthly';

export type Schedule = {
  id: string;
  reportId: string;
  frequency: Frequency;
  weekday: number; // 0 = Sun
  monthDay: number; // 1-28
  hour: number;
  minute: number;
  range: string;
  enabled: boolean;
  lastSent?: string;
};

export type ReportHistoryItem = {
  id: string;
  reportId: string;
  title: string;
  scope: string; // e.g. "This Month (01 Oct 2026 - 31 Oct 2026)"
  range: string; // e.g. "This Month"
  propertyName: string;
  createdAt: number;
};

const warn = (label: string) => (e: any) => console.warn(label, e?.code ?? e?.message ?? e);

// Scheduled reports of the logged-in admin, live.
export function useReportSchedules() {
  const uid = getAuth().currentUser?.uid;
  const [schedules, setSchedules] = useState<Schedule[]>([]);

  useEffect(() => {
    if (!uid) {
      setSchedules([]);
      return;
    }
    return onSnapshot(
      query(collection(getFirestore(), 'reportSchedules'), where('ownerUid', '==', uid)),
      (snap: any) => {
        const rows = snap.docs.map((d: any) => ({ ...d.data(), id: d.id }));
        rows.sort((a: any, b: any) => (a.createdAt ?? 0) - (b.createdAt ?? 0));
        setSchedules(rows as Schedule[]);
      },
      warn('reportSchedules listener:')
    );
  }, [uid]);

  const addSchedule = (data: Omit<Schedule, 'id' | 'enabled' | 'lastSent'>) => {
    if (!uid) return;
    const db = getFirestore();
    const id = doc(collection(db, 'reportSchedules')).id;
    setDoc(doc(db, 'reportSchedules', id), { ...data, enabled: true, ownerUid: uid, createdAt: Date.now() })
      .catch(warn('addSchedule:'));
  };

  const updateSchedule = (id: string, patch: Partial<Omit<Schedule, 'id'>>) => {
    updateDoc(doc(getFirestore(), 'reportSchedules', id), patch).catch(warn('updateSchedule:'));
  };

  const deleteSchedule = (id: string) => {
    deleteDoc(doc(getFirestore(), 'reportSchedules', id)).catch(warn('deleteSchedule:'));
  };

  return { schedules, addSchedule, updateSchedule, deleteSchedule };
}

// The logged-in admin's generated-report log (newest first, last 50).
export function useReportHistory() {
  const uid = getAuth().currentUser?.uid;
  const [history, setHistory] = useState<ReportHistoryItem[]>([]);

  useEffect(() => {
    if (!uid) {
      setHistory([]);
      return;
    }
    return onSnapshot(
      query(collection(getFirestore(), 'reportHistory'), where('ownerUid', '==', uid)),
      (snap: any) => {
        const rows = snap.docs.map((d: any) => ({ ...d.data(), id: d.id }));
        rows.sort((a: any, b: any) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
        setHistory(rows.slice(0, 50) as ReportHistoryItem[]);
      },
      warn('reportHistory listener:')
    );
  }, [uid]);

  return history;
}

// Call after a report PDF has been generated.
export function logReportExport(entry: Omit<ReportHistoryItem, 'id' | 'createdAt'>) {
  const uid = getAuth().currentUser?.uid;
  if (!uid) return;
  const db = getFirestore();
  const id = doc(collection(db, 'reportHistory')).id;
  setDoc(doc(db, 'reportHistory', id), { ...entry, ownerUid: uid, createdAt: Date.now() })
    .catch(warn('logReportExport:'));
}