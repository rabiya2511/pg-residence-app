import React, { createContext, useContext, ReactNode } from 'react';
import { useAdmin } from './AdminContext';
import { useMockAuth } from './MockAuthContext';
import { residentData as fallbackResidentData } from '../constants/mockData';

type ResidentDataType = typeof fallbackResidentData;

type ResidentContextType = {
  residentData: ResidentDataType;
  updateResidentData: (updates: Partial<ResidentDataType>) => void;
};

const ResidentContext = createContext<ResidentContextType | undefined>(undefined);

export function ResidentProvider({ children }: { children: ReactNode }) {
  const { residents, updateResident } = useAdmin();
  const { residentId } = useMockAuth();

  const adminRecord = residents.find((r) => r.id === residentId);

  // Every field that also exists on AdminResident is synced from there —
  // so an admin's edit (via AdminResidentFormScreen) and a resident's own
  // edit (via EditProfileScreen) both read/write the same underlying
  // record. dob and companyName have no AdminResident equivalent, so they
  // stay purely local (fall back to the static mock value, as before).
  const residentData: ResidentDataType = {
    ...fallbackResidentData,
    name: adminRecord?.name ?? fallbackResidentData.name,
    phone: adminRecord?.phone ?? fallbackResidentData.phone,
    email: adminRecord?.email ?? fallbackResidentData.email,
    gender: adminRecord?.gender ?? fallbackResidentData.gender,
    profileImageUri: adminRecord?.profileImageUri ?? fallbackResidentData.profileImageUri,
    occupation: adminRecord?.occupation ?? fallbackResidentData.occupation,
    occupationAddress: adminRecord?.occupationAddress ?? fallbackResidentData.occupationAddress,
    nativePlace: adminRecord?.nativePlace ?? fallbackResidentData.nativePlace,
    emergencyContact1: adminRecord?.emergencyContact1 ?? fallbackResidentData.emergencyContact1,
    emergencyContact2: adminRecord?.emergencyContact2 ?? fallbackResidentData.emergencyContact2,
    companyIdProofUri: adminRecord?.companyIdProofUri ?? fallbackResidentData.companyIdProofUri,
  };

  const updateResidentData = (updates: Partial<ResidentDataType>) => {
    if (!residentId) return;

    // Only forward the fields AdminResident actually has — dob/companyName
    // are deliberately excluded since there's nowhere on AdminResident for
    // them to live.
    const {
      name,
      phone,
      email,
      gender,
      profileImageUri,
      occupation,
      occupationAddress,
      nativePlace,
      emergencyContact1,
      emergencyContact2,
      companyIdProofUri,
    } = updates;

    const hasSyncableUpdate =
      name !== undefined ||
      phone !== undefined ||
      email !== undefined ||
      gender !== undefined ||
      profileImageUri !== undefined ||
      occupation !== undefined ||
      occupationAddress !== undefined ||
      nativePlace !== undefined ||
      emergencyContact1 !== undefined ||
      emergencyContact2 !== undefined ||
      companyIdProofUri !== undefined;

    if (hasSyncableUpdate) {
      updateResident(residentId, {
        ...(name !== undefined && { name }),
        ...(phone !== undefined && { phone }),
        ...(email !== undefined && { email }),
        ...(gender !== undefined && { gender: gender as any }),
        ...(profileImageUri !== undefined && { profileImageUri }),
        ...(occupation !== undefined && { occupation }),
        ...(occupationAddress !== undefined && { occupationAddress }),
        ...(nativePlace !== undefined && { nativePlace }),
        ...(emergencyContact1 !== undefined && { emergencyContact1 }),
        ...(emergencyContact2 !== undefined && { emergencyContact2 }),
        ...(companyIdProofUri !== undefined && { companyIdProofUri }),
      });
    }
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