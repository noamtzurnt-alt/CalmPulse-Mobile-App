import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Purchases, { LOG_LEVEL, PurchasesPackage, PurchasesOffering } from 'react-native-purchases';
import Constants from 'expo-constants';
import { AppEventsLogger } from 'react-native-fbsdk-next';

export const PREMIUM_ENTITLEMENT_ID = 'premium';

export const PRODUCTS = {
  monthly: 'premium_monthly',
  yearly: 'premium_yearly',
};

let __rcConfigured = false;
let __rcMissingKey = false;
let __rcLastKey: string | undefined;

function getSdkKey(): string | undefined {
  const extra: any = Constants?.expoConfig?.extra || (Constants as any)?.manifest?.extra || {};
  const envKey = (process as any)?.env?.EXPO_PUBLIC_REVENUECAT_API_KEY as string | undefined;
  if (envKey) return envKey;
  // Support platform-specific keys from app.config.ts (EXTRA)
  const iosKey = extra?.REVENUECAT_API_KEY_IOS || extra?.revenuecatIosKey;
  const androidKey = extra?.REVENUECAT_API_KEY_ANDROID || extra?.revenuecatAndroidKey;
  if (Platform.OS === 'ios') return iosKey;
  if (Platform.OS === 'android') return androidKey;
  return undefined;
}

// Helper: log purchase to Facebook with mapping for monthly/yearly
async function logFacebookPurchase(amount: number, currency: string, productId?: string) {
  try {
    if (typeof amount !== 'number' || !currency) return;
    AppEventsLogger.logPurchase(amount, currency, productId ? { product_id: productId } : undefined);
    await AsyncStorage.setItem('fb_last_purchase_sent_at', String(Date.now()));
    if (productId) await AsyncStorage.setItem('fb_last_product_id', productId);
  } catch {}
}

function inferAmountCurrencyFromPackage(pkg: PurchasesPackage | null | undefined): { amount: number; currency: string; productId: string } | null {
  const productId: string = (pkg as any)?.product?.identifier || (pkg as any)?.identifier || 'premium_subscription';
  const price: number | undefined = (pkg as any)?.product?.price;
  const currencyCode: string | undefined = (pkg as any)?.product?.currencyCode;
  if (typeof price === 'number' && price > 0 && currencyCode) {
    return { amount: price, currency: currencyCode, productId };
  }
  // Fallback by id heuristics: monthly 9.99 USD, yearly 49.99 USD
  const id = (productId || '').toLowerCase();
  if (id.includes('year')) {
    return { amount: 49.99, currency: 'USD', productId };
  }
  return { amount: 9.99, currency: 'USD', productId };
}

// A) Client library per spec
export const initRevenueCat = async (): Promise<void> => {
  try {
    if (__rcConfigured) return;
    const key = getSdkKey();
    __rcLastKey = key;
    if (!key) {
      __rcMissingKey = true;
      console.warn('RevenueCat SDK key missing. Set EXPO_PUBLIC_REVENUECAT_API_KEY or expo.extra keys.');
        return;
      }
    Purchases.setLogLevel(LOG_LEVEL.WARN);
    await Purchases.configure({ apiKey: key });
    __rcConfigured = true;
    __rcMissingKey = false;
  } catch (e) {
    console.warn('Failed to configure RevenueCat', e);
  }
};

export const identifyWithFirebase = async (uid: string): Promise<any | null> => {
  try {
    if (!uid) return null;
    await initRevenueCat();
    if (__rcMissingKey) return null;
    const { customerInfo } = await Purchases.logIn(uid);
    return customerInfo;
  } catch (e) {
    console.warn('identifyWithFirebase error', e);
    return null;
  }
};

export const clearIdentification = async (): Promise<void> => {
  try {
    if (!__rcConfigured || __rcMissingKey) return;
    await Purchases.logOut();
  } catch {}
};

export const getCustomerInfo = async (): Promise<any> => {
  await initRevenueCat();
  if (__rcMissingKey) return {};
  try { return await Purchases.getCustomerInfo(); } catch (e) { console.warn('getCustomerInfo error', e); throw e; }
};

export const isPremiumFromCustomerInfo = (info: any): boolean => {
  const ent: any = info?.entitlements?.active?.[PREMIUM_ENTITLEMENT_ID];
  const exp = ent?.expirationDate ? new Date(ent.expirationDate) : null;
  return !!ent && (!exp || exp > new Date());
};

export const restorePurchases = async (): Promise<{ restored: boolean; active: boolean; reason?: string }> => {
  try {
    await initRevenueCat();
    if (__rcMissingKey) return { restored: false, active: false, reason: 'Missing RevenueCat key' };
    const info = await Purchases.restorePurchases();
    const active = isPremiumFromCustomerInfo(info);
    return { restored: active, active };
  } catch (e: any) {
    return { restored: false, active: false, reason: String(e?.message || e) };
  }
};

export const getOfferings = async (): Promise<PurchasesOffering | null> => {
  await initRevenueCat();
  if (__rcMissingKey) return null;
  try {
    const offerings = await Purchases.getOfferings();
    return offerings?.current ?? null;
  } catch (e) {
    console.warn('getOfferings error', e);
    return null;
  }
};

export const purchasePackage = async (pkg: PurchasesPackage): Promise<any> => {
  await initRevenueCat();
  if (__rcMissingKey) throw new Error('Missing RevenueCat key');
  const result = await Purchases.purchasePackage(pkg);
  try {
    const inferred = inferAmountCurrencyFromPackage(pkg);
    if (inferred) {
      await logFacebookPurchase(inferred.amount, inferred.currency, inferred.productId);
    }
  } catch {}
  return result;
};

export const addCustomerInfoListener = (cb: (info: any) => void): any => {
  if (__rcMissingKey) return () => {};
  const listener = (info: any) => cb(info);
  Purchases.addCustomerInfoUpdateListener(listener);
  return listener;
};

export const removeCustomerInfoListener = (sub: any) => {
  try { if (!__rcMissingKey) Purchases.removeCustomerInfoUpdateListener(sub); } catch {}
};
        
// Backwards-compat exports
export const initializeRevenueCat = initRevenueCat;
export const identifyUser = (uid: string) => identifyWithFirebase(uid);
export const logOutUser = clearIdentification;
export const syncRevenueCatUser = async () => { try { if (!__rcMissingKey) await Purchases.syncPurchases(); } catch {} };

export const isPremiumEntitlementActive = isPremiumFromCustomerInfo;

export const updatePremiumStatus = async (isPremium: boolean) => {
  await AsyncStorage.setItem('hasPremium', String(isPremium));
  await AsyncStorage.setItem('isPremium', String(isPremium));
  return true;
};

export const checkPremiumStatus = async (): Promise<boolean> => {
  try {
    const info = await getCustomerInfo();
    const active = isPremiumFromCustomerInfo(info);
    await updatePremiumStatus(active);
    return active;
  } catch {
    const local = await AsyncStorage.getItem('hasPremium');
    return local === 'true';
    }
};

// Facebook fallback listener: if entitlement becomes active and we haven't sent recently, send purchase
export const startFacebookPurchaseTracking = async (): Promise<() => void> => {
  await initRevenueCat();
  if (__rcMissingKey) return () => {};
  const listener = async (info: any) => {
    try {
      const lastSent = Number(await AsyncStorage.getItem('fb_last_purchase_sent_at') || '0');
      if (Date.now() - lastSent < 6 * 60 * 60 * 1000) return; // avoid duplicates within 6h
      const ent: any = info?.entitlements?.active?.[PREMIUM_ENTITLEMENT_ID];
      if (!ent) return;
      const productId: string = ent?.productIdentifier || (await AsyncStorage.getItem('fb_last_product_id') || 'premium_subscription');
      const idLower = (productId || '').toLowerCase();
      const isYear = idLower.includes('year');
      const amount = isYear ? 49.99 : 9.99;
      await logFacebookPurchase(amount, 'USD', productId);
    } catch {}
  };
  Purchases.addCustomerInfoUpdateListener(listener);
  return () => {
    try { Purchases.removeCustomerInfoUpdateListener(listener); } catch {}
  };
};

// Optional non-subscription helpers
export const purchaseNonSubscriptionProduct = async (_productId: string): Promise<{ success: boolean }> => {
  return { success: true };
};

export const hasNonSubscriptionPurchase = async (_productId: string): Promise<boolean> => {
  return false;
}; 