import { getCustomerInfo, isPremiumFromCustomerInfo } from '@/lib/revenueCat';

export async function navigateWithPremiumCheck(navigation: any, targetScreen: string, params?: Record<string, any>) {
  try {
    const info = await getCustomerInfo();
    const isPremium = isPremiumFromCustomerInfo(info);
    if (isPremium) {
      navigation.navigate(targetScreen, params || {});
    } else {
      navigation.navigate('onboarding-stages/paywall-stage', { redirect: { screen: targetScreen, params: params || {} } });
    }
  } catch {
    navigation.navigate('onboarding-stages/paywall-stage', { redirect: { screen: targetScreen, params: params || {} } });
  }
} 