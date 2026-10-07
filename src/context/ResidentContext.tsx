import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Alert } from 'react-native';
import { useAdmin } from './AdminContext';
import { useMockAuth } from './MockAuthContext';
import { uploadImage } from '../utils/uploadImage';

// The resident's profile, as the Home / Profile / Edit Profile screens use it.
export type ResidentDataType = {
  name: string;
  pgName: string;
  room: string;
  bed: string;
  floor: string;
  joiningDate: string;
  monthlyRent: number;
  nextDueDate: string;
  stayStatus: string;
  email: string;
  phone: string;
  dob: string;
  gender: string;
  profileImageUri: string | null;
  occupation: string;
  companyName: string;
  occupationAddress: string;
  nativePlace: string;
  emergencyContact1: string;
  emergencyContact2: string;
  companyIdProofUri: string | null;
};

// Shown for the split second before the resident's record has loaded
// (instead of someone else's sample data).
const EMPTY_RESIDENT: ResidentDataType = {
  name: '',
  pgName: '',
  room: '',
  bed: '',
  floor: '',
  joiningDate: '',
  monthlyRent: 0,
  nextDueDate: '',
  stayStatus: 'Active',
  email: '',
  phone: '',
  dob: '',
  gender: '',
  profileImageUri: null,
  occupation: '',
  companyName: '',
  occupationAddress: '',
  nativePlace: '',
  emergencyContact1: '',
  emergencyContact2: '',
  companyIdProofUri: null,
};

type ResidentContextType = {
  residentData: ResidentDataType;
  updateResidentData: (updates: Partial<ResidentDataType>) => void;
};

const ResidentContext = createContext<ResidentContextType | undefined>(undefined);

function floorLabel(n: number): string {
  if (n === 0) return 'Ground Floor';
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]} Floor`;
}

// "Nov 5": this month's due date, or next month's once this month's rent is paid.
function nextDueLabel(dueDay: number, paidThisMonth: boolean): string {
  const now = new Date();
  const monthOffset = paidThisMonth ? 1 : 0;
  const d = new Date(now.getFullYear(), now.getMonth() + monthOffset, dueDay);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function ResidentProvider({ children }: { children: ReactNode }) {
  const { residents, updateResident, rooms, properties, paymentRecords } = useAdmin();
  const { residentId } = useMockAuth();

  // A new photo shows straight away from the phone's file while it uploads.
  const [localImages, setLocalImages] = useState<{ profileImageUri?: string; companyIdProofUri?: string }>({});

  const adminRecord: any = residents.find((r) => r.id === residentId);
  // Room and property are looked up live from AdminContext, so a room transfer or an
  // admin's edit shows up here immediately.
  const adminRoom = adminRecord ? rooms.find((r) => r.id === adminRecord.roomId) : undefined;
  const adminProperty = adminRecord ? properties.find((p) => p.id === adminRecord.propertyId) : undefined;

  const currentMonthLabel = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const paidThisMonth = paymentRecords.some(
    (p) => p.residentId === residentId && p.month === currentMonthLabel && p.status === 'Paid'
  );

  const residentData: ResidentDataType = adminRecord
    ? {
        ...EMPTY_RESIDENT,
        name: adminRecord.name ?? '',
        phone: adminRecord.phone ?? '',
        email: adminRecord.email ?? '',
        gender: adminRecord.gender ?? '',
        dob: adminRecord.dob ?? '',
        companyName: adminRecord.companyName ?? '',
        profileImageUri: localImages.profileImageUri ?? adminRecord.profileImageUri ?? null,
        occupation: adminRecord.occupation ?? '',
        occupationAddress: adminRecord.occupationAddress ?? '',
        nativePlace: adminRecord.nativePlace ?? '',
        emergencyContact1: adminRecord.emergencyContact1 ?? '',
        emergencyContact2: adminRecord.emergencyContact2 ?? '',
        companyIdProofUri: localImages.companyIdProofUri ?? adminRecord.companyIdProofUri ?? null,
        pgName: adminProperty?.name ?? '',
        room: adminRoom?.roomNumber ?? '',
        floor: adminRoom ? floorLabel(adminRoom.floor) : '',
        // Rooms only have a capacity (e.g. "3 Sharing"), not individual bed codes.
        bed: adminRoom ? `${adminRoom.capacity} Sharing` : '',
        joiningDate: adminRecord.joiningDate ?? '',
        monthlyRent: adminRecord.monthlyRent ?? 0,
        nextDueDate: nextDueLabel(adminRecord.rentDueDay ?? 5, paidThisMonth),
        stayStatus: adminRecord.vacatingDate ? 'Notice Given' : 'Active',
      }
    : EMPTY_RESIDENT;

  // Photos and files go to Firebase Storage first, then the link is saved on the resident.
  const saveImage = (
    key: 'profileImageUri' | 'companyIdProofUri',
    uri: string | null | undefined,
    fileName: string
  ) => {
    if (!residentId || uri === undefined) return;

    if (!uri || /^https?:/.test(uri)) {
      updateResident(residentId, { [key]: uri } as any);
      return;
    }

    setLocalImages((prev) => ({ ...prev, [key]: uri }));
    const clear = () =>
      setLocalImages((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });

    uploadImage(uri, `profiles/${residentId}/${fileName}-${Date.now()}.jpg`)
      .then((url) => {
        updateResident(residentId, { [key]: url } as any);
        clear();
      })
      .catch((e: any) => {
        console.warn('profile upload failed:', e?.code ?? e?.message);
        clear();
        Alert.alert('Upload failed', 'The photo could not be uploaded. Check your internet connection and try again.');
      });
  };

  const updateResidentData = (updates: Partial<ResidentDataType>) => {
    if (!residentId) return;

    // Text fields saved on the resident's record. The phone number is NOT saved here:
    // it is the resident's login, so only the owner can change it.
    const textKeys = [
      'name',
      'email',
      'gender',
      'dob',
      'companyName',
      'occupation',
      'occupationAddress',
      'nativePlace',
      'emergencyContact1',
      'emergencyContact2',
    ] as const;

    const patch: Record<string, any> = {};
    textKeys.forEach((k) => {
      if (updates[k] !== undefined) patch[k] = updates[k];
    });
    if (Object.keys(patch).length > 0) updateResident(residentId, patch as any);

    saveImage('profileImageUri', updates.profileImageUri, 'photo');
    saveImage('companyIdProofUri', updates.companyIdProofUri, 'company-id');
  };

  return (
    <ResidentContext.Provider value={{ residentData, updateResidentData }}>
      {children}
    </ResidentContext.Provider>
  );
}

export function useResident() {
  const context = useContext(ResidentContext);
  if (!context) {
    throw new Error('useResident must be used within a ResidentProvider');
  }
  return context;
}