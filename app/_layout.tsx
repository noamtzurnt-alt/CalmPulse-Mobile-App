import React from 'react';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { View, Modal, Text, Pressable, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, ScrollView, Image, Platform, AppState, LogBox } from 'react-native';
import * as RN from 'react-native';
import { Asset } from 'expo-asset';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming, 
  withRepeat, 
  withSequence,
  withDelay,
  Easing 
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db, isFirebaseInitialized } from '../lib/firebase';
import { LanguageProvider } from '@/lib/LanguageContext';
import { PulseAIProvider } from '@/lib/PulseAIContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import * as SplashScreen from 'expo-splash-screen';
import 'expo-router/entry';
import { useColorScheme } from 'react-native';
import { ThemeProvider } from '@/lib/ThemeContext';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { initializeFirebase, configureGoogleSignIn } from '../lib/firebase';
// Premium removed: no RevenueCat usage
// import { initializeRevenueCat, identifyUser, checkPremiumStatus, syncRevenueCatUser } from '../lib/revenueCat';
// Premium removed: Purchases disabled
// import Purchases from 'react-native-purchases';
import mobileAds, { MaxAdContentRating } from 'react-native-google-mobile-ads';
import { checkSubscriptionExpiration, updatePremiumStatus } from '@/lib/premiumUtils';
// Premium removed: PREM ID not used
// import { PREMIUM_ENTITLEMENT_ID } from '@/lib/revenueCat';
import Constants from 'expo-constants';
import { useLanguage } from '@/lib/LanguageContext';
import SplashScreenWithAd from '@/components/SplashScreenWithAd';
// import { isVersionLessThan, openStoreForUpdate } from '@/lib/updateUtils';
import VersionGate from '@/components/VersionGate';
import { Settings as FBSettings, AppEventsLogger } from 'react-native-fbsdk-next';
import { getTrackingPermissionsAsync, requestTrackingPermissionsAsync } from 'expo-tracking-transparency';

// Simple diagnostic logger for native promise errors
function logNativeError(label: string, err: any) {
  try {
    const type = typeof err;
    const msg = (err && (err.message || err.msg || err.toString?.())) || String(err);
    const keys = err && typeof err === 'object' ? Object.keys(err) : [];
    console.log(`🧩 [DIAG] ${label} error`, { type, msg, keys, raw: err });
  } catch {}
}

// Safe reload helper for React Native
async function reloadApp() {
  try {
    const Updates = await import('expo-updates');
    if ((Updates as any)?.reloadAsync) {
      await (Updates as any).reloadAsync();
      return;
    }
  } catch {}
  try {
    const { DevSettings } = await import('react-native');
    (DevSettings as any)?.reload?.();
  } catch {}
}

// Error boundary component to catch JavaScript errors
interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('Error caught by boundary:', error, errorInfo);
    this.setState({ errorInfo });
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#fff' }}>
          <Text style={{ fontSize: 18, marginBottom: 10, textAlign: 'center', color: '#000', fontWeight: 'bold' }}>
            Something went wrong
          </Text>
          
          <ScrollView style={{ maxHeight: 200, width: '100%', marginBottom: 20 }}>
            <Text style={{ fontSize: 14, marginBottom: 10, textAlign: 'center', color: '#e53e3e' }}>
              {this.state.error?.message || 'Unknown error'}
            </Text>
            
            {this.state.errorInfo && (
              <Text style={{ fontSize: 12, textAlign: 'left', color: '#666' }}>
                {this.state.errorInfo.componentStack}
              </Text>
            )}
          </ScrollView>
          
          <TouchableOpacity
            style={{ padding: 10, backgroundColor: '#60A5FA', borderRadius: 5 }}
            onPress={() => {
              this.setState({ hasError: false, error: null, errorInfo: null });
              // Try to reload the app
              reloadApp();
            }}
          >
            <Text style={{ color: 'white' }}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}

// Globally lock Text/TextInput scaling across the app
try {
  // @ts-ignore
  if (RN.Text && RN.Text.defaultProps == null) RN.Text.defaultProps = {} as any;
  // @ts-ignore
  RN.Text.defaultProps = { ...(RN.Text.defaultProps || {}), allowFontScaling: false, maxFontSizeMultiplier: 1 } as any;
  // @ts-ignore
  if (RN.TextInput && RN.TextInput.defaultProps == null) RN.TextInput.defaultProps = {} as any;
  // @ts-ignore
  RN.TextInput.defaultProps = { ...(RN.TextInput.defaultProps || {}), allowFontScaling: false, maxFontSizeMultiplier: 1 } as any;
} catch {}

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync().catch(() => {
  /* reloading the app might trigger some race conditions, ignore them */
});

// Silence deprecation warnings for expo-av until full migration to expo-audio is done
try {
  LogBox.ignoreLogs([
    '[expo-av]: Expo AV has been deprecated',
    'expo-av',
  ]);
} catch {}

export default function RootLayout() {
  const [showSettings, setShowSettings] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const [firebaseInitialized, setFirebaseInitialized] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [appIsReady, setAppIsReady] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [isAppActive, setIsAppActive] = useState(true);
  const [hasShownSplash, setHasShownSplash] = useState(false);
  const colorScheme = useColorScheme();
  const [hasPremium, setHasPremium] = useState(false);
  const [showAppOpenAd, setShowAppOpenAd] = useState(true);
  const { language } = useLanguage();
  const [forceUpdateRequired, setForceUpdateRequired] = useState(false);
  
  // Animation values for splash screen
  const logoOpacity = useSharedValue(0);
  const textOpacity = useSharedValue(0);
  const pulseScale = useSharedValue(1);
  const loadingTextOpacity = useSharedValue(0);

  // Premium removed; no customer info fetch
  const fetchCustomerInfo = async () => { return; };

  // Handle App Open Ads - Show immediately when app starts (enabled)
  useEffect(() => {
    console.log('🧩 [DIAG] INIT: AdMob init effect start');
    setShowAppOpenAd(true);
    // Initialize AdMob SDK with better error handling
    try {
      // Ensure consent/ATT before mobileAds initialize
      (async () => {
        try {
          console.log('🧩 [DIAG] AdMob: ensureAdsConsentInitialized -> start');
          const { ensureAdsConsentInitialized } = await import('@/lib/adsConsent');
          await ensureAdsConsentInitialized();
          console.log('🧩 [DIAG] AdMob: ensureAdsConsentInitialized -> done');
        } catch (e) { 
          logNativeError('AdMob.ensureAdsConsentInitialized', e);
          // Continue even if consent fails
        }
        
        try {
          console.log('🧩 [DIAG] AdMob: setRequestConfiguration -> start');
          await mobileAds()
          .setRequestConfiguration({
            maxAdContentRating: MaxAdContentRating.G,
            tagForChildDirectedTreatment: false,
            tagForUnderAgeOfConsent: false,
            });
          console.log('🧩 [DIAG] AdMob: setRequestConfiguration -> done');
        } catch (e) { 
          logNativeError('AdMob.setRequestConfiguration', e);
          // Continue even if configuration fails
        }
        
        try {
          console.log('🧩 [DIAG] AdMob: initialize -> start');
          await mobileAds().initialize();
          console.log('🧩 [DIAG] AdMob: initialize -> done');
        } catch (e) { 
          logNativeError('AdMob.initialize', e);
          // Continue even if AdMob initialization fails
          setShowAppOpenAd(false); // Disable ads if initialization fails
        }
      })();
    } catch (e) { 
      logNativeError('AdMob.init.effect', e);
      setShowAppOpenAd(false); // Disable ads if there's an error
    }
  }, []);

  // Forced update gate: removed (handled by VersionGate)

  // Monitor app state changes
  useEffect(() => {
    const handleAppStateChange = (nextAppState: string) => {
      console.log('🔍 App state changed:', nextAppState);
      
      if (nextAppState === 'active') {
        setIsAppActive(true);
        console.log('✅ App became active');
      } else if (nextAppState === 'background' || nextAppState === 'inactive') {
        setIsAppActive(false);
        console.log('❌ App went to background');
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, []);

  useEffect(() => {
    console.log('🔍 Auth state change listener started');
    
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (__DEV__) {
        console.log('🔍 Auth state changed:', {
          hasUser: !!user,
          isAnonymous: user?.isAnonymous,
          currentTime: new Date().toISOString()
        });
      }
      
      if (user) {
        try {
          // Check if user is anonymous
          const isAnonymous = user.isAnonymous;
          if (__DEV__) {
            console.log('🔍 User connection status:', {
              isAnonymous: isAnonymous,
              providerId: user.providerId,
              creationTime: user.metadata.creationTime,
              lastSignInTime: user.metadata.lastSignInTime
            });
          }

          // Identify RevenueCat with current Firebase UID (non-blocking)
          try {
            const { identifyUser } = await import('@/lib/revenueCat');
            await identifyUser(user.uid);
          } catch {}
          // Set authenticated state
          console.log('✅ Setting user as authenticated');
          setIsAuthenticated(true);
          await AsyncStorage.setItem('isAuthenticated', 'true');
        } catch (error) {
          console.warn('⚠️ Failed to sync premium status:', error);
        }
      } else {
        console.log('❌ Setting user as not authenticated');
        setIsAuthenticated(false);
        await AsyncStorage.setItem('isAuthenticated', 'false');
        // Log out RevenueCat when user signs out
        try {
          const { logOutUser } = await import('@/lib/revenueCat');
          await logOutUser();
        } catch {}
      }
      
      // Mark auth check as complete
      console.log('✅ Marking auth check as complete');
      setAuthChecked(true);
    });

    return () => unsubscribe();
  }, []);

  
  
  // Initialize Firebase with retry mechanism
  useEffect(() => {
    const initApp = async () => {
      try {
        console.log('🧩 [DIAG] INIT: App init -> start');
        
        // Add delay to prevent race conditions
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Preload onboarding images with error handling
        try {
          console.log('🧩 [DIAG] Asset.load -> start');
          await Asset.loadAsync(require('../assets/images/adaptive-icon.png'));
          console.log('🧩 [DIAG] Asset.load -> done');
        } catch (e) { 
          logNativeError('Asset.load', e);
          // Continue even if asset loading fails
        }

        if (isFirebaseInitialized()) {
          console.log('🧩 [DIAG] Firebase already initialized');
          setFirebaseInitialized(true);
          // Ensure Google Sign-In is configured even if Firebase was already initialized
          try { 
            console.log('🧩 [DIAG] configureGoogleSignIn -> start'); 
            configureGoogleSignIn(); 
            console.log('🧩 [DIAG] configureGoogleSignIn -> done'); 
          } catch (e) { 
            logNativeError('configureGoogleSignIn', e);
            // Continue even if Google Sign-In fails
          }
          // Initialize analytics
          setTimeout(() => {
          setAppIsReady(true);
          setIsLoading(false);
          console.log('🧩 [DIAG] INIT: App ready (fast-path)');
          
          // Facebook Event - App Launched
          try {
            AppEventsLogger.logEvent('App_Launched', {
              'source': 'app_start',
              'user_id': auth.currentUser?.uid || 'anonymous',
              'timestamp': new Date().toISOString()
            });
            console.log('✅ Facebook event: App_Launched logged');
          } catch (fbError) {
            console.log('⚠️ Facebook App_Launched event failed:', fbError);
          }
        }, 2000); // Reduced timeout
        return;
      }
  
        try { 
          console.log('🧩 [DIAG] initializeFirebase -> start'); 
          await initializeFirebase(); 
          console.log('🧩 [DIAG] initializeFirebase -> done'); 
        } catch (e) { 
          logNativeError('initializeFirebase', e);
          // Continue even if Firebase initialization fails
        }
        
        try { 
          console.log('🧩 [DIAG] configureGoogleSignIn -> start'); 
          configureGoogleSignIn(); 
          console.log('🧩 [DIAG] configureGoogleSignIn -> done'); 
        } catch (e) { 
          logNativeError('configureGoogleSignIn', e);
          // Continue even if Google Sign-In fails
        }
        
        setFirebaseInitialized(true);
        console.log('🧩 [DIAG] INIT: App is ready (cold-path)');
        setTimeout(() => {
          setAppIsReady(true);
          setIsLoading(false);
          
          // Facebook Event - App Launched (Cold Start)
          try {
            AppEventsLogger.logEvent('App_Launched', {
              'source': 'app_start_cold',
              'user_id': auth.currentUser?.uid || 'anonymous',
              'timestamp': new Date().toISOString()
            });
            console.log('✅ Facebook event: App_Launched (cold) logged');
          } catch (fbError) {
            console.log('⚠️ Facebook App_Launched (cold) event failed:', fbError);
          }
        }, 2000); // Reduced timeout
      } catch (error) {
        console.error('❌ Critical error in app initialization:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        setError(`Error initializing app: ${errorMessage}`);
        setErrorDetails(error instanceof Error ? error.stack || null : null);
        
        // Set app as ready even on error to prevent infinite loading
        setTimeout(() => {
          setAppIsReady(true);
          setIsLoading(false);
        }, 1000);
        
        if (retryCount < 3) {
          setTimeout(() => setRetryCount((prev) => prev + 1), 1000);
        }
      }
    };

    initApp();
  }, [retryCount]);

  // Global error handler
  useEffect(() => {
    const handleError = (error: Error): void => {
      console.error('Global error caught:', error);
      
      // Extract detailed error message
      let errorMessage = 'An unexpected error occurred.';
      let details = '';
      
      if (error instanceof Error) {
        errorMessage = `Error: ${error.message}`;
        details = error.stack || '';
      }
      
      setError(errorMessage);
      setErrorDetails(error instanceof Error ? error.stack || null : null);
    };

    // Add global error handler
    const originalErrorHandler = ErrorUtils.getGlobalHandler();
    ErrorUtils.setGlobalHandler((error: Error, isFatal?: boolean) => {
      handleError(error);
      // Still call the original handler
      originalErrorHandler(error, isFatal);
    });

    return () => {
      // Restore original handler on cleanup
      ErrorUtils.setGlobalHandler(originalErrorHandler);
    };
  }, []);

  // Ensure appIsReady is set correctly and the splash screen is hidden appropriately
  useEffect(() => {
    if (appIsReady && !hasShownSplash) {
      // Only show splash screen if app is truly starting fresh
      setHasShownSplash(true);
      
      // Add delay before starting fade out
      setTimeout(() => {
      // Fade out animations when app is ready
      logoOpacity.value = withTiming(0, { duration: 500, easing: Easing.out(Easing.cubic) });
      textOpacity.value = withTiming(0, { duration: 500, easing: Easing.out(Easing.cubic) });
      loadingTextOpacity.value = withTiming(0, { duration: 500, easing: Easing.out(Easing.cubic) });
      
      // Hide splash screen after fade out
      setTimeout(() => {
        SplashScreen.hideAsync().catch(() => {
          console.error('Error hiding splash screen');
        });
      }, 500);
      }, 2000); // 2 second delay before starting fade out
    } else if (appIsReady && hasShownSplash) {
      // If app is ready and splash has been shown, hide immediately
      SplashScreen.hideAsync().catch(() => {
        console.error('Error hiding splash screen');
      });
    }
  }, [appIsReady, hasShownSplash]);

  // Start splash screen animations
  useEffect(() => {
    if (isLoading || !appIsReady) {
      // Logo fade in animation
      logoOpacity.value = withTiming(1, { duration: 800, easing: Easing.out(Easing.cubic) });
      
      // Gentle pulse animation
      pulseScale.value = withRepeat(
        withSequence(
          withTiming(1.05, { duration: 1500, easing: Easing.inOut(Easing.cubic) }),
          withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.cubic) })
        ),
        -1,
        true
      );
      
      // Text animation with delay
      textOpacity.value = withDelay(600, withTiming(1, { duration: 800, easing: Easing.out(Easing.cubic) }));
      
      // Loading text animation with longer delay
      loadingTextOpacity.value = withDelay(1000, withTiming(1, { duration: 800, easing: Easing.out(Easing.cubic) }));
    }
  }, [isLoading, appIsReady]);

  // Animated styles
  const logoAnimatedStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value
  }));

  const logoImageAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: pulseScale.value }
    ]
  }));

  const textAnimatedStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value
  }));

  const pulseAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }]
  }));

  const loadingTextAnimatedStyle = useAnimatedStyle(() => ({
    opacity: loadingTextOpacity.value
  }));

  // RevenueCat init + Facebook SDK init
  useEffect(() => {
    (async () => {
      try {
        // Initialize Facebook SDK with better error handling
        try {
          console.log('🧩 [DIAG] FBSettings: configure -> start');
          const extra: any = (Constants as any)?.expoConfig?.extra || {};
          const appId = typeof extra?.FB_APP_ID === 'string' ? extra.FB_APP_ID : undefined;
          const displayName = typeof extra?.FB_DISPLAY_NAME === 'string' ? extra.FB_DISPLAY_NAME : undefined;
          
          if (appId && (FBSettings as any)?.setAppID) { 
            try { (FBSettings as any).setAppID(appId); } catch (e) { logNativeError('FBSettings.setAppID', e); } 
          }
          if (displayName && (FBSettings as any)?.setDisplayName) { 
            try { (FBSettings as any).setDisplayName(displayName); } catch (e) { logNativeError('FBSettings.setDisplayName', e); } 
          }
          if ((FBSettings as any)?.initializeSDK) { 
            try { 
              console.log('🧩 [DIAG] FBSettings: initializeSDK -> start'); 
              (FBSettings as any).initializeSDK(); 
              console.log('🧩 [DIAG] FBSettings: initializeSDK -> done'); 
            } catch (e) { 
              logNativeError('FBSettings.initializeSDK', e);
              // Continue even if Facebook SDK fails
            } 
          }
          
          // Enable auto app events & advertiser ID collection
          try { (FBSettings as any).setAutoLogAppEventsEnabled?.(true); } catch (e) { logNativeError('FBSettings.setAutoLogAppEventsEnabled', e); }
          try { (FBSettings as any).setAdvertiserIDCollectionEnabled?.(true); } catch (e) { logNativeError('FBSettings.setAdvertiserIDCollectionEnabled', e); }
          
          // iOS ATT -> enable advertiser tracking if granted
          if (Platform.OS === 'ios') {
            try {
              const { status } = await getTrackingPermissionsAsync();
              const final = status === 'undetermined' ? (await requestTrackingPermissionsAsync()).status : status;
              if (final === 'granted') {
                try { (FBSettings as any).setAdvertiserTrackingEnabled?.(true); } catch (e) { logNativeError('FBSettings.setAdvertiserTrackingEnabled', e); }
              }
            } catch (e) { logNativeError('ATT.request', e); }
          }
          console.log('🧩 [DIAG] FBSettings: configure -> done');
        } catch (e) { 
          logNativeError('FBSettings.configure.block', e);
          // Continue even if Facebook SDK fails
        }
        
        // Initialize RevenueCat with better error handling
        try {
          console.log('🧩 [DIAG] RevenueCat: initRevenueCat -> start');
          const { initRevenueCat } = await import('@/lib/revenueCat');
          await initRevenueCat();
          console.log('🧩 [DIAG] RevenueCat: initRevenueCat -> done');
        } catch (e) { 
          logNativeError('RevenueCat.init', e);
          // Continue even if RevenueCat fails
        }
      } catch (error) {
        logNativeError('SDK.init.outer', error);
        // Continue even if all SDK initialization fails
      }
    })();
  }, []);

  // Facebook fallback purchase tracking via RevenueCat listener
  useEffect(() => {
    let cleanup: (() => void) | undefined;
    (async () => {
      try {
        const { startFacebookPurchaseTracking } = await import('@/lib/revenueCat');
        cleanup = await startFacebookPurchaseTracking();
      } catch {}
    })();
    return () => { try { cleanup?.(); } catch {} };
  }, []);

  if (isLoading || !appIsReady) {
    return (
      <View style={{ 
        flex: 1, 
        justifyContent: 'center', 
        alignItems: 'center', 
        backgroundColor: '#f8fafc',
        paddingHorizontal: 40
      }}>
        <Animated.View style={[logoAnimatedStyle, { marginBottom: 30 }]}>
          <Animated.Image 
            source={require('../assets/images/adaptive-icon.png')}
            style={[logoImageAnimatedStyle, {
              width: 200,
              height: 200,
              resizeMode: 'contain'
            }]}
          />
        </Animated.View>
        
        <Animated.View style={textAnimatedStyle}>
          <Text style={{ 
            fontSize: 24, 
            fontWeight: 'bold', 
            color: '#334155',
            marginBottom: 10,
            textAlign: 'center'
          }}>
            PULSE
          </Text>
          <Text style={{ 
            fontSize: 16, 
            color: '#64748b',
            marginBottom: 30,
            textAlign: 'center'
          }}>
            {language === 'he' ? 'המלווה האינטליגנטי שלך לרווחה' : 'Your AI Wellness Companion'}
          </Text>
        </Animated.View>
        
        <ActivityIndicator size="large" color="#60A5FA" />
        <Animated.Text style={[loadingTextAnimatedStyle, { 
          marginTop: 20, 
          fontSize: 14, 
          color: '#64748b',
          textAlign: 'center'
        }]}>
          {language === 'he' ? 'טוען את מסע הרווחה שלך...' : 'Loading your wellness journey...'}
        </Animated.Text>
      </View>
    );
  }

  // Blocking forced update overlay: handled by VersionGate

  if (error) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#fff' }}>
        <Text style={{ fontSize: 18, marginBottom: 10, textAlign: 'center', color: '#000', fontWeight: 'bold' }}>
          {error}
        </Text>
        {errorDetails && (
          <ScrollView style={{ maxHeight: 200, width: '100%', marginBottom: 20 }}>
            <Text style={{ fontSize: 12, textAlign: 'left', color: '#666' }}>
              {errorDetails}
            </Text>
          </ScrollView>
        )}
        <TouchableOpacity
          style={{ padding: 10, backgroundColor: '#60A5FA', borderRadius: 5 }}
          onPress={() => {
            setError(null);
            setErrorDetails(null);
            setRetryCount(0);
            reloadApp();
          }}
        >
          <Text style={{ color: 'white' }}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <LanguageProvider>
          <PulseAIProvider>
            <VersionGate>
              <StatusBar style="dark" backgroundColor="#f8fafc" />
              <SafeAreaProvider style={{ backgroundColor: '#f8fafc' }}>
                <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
                {showAppOpenAd ? (
                  <SplashScreenWithAd
                    onAdComplete={() => {
                      setShowAppOpenAd(false);
                    }}
                    onTimeout={() => {
                      setShowAppOpenAd(false);
                    }}
                  />
                ) : (
                  // Add debug info
                  console.log('🔍 Rendering main app with:', {
                    authChecked,
                    isAuthenticated,
                    appIsReady,
                    currentTime: new Date().toISOString()
                  }),
                  <Stack
                  screenOptions={{
                    headerShown: false,
                    headerRight: () => (
                      <TouchableOpacity 
                        onPress={() => setShowSettings(true)}
                        style={styles.settingsButton}
                      >
                        <Ionicons name="settings-outline" size={24} color="#1e293b" />
                      </TouchableOpacity>
                    ),
                    gestureEnabled: false,
                    contentStyle: {
                      backgroundColor: '#f8fafc',
                    },

                  }}
                  initialRouteName="(tabs)"
                >
                  <Stack.Screen 
  name="onboarding"
  options={{ headerShown: false, gestureEnabled: false }}
/>

<Stack.Screen 
  name="(tabs)"
  options={{ headerShown: false }}
/>

                  <Stack.Screen name="(games)" />
                </Stack>
                )}
                </View>

                <Modal
                  animationType="slide"
                  transparent={true}
                  visible={showSettings}
                  onRequestClose={() => setShowSettings(false)}
                >
                  <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                      <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>Settings</Text>
                        <TouchableOpacity 
                          onPress={() => setShowSettings(false)}
                          style={styles.closeButton}
                        >
                          <Ionicons name="close" size={24} color="#1e293b" />
                        </TouchableOpacity>
                      </View>

                      <TouchableOpacity 
                        style={styles.settingItem}
                        onPress={() => setIsMuted(!isMuted)}
                      >
                        <Ionicons 
                          name={isMuted ? "volume-mute" : "volume-medium"} 
                          size={24} 
                          color="#1e293b" 
                        />
                        <Text style={styles.settingText}>
                          {isMuted ? "Unmute" : "Mute"}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity style={styles.settingItem}>
                        <Ionicons name="shield-checkmark-outline" size={24} color="#1e293b" />
                        <Text style={styles.settingText}>Privacy Policy</Text>
                      </TouchableOpacity>

                      <View style={styles.userSection}>
                        <Text style={styles.userSectionTitle}>Current User</Text>
                        <Text style={styles.userInfo}>Not logged in</Text>
                      </View>
                    </View>
                  </View>
                </Modal>
              </SafeAreaProvider>
            </VersionGate>
          </PulseAIProvider>
        </LanguageProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  logoContainer: {
    width: 300,
    height: 300,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30,
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
  logoGlow: {
    position: 'absolute',
    width: '110%',
    height: '110%',
    borderRadius: 137.5,
    backgroundColor: 'rgba(96, 165, 250, 0.15)',
    zIndex: -1,
  },
  appName: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 15,
  },
  loadingText: {
    fontSize: 20,
    color: '#64748b',
    textAlign: 'center',
  },
  settingsButton: {
    marginRight: 16,
    padding: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    minHeight: 300,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1e293b',
  },
  closeButton: {
    padding: 8,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  settingText: {
    marginLeft: 12,
    fontSize: 16,
    color: '#1e293b',
  },
  userSection: {
    marginTop: 20,
    padding: 16,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
  },
  userSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 8,
  },
  userInfo: {
    fontSize: 14,
    color: '#64748b',
  },
});