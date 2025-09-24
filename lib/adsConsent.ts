import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, NativeModules } from 'react-native';

// We avoid strict typings for UMP to prevent build breaks if the API shape changes
let AdsConsent: any = null;
try {
  const gma = require('react-native-google-mobile-ads');
  AdsConsent = gma?.AdsConsent || gma?.consent || null;
} catch {}

const STORAGE_KEY_NPA = 'ads_consent_npa';
let cachedInitialized = false;
let cachedNpa: boolean | null = null;

export const getCachedNpa = () => (cachedNpa ?? true);

export const getAdRequestOptions = () => ({
  requestNonPersonalizedAdsOnly: getCachedNpa(),
});

export async function ensureAdsConsentInitialized(): Promise<{ npa: boolean }> {
  if (cachedInitialized && cachedNpa !== null) {
    return { npa: cachedNpa };
  }

  // Load previous preference if exists
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY_NPA);
    if (stored !== null) {
      cachedNpa = stored === 'true';
    }
  } catch {}

  try {
    if (Platform.OS === 'ios') {
      // No ATT; serve non-personalized ads by default on iOS
      cachedNpa = true;
    } else if (Platform.OS === 'android') {
      // Android: Show UMP form if available, but always request non-personalized ads
      if (AdsConsent) {
        try {
          if (AdsConsent.requestInfoUpdate) await AdsConsent.requestInfoUpdate();
          if (AdsConsent.loadAndShowConsentFormIfRequired) await AdsConsent.loadAndShowConsentFormIfRequired();
          else if (AdsConsent.isConsentFormAvailable && AdsConsent.isConsentFormAvailable()) {
            if (AdsConsent.showForm) await AdsConsent.showForm();
          }
        } catch {}
      }
      cachedNpa = true;
    } else {
      cachedNpa = true;
    }
  } catch {
    if (cachedNpa === null) cachedNpa = true;
  }

  if (cachedNpa === null) cachedNpa = true;
  cachedInitialized = true;

  try { await AsyncStorage.setItem(STORAGE_KEY_NPA, String(cachedNpa)); } catch {}

  return { npa: cachedNpa };
} 