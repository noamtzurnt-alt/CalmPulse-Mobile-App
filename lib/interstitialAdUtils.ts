import { InterstitialAd, AdEventType, TestIds } from 'react-native-google-mobile-ads';
import { Platform } from 'react-native';
import { checkPremiumStatus } from './premiumUtils';

// Ad Unit ID for Interstitial Ads
const INTERSTITIAL_AD_UNIT_ID = __DEV__
  ? TestIds.INTERSTITIAL
  : Platform.OS === 'ios'
    ? 'ca-app-pub-9135457753563605/1095199982' // iOS Interstitial Ad Unit ID
    : 'ca-app-pub-9135457753563605/3211061584'; // Android Interstitial Ad Unit ID

/**
 * Shows an interstitial ad with proper AdMob policy compliance
 * 
 * @param onAdClosed - Callback function to execute when ad is closed or fails
 * @returns Promise that resolves when the ad process is complete
 */
export const showInterstitialAd = async (onAdClosed: () => void): Promise<void> => {
  console.log('🎯 showInterstitialAd called');
  
  try {
    // 🚫 PREMIUM USER PROTECTION - FIRST PRIORITY
    console.log('🔒 Checking premium status before any ad logic...');
    const isPremium = await checkPremiumStatus(true);
    if (isPremium) {
      console.log('🚫 PREMIUM USER DETECTED - INTERSTITIAL AD WILL NEVER BE SHOWN');
      console.log('🚫 Premium users should NEVER see any ads');
      onAdClosed();
      return;
    }

    console.log('✅ User is not premium - proceeding with interstitial ad');

    // Create a new ad instance (important for AdMob compliance)
    const interstitial = InterstitialAd.createForAdRequest(INTERSTITIAL_AD_UNIT_ID, {
      requestNonPersonalizedAdsOnly: true,
    });

    return new Promise<void>((resolve) => {
      let isAdProcessComplete = false;
      let adLoadTimeout: NodeJS.Timeout;

      // Helper function to complete the ad process
      const completeAdProcess = () => {
        if (isAdProcessComplete) return;
        isAdProcessComplete = true;
        
        if (adLoadTimeout) {
          clearTimeout(adLoadTimeout);
        }
        
        console.log('🏁 Interstitial ad process completed');
        onAdClosed();
        resolve();
      };

      // Set timeout for ad loading (10 seconds)
      adLoadTimeout = setTimeout(() => {
        console.log('⏰ Interstitial ad load timeout - proceeding without ad');
        completeAdProcess();
      }, 10000);

      // Ad loaded successfully
      const unsubscribeLoaded = interstitial.addAdEventListener(
        AdEventType.LOADED,
        async () => {
          console.log('📱 Interstitial ad loaded successfully');
          clearTimeout(adLoadTimeout);
          
          // FINAL PREMIUM CHECK before showing ad
          try {
            const finalPremiumCheck = await checkPremiumStatus(true);
            if (finalPremiumCheck) {
              console.log('🚫 Premium user detected at last moment - cancelling ad show');
              completeAdProcess();
              return;
            }
          } catch (error) {
            console.error('❌ Error in final premium check:', error);
            // If we can't verify premium status, don't show ad to be safe
            completeAdProcess();
            return;
          }
          
          console.log('🎬 Showing interstitial ad...');
          interstitial.show();
        }
      );

      // Ad failed to load
      const unsubscribeError = interstitial.addAdEventListener(
        AdEventType.ERROR,
        (error) => {
          console.error('❌ Interstitial ad failed to load:', error);
          completeAdProcess();
        }
      );

      // Ad was shown
      const unsubscribeOpened = interstitial.addAdEventListener(
        AdEventType.OPENED,
        () => {
          console.log('🎬 Interstitial ad opened');
        }
      );

      // Ad was closed
      const unsubscribeClosed = interstitial.addAdEventListener(
        AdEventType.CLOSED,
        () => {
          console.log('🔒 Interstitial ad closed');
          completeAdProcess();
        }
      );

      // Ad was clicked
      const unsubscribeClicked = interstitial.addAdEventListener(
        AdEventType.CLICKED,
        () => {
          console.log('👆 Interstitial ad clicked');
        }
      );

      // Start loading the ad
      console.log('📥 Loading interstitial ad...');
      interstitial.load();
    });

  } catch (error) {
    console.error('❌ Error in showInterstitialAd:', error);
    // If there's any error, proceed without showing ad
    onAdClosed();
  }
};

/**
 * Check if interstitial ad is ready to be shown
 * (Useful for pre-loading ads)
 * 
 * ⚠️ IMPORTANT: This function will ALWAYS return false for premium users
 */
export const isInterstitialAdReady = async (): Promise<boolean> => {
  try {
    console.log('🔍 Checking if interstitial ad is ready...');
    
    // ALWAYS check premium status first
    const isPremium = await checkPremiumStatus(true);
    if (isPremium) {
      console.log('🚫 Premium user - interstitial ad is NOT ready');
      return false;
    }
    
    console.log('✅ Non-premium user - interstitial ad is ready');
    return true;
  } catch (error) {
    console.error('❌ Error checking if interstitial ad is ready:', error);
    // If there's an error checking premium status, err on the side of caution
    // and don't show ads to avoid showing ads to premium users
    return false;
  }
}; 