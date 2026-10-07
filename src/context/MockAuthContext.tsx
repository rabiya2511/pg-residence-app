import React, { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { Alert } from 'react-native';
import { getAuth, onAuthStateChanged, signInWithPhoneNumber, signOut } from '@react-native-firebase/auth';
import { getFirestore, doc, getDoc, setDoc, updateDoc } from '@react-native-firebase/firestore';
import { collection, query, where, limit, getDocs } from '@react-native-firebase/firestore';

// NOTE: the file and hook names (MockAuthProvider / useMockAuth) are kept on purpose so
// every screen that already imports them keeps working. Inside, login is now real Firebase
// phone authentication and the user's profile is stored in Firestore (users/{uid}).

type Role = 'resident' | 'admin' | null;

type UserProfile = {
  phone: string; // digits only
  name: string;
  role: 'resident' | 'admin';
  residentId: string | null;
  propertyIds: string[]; // only used for admins
};

// ───────── Interim role rules (same behaviour as the old mock login) ─────────
// Until residents and admins live in Firestore, these decide who a phone number is
// the FIRST time it logs in. The result is saved in users/{uid} so later logins
// reuse it. Phase 2 replaces this with a lookup in the residents collection.
const PRIMARY_ADMIN_PHONE = '98765 43210';
const FIXED_RESIDENT_PHONE = '99999 99999';
const DEMO_RESIDENT_ID = 'r1';

const KNOWN_ADMINS: { phone: string; name: string; propertyIds: string[] }[] = [
  { phone: PRIMARY_ADMIN_PHONE, name: 'Lokansh Aditya PG Owner', propertyIds: ['prop1', 'prop2'] },
  { phone: '90000 00000', name: 'New PG Admin', propertyIds: ['prop_new'] },
];

function cleanPhone(phone: string): string {
  return phone.replace(/[^\d]/g, '');
}

// Compare by the last 10 digits so "+91 98765 43210" and "98765 43210" match.
function last10(phone: string): string {
  return cleanPhone(phone).slice(-10);
}

// Firebase needs international format. Indian 10-digit numbers get +91.
function toE164(raw: string): string {
  const t = raw.trim();
  if (t.startsWith('+')) return `+${cleanPhone(t)}`;
  const d = cleanPhone(t);
  if (d.length === 10) return `+91${d}`;
  return `+${d}`;
}

function snapExists(snap: any): boolean {
  return typeof snap.exists === 'function' ? snap.exists() : !!snap.exists;
}

function buildInitialProfile(phoneDigits: string): UserProfile {
  const p10 = last10(phoneDigits);

  if (p10 === last10(FIXED_RESIDENT_PHONE)) {
    return { phone: phoneDigits, name: 'Resident', role: 'resident', residentId: DEMO_RESIDENT_ID, propertyIds: [] };
  }

  const known = KNOWN_ADMINS.find((a) => last10(a.phone) === p10);
  if (known) {
    return { phone: phoneDigits, name: known.name, role: 'admin', residentId: null, propertyIds: known.propertyIds };
  }

  // Any other number is a brand-new PG owner: one fresh, empty property.
  return {
    phone: phoneDigits,
    name: 'New PG Owner',
    role: 'admin',
    residentId: null,
    propertyIds: [`prop_${Date.now()}`],
  };
}

// Is this phone number one of the residents an admin has added?
async function findResidentProfile(phoneDigits: string): Promise<UserProfile | null> {
  const snap = await getDocs(
    query(collection(getFirestore(), 'residents'), where('phoneKey', '==', last10(phoneDigits)), limit(1))
  );
  if (snap.empty) return null;
  const d: any = snap.docs[0];
  const data = d.data();
  if (data.archived) return null;
  return { phone: phoneDigits, name: data.name, role: 'resident', residentId: d.id, propertyIds: [] };
}

type MockAuthContextType = {
  role: Role;
  residentId: string | null;
  adminPropertyIds: string[] | null;
  mainAdminPropertyIds: string[];
  pendingPhone: string | null;
  /** True until Firebase has reported whether someone is already logged in. */
  initializing: boolean;
  /** Last login problem (wrong code, no network...). Cleared on the next attempt. */
  authError: string | null;
  /** Sends the SMS code. Resolves true when the code was sent. */
  requestOtp: (phone: string) => Promise<boolean>;
  /** Checks the code. Resolves true when login succeeded. */
  verifyOtp: (otp: string) => Promise<boolean>;
  loginWithGoogle: () => void;
  logout: () => void;
  addPropertyToCurrentAdmin: (propertyId: string) => void;
  removePropertyFromCurrentAdmin: (propertyId: string) => void;
};

const MockAuthContext = createContext<MockAuthContextType | undefined>(undefined);

type Confirmation = Awaited<ReturnType<typeof signInWithPhoneNumber>>;

export function MockAuthProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<Role>(null);
  const [residentId, setResidentId] = useState<string | null>(null);
  const [adminPropertyIds, setAdminPropertyIds] = useState<string[] | null>(null);
  // Properties shown to residents in the public "Book a Room" flow (primary admin's).
  const [mainAdminPropertyIds, setMainAdminPropertyIds] = useState<string[]>(
    KNOWN_ADMINS.find((a) => last10(a.phone) === last10(PRIMARY_ADMIN_PHONE))?.propertyIds ?? []
  );
  const [pendingPhone, setPendingPhone] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [currentPhone, setCurrentPhone] = useState<string | null>(null);

  const confirmationRef = useRef<Confirmation | null>(null);

  const clearSession = () => {
    setRole(null);
    setResidentId(null);
    setAdminPropertyIds(null);
    setCurrentPhone(null);
  };

  // Runs on app start and whenever someone logs in or out.
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(getAuth(), async (user) => {
      if (!user) {
        clearSession();
        setInitializing(false);
        return;
      }

      try {
        const db = getFirestore();
        const ref = doc(db, 'users', user.uid);
        const snap = await getDoc(ref);

        let profile: UserProfile;
        if (snapExists(snap)) {
          profile = snap.data() as UserProfile;

          // A resident's saved profile can point at the wrong (or a deleted) resident record,
          // e.g. the old demo id "r1". Look the phone number up again on every login and
          // correct the link when a resident with this number exists.
          if (profile.role === 'resident') {
            try {
              const found = await findResidentProfile(cleanPhone(user.phoneNumber ?? ''));
              if (found && found.residentId !== profile.residentId) {
                await updateDoc(ref, { residentId: found.residentId });
                profile = { ...profile, residentId: found.residentId, name: found.name };
              }
            } catch (e) {
              // Keep the saved profile if the re-check cannot run (e.g. offline).
            }
          }
        } else {
          const digits = cleanPhone(user.phoneNumber ?? '');
          profile = (await findResidentProfile(digits)) ?? buildInitialProfile(digits);
          await setDoc(ref, { ...profile, createdAt: Date.now() });
        }

        setRole(profile.role);
        setResidentId(profile.role === 'resident' ? profile.residentId : null);
        setAdminPropertyIds(profile.role === 'admin' ? profile.propertyIds ?? [] : null);
        setCurrentPhone(profile.phone);
        setPendingPhone(null);
      } catch (e: any) {
        console.warn('PROFILE LOAD FAILED:', e?.code, e?.message);
        setAuthError(
          `Could not load your account (${e?.code ?? e?.message ?? 'unknown error'}). Check your internet connection and try again.`
        );
        await signOut(getAuth());
        clearSession();
      } finally {
        setInitializing(false);
      }
    });
    return unsubscribe;
  }, []);

  const requestOtp = async (phone: string): Promise<boolean> => {
    setAuthError(null);
    setPendingPhone(phone.trim());
    try {
      confirmationRef.current = await signInWithPhoneNumber(getAuth(), toE164(phone));
      return true;
    }  catch (e: any) {
      console.log('requestOtp failed:', e?.code, e?.message);
      const code: string = e?.code ?? '';
      setAuthError(
        code.includes('invalid-phone-number')
          ? 'That phone number is not valid.'
          : code.includes('too-many-requests')
          ? 'Too many attempts. Please wait a few minutes and try again.'
          : `Could not send the code (${code || e?.message || 'unknown error'}).`
      );
      return false;
    }
  };

  const verifyOtp = async (otp: string): Promise<boolean> => {
    setAuthError(null);
    if (!confirmationRef.current) {
      setAuthError('Please request a new code first.');
      return false;
    }
    try {
      // onAuthStateChanged above then loads the profile and sets the role.
      await confirmationRef.current.confirm(otp.trim());
      confirmationRef.current = null;
      return true;
    } catch (e: any) {
      const code: string = e?.code ?? '';
      setAuthError(
        code.includes('invalid-verification-code')
          ? 'That code is not correct. Please try again.'
          : code.includes('code-expired')
          ? 'That code has expired. Please request a new one.'
          : 'Could not verify the code. Please try again.'
      );
      return false;
    }
  };

  const loginWithGoogle = () => {
    Alert.alert('Google Sign-In', 'Google sign-in will be added in the next step. Please use your phone number for now.');
  };

  const logout = () => {
    signOut(getAuth()).catch(() => {});
    confirmationRef.current = null;
    clearSession();
    setPendingPhone(null);
  };

  const addPropertyToCurrentAdmin = (propertyId: string) => {
    if (!adminPropertyIds) return;
    const next = [...adminPropertyIds, propertyId];
    setAdminPropertyIds(next);

    if (currentPhone && last10(currentPhone) === last10(PRIMARY_ADMIN_PHONE)) {
      setMainAdminPropertyIds(next);
    }

    const uid = getAuth().currentUser?.uid;
    if (uid) {
      updateDoc(doc(getFirestore(), 'users', uid), { propertyIds: next }).catch(() => {});
    }
  };

  const removePropertyFromCurrentAdmin = (propertyId: string) => {
    if (!adminPropertyIds) return;
    const next = adminPropertyIds.filter((id) => id !== propertyId);
    setAdminPropertyIds(next);

    if (currentPhone && last10(currentPhone) === last10(PRIMARY_ADMIN_PHONE)) {
      setMainAdminPropertyIds(next);
    }

    const uid = getAuth().currentUser?.uid;
    if (uid) {
      updateDoc(doc(getFirestore(), 'users', uid), { propertyIds: next }).catch(() => {});
    }
  };

  return (
    <MockAuthContext.Provider
      value={{
        role,
        residentId,
        adminPropertyIds,
        mainAdminPropertyIds,
        pendingPhone,
        initializing,
        authError,
        requestOtp,
        verifyOtp,
        loginWithGoogle,
        logout,
        addPropertyToCurrentAdmin,
        removePropertyFromCurrentAdmin,
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