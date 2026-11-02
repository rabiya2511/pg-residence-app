import { useEffect, useMemo, useState } from 'react';
import { getFirestore, collection, doc, onSnapshot, query, where, updateDoc } from '@react-native-firebase/firestore';
import { useAdmin } from '../context/AdminContext';
import type { SupportTicket, TicketStatus } from './useSupportTickets';

// Admin side: every ticket of the active property, live.
export function useAdminSupport() {
  const { activePropertyId } = useAdmin();
  const db = getFirestore();
  const [rows, setRows] = useState<SupportTicket[]>([]);

  useEffect(() => {
    if (!activePropertyId) {
      setRows([]);
      return;
    }
    return onSnapshot(
      query(collection(db, 'supportTickets'), where('propertyId', '==', activePropertyId)),
      (snap: any) => setRows(snap.docs.map((d: any) => ({ replies: [], ...d.data(), id: d.id }))),
      (e: any) => console.warn('admin support listener:', e?.code)
    );
  }, [activePropertyId]);

  const tickets = useMemo(() => [...rows].sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0)), [rows]);
  const openCount = tickets.filter((t) => t.status === 'Open').length;

  const update = (id: string, data: Record<string, any>) =>
    updateDoc(doc(db, 'supportTickets', id), { ...data, updatedAt: Date.now() }).catch((e: any) =>
      console.warn('admin ticket update:', e?.code)
    );

  const setStatus = (t: SupportTicket, status: TicketStatus) => update(t.id, { status });
  const saveDetails = (t: SupportTicket, assignedTo: string, resolution: string) =>
    update(t.id, { assignedTo: assignedTo.trim(), resolution: resolution.trim() });
  const reply = (t: SupportTicket, text: string) =>
    update(t.id, {
      replies: [...t.replies, { from: 'admin', text, at: Date.now() }],
      status: t.status === 'Open' ? 'In Progress' : t.status,
    });

  return { tickets, openCount, setStatus, saveDetails, reply };
}