import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  AppState,
  AppStateStatus,
  Platform,
  Image,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import {
  AppOpenAd,
  AdEventType,
  TestIds,
} from 'react-native-google-mobile-ads';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { checkPremiumStatus } from '@/lib/premiumUtils';
// import { checkForUpdates } from '@/lib/updateUtils';
import { Asset } from 'expo-asset';
import { ensureAdsConsentInitialized, getAdRequestOptions } from '@/lib/adsConsent';

const { width, height } = Dimensions.get('window');

// Ad Unit IDs
const APP_OPEN_AD_UNIT_ID = __DEV__
  ? TestIds.APP_OPEN
  : Platform.OS === 'ios'
    ? 'ca-app-pub-9135457753563605/9893348994' // iOS App Open Ad Unit ID
    : 'ca-app-pub-9135457753563605/2668136109'; // Android App Open Ad Unit ID

interface SplashScreenWithAdProps {
  onAdComplete?: () => void;
  onTimeout?: () => void;
}

export default function SplashScreenWithAd({ 
  onAdComplete, 
  onTimeout 
}: SplashScreenWithAdProps) {
  const router = useRouter();
  const [isAdLoaded, setIsAdLoaded] = useState(false);
  const [isAdShown, setIsAdShown] = useState(false);
  const [isTimeoutReached, setIsTimeoutReached] = useState(false);
  const [shouldShowAd, setShouldShowAd] = useState(false);
  
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const appOpenAd = useRef<AppOpenAd | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const appStateRef = useRef(AppState.currentState);
  const lastAppOpenTimeRef = useRef<number>(0);

  // Check if we should show the ad
  const checkShouldShowAd = async () => {
    try {
      console.log('🔍 Checking if App Open Ad should be shown...');
      console.log('🔍 Development mode:', __DEV__);
      console.log('🔍 Platform:', Platform.OS);
      console.log('🔍 Ad Unit ID:', APP_OPEN_AD_UNIT_ID);
      
      // Allow App Open Ads on both platforms
      
      // FIRST PRIORITY: Check if user is premium - if yes, NEVER show ad
      const isPremium = await checkPremiumStatus(true);
      console.log('🔍 Premium status:', isPremium);
      
      if (isPremium) {
        console.log('🚫 Premium user detected - App Open Ad will NEVER be shown');
        setShouldShowAd(false);
        return;
      }

      console.log('✅ User is not premium - App Open Ad will be shown');
      setShouldShowAd(true);
    } catch (error) {
      console.error('❌ Error checking ad conditions:', error);
      // If there's an error checking premium status, err on the side of caution
      // and don't show the ad to avoid showing ads to premium users
      setShouldShowAd(false);
    }
  };

  // Load App Open Ad
  const loadAppOpenAd = async () => {
    if (!shouldShowAd) {
      console.log('❌ Should not show ad - skipping load');
      return;
    }

    console.log('📱 Starting to load App Open Ad...');
    console.log('📱 Using Ad Unit ID:', APP_OPEN_AD_UNIT_ID);

    // Ensure consent/ATT first
    try {
      await ensureAdsConsentInitialized();
    } catch {}

    // Double-check premium status before loading ad
    try {
      const isPremium = await checkPremiumStatus(true);
      if (isPremium) {
        console.log('🚫 Premium status changed - cancelling App Open Ad load');
        setShouldShowAd(false);
        return;
      }
    } catch (error) {
      console.error('❌ Error double-checking premium status:', error);
      // If we can't verify premium status, don't show ad to be safe
      setShouldShowAd(false);
      return;
    }

    console.log('📱 Creating App Open Ad request...');
    
    appOpenAd.current = AppOpenAd.createForAdRequest(APP_OPEN_AD_UNIT_ID, getAdRequestOptions());

    const unsubscribeLoaded = appOpenAd.current.addAdEventListener(
      AdEventType.LOADED,
      async () => {
        console.log('✅ App Open Ad loaded successfully');
        console.log('✅ Setting isAdLoaded to true');
        setIsAdLoaded(true);
        
        // Show ad immediately with loaded state
        console.log('✅ Calling showAppOpenAd immediately...');
        await showAppOpenAdWithLoadedState();
      }
    );

    const unsubscribeError = appOpenAd.current.addAdEventListener(
      AdEventType.ERROR,
      (error) => {
        console.error('❌ App Open Ad failed to load:', error);
        console.log('❌ Error details:', JSON.stringify(error, null, 2));
        console.log('❌ This might be due to AdMob "Ad Limited" restriction');
        console.log('❌ Error code:', (error as any)?.code);
        console.log('❌ Error message:', (error as any)?.message);
        setIsAdLoaded(false);
        unsubscribeLoaded();
        unsubscribeError();
      }
    );

    const unsubscribeClosed = appOpenAd.current.addAdEventListener(
      AdEventType.CLOSED,
      () => {
        console.log('🔒 App Open Ad closed by user');
        setIsAdShown(true);
        unsubscribeLoaded();
        unsubscribeError();
        unsubscribeClosed();
        completeSplash();
      }
    );

    const unsubscribeOpened = appOpenAd.current.addAdEventListener(
      AdEventType.OPENED,
      () => {
        console.log('🎬 App Open Ad opened and displayed');
        console.log('🎬 This means the ad was actually shown to the user');
        console.log('🎬 AdMob restriction is NOT active');
      }
    );

    appOpenAd.current.load();
  };

  // Show App Open Ad with loaded state (called from LOADED event)
  const showAppOpenAdWithLoadedState = async () => {
    console.log('🎬 showAppOpenAdWithLoadedState called');
    console.log('🎬 appOpenAd.current exists:', !!appOpenAd.current);
    console.log('🎬 isAdShown:', isAdShown);
    
    if (!appOpenAd.current || isAdShown) {
      console.log('❌ Cannot show ad - conditions not met');
      console.log('❌ Missing conditions:', {
        noAppOpenAd: !appOpenAd.current,
        alreadyShown: isAdShown
      });
      return;
    }

    // Final premium check before showing ad
    try {
      const isPremium = await checkPremiumStatus(true);
      if (isPremium) {
        console.log('🚫 Premium user detected at last moment - cancelling App Open Ad');
        setIsAdShown(true); // Mark as shown to prevent further attempts
        completeSplash();
        return;
      }
    } catch (error) {
      console.error('❌ Error in final premium check:', error);
      // If we can't verify, don't show ad
      setIsAdShown(true);
      completeSplash();
      return;
    }

    console.log('🎬 All checks passed - showing App Open Ad...');
    setIsAdShown(true);
    appOpenAd.current.show();
    console.log('🎬 App Open Ad show() called');
  };

  // Show App Open Ad (original function for other cases)
  const showAppOpenAd = async () => {
    console.log('🎬 showAppOpenAd called');
    console.log('🎬 appOpenAd.current exists:', !!appOpenAd.current);
    console.log('🎬 isAdLoaded:', isAdLoaded);
    console.log('🎬 isAdShown:', isAdShown);
    console.log('🎬 Current state check:', {
      hasAppOpenAd: !!appOpenAd.current,
      isAdLoaded,
      isAdShown
    });
    
    if (!appOpenAd.current || !isAdLoaded || isAdShown) {
      console.log('❌ Cannot show ad - conditions not met');
      console.log('❌ Missing conditions:', {
        noAppOpenAd: !appOpenAd.current,
        notLoaded: !isAdLoaded,
        alreadyShown: isAdShown
      });
      return;
    }

    // Final premium check before showing ad
    try {
      const isPremium = await checkPremiumStatus(true);
      if (isPremium) {
        console.log('🚫 Premium user detected at last moment - cancelling App Open Ad');
        setIsAdShown(true); // Mark as shown to prevent further attempts
        completeSplash();
        return;
      }
    } catch (error) {
      console.error('❌ Error in final premium check:', error);
      // If we can't verify, don't show ad
      setIsAdShown(true);
      completeSplash();
      return;
    }

    console.log('🎬 All checks passed - showing App Open Ad...');
    setIsAdShown(true);
    appOpenAd.current.show();
    console.log('🎬 App Open Ad show() called');
  };

  // Complete splash and navigate
  const completeSplash = async () => {
    console.log('🏁 completeSplash called');
    try {
      // Save today's open time
      const today = new Date().toDateString();
      await AsyncStorage.setItem('lastAppOpenTime', today);
      console.log('💾 Saved lastAppOpenTime:', today);
      
      // Clear timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        console.log('⏰ Cleared timeout');
      }

      // Call callbacks
      if (onAdComplete) {
        console.log('📞 Calling onAdComplete callback');
        onAdComplete();
      }
      
      // Don't navigate - let the parent component handle navigation
      console.log('✅ Splash screen completed - parent will handle navigation');
    } catch (error) {
      console.error('❌ Error completing splash:', error);
      // Call callbacks even on error
      if (onAdComplete) {
        console.log('📞 Calling onAdComplete callback (error case)');
        onAdComplete();
      }
    }
  };

  // Handle timeout
  const handleTimeout = () => {
    console.log('⏰ Splash timeout reached (5 seconds)');
    setIsTimeoutReached(true);
    console.log('⏰ Set isTimeoutReached to true');
    
    if (onTimeout) {
      console.log('📞 Calling onTimeout callback');
      onTimeout();
    }
    
    // Don't navigate - let the parent component handle navigation
    console.log('✅ Splash timeout - parent will handle navigation');
  };

  // App state change handler
  const handleAppStateChange = (nextAppState: AppStateStatus) => {
    if (
      appStateRef.current.match(/inactive|background/) &&
      nextAppState === 'active'
    ) {
      // App came to foreground
      lastAppOpenTimeRef.current = Date.now();
    }
    appStateRef.current = nextAppState;
  };

  // Start fade-in animation
  const startFadeAnimation = () => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 1000,
      useNativeDriver: true,
    }).start();
  };

  // Initialize component
  useEffect(() => {
    const initialize = async () => {
      console.log('🚀 Initializing SplashScreenWithAd component...');
      
              // Preload onboarding images FIRST
        try {
          console.log('🖼️ Preloading onboarding images...');
          await Promise.all([
            Asset.loadAsync(require('@/assets/images/adaptive-icon.png')),
          ]);
          console.log('✅ Onboarding images preloaded successfully');
        } catch (error) {
          console.error('❌ Error preloading onboarding images:', error);
          // Continue even if preload fails
        }
      
      // Removed update check; VersionGate handles forcing updates
      
      // Start fade animation
      console.log('🎨 Starting fade animation...');
      startFadeAnimation();
      
      // Check if we should show ad immediately
      console.log('🔍 Checking if should show ad...');
      await checkShouldShowAd();
      

      
      // Set timeout for 5 seconds
      console.log('⏰ Setting 5 second timeout...');
      timeoutRef.current = setTimeout(handleTimeout, 5000);
    };

    initialize();

    // Listen for app state changes
    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      subscription?.remove();
    };
  }, []);

  // React to shouldShowAd changes
  useEffect(() => {
    if (shouldShowAd) {
      console.log('📱 shouldShowAd changed to true - loading App Open Ad...');
      loadAppOpenAd();
    } else {
      console.log('❌ shouldShowAd changed to false - will complete splash after delay');
    }
  }, [shouldShowAd]);

  // Complete splash when ad is shown, timeout is reached, or conditions not met
  useEffect(() => {
    if (isAdShown || isTimeoutReached) {
      completeSplash();
    }
  }, [isAdShown, isTimeoutReached]);

  // Complete splash when ad is loaded but not shown (for premium users)
  useEffect(() => {
    if (isAdLoaded && !shouldShowAd) {
      // For premium users, complete after showing welcome message
      const timer = setTimeout(() => {
        completeSplash();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isAdLoaded, shouldShowAd]);

  // Complete splash immediately if conditions not met
  useEffect(() => {
    if (!shouldShowAd) {
      // If conditions not met (e.g., premium user), complete after a short delay to show the welcome message
      const timer = setTimeout(() => {
        completeSplash();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [shouldShowAd]);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        <Image
          source={require('@/assets/images/adaptive-icon.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.title}>CalmPulse</Text>
        
        {shouldShowAd && !isAdLoaded && (
          <Text style={styles.loadingText}>Loading...</Text>
        )}
        
        {!shouldShowAd && (
          <Text style={styles.loadingText}>Welcome back!</Text>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 20,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 30,
    paddingHorizontal: 40,
    lineHeight: 24,
  },
  loadingText: {
    fontSize: 14,
    color: '#94a3b8',
    marginTop: 20,
  },
  logo: {
    width: 600,
    height: 600,
    marginBottom: 10,
  },
}); 