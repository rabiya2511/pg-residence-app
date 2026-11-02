import { useEffect, useState } from 'react';
import { getFirestore, doc, onSnapshot, setDoc } from '@react-native-firebase/firestore';
import { useAdmin } from '../context/AdminContext';
import { useMockAuth } from '../context/MockAuthContext';

// The policy sections shown to residents and edited by the admin.
export const RULE_SECTIONS: { key: string; label: string; icon: string; placeholder: string }[] = [
  { key: 'pgRules', label: 'PG Rules', icon: 'book-outline', placeholder: 'General house rules, gate timings, ID card use…' },
  { key: 'visitors', label: 'Visitor Policy', icon: 'people-outline', placeholder: 'Visiting hours, approval required, overnight stay rules…' },
  { key: 'food', label: 'Food Timings', icon: 'restaurant-outline', placeholder: 'Breakfast, lunch and dinner timings, outside food rules…' },
  { key: 'rent', label: 'Rent Payment Policy', icon: 'cash-outline', placeholder: 'Due date, late fee, accepted payment methods…' },
  { key: 'notice', label: 'Notice Period', icon: 'exit-outline', placeholder: 'Notice needed before vacating, deposit refund timeline…' },
  { key: 'cleanliness', label: 'Cleanliness Guidelines', icon: 'sparkles-outline', placeholder: 'Room and common area cleanliness expectations…' },
  { key: 'electricity', label: 'Electricity Usage', icon: 'flash-outline', placeholder: 'Allowed appliances, heater/iron rules, charges…' },
  { key: 'powerBackup', label: 'Power Backup Instructions', icon: 'battery-charging-outline', placeholder: 'What runs on backup, how long, what not to plug in…' },
  { key: 'generator', label: 'Generator Schedule', icon: 'time-outline', placeholder: 'Generator run timings during power cuts…' },
  { key: 'safety', label: 'Safety Instructions', icon: 'shield-checkmark-outline', placeholder: 'Fire safety, locking rooms, valuables…' },
  { key: 'restricted', label: 'Restricted Activities', icon: 'ban-outline', placeholder: 'Smoking, alcohol, cooking in rooms, loud music…' },
  { key: 'emergency', label: 'Emergency Procedures', icon: 'warning-outline', placeholder: 'What to do and who to call in an emergency…' },
];

export type RulesDoc = {
  propertyId: string;
  version: number;
  updatedAt: number;
  [key: string]: any;
};

// Resident side: the rules of the resident's own property + whether they acknowledged the latest version.
export function useRules() {
  const { residentId } = useMockAuth();
  const { residents } = useAdmin();
  const db = getFirestore();
  const propertyId = residents.find((r) => r.id === residentId)?.propertyId;

  const [data, setData] = useState<RulesDoc | null>(null);
  const [ackVersion, setAckVersion] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!propertyId) {
      setData(null);
      return;
    }
    setLoading(true);
    return onSnapshot(
      doc(db, 'rules', propertyId),
      (snap: any) => {
        const exists = typeof snap.exists === 'function' ? snap.exists() : !!snap.exists;
        setData(exists ? (snap.data() as RulesDoc) : null);
        setLoading(false);
      },
      (e: any) => {
        console.warn('rules listener:', e?.code);
        setLoading(false);
      }
    );
  }, [propertyId]);

  useEffect(() => {
    if (!residentId) {
      setAckVersion(0);
      return;
    }
    return onSnapshot(
      doc(db, 'ruleAcks', residentId),
      (snap: any) => {
        const exists = typeof snap.exists === 'function' ? snap.exists() : !!snap.exists;
        setAckVersion(exists ? snap.data()?.version ?? 0 : 0);
      },
      (e: any) => console.warn('rule ack listener:', e?.code)
    );
  }, [residentId]);

  const acknowledged = !!data && ackVersion >= (data.version ?? 1);

  const acknowledge = () => {
    if (!residentId || !propertyId || !data) return;
    setAckVersion(data.version ?? 1); // instant
    setDoc(doc(db, 'ruleAcks', residentId), {
      residentId,
      propertyId,
      version: data.version ?? 1,
      acknowledgedAt: Date.now(),
    }).catch((e: any) => console.warn('acknowledge rules:', e?.code));
  };

  return { data, loading, acknowledged, acknowledge };
}