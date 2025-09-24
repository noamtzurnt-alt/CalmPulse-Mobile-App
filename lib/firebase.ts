import { initializeApp, FirebaseApp, getApps } from 'firebase/app';
// @ts-ignore getReactNativePersistence is available in RN bundle for v12
import { initializeAuth, getReactNativePersistence, Auth, GoogleAuthProvider, signInWithCredential, fetchSignInMethodsForEmail, getAdditionalUserInfo, OAuthProvider } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
const extra: any = (Constants.expoConfig?.extra as any) ?? (Constants.manifestExtra as any) ?? {};
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';

export const firebaseConfig = {
  apiKey: extra.FIREBASE_API_KEY,
  authDomain: extra.FIREBASE_AUTH_DOMAIN,
  projectId: extra.FIREBASE_PROJECT_ID,
  storageBucket: extra.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: extra.FIREBASE_MESSAGING_SENDER_ID,
  appId: extra.FIREBASE_APP_ID
};

// ✅ בדיקת ENV (avoid logging secrets)
const app: FirebaseApp = getApps()[0] ?? initializeApp(firebaseConfig);
console.log("✅ Firebase initialized with env config");

const auth: Auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage as unknown as any),
});
console.log("🔐 Firebase Auth initialized");

const db: Firestore = getFirestore(app);
console.log("🧠 Firestore initialized");

export const initializeFirebase = async () => {
  return true; // already initialized via singleton above
};

export const isFirebaseInitialized = () => {
  return getApps().length > 0;
};

// Google Sign-In Configuration
export const configureGoogleSignIn = () => {
  GoogleSignin.configure({
    webClientId: Constants.expoConfig?.extra?.GOOGLE_CLIENT_ID,
    iosClientId: Constants.expoConfig?.extra?.GOOGLE_IOS_CLIENT_ID,
    offlineAccess: true,
  });
};

export const googleSignIn = async () => {
  try {
    // Check if your device supports Google Play
    if (Platform.OS === 'android') {
      await GoogleSignin.hasPlayServices();
    }
    
    // Sign in
    const userInfo = await GoogleSignin.signIn();
    
    // Prefer idToken from signIn; fallback to getTokens() (needed on iOS sometimes)
    const idToken = (userInfo as any)?.idToken ?? (await GoogleSignin.getTokens()).idToken;
    if (!idToken) {
      const err: any = new Error('Missing Google ID token');
      err.code = 'auth/invalid-credential';
      throw err;
    }
    
    // Create a Google credential with the token
    const credential = GoogleAuthProvider.credential(idToken);
    
    // Sign-in the user with the credential
    const userCredential = await signInWithCredential(auth, credential);
    
    return userCredential;
  } catch (error) {
    console.error('Google sign-in error:', error);
    throw error;
  }
};

// Google login that does NOT create new users. Only allows sign-in for existing accounts that use Google.
export const googleLoginOnly = async () => {
  try {
    if (Platform.OS === 'android') {
      await GoogleSignin.hasPlayServices();
    }
    const userInfo = await GoogleSignin.signIn();

    // Safely get email after signIn
    const current = await GoogleSignin.getCurrentUser();
    const email = current?.user?.email;

    // Prefer idToken from signIn; fallback to getTokens() (needed on iOS sometimes)
    const idToken = (userInfo as any)?.idToken ?? (await GoogleSignin.getTokens()).idToken;
    if (!idToken) {
      const err: any = new Error('Missing Google ID token');
      err.code = 'auth/invalid-credential';
      throw err;
    }

    let methods: string[] | null = null;
    try {
      if (email) {
        methods = await fetchSignInMethodsForEmail(auth as any, email);
      }
    } catch (e) {
      methods = null;
    }

    if (methods && methods.length > 0) {
      if (!methods.includes('google.com')) {
        const err: any = new Error('Account exists with a different sign-in method');
        err.code = 'auth/account-exists-with-different-credential';
        throw err;
      }
      const credential = GoogleAuthProvider.credential(idToken);
      return await signInWithCredential(auth, credential);
    }

    // Unknown/none methods → attempt credential sign-in, then block if new user was created
    const credential = GoogleAuthProvider.credential(idToken);
    const userCredential = await signInWithCredential(auth, credential);
    const info = getAdditionalUserInfo(userCredential);
    if (info?.isNewUser) {
      try {
        await userCredential.user.delete();
      } catch {}
      const err: any = new Error('No account found for this Google email');
      err.code = 'auth/user-not-found';
      throw err;
    }
    return userCredential;
  } catch (error) {
    console.error('Google login-only error:', error);
    throw error;
  }
};

// ----- Apple Sign-In -----
const generateRandomNonce = async (length: number = 32) => {
  const bytes = await Crypto.getRandomBytesAsync(length);
  const charset = '0123456789ABCDEFGHIJKLMNOPQRSTUVXYZabcdefghijklmnopqrstuvwxyz-._';
  let res = '';
  for (let i = 0; i < length; i++) res += charset[bytes[i] % charset.length];
  return res;
};

export const appleSignIn = async () => {
  try {
    const rawNonce = await generateRandomNonce();
    const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);

    const appleCredential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });

    const provider = new OAuthProvider('apple.com');
    const credential = provider.credential({
      idToken: appleCredential.identityToken ?? undefined,
      rawNonce,
    });

    const userCredential = await signInWithCredential(auth, credential as any);
    return userCredential;
  } catch (error) {
    console.error('Apple sign-in error:', error);
    throw error;
  }
};

// Apple login that does NOT create new users. Only allows sign-in for existing accounts that use Apple.
export const appleLoginOnly = async () => {
  try {
    const rawNonce = await generateRandomNonce();
    const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);

    const appleCredential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });

    const email = (appleCredential as any)?.email as string | undefined;

    let methods: string[] | null = null;
    try {
      if (email) {
        methods = await fetchSignInMethodsForEmail(auth as any, email);
      }
    } catch (e) {
      methods = null;
    }

    const provider = new OAuthProvider('apple.com');
    const credential = provider.credential({
      idToken: appleCredential.identityToken ?? undefined,
      rawNonce,
    });

    if (methods && methods.length > 0) {
      if (!methods.includes('apple.com')) {
        const err: any = new Error('Account exists with a different sign-in method');
        err.code = 'auth/account-exists-with-different-credential';
        throw err;
      }
      return await signInWithCredential(auth, credential as any);
    }

    // Unknown/none methods → attempt credential sign-in, then block if new user was created
    const userCredential = await signInWithCredential(auth, credential as any);
    const info = getAdditionalUserInfo(userCredential);
    if (info?.isNewUser) {
      try {
        await userCredential.user.delete();
      } catch {}
      const err: any = new Error('No account found for this Apple ID');
      err.code = 'auth/user-not-found';
      throw err;
    }
    return userCredential;
  } catch (error) {
    console.error('Apple login-only error:', error);
    throw error;
  }
};

export { auth, db };
