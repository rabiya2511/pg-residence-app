import {
  getAuth,
  GoogleAuthProvider,
  FacebookAuthProvider,
  signInWithCredential,
  linkWithCredential,
  unlink,
  signOut,
} from '@react-native-firebase/auth';
import { getFirestore, doc, getDoc } from '@react-native-firebase/firestore';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

// The Facebook SDK is loaded only when someone actually uses Facebook. Loading it at app start
// crashes the whole app while the Facebook App ID in app.json is still a placeholder.
let fbUsed = false;
function fb(): any {
  fbUsed = true;
  return require('react-native-fbsdk-next');
}

// Firebase Console -> Authentication -> Sign-in method -> Google -> "Web SDK configuration" -> Web client ID.
const GOOGLE_WEB_CLIENT_ID = '16254862219-9nu8ht4s0eeppmgplv4pflrjfqtkblec.apps.googleusercontent.com';

GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID });

export type SocialProvider = 'google' | 'facebook';
export type SocialResult = { ok: true } | { ok: false; cancelled?: boolean; message: string };

const PROVIDER_ID: Record<SocialProvider, string> = { google: 'google.com', facebook: 'facebook.com' };
const LABEL: Record<SocialProvider, string> = { google: 'Google', facebook: 'Facebook' };

// True while a social sign-in is being checked. The auth context ignores the
// temporary Firebase user during this window (it is removed again if no PG account is linked).
let busy = false;
export const isSocialAuthBusy = () => busy;

/** Opens the Google / Facebook login and returns a Firebase credential, or null if the person cancelled. */
async function getCredential(provider: SocialProvider): Promise<any | null> {
  if (provider === 'google') {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    try {
      await GoogleSignin.signOut(); // so the account chooser is shown every time
    } catch {}
    const res: any = await GoogleSignin.signIn();
    if (res?.type === 'cancelled') return null;
    const idToken = res?.data?.idToken ?? res?.idToken; // newer and older library versions
    if (!idToken) throw new Error('no-id-token');
    return GoogleAuthProvider.credential(idToken);
  }

  // public_profile needs no Facebook app review (email would).
  const { LoginManager, AccessToken } = fb();
  const r = await LoginManager.logInWithPermissions(['public_profile']);
  if (r.isCancelled) return null;
  const token = await AccessToken.getCurrentAccessToken();
  if (!token?.accessToken) throw new Error('no-access-token');
  return FacebookAuthProvider.credential(token.accessToken);
}

function friendlyError(e: any, provider: SocialProvider): string {
  const code = String(e?.code ?? '');
  const msg = String(e?.message ?? '');
  if (code === '12501' || code === 'SIGN_IN_CANCELLED') return '';
  if (code === '10' || msg.includes('DEVELOPER_ERROR')) {
    return `${LABEL[provider]} sign-in is not set up correctly yet (SHA-1 / client ID). Please contact the app developer.`;
  }
  if (code === 'auth/credential-already-in-use') {
    return `This ${LABEL[provider]} account is already linked to another PG account.`;
  }
  if (code === 'auth/provider-already-linked') return `${LABEL[provider]} is already linked to your account.`;
  if (code === 'auth/account-exists-with-different-credential') {
    return 'An account already exists with this email. Sign in with your phone number first.';
  }
  if (code === 'auth/network-request-failed') return 'No internet connection. Please try again.';
  console.warn('social auth error:', code, msg);
  return `Could not sign in with ${LABEL[provider]}. Please try again.`;
}

async function dropSocialSessions() {
  try { await GoogleSignin.signOut(); } catch {}
  if (fbUsed) {
    try { fb().LoginManager.logOut(); } catch {}
  }
}

/** Login screen: signs in with Google / Facebook, but only if it is linked to an existing PG account. */
export async function signInWithSocial(provider: SocialProvider): Promise<SocialResult> {
  busy = true;
  try {
    const credential = await getCredential(provider);
    if (!credential) return { ok: false, cancelled: true, message: '' };

    const auth = getAuth();
    const result: any = await signInWithCredential(auth, credential);
    const user = result.user;

    // A linked account already has its users/{uid} profile (created at the first phone login).
    const snap: any = await getDoc(doc(getFirestore(), 'users', user.uid));
    const hasProfile = typeof snap.exists === 'function' ? snap.exists() : !!snap.exists;
    if (hasProfile) return { ok: true };

    // Not linked: remove the empty account Firebase just created (otherwise this Google / Facebook
    // identity could never be linked later), then sign out.
    const isNew = result?.additionalUserInfo?.isNewUser === true;
    if (isNew) await user.delete().catch(() => {});
    await signOut(auth).catch(() => {});
    await dropSocialSessions();
    return {
      ok: false,
      message:
        `This ${LABEL[provider]} account is not linked to a PG account yet.\n\n` +
        `Sign in once with your phone number, then open Settings → Linked accounts and link ${LABEL[provider]}.`,
    };
  } catch (e: any) {
    await dropSocialSessions();
    const message = friendlyError(e, provider);
    return message ? { ok: false, message } : { ok: false, cancelled: true, message: '' };
  } finally {
    busy = false;
  }
}

/** Settings screen: links Google / Facebook to the account that is signed in right now. */
export async function linkSocial(provider: SocialProvider): Promise<SocialResult> {
  const user = getAuth().currentUser;
  if (!user) return { ok: false, message: 'Please sign in first.' };
  try {
    const credential = await getCredential(provider);
    if (!credential) return { ok: false, cancelled: true, message: '' };
    await linkWithCredential(user, credential);
    return { ok: true };
  } catch (e: any) {
    const message = friendlyError(e, provider);
    return message ? { ok: false, message } : { ok: false, cancelled: true, message: '' };
  } finally {
    await dropSocialSessions();
  }
}

/** Settings screen: removes the link. Phone login always stays. */
export async function unlinkSocial(provider: SocialProvider): Promise<SocialResult> {
  const user = getAuth().currentUser;
  if (!user) return { ok: false, message: 'Please sign in first.' };
  try {
    await unlink(user, PROVIDER_ID[provider]);
    return { ok: true };
  } catch (e: any) {
    console.warn('unlink failed:', e?.code, e?.message);
    return { ok: false, message: `Could not unlink ${LABEL[provider]}. Please try again.` };
  }
}

/** Which providers the signed-in account has: e.g. ['phone', 'google.com']. */
export function linkedProviders(): string[] {
  return (getAuth().currentUser?.providerData ?? []).map((p) => p.providerId);
}
export const isLinked = (provider: SocialProvider) => linkedProviders().includes(PROVIDER_ID[provider]);