import AsyncStorage from '@react-native-async-storage/async-storage';
import { checkPremiumStatus } from './premiumUtils';
import { AdEventType, TestIds, InterstitialAd, RewardedAd, RewardedAdEventType } from 'react-native-google-mobile-ads';
import { Platform } from 'react-native';
import { ensureAdsConsentInitialized, getAdRequestOptions } from './adsConsent';

// Ad Unit IDs
export const AD_UNIT_IDS = {
  // Interstitial Ads
  INTERSTITIAL: {
    ios: 'ca-app-pub-9135457753563605/1552052486',
    android: 'ca-app-pub-9135457753563605/6896696742'
  },
  // Rewarded Ads
  REWARDED: {
    ios: 'ca-app-pub-9135457753563605/2399366731',
    android: 'ca-app-pub-9135457753563605/4179336352'
  }
};

// Cooling and timing
const LAST_INTERSTITIAL_KEY = 'ads_last_interstitial_show_ms';
const COOLDOWN_MINUTES = 3; // X minutes cooldown between interstitials
const POST_LAUNCH_GRACE_MS = 45 * 1000; // avoid interstitial right after app launch (approx App Open)
const appLaunchMs = Date.now();

// Preload holder
let preloadedInterstitial: InterstitialAd | null = null;
let preloadedReady = false;

// Get interstitial ad unit ID
const getInterstitialAdUnitId = () => {
  return __DEV__
  ? TestIds.INTERSTITIAL
  : Platform.OS === 'ios'
    ? AD_UNIT_IDS.INTERSTITIAL.ios
    : AD_UNIT_IDS.INTERSTITIAL.android;
};

// Get rewarded ad unit ID
const getRewardedAdUnitId = () => {
  return __DEV__
    ? TestIds.REWARDED
    : Platform.OS === 'ios'
      ? AD_UNIT_IDS.REWARDED.ios
      : AD_UNIT_IDS.REWARDED.android;
};

const isWithinCooldown = async (): Promise<boolean> => {
  try {
    const last = await AsyncStorage.getItem(LAST_INTERSTITIAL_KEY);
    if (!last) return false;
    const deltaMin = (Date.now() - Number(last)) / 60000;
    return deltaMin < COOLDOWN_MINUTES;
  } catch {
    return false;
  }
};

export const preloadInterstitial = async (): Promise<void> => {
  try {
    // Respect premium
    const isPremium = await checkPremiumStatus(true);
    if (isPremium) return;

    await ensureAdsConsentInitialized();

    preloadedReady = false;
    preloadedInterstitial = InterstitialAd.createForAdRequest(getInterstitialAdUnitId(), getAdRequestOptions());

    preloadedInterstitial.addAdEventListener(AdEventType.LOADED, () => {
      preloadedReady = true;
    });
    preloadedInterstitial.addAdEventListener(AdEventType.ERROR, () => {
      preloadedReady = false;
      preloadedInterstitial = null;
    });

    preloadedInterstitial.load();
  } catch (error) {
    // ignore preload errors
  }
};

// Helper function to show interstitial ad
export const showInterstitialAd = async () => {
  try {
    const isPremium = await checkPremiumStatus(true);
    if (isPremium) {
      console.log('Premium user - skipping interstitial ad');
      return;
    }

    // Avoid immediately after app open (approx by app launch time)
    if (Date.now() - appLaunchMs < POST_LAUNCH_GRACE_MS) {
      console.log('Skipping interstitial - within app-launch grace period');
      return;
    }

    // Cooldown enforcement
    if (await isWithinCooldown()) {
      console.log('Skipping interstitial - within cooldown window');
      return;
    }

    console.log('Creating interstitial ad...');
    
    await ensureAdsConsentInitialized();

    // Use preloaded if available, otherwise create a new ad instance
    const interstitial = preloadedReady && preloadedInterstitial
      ? preloadedInterstitial
      : InterstitialAd.createForAdRequest(getInterstitialAdUnitId(), getAdRequestOptions());
    
    return new Promise<void>((resolve) => {
      const cleanup = () => {
        try { interstitial.removeAllListeners(); } catch {}
        resolve();
      };

      const onLoaded = () => {
        console.log('Interstitial ad loaded, showing...');
        try {
        interstitial.show();
        } catch (e) {
          console.error('Error showing interstitial:', e);
          cleanup();
        }
      };

      const onError = (error: any) => {
        console.error('Interstitial ad error:', error);
        cleanup();
      };

      const onClosed = async () => {
        console.log('Interstitial ad closed');
        // Mark last show time and reset preload state
        try { await AsyncStorage.setItem(LAST_INTERSTITIAL_KEY, String(Date.now())); } catch {}
        preloadedReady = false;
        preloadedInterstitial = null;
        cleanup();
      };

      interstitial.addAdEventListener(AdEventType.LOADED, onLoaded);
      interstitial.addAdEventListener(AdEventType.ERROR, onError);
      interstitial.addAdEventListener(AdEventType.CLOSED, onClosed);

      if (preloadedReady && preloadedInterstitial) {
        console.log('Using preloaded interstitial');
        // Already loaded -> trigger onLoaded manually
        onLoaded();
      } else {
        console.log('Loading interstitial ad...');
      interstitial.load();
      }
    });

  } catch (error) {
    console.error('Error showing interstitial ad:', error);
    return Promise.resolve();
  }
};

// Rewarded ad flow; resolves true if user earned reward
export const showRewardedAd = async (): Promise<boolean> => {
  try {
    const isPremium = await checkPremiumStatus(true);
    if (isPremium) return true; // premium users don't need to watch ads

    await ensureAdsConsentInitialized();
    const rewarded = RewardedAd.createForAdRequest(getRewardedAdUnitId(), getAdRequestOptions());

    return await new Promise<boolean>((resolve) => {
      let rewardedEarned = false;

      const cleanup = () => {
        try { rewarded.removeAllListeners(); } catch {}
        resolve(rewardedEarned);
      };

      rewarded.addAdEventListener(RewardedAdEventType.LOADED, () => {
        try { rewarded.show(); } catch (e) { cleanup(); }
      });
      rewarded.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
        rewardedEarned = true;
      });
      rewarded.addAdEventListener(AdEventType.CLOSED, () => {
        cleanup();
      });
      rewarded.addAdEventListener(AdEventType.ERROR, () => {
        cleanup();
      });

      rewarded.load();
    });
  } catch (e) {
    console.error('Error showing rewarded ad:', e);
    return false;
  }
};

// Helper function to clear ad flags
export const clearAdFlags = async () => {
  try {
    await AsyncStorage.removeItem('shouldShowInterstitial');
  } catch (error) {
    console.error('Error clearing ad flags:', error);
  }
}; 