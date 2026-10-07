import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Linking, Platform } from 'react-native';
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
  Timestamp,
} from '@react-native-firebase/firestore';
import { useAdmin } from './AdminContext';
import {
  MessageTemplate,
  MessageCategory,
  Channel,
  DEFAULT_TEMPLATES,
  ALL_PLACEHOLDER_TOKENS,
} from '../constants/communicationsData';
// Fallbacks used only when the property document has no upiId / payeeName yet.
import { PG_UPI_ID, PG_PAYEE_NAME } from '../constants/mockData';

export type MessageStatus = 'Sent' | 'Scheduled' | 'Draft' | 'Failed';

export type CommunicationMessage = {
  id: string;
  propertyId: string;
  residentId: string;
  residentName: string;
  roomLabel: string;
  propertyName: string;
  phone: string;
  category: MessageCategory | null;
  channel: Channel;
  subject: string; // resolved (placeholders filled)
  body: string; // resolved
  rawSubject: string; // unresolved, used when re-editing a draft
  rawBody: string;
  status: MessageStatus;
  scheduledFor: number | null;
  createdAt: number;
  sentAt: number | null;
  sentBy: string;
  failReason: string | null;
};

export type ComposeInput = {
  residentId: string;
  category: MessageCategory | null;
  channel: Channel;
  subject: string;
  body: string;
};

type NewTemplateInput = { category: MessageCategory; name: string; subject: string; body: string };

type CommunicationsContextType = {
  templates: MessageTemplate[];
  messages: CommunicationMessage[];
  loading: boolean;
  addTemplate: (t: NewTemplateInput) => Promise<void>;
  deleteTemplate: (id: string) => Promise<void>;
  resolvePlaceholders: (text: string, residentId: string) => string;
  sendNow: (input: ComposeInput) => Promise<{ ok: boolean; message: string }>;
  scheduleMessage: (input: ComposeInput, scheduledFor: number) => Promise<void>;
  saveDraft: (input: ComposeInput, existingId?: string) => Promise<void>;
  sendScheduledNow: (id: string) => Promise<void>;
  retryFailed: (id: string) => Promise<void>;
  deleteMessage: (id: string) => Promise<void>;
};

const CommunicationsContext = createContext<CommunicationsContextType | undefined>(undefined);

const toMs = (v: any): number | null => (v && typeof v.toMillis === 'function' ? v.toMillis() : null);

const ordinal = (n: number) => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

// Firestore rejects `undefined`, so strip it before writing.
const clean = (o: Record<string, any>) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));

// A new document reference with an auto-generated id.
const newRef = (name: string) => doc(collection(getFirestore(), name));

export function CommunicationsProvider({ children }: { children: ReactNode }) {
  const { residents, rooms, properties } = useAdmin();
  const propertyId: string | undefined = properties[0]?.id;

  const [customTemplates, setCustomTemplates] = useState<MessageTemplate[]>([]);
  const [messages, setMessages] = useState<CommunicationMessage[]>([]);
  const [loading, setLoading] = useState(true);

  // ───────── live subscriptions ─────────
  useEffect(() => {
    if (!propertyId) {
      setCustomTemplates([]);
      setMessages([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const db = getFirestore();

    const unsubTemplates = onSnapshot(
      query(collection(db, 'messageTemplates'), where('propertyId', '==', propertyId)),
      (snap) => {
        const list = snap.docs.map((d) => {
          const x: any = d.data({ serverTimestamps: 'estimate' });
          return {
            id: d.id,
            category: x.category as MessageCategory,
            name: x.name ?? 'Untitled Template',
            subject: x.subject ?? '',
            body: x.body ?? '',
            isDefault: false,
            isActive: x.isActive !== false,
            _created: toMs(x.createdAt) ?? 0,
          };
        });
        list.sort((a, b) => b._created - a._created);
        setCustomTemplates(list.map(({ _created, ...t }) => t));
      },
      (e) => console.warn('messageTemplates listener error', e)
    );

    const unsubMessages = onSnapshot(
      query(collection(db, 'communications'), where('propertyId', '==', propertyId)),
      (snap) => {
        const list: CommunicationMessage[] = snap.docs.map((d) => {
          const x: any = d.data({ serverTimestamps: 'estimate' });
          return {
            id: d.id,
            propertyId: x.propertyId,
            residentId: x.residentId,
            residentName: x.residentName ?? 'Unknown',
            roomLabel: x.roomLabel ?? '—',
            propertyName: x.propertyName ?? '—',
            phone: x.phone ?? '',
            category: x.category ?? null,
            channel: x.channel as Channel,
            subject: x.subject ?? '',
            body: x.body ?? '',
            rawSubject: x.rawSubject ?? '',
            rawBody: x.rawBody ?? '',
            status: x.status as MessageStatus,
            scheduledFor: toMs(x.scheduledFor),
            createdAt: toMs(x.createdAt) ?? Date.now(),
            sentAt: toMs(x.sentAt),
            sentBy: x.sentBy ?? 'Admin',
            failReason: x.failReason ?? null,
          };
        });
        setMessages(list);
        setLoading(false);
      },
      (e) => {
        console.warn('communications listener error', e);
        setLoading(false);
      }
    );

    return () => {
      unsubTemplates();
      unsubMessages();
    };
  }, [propertyId]);

  const templates: MessageTemplate[] = [...customTemplates, ...DEFAULT_TEMPLATES];

  // ───────── templates ─────────
  const addTemplate = async (t: NewTemplateInput) => {
    if (!propertyId) throw new Error('No property selected.');
    await setDoc(
      newRef('messageTemplates'),
      clean({
        propertyId,
        ownerUid: getAuth().currentUser?.uid ?? null,
        category: t.category,
        name: t.name,
        subject: t.subject,
        body: t.body,
        isActive: true,
        createdAt: serverTimestamp(),
      })
    );
  };

  const deleteTemplate = async (id: string) => {
    await deleteDoc(doc(getFirestore(), 'messageTemplates', id));
  };

  // ───────── placeholders ─────────
  const resolvePlaceholders = (text: string, residentId: string): string => {
    const resident: any = residents.find((r) => r.id === residentId);
    const room: any = resident ? rooms.find((r) => r.id === resident.roomId) : undefined;
    const property: any = resident ? properties.find((p) => p.id === resident.propertyId) : properties[0];

    const fmt = (d: Date) => d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const upi = property?.upiId ?? PG_UPI_ID;
    const payee = property?.payeeName ?? PG_PAYEE_NAME;
    const rent = String(resident?.monthlyRent ?? 0);
    const dueDay = Number(resident?.rentDueDay ?? 5);

    const values: Record<string, string> = {
      '{{ResidentName}}': resident?.name ?? 'Resident',
      '{{MobileNumber}}': resident?.phone ?? '',
      '{{Email}}': resident?.email ?? '',
      '{{RoomNumber}}': room?.roomNumber ?? '—',
      '{{BedNumber}}': String(resident?.bedNumber ?? '—'),
      '{{JoiningDate}}': resident?.joiningDate ?? '—',
      '{{PropertyName}}': property?.name ?? 'the property',
      '{{PropertyAddress}}': property?.address ?? '—',
      '{{PropertyContactNumber}}': property?.contactNumber ?? '—',
      '{{PropertyEmail}}': property?.email ?? '—',
      '{{WifiName}}': property?.wifiName ?? '—',
      '{{WifiPassword}}': property?.wifiPassword ?? 'ask front desk',
      '{{WhatsappGroupLink}}': property?.whatsappGroupLink ?? 'ask front desk',
      '{{UpiId}}': upi,
      '{{PayeeName}}': payee,
      '{{GoogleReviewLink}}': property?.googleReviewLink ?? 'ask front desk',
      '{{RentAmount}}': rent,
      '{{PaymentDueAmount}}': rent,
      '{{DueDate}}': `${ordinal(dueDay)} of the month`,
      '{{PendingAmount}}': rent,
      '{{PaymentLink}}': `upi://pay?pa=${upi}&pn=${encodeURIComponent(payee)}&cu=INR`,
      '{{CurrentDate}}': fmt(new Date()),
      '{{NoticeDate}}': fmt(new Date()),
      '{{ExitDate}}': resident?.vacatingDate ?? '—',
      '{{StaffName}}': getAuth().currentUser?.displayName ?? 'Admin Team',
    };

    let result = text;
    ALL_PLACEHOLDER_TOKENS.forEach((token) => {
      if (values[token] !== undefined) result = result.split(token).join(values[token]);
    });
    return result;
  };

  // ───────── building + delivering ─────────
  const buildPayload = (input: ComposeInput, status: MessageStatus, extra: Record<string, any> = {}) => {
    const resident: any = residents.find((r) => r.id === input.residentId);
    const room: any = resident ? rooms.find((r) => r.id === resident.roomId) : undefined;
    const property: any = resident ? properties.find((p) => p.id === resident.propertyId) : properties[0];

    return {
      propertyId: resident?.propertyId ?? propertyId,
      ownerUid: getAuth().currentUser?.uid ?? null,
      residentId: input.residentId,
      residentName: resident?.name ?? 'Unknown',
      roomLabel: room?.roomNumber ?? '—',
      propertyName: property?.name ?? '—',
      phone: resident?.phone ?? '',
      category: input.category ?? null,
      channel: input.channel,
      subject: resolvePlaceholders(input.subject, input.residentId),
      body: resolvePlaceholders(input.body, input.residentId),
      rawSubject: input.subject,
      rawBody: input.body,
      status,
      scheduledFor: null,
      sentAt: null,
      sentBy: getAuth().currentUser?.displayName ?? 'Admin Team',
      failReason: null,
      createdAt: serverTimestamp(),
      ...extra,
    };
  };

  // Opens WhatsApp / SMS / Email with the message pre-filled. The admin taps send in that app.
  const deliver = async (m: { channel: Channel; phone: string; subject: string; body: string }): Promise<{ ok: boolean; reason?: string }> => {
    try {
      if (m.channel === 'WhatsApp') {
        let digits = m.phone.replace(/[^\d]/g, '');
        if (!digits) return { ok: false, reason: 'No phone number on file.' };
        if (digits.length === 10) digits = `91${digits}`; // assume India for 10-digit numbers
        await Linking.openURL(`https://wa.me/${digits}?text=${encodeURIComponent(m.body)}`);
        return { ok: true };
      }
      if (m.channel === 'SMS') {
        const digits = m.phone.replace(/\s/g, '');
        if (!digits) return { ok: false, reason: 'No phone number on file.' };
        const sep = Platform.OS === 'ios' ? '&' : '?';
        await Linking.openURL(`sms:${digits}${sep}body=${encodeURIComponent(m.body)}`);
        return { ok: true };
      }
      if (m.channel === 'Email') {
        await Linking.openURL(`mailto:?subject=${encodeURIComponent(m.subject)}&body=${encodeURIComponent(m.body)}`);
        return { ok: true };
      }
      // In-App Alert: nothing to open; the stored document is the alert.
      return { ok: true };
    } catch (e: any) {
      return { ok: false, reason: e?.message ?? 'Could not open the app to send this message.' };
    }
  };

  const markFailed = (id: string, reason?: string) =>
    updateDoc(doc(getFirestore(), 'communications', id), { status: 'Failed', failReason: reason ?? 'Delivery failed.' });

  // ───────── actions ─────────
  const sendNow = async (input: ComposeInput) => {
    if (!propertyId) return { ok: false, message: 'No property selected.' };
    const payload = buildPayload(input, 'Sent', { sentAt: serverTimestamp() });
    const ref = newRef('communications');
    await setDoc(ref, clean(payload));
    const result = await deliver({ channel: input.channel, phone: payload.phone, subject: payload.subject, body: payload.body });
    if (!result.ok) {
      await markFailed(ref.id, result.reason);
      return { ok: false, message: result.reason ?? 'Delivery failed.' };
    }
    return { ok: true, message: 'Message handed off to send.' };
  };

  const scheduleMessage = async (input: ComposeInput, scheduledFor: number) => {
    if (!propertyId) throw new Error('No property selected.');
    await setDoc(
      newRef('communications'),
      clean(buildPayload(input, 'Scheduled', { scheduledFor: Timestamp.fromMillis(scheduledFor) }))
    );
  };

  const saveDraft = async (input: ComposeInput, existingId?: string) => {
    if (!propertyId) throw new Error('No property selected.');
    if (existingId) {
      const p = buildPayload(input, 'Draft');
      await updateDoc(
        doc(getFirestore(), 'communications', existingId),
        clean({
          residentId: p.residentId,
          residentName: p.residentName,
          roomLabel: p.roomLabel,
          propertyName: p.propertyName,
          phone: p.phone,
          category: p.category,
          channel: p.channel,
          subject: p.subject,
          body: p.body,
          rawSubject: p.rawSubject,
          rawBody: p.rawBody,
        })
      );
      return;
    }
    await setDoc(newRef('communications'), clean(buildPayload(input, 'Draft')));
  };

  // Shared by "Send Now" on a scheduled message and "Retry" on a failed one.
  const dispatchExisting = async (id: string) => {
    const m = messages.find((x) => x.id === id);
    if (!m) return;
    await updateDoc(doc(getFirestore(), 'communications', id), {
      status: 'Sent',
      sentAt: serverTimestamp(),
      failReason: null,
    });
    const result = await deliver({ channel: m.channel, phone: m.phone, subject: m.subject, body: m.body });
    if (!result.ok) await markFailed(id, result.reason);
  };

  const sendScheduledNow = (id: string) => dispatchExisting(id);
  const retryFailed = (id: string) => dispatchExisting(id);

  const deleteMessage = async (id: string) => {
    await deleteDoc(doc(getFirestore(), 'communications', id));
  };

  return (
    <CommunicationsContext.Provider
      value={{
        templates,
        messages,
        loading,
        addTemplate,
        deleteTemplate,
        resolvePlaceholders,
        sendNow,
        scheduleMessage,
        saveDraft,
        sendScheduledNow,
        retryFailed,
        deleteMessage,
      }}
    >
      {children}
    </CommunicationsContext.Provider>
  );
}

export function useCommunications() {
  const context = useContext(CommunicationsContext);
  if (!context) throw new Error('useCommunications must be used within a CommunicationsProvider');
  return context;
}