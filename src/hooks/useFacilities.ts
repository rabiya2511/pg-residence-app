import { useEffect, useState } from 'react';
import { getFirestore, doc, onSnapshot } from '@react-native-firebase/firestore';
import { useAdmin } from '../context/AdminContext';
import { useMockAuth } from '../context/MockAuthContext';

export type WifiRow = { floor: string; network: string; password: string };
export type EmergencyRow = { label: string; phone: string };
export type FacilitiesData = {
  wifi: WifiRow[];
  emergency: EmergencyRow[];
  [textKey: string]: any;
};

// The text sections shown to residents and edited by the admin.
export const FACILITY_SECTIONS: { key: string; label: string; icon: string; placeholder: string }[] = [
  { key: 'hotWater', label: 'Hot Water', icon: 'water-outline', placeholder: 'e.g., Available 5:30 AM – 9:00 AM and 6 PM – 9 PM' },
  { key: 'drinkingWater', label: 'Drinking Water', icon: 'beaker-outline', placeholder: 'e.g., RO water available on every floor' },
  { key: 'powerBackup', label: 'Power Backup', icon: 'flash-outline', placeholder: 'e.g., 24x7 inverter backup for lights and fans' },
  { key: 'generator', label: 'Generator Schedule', icon: 'time-outline', placeholder: 'e.g., Runs during power cuts, 6 PM – 11 PM' },
  { key: 'housekeeping', label: 'Housekeeping Schedule', icon: 'sparkles-outline', placeholder: 'e.g., Rooms cleaned daily 10 AM – 12 PM' },
  { key: 'laundry', label: 'Laundry Facilities', icon: 'shirt-outline', placeholder: 'e.g., Washing machines on terrace, 7 AM – 9 PM' },
  { key: 'parking', label: 'Parking', icon: 'car-outline', placeholder: 'e.g., Two-wheeler parking in basement' },
  { key: 'commonAreas', label: 'Common Area Guidelines', icon: 'people-outline', placeholder: 'e.g., Keep common areas clean, no loud music after 10 PM' },
  { key: 'evacuation', label: 'Emergency Evacuation', icon: 'warning-outline', placeholder: 'e.g., Use the staircase, assemble at the front gate' },
];

export const EMPTY_FACILITIES: FacilitiesData = { wifi: [], emergency: [] };

// Resident side: the facilities info the admin published for the resident's own property.
export function useFacilities() {
  const { residentId } = useMockAuth();
  const { residents } = useAdmin();
  const propertyId = residents.find((r) => r.id === residentId)?.propertyId;
  const [data, setData] = useState<FacilitiesData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!propertyId) {
      setData(null);
      return;
    }
    setLoading(true);
    return onSnapshot(
      doc(getFirestore(), 'facilities', propertyId),
      (snap: any) => {
        const exists = typeof snap.exists === 'function' ? snap.exists() : !!snap.exists;
        setData(exists ? { ...EMPTY_FACILITIES, ...snap.data() } : null);
        setLoading(false);
      },
      (e: any) => {
        console.warn('facilities listener:', e?.code);
        setLoading(false);
      }
    );
  }, [propertyId]);

  return { data, loading };
}