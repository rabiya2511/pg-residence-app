import { useEffect, useMemo, useState } from 'react';
import {
  getFirestore, collection, doc, onSnapshot, query, where, setDoc, updateDoc,
} from '@react-native-firebase/firestore';
import { useAdmin } from '../context/AdminContext';
import { useMockAuth } from '../context/MockAuthContext';
import { uploadImage } from '../utils/uploadImage';

export type TicketStatus = 'Open' | 'Assigned' | 'In Progress' | 'Resolved' | 'Closed';
export const TICKET_STATUSES: TicketStatus[] = ['Open', 'Assigned', 'In Progress', 'Resolved', 'Closed'];
export const TICKET_CATEGORIES = [
  'Account & Profile',
  'Payments & Billing',
  'Room & Stay',
  'Food & Dining',
  'Wi-Fi & Internet',
  'Staff & Behaviour',
  'Safety & Security',
  'Other',
];

export type TicketReply = { from: 'resident' | 'admin'; text: string; at: number };
export type SupportTicket = {
  id: string;
  residentId: string;
  propertyId: string;
  residentName: string;
  room?: string;
  category: string;
  subject: string;
  description: string;
  status: TicketStatus;
  assignedTo?: string;
  resolution?: string;
  photo?: string;
  replies: TicketReply[];
  createdAt: number;
  updatedAt: number;
};

export const ticketColor = (s: string): { bg: string; text: string } => {
  switch (s) {
    case 'Open': return { bg: '#FEE2E2', text: '#DC2626' };
    case 'Assigned': return { bg: '#DBEAFE', text: '#2563EB' };
    case 'In Progress': return { bg: '#FEF3C7', text: '#D97706' };
    case 'Resolved': return { bg: '#D1FAE5', text: '#059669' };
    default: return { bg: '#E5E7EB', text: '#6B7280' };
  }
};

export const fmtWhen = (ts: number) =>
  new Date(ts).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

// Resident side: the logged-in resident's own tickets, live. No provider needed.
export function useSupportTickets() {
  const { residentId } = useMockAuth();
  const { residents, rooms } = useAdmin();
  const db = getFirestore();
  const [rows, setRows] = useState<SupportTicket[]>([]);

  useEffect(() => {
    if (!residentId) {
      setRows([]);
      return;
    }
    return onSnapshot(
      query(collection(db, 'supportTickets'), where('residentId', '==', residentId)),
      (snap: any) => setRows(snap.docs.map((d: any) => ({ replies: [], ...d.data(), id: d.id }))),
      (e: any) => console.warn('support tickets listener:', e?.code)
    );
  }, [residentId]);

  const tickets = useMemo(() => [...rows].sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0)), [rows]);

  const createTicket = async (
    category: string,
    subject: string,
    description: string,
    photoUri?: string | null
  ): Promise<boolean> => {
    const resident = residents.find((r) => r.id === residentId);
    if (!resident) return false;
    const room = rooms.find((r) => r.id === resident.roomId);
    const id = doc(collection(db, 'supportTickets')).id;
    const now = Date.now();
    try {
      const photo = photoUri ? await uploadImage(photoUri, `support/${id}.jpg`) : null;
      await setDoc(doc(db, 'supportTickets', id), {
        id,
        residentId: resident.id,
        propertyId: resident.propertyId,
        residentName: resident.name,
        room: room?.roomNumber ?? '-',
        category,
        subject,
        description,
        ...(photo ? { photo } : {}),
        status: 'Open',
        replies: [],
        createdAt: now,
        updatedAt: now,
      });
      return true;
    } catch (e: any) {
      console.warn('createTicket:', e?.code);
      return false;
    }
  };

  // A reply on a Resolved ticket reopens it.
  const reply = (t: SupportTicket, text: string) =>
    updateDoc(doc(db, 'supportTickets', t.id), {
      replies: [...t.replies, { from: 'resident', text, at: Date.now() }],
      status: t.status === 'Resolved' ? 'Open' : t.status,
      updatedAt: Date.now(),
    }).catch((e: any) => console.warn('ticket reply:', e?.code));

  const setStatus = (t: SupportTicket, status: 'Open' | 'Closed') =>
    updateDoc(doc(db, 'supportTickets', t.id), { status, updatedAt: Date.now() }).catch((e: any) =>
      console.warn('ticket status:', e?.code)
    );

  return { tickets, createTicket, reply, reopen: (t: SupportTicket) => setStatus(t, 'Open'), close: (t: SupportTicket) => setStatus(t, 'Closed') };
}