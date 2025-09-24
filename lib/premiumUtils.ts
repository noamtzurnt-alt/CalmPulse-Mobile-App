import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth, db } from '@/lib/firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';

export const PREMIUM_ENTITLEMENT_ID = 'premium';

export const checkPremiumStatus = async (_forceRemote: boolean = false): Promise<boolean> => {
  try {
    const { getCustomerInfo, isPremiumFromCustomerInfo } = await import('@/lib/revenueCat');
    const info = await getCustomerInfo();
    const premium = isPremiumFromCustomerInfo(info);
    const user = auth.currentUser;
    if (user?.uid) {
      await AsyncStorage.setItem(`premium_${user.uid}`, String(premium));
    }
    await AsyncStorage.setItem('hasPremium', String(premium));
    await AsyncStorage.setItem('isPremium', String(premium));
    return premium;
  } catch {
    try {
      const user = auth.currentUser;
      if (user?.uid) {
        const v = await AsyncStorage.getItem(`premium_${user.uid}`);
        if (v != null) return v === 'true';
      }
      const local = await AsyncStorage.getItem('hasPremium');
      return local === 'true';
    } catch {
      return false;
    }
  }
};

export const updatePremiumStatus = async (isPremium: boolean): Promise<boolean> => {
  try {
    const user = auth.currentUser;
    if (user?.uid) {
      await AsyncStorage.setItem(`premium_${user.uid}`, String(isPremium));
      await AsyncStorage.setItem('hasPremium', String(isPremium));
      await AsyncStorage.setItem('isPremium', String(isPremium));
      try { await setDoc(doc(db, 'users', user.uid), { isPremium, updatedAt: new Date().toISOString() }, { merge: true }); } catch {}
    }
    return true;
  } catch {
    return false;
  }
};

export const savePremiumStatusToFirebase = async (_data: { isPremium: boolean; packageIdentifier?: string; expirationDate?: string; email?: string; }): Promise<boolean> => {
  try {
    const user = auth.currentUser;
    if (user?.uid) {
      await setDoc(doc(db, 'users', user.uid), { isPremium: true, updatedAt: new Date().toISOString() }, { merge: true });
    }
    return true;
  } catch {
    return false;
  }
};

export const checkPremiumFeatureAccess = async (_featureName: string): Promise<boolean> => {
  return true;
};

export const checkSubscriptionExpiration = async (): Promise<boolean> => {
  return false;
};

export const clearPremiumData = async (_uid: string): Promise<void> => {
  try {
    await AsyncStorage.multiRemove(['hasPremium', 'isPremium']);
  } catch {}
};

export const isGuestUser = async (): Promise<boolean> => false;
export const handleGuestPremiumAttempt = async (): Promise<boolean> => false;
export const migrateGuestDataToUser = async (_uid?: string): Promise<boolean> => true;

export const saveTempPremiumPurchase = async (_data?: { packageIdentifier?: string; expirationDate?: string; email?: string; }): Promise<void> => {};
export const getTempPremiumPurchase = async (): Promise<null> => null;
export const clearTempPremiumPurchase = async (): Promise<void> => {};
export const transferTempPremiumToUser = async (_uid?: string, _email?: string): Promise<boolean> => true; 