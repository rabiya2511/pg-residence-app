import React, { createContext, useContext, useState, ReactNode } from 'react';

type Role = 'resident' | 'admin' | null;

type AdminAccount = {
  phone: string;
  name: string;
  propertyIds: string[];
};

// This is the one admin account whose properties are shown to residents in
// the public "Book a Room" flow. Any other admin account (the fixed
// prop_new test number, or any dynamically-registered new PG owner) is a
// separate, isolated PG whose properties are never shown there — only
// visible on that admin's own dashboard.
const PRIMARY_ADMIN_PHONE = '98765 43210';

// This owner already runs 2 properties (Co-living + Ladies PG), so both are
// listed under one login.
// 'prop_new' is a fixed test number for a brand-new PG admin — AdminContext
// should have no seeded data for this propertyId, so every admin screen
// renders with empty lists (no rooms/residents/payments), just the UI shells.
const INITIAL_ADMIN_ACCOUNTS: AdminAccount[] = [
  { phone: PRIMARY_ADMIN_PHONE, name: 'Lokansh Aditya PG Owner', propertyIds: ['prop1', 'prop2'] },
  { phone: '90000 00000', name: 'New PG Admin', propertyIds: ['prop_new'] },
];

// The one fixed number that always logs in as the demo resident (Rabiya).
// Deliberately different from the admin numbers above to avoid role
// collisions — matches residentData.phone / adminResidents r1.phone in
// mockData.ts (update those together if this ever changes).
const FIXED_RESIDENT_PHONE = '99999 99999';

const MOCK_OTP = '1234';

const DEMO_RESIDENT_ID = 'r1';

function cleanPhone(phone: string): string {
  return phone.replace(/[^\d]/g, '');
}

type MockAuthContextType = {
  role: Role;
  residentId: string | null;
  // propertyIds owned by the currently logged-in admin, or null when not an
  // admin session. AdminContext reads this to scope its data.
  adminPropertyIds: string[] | null;
  // propertyIds owned by the main/primary admin account specifically —
  // always available regardless of who (if anyone) is currently logged in,
  // and updates live as that admin adds properties. AdminContext uses this
  // to build the public list of bookable properties for residents.
  mainAdminPropertyIds: string[];
  pendingPhone: string | null;
  requestOtp: (phone: string) => void;
  verifyOtp: (otp: string) => boolean;
  loginWithGoogle: () => void;
  logout: () => void;
  /**
   * Called by AdminContext right after a new property is created via the
   * in-app "Add Property" flow, so it's immediately visible to the admin
   * who created it without requiring a re-login.
   */
  addPropertyToCurrentAdmin: (propertyId: string) => void;
};

const MockAuthContext = createContext<MockAuthContextType | undefined>(undefined);

export function MockAuthProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<Role>(null);
  const [residentId, setResidentId] = useState<string | null>(null);
  const [adminAccounts, setAdminAccounts] = useState<AdminAccount[]>(INITIAL_ADMIN_ACCOUNTS);
  const [currentAdminPhone, setCurrentAdminPhone] = useState<string | null>(null); // stored cleaned (digits only)
  const [pendingPhone, setPendingPhone] = useState<string | null>(null);

  const currentAdmin = adminAccounts.find((a) => cleanPhone(a.phone) === currentAdminPhone);
  const adminPropertyIds = currentAdmin ? currentAdmin.propertyIds : null;

  const mainAdmin = adminAccounts.find((a) => cleanPhone(a.phone) === cleanPhone(PRIMARY_ADMIN_PHONE));
  const mainAdminPropertyIds = mainAdmin ? mainAdmin.propertyIds : [];

  const requestOtp = (phone: string) => {
    setPendingPhone(phone.trim());
  };

  const verifyOtp = (otp: string): boolean => {
    if (otp.trim() !== MOCK_OTP) {
      return false;
    }

    const cleanedPending = cleanPhone(pendingPhone ?? '');

    // 1. The one fixed resident test number always logs in as the demo
    //    resident, regardless of anything else.
    if (cleanedPending === cleanPhone(FIXED_RESIDENT_PHONE)) {
      setRole('resident');
      setResidentId(DEMO_RESIDENT_ID);
      setCurrentAdminPhone(null);
      setPendingPhone(null);
      return true;
    }

    // 2. A known admin phone (prop1/prop2 owner, or the fixed prop_new test
    //    number) logs into their existing account.
    const matchedAdmin = adminAccounts.find((a) => cleanPhone(a.phone) === cleanedPending);
    if (matchedAdmin) {
      setRole('admin');
      setCurrentAdminPhone(cleanedPending);
      setResidentId(null);
      setPendingPhone(null);
      return true;
    }

    // 3. Any other, unrecognized number is a brand-new PG owner logging in
    //    for the first time — automatically registered as a new admin with
    //    one fresh propertyId. AdminContext auto-creates the actual empty
    //    Property record the first time it sees this new id, so every
    //    screen just shows empty lists ready for them to fill in.
    const newPropertyId = `prop_${Date.now()}`;
    const newAccount: AdminAccount = {
      phone: cleanedPending,
      name: 'New PG Owner',
      propertyIds: [newPropertyId],
    };
    setAdminAccounts((prev) => [...prev, newAccount]);
    setRole('admin');
    setCurrentAdminPhone(cleanedPending);
    setResidentId(null);
    setPendingPhone(null);
    return true;
  };

  const loginWithGoogle = () => {
    setRole('resident');
    setResidentId(DEMO_RESIDENT_ID);
    setCurrentAdminPhone(null);
  };

  const logout = () => {
    setRole(null);
    setResidentId(null);
    setCurrentAdminPhone(null);
    setPendingPhone(null);
  };

  const addPropertyToCurrentAdmin = (propertyId: string) => {
    if (!currentAdminPhone) return;
    setAdminAccounts((prev) =>
      prev.map((a) =>
        cleanPhone(a.phone) === currentAdminPhone
          ? { ...a, propertyIds: [...a.propertyIds, propertyId] }
          : a
      )
    );
  };

  return (
    <MockAuthContext.Provider
      value={{
        role,
        residentId,
        adminPropertyIds,
        mainAdminPropertyIds,
        pendingPhone,
        requestOtp,
        verifyOtp,
        loginWithGoogle,
        logout,
        addPropertyToCurrentAdmin,
      }}
    >
      {children}
    </MockAuthContext.Provider>
  );
}

export function useMockAuth() {
  const context = useContext(MockAuthContext);
  if (!context) {
    throw new Error('useMockAuth must be used within a MockAuthProvider');
  }
  return context;
}