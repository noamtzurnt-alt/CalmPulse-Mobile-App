import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Pressable, SafeAreaView, Text, Animated, Platform, Dimensions } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { useLanguage } from '@/lib/LanguageContext';
import { doc, getDoc } from 'firebase/firestore';
import { checkPremiumStatus } from '@/lib/premiumUtils';
// Premium removed
// import { identifyUser } from '@/lib/revenueCat';
// import Purchases from 'react-native-purchases';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useIsFocused } from '@react-navigation/native';
import { AppOpenAd, AdEventType, TestIds } from 'react-native-google-mobile-ads';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Ad Unit IDs
const APP_OPEN_AD_UNIT_ID = __DEV__
  ? TestIds.APP_OPEN
  : Platform.OS === 'ios'
    ? 'ca-app-pub-9135457753563605/9893348994' // iOS App Open Ad Unit ID
    : 'ca-app-pub-9135457753563605/2668136109'; // Android App Open Ad Unit ID

export default function IndexScreen() {
  console.log('🔍 IndexScreen component rendered');
  
  const router = useRouter();
  const isFocused = useIsFocused();
  const floatAnim = new Animated.Value(0);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  const { t, language } = useLanguage();
  const [showAd, setShowAd] = useState(false);
  const [isAdLoaded, setIsAdLoaded] = useState(false);
  const [isAdShown, setIsAdShown] = useState(false);
  const [adRetryCount, setAdRetryCount] = useState(0);
  const appOpenAd = React.useRef<AppOpenAd | null>(null);

  // Check authentication status first
  useEffect(() => {
    console.log('🔍 IndexScreen: Checking authentication status');
    
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log('🔍 IndexScreen: Auth state changed:', {
        hasUser: !!user,
        uid: user?.uid,
        email: user?.email,
        isAnonymous: user?.isAnonymous
      });

      if (!user || user.isAnonymous) {
        console.log('❌ IndexScreen: User not authenticated, redirecting to onboarding');
        router.replace('/onboarding');
        return;
      }

      // Gate: ensure onboarding fully completed (finished at myplan.tsx)
      try {
        const hasSeenOnboarding = await AsyncStorage.getItem('hasSeenOnboarding');
        if (hasSeenOnboarding !== 'true') {
          console.log('🚦 IndexScreen: Onboarding not completed, redirecting to onboarding');
          router.replace('/onboarding');
          return;
        }
      } catch (e) {
        console.log('⚠️ IndexScreen: Failed to read hasSeenOnboarding, redirecting to onboarding as safe default');
        router.replace('/onboarding');
        return;
      }

      console.log('✅ IndexScreen: User authenticated, continuing');
      setUser(user);
      setAuthChecked(true);
      // tracking moved to onsignup.tsx after successful signup
      
      // Check premium status
      try {
          const isPremium = await checkPremiumStatus(true);
          console.log('Initial premium status check:', isPremium);
          await AsyncStorage.setItem('hasPremium', isPremium.toString());
          await AsyncStorage.setItem('isPremium', isPremium.toString());
        if (isPremium) {
          try { await AsyncStorage.setItem('rc_suppress_until', String(Date.now() + 20000)); } catch {}
        }
      } catch (error) {
        console.error('Error checking initial premium status:', error);
        // Keep cached value on error to avoid flicker
      }
    });

    return () => unsubscribe();
  }, []);

  // Show App Open Ad for all users (except premium)
  useEffect(() => {
    console.log('🔍 Ad useEffect triggered:', { isFocused, user: !!user });
    
    // TEMPORARY: Disable App Open Ads for iOS and Android during testing
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      console.log('🚫 iOS/Android detected - App Open Ads disabled for testing');
      return;
    }
    
    // Show ads for all users when screen is focused
    if (isFocused) {
      console.log('✅ Conditions met for showing ad - screen focused');
      
      // Reset ad state when screen is focused
      setIsAdShown(false);
      setShowAd(false);
      setIsAdLoaded(false);
      setAdRetryCount(0); // Reset retry count
      
      const showAdForUser = async () => {
        try {
          console.log('🔍 Checking premium status for ad...');
          // Check if user is premium
          const isPremium = await checkPremiumStatus(true);
          if (isPremium) {
            console.log('🚫 Premium user - skipping ad');
            return;
          }

          console.log('🔍 Checking last ad time...');
          // Check last ad time to avoid showing too frequently
          const lastAdTime = await AsyncStorage.getItem('lastAppOpenTime');
          const now = Date.now();
          const timeSinceLastAd = lastAdTime ? now - parseInt(lastAdTime) : Infinity;
          
          console.log('⏰ Time since last ad:', timeSinceLastAd / 1000 / 60, 'minutes');
          
          // Show ad only if more than 5 minutes have passed
          if (timeSinceLastAd < 5 * 60 * 1000) {
            console.log('⏰ Ad shown recently, skipping');
            return;
          }

          console.log('📱 Showing App Open Ad for user');
          setShowAd(true);
          loadAppOpenAd();
        } catch (error) {
          console.error('❌ Error showing ad for user:', error);
          // Continue normally even if ad fails
          setShowAd(false);
          setIsAdShown(true);
        }
      };

      // Delay ad by 2 seconds to let the screen load
      const timer = setTimeout(showAdForUser, 2000);
      return () => clearTimeout(timer);
    } else {
      console.log('❌ Conditions not met for showing ad:', { 
        isFocused, 
        user: !!user
      });
    }
  }, [isFocused, user]);

  // Load App Open Ad
  const loadAppOpenAd = async () => {
    console.log('🔍 loadAppOpenAd called, showAd:', showAd);
    
    if (!showAd) {
      console.log('❌ showAd is false, returning');
      return;
    }

    console.log('📱 Loading App Open Ad for user...');
    console.log('📱 Using Ad Unit ID:', APP_OPEN_AD_UNIT_ID);
    
    try {
      appOpenAd.current = AppOpenAd.createForAdRequest(APP_OPEN_AD_UNIT_ID, {
        requestNonPersonalizedAdsOnly: true,
      });

      const unsubscribeLoaded = appOpenAd.current.addAdEventListener(
        AdEventType.LOADED,
        () => {
          console.log('✅ App Open Ad loaded for logged in user');
          setIsAdLoaded(true);
          setAdRetryCount(0); // Reset retry count on success
          showAppOpenAd();
        }
      );

      const unsubscribeError = appOpenAd.current.addAdEventListener(
        AdEventType.ERROR,
        (error: any) => {
          console.error('❌ App Open Ad failed to load for logged in user:', error);
          console.error('❌ Error details:', {
            namespace: error.namespace,
            code: error.code,
            message: error.message,
            jsStack: error.jsStack,
            userInfo: error.userInfo
          });
          
          // Check if it's a no-fill error (common in development)
          if (error.code === 'googleMobileAds/no-fill') {
            console.log('❌ This might be due to AdMob "Ad Limited" restriction');
            console.log('❌ Error code:', error.code);
            console.log('❌ Error message:', error.message);
          }
          
          setIsAdLoaded(false);
          setShowAd(false);
          
          // Retry logic - max 3 attempts
          if (adRetryCount < 3) {
            console.log(`🔄 Retrying ad load (attempt ${adRetryCount + 1}/3)`);
            setAdRetryCount(prev => prev + 1);
            setTimeout(() => {
              if (showAd) {
                loadAppOpenAd();
              }
            }, 2000); // Wait 2 seconds before retry
          } else {
            console.log('❌ Max ad retry attempts reached, giving up');
            setAdRetryCount(0);
          }
          
          // Clean up listeners
          unsubscribeLoaded();
          unsubscribeError();
        }
      );

      const unsubscribeClosed = appOpenAd.current.addAdEventListener(
        AdEventType.CLOSED,
        async () => {
          console.log('🔒 App Open Ad closed by logged in user');
          setIsAdShown(true);
          setShowAd(false);
          
          // Save ad time
          await AsyncStorage.setItem('lastAppOpenTime', Date.now().toString());
          console.log('💾 Saved lastAppOpenTime');
          
          // Clean up listeners
          unsubscribeLoaded();
          unsubscribeError();
          unsubscribeClosed();
        }
      );

      console.log('📱 Starting to load App Open Ad...');
      appOpenAd.current.load();
      
      // Add timeout for ad loading
      setTimeout(() => {
        if (!isAdLoaded && showAd) {
          console.log('⏰ Ad loading timeout - cleaning up');
          setIsAdLoaded(false);
          setShowAd(false);
          unsubscribeLoaded();
          unsubscribeError();
          unsubscribeClosed();
        }
      }, 10000); // 10 second timeout
      
    } catch (error) {
      console.error('❌ Error creating App Open Ad:', error);
      setIsAdLoaded(false);
      setShowAd(false);
    }
  };

  // Show App Open Ad
  const showAppOpenAd = () => {
    console.log('🔍 showAppOpenAd called:', { 
      hasAppOpenAd: !!appOpenAd.current, 
      isAdLoaded 
    });
    
    if (!appOpenAd.current || !isAdLoaded) {
      console.log('❌ Cannot show ad - conditions not met');
      return;
    }

    // Final premium check only
    const finalChecks = async () => {
      try {
        // Final premium check
        const isPremium = await checkPremiumStatus(true);
        if (isPremium) {
          console.log('🚫 Premium user detected - cancelling ad');
          setIsAdShown(true);
          setShowAd(false);
          return;
        }

        console.log('🎬 Showing App Open Ad for user');
        appOpenAd.current?.show();
      } catch (error) {
        console.error('❌ Error in final ad checks:', error);
        setIsAdShown(true);
        setShowAd(false);
      }
    };

    finalChecks();
  };

  // auth listener
  useEffect(() => {
    if (!auth) {
      console.log('Firebase auth not initialized');
      router.push("/onboarding");
      return;
    }

    const checkGuestStatus = async () => {
      const isGuest = await AsyncStorage.getItem('isGuest');
      if (isGuest === 'true') {
        console.log('Guest user detected via AsyncStorage');
        setLoading(false);
        return true;
      }
      return false;
    };

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log('🔍 Auth state changed:', { user: !!user, uid: user?.uid });
      
      const isGuestUser = await checkGuestStatus();
      if (isGuestUser) {
        console.log('👤 Guest user detected');
        setUser(null);
        return;
      }

      if (!user) {
        console.log('❌ No user logged in, redirecting to onboarding');
        router.push("/onboarding");
        return;
      }

      console.log('✅ User logged in:', user.uid);
      setUser(user);

      try {
        const isFirebaseGuestUser = user.isAnonymous;
        if (isFirebaseGuestUser) {
          await AsyncStorage.setItem('isGuest', 'true');
          await AsyncStorage.setItem('hasPremium', 'false');
          await AsyncStorage.setItem('isPremium', 'false');
        } else {
          // Premium removed: no identifyUser
          try {
              const hasPremium = await checkPremiumStatus(true);
              console.log('Premium status:', hasPremium);
              await AsyncStorage.setItem('hasPremium', hasPremium.toString());
              await AsyncStorage.setItem('isPremium', hasPremium.toString());
            if (hasPremium) {
              try { await AsyncStorage.setItem('rc_suppress_until', String(Date.now() + 20000)); } catch {}
            }
          } catch (error) {
            console.error('Error checking premium ownership:', error);
            // Keep cached value on error
          }
        }
      } catch (error) {
        console.error('Error checking user status:', error);
        await AsyncStorage.setItem('hasPremium', 'false');
        await AsyncStorage.setItem('isPremium', 'false');
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const floatAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    );

    floatAnimation.start();
    return () => floatAnimation.stop();
  }, []);

  const navigateToMusic = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      const userDoc = await getDoc(doc(db, 'users', user.uid));
      const userData = userDoc.data();

      if (userData?.musicData) {
        router.push({
          pathname: '/(tabs)/musicnew',
          params: { musicData: JSON.stringify(userData.musicData) }
        });
      } else {
        router.push('/(tabs)/musicnew');
      }
    } catch (error) {
      console.error('Error navigating to music:', error);
      router.push('/(tabs)/musicnew');
    }
  };

  // Don't render content until auth is checked
  if (!authChecked) {
    return (
      <SafeAreaView style={[styles.container, { direction: 'ltr', backgroundColor: '#f8fafc' }]}>
        <View style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }
 
  (async () => {
    try {
      const once = await AsyncStorage.getItem('fire_onboarding_home');
      if (once === 'true') {
        await AsyncStorage.removeItem('fire_onboarding_home');
      }
    } catch {}
  })();
 
  return (
    <SafeAreaView style={[styles.container, { direction: 'ltr', backgroundColor: '#f8fafc' }]}>
      {/* Welcome Text */}
      <View style={styles.titleContainer}>
        <Text style={styles.welcomeTitle}>{t('welcome')}</Text>
        <Text style={styles.waveEmoji}>👋</Text>
      </View>

      {/* Logo - Positioned absolutely */}
      <Animated.Image
        source={require('@/assets/images/adaptive-icon.png')}
        style={[
          styles.centerImage,
          {
            transform: [
              { scale: floatAnim.interpolate({
                  inputRange: [0, 0.5, 1],
                  outputRange: [1, 1.05, 1],
              })},
            ],
          },
        ]}
        resizeMode="contain"
      />

      {/* Buttons */}
      <View style={styles.buttonsSection}>
        <Pressable style={styles.calmButton} onPress={() => router.push('/(tabs)/before')}>
          <Ionicons name="leaf" size={24} color="white" />
          <ThemedText style={styles.calmButtonText}>{t('calmAnxiety')}</ThemedText>
        </Pressable>

        <Pressable style={styles.optionButton} onPress={() => router.push('/(tabs)/haptics')}>
          <Ionicons name="settings-outline" size={24} color="#334155" />
          <ThemedText style={styles.optionButtonText}>{t('hapticsCustomize')}</ThemedText>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    paddingHorizontal: 20,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingTop: screenHeight * 0.05,
    paddingBottom: screenHeight * 0.1,
  },
  welcomeTitle: {
    fontSize: Math.min(screenWidth * 0.06, 24),
    fontWeight: '700',
    color: '#334155',
    textAlign: 'center',
  },
  waveEmoji: {
    fontSize: Math.min(screenWidth * 0.06, 24),
    marginLeft: 8,
    lineHeight: Math.min(screenWidth * 0.06, 24) * 1.2,
  },
  centerImage: {
    position: 'absolute',
    width: Math.min(screenWidth * 0.65, 320),
    height: Math.min(screenWidth * 0.65, 320),
    top: '15%',
    left: Platform.OS === 'android' ? '20%' : '18%',
    transform: [
      { translateX: -Math.min(screenWidth * 0.325, 160) },
      { translateY: -Math.min(screenWidth * 0.325, 160) },
    ],
  },
  buttonsSection: {
    position: 'absolute',
    bottom: screenHeight * 0.25,
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: screenHeight * 0.03,
  },
  calmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#60A5FA',
    padding: Math.min(screenWidth * 0.05, 20),
    borderRadius: 16,
    gap: 12,
    width: Math.min(screenWidth * 0.85, 350),
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
    marginTop: 0,
    position: 'relative',
    zIndex: 10,
  },
  calmButtonText: {
    color: 'white',
    fontSize: Math.min(screenWidth * 0.055, 18),
    fontWeight: '800',
  },

  arrowContainer: {
    marginVertical: 8,
    marginTop: 70,
    position: 'absolute',
    top: 340,
    zIndex: 1,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'white',
    padding: Math.min(screenWidth * 0.04, 16),
    borderRadius: 12,
    gap: 8,
    width: Math.min(screenWidth * 0.8, 320),
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
    marginTop: 0,
  },
  optionButtonText: {
    color: '#334155',
    fontSize: Math.min(screenWidth * 0.04, 16),
    fontWeight: '600',
  },
}); 
