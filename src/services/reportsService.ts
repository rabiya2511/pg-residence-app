// Firestore access for the Reports screen: scheduled reports + report history.
// Uses @react-native-firebase (modular API), same as AdminContext.

import { getAuth } from '@react-native-firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  onSnapshot,
  query,
  where,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from '@react-native-firebase/firestore';

export type Frequency = 'Daily' | 'Weekly' | 'Monthly';

export interface Schedule {
  id: string;
  propertyId: string;
  reportId: string;
  frequency: Frequency;
  weekday: number; // 0 = Sun
  monthDay: number; // 1-28
  hour: number;
  minute: number;
  range: string;
  enabled: boolean;
  lastSent: Date | null;
}

export type ScheduleInput = Omit<Schedule, 'id' | 'propertyId' | 'enabled' | 'lastSent'>;

export interface HistoryItem {
  id: string;
  propertyId: string;
  reportId: string;
  title: string;
  scope: string;
  format: string;
  sizeKb: number | null;
  generatedAt: Date | null;
}

const uid = () => {
  const u = getAuth().currentUser?.uid;
  if (!u) throw new Error('Not signed in');
  return u;
};

const toDate = (v: any): Date | null => (v && typeof v.toDate === 'function' ? v.toDate() : null);

const newRef = (name: string) => doc(collection(getFirestore(), name));

// NOTE: every query filters on ownerUid, which is what the security rules require.
// Sorting is done on the client so no composite index is needed.

export function subscribeSchedules(
  propertyId: string,
  onData: (list: Schedule[]) => void,
  onError: (e: Error) => void
) {
  const q = query(
    collection(getFirestore(), 'reportSchedules'),
    where('ownerUid', '==', uid()),
    where('propertyId', '==', propertyId)
  );
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => {
        const x: any = d.data({ serverTimestamps: 'estimate' });
        return {
          id: d.id,
          propertyId: x.propertyId,
          reportId: x.reportId,
          frequency: x.frequency,
          weekday: x.weekday ?? 1,
          monthDay: x.monthDay ?? 1,
          hour: x.hour ?? 9,
          minute: x.minute ?? 0,
          range: x.range ?? 'This Month',
          enabled: x.enabled !== false,
          lastSent: toDate(x.lastSent),
          _created: toDate(x.createdAt)?.getTime() ?? 0,
        } as Schedule & { _created: number };
      });
      list.sort((a: any, b: any) => a._created - b._created);
      onData(list);
    },
    onError
  );
}

export async function createSchedule(propertyId: string, input: ScheduleInput) {
  await setDoc(newRef('reportSchedules'), {
    ...input,
    ownerUid: uid(),
    propertyId,
    enabled: true,
    lastSent: null,
    createdAt: serverTimestamp(),
  });
}

export async function updateSchedule(id: string, propertyId: string, input: ScheduleInput) {
  await updateDoc(doc(getFirestore(), 'reportSchedules', id), { ...input, ownerUid: uid(), propertyId });
}

export async function setScheduleEnabled(id: string, enabled: boolean) {
  await updateDoc(doc(getFirestore(), 'reportSchedules', id), { enabled });
}

export async function markScheduleSent(id: string) {
  await updateDoc(doc(getFirestore(), 'reportSchedules', id), { lastSent: serverTimestamp() });
}

export async function removeSchedule(id: string) {
  await deleteDoc(doc(getFirestore(), 'reportSchedules', id));
}

export function subscribeHistory(
  propertyId: string,
  onData: (list: HistoryItem[]) => void,
  onError: (e: Error) => void
) {
  const q = query(
    collection(getFirestore(), 'reportHistory'),
    where('ownerUid', '==', uid()),
    where('propertyId', '==', propertyId)
  );
  return onSnapshot(
    q,
    (snap) => {
      const list: HistoryItem[] = snap.docs.map((d) => {
        const x: any = d.data({ serverTimestamps: 'estimate' });
        return {
          id: d.id,
          propertyId: x.propertyId,
          reportId: x.reportId,
          title: x.title,
          scope: x.scope ?? 'All Records',
          format: x.format ?? 'PDF',
          sizeKb: typeof x.sizeKb === 'number' ? x.sizeKb : null,
          generatedAt: toDate(x.generatedAt),
        };
      });
      list.sort((a, b) => (b.generatedAt?.getTime() ?? 0) - (a.generatedAt?.getTime() ?? 0));
      onData(list.slice(0, 100));
    },
    onError
  );
}

// Call this from AdminReportDetailScreen after a PDF/Excel/CSV is actually exported,
// so the Audit History reflects real exports (manual ones as well as "Send now").
export async function logReportHistory(
  propertyId: string,
  entry: { reportId: string; title: string; scope: string; format?: string; sizeKb?: number }
) {
  await setDoc(newRef('reportHistory'), {
    ownerUid: uid(),
    propertyId,
    reportId: entry.reportId,
    title: entry.title,
    scope: entry.scope,
    format: entry.format ?? 'PDF',
    sizeKb: entry.sizeKb ?? null,
    generatedAt: serverTimestamp(),
  });
}