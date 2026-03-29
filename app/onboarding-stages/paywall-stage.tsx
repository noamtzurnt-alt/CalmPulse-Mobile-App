import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  SafeAreaView,
  ImageBackground,
  ScrollView,
  ActivityIndicator,
  Platform,
  Alert,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { OnboardingImages } from '@/constants/Images';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { getOfferings, purchasePackage, restorePurchases, getCustomerInfo, isPremiumFromCustomerInfo, syncRevenueCatUser } from '@/lib/revenueCat';
import { auth, db } from '@/lib/firebase';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { AppEventsLogger } from 'react-native-fbsdk-next';

interface PaywallStageProps {
  onComplete: () => void;
  onBack?: () => void;
  source?: 'pulse-ai' | 'afterinfo';
}

export default function PaywallStage({ onComplete, source }: PaywallStageProps) {
  const insets = useSafeAreaInsets();
  const [imageLoaded, setImageLoaded] = useState(false);
  const [showSlowConnectionMessage, setShowSlowConnectionMessage] = useState(false);
  const [busy, setBusy] = useState<boolean>(false);
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const params = useLocalSearchParams<any>();
  const router = useRouter();

  const resolveRedirect = () => {
    let redirect: any = null;
    const r = (params as any)?.redirect;
    if (typeof r === 'string') {
      try { redirect = JSON.parse(r); } catch {}
    } else if (r && typeof r === 'object') {
      redirect = r;
    }
    if (redirect?.screen) return redirect;
    if ((params as any)?.from) return { screen: String((params as any).from) };
    return null;
  };

  const doRedirect = () => {
    const target = resolveRedirect();
    if (target?.screen) {
      try {
        const raw = String(target.screen);
        const path = raw.includes('/')
          ? (raw.startsWith('/') ? raw : '/' + raw)
          : ((raw.toLowerCase() === 'index') ? '/(tabs)' : `/(tabs)/${raw}`);
        router.replace(path);
        return;
    } catch {}
    }
    if (typeof onComplete === 'function') {
      onComplete();
      return;
    }
    try { router.replace('/(tabs)'); } catch {}
  };

  const handlePurchase = async (planType: 'monthly' | 'sixMonth' = 'monthly') => {
    if (busy) return;
    setBusy(true);
    
    // Facebook Pixel Event - Purchase Button Clicked
    try {
      AppEventsLogger.logEvent('Purchase_Button_Clicked', {
        'plan_type': planType,
        'source': source || String((params as any)?.source || ''),
        'user_id': auth.currentUser?.uid || 'anonymous'
      });
      console.log('✅ Facebook event: Purchase_Button_Clicked logged');
    } catch (fbError) {
      console.log('⚠️ Facebook Purchase_Button_Clicked event failed:', fbError);
    }
    
    try {
      const offerings = await getOfferings();
      const available = offerings?.availablePackages || [];
      
      let selectedPackage;
      if (planType === 'sixMonth') {
        // Look for 6-month package first, then fallback to any package
        selectedPackage = available.find((p: any) => p?.identifier === '$rc_six_month') || 
                         available.find((p: any) => p?.identifier?.includes('6') || p?.identifier?.includes('six')) ||
                         available[0];
      } else {
        // Monthly package
        selectedPackage = available.find((p: any) => p?.identifier === '$rc_monthly') || available[0];
      }
      
      if (!selectedPackage) {
        Alert.alert('Network error', 'Network error. Try again.');
        setBusy(false);
        return;
      }
      const result: any = await purchasePackage(selectedPackage);
      // If user cancelled
      if (result?.userCancelled) {
        Toast.show({ type: 'info', text1: 'Purchase cancelled.' });
        setBusy(false);
      return;
    }
      // Prefer customerInfo returned from purchase
      let info: any = result?.customerInfo;
      if (!info) {
        info = await getCustomerInfo();
      }
      let active = isPremiumFromCustomerInfo(info);
      if (!active) {
        // Sandbox may lag; try to sync and poll a few times
        try { await syncRevenueCatUser(); } catch {}
        const maxAttempts = 6;
        for (let i = 0; i < maxAttempts && !active; i++) {
          await new Promise(r => setTimeout(r, 1500));
          try { info = await getCustomerInfo(); } catch {}
          active = isPremiumFromCustomerInfo(info);
        }
      }
      if (active) {
        try {
          await addDoc(collection(db, 'pruchase'), {
            uid: auth.currentUser?.uid || null,
            event: 'purchase_success',
            next: 'index',
            source: source || String((params as any)?.source || ''),
            createdAt: serverTimestamp(),
          });
        } catch {}
        
        // Facebook Pixel Events
        try {
          // Track Purchase Event (Standard Facebook Event)
          AppEventsLogger.logPurchase(9.99, 'USD', {
            'fb_content_type': 'product',
            'fb_content_name': 'CalmPulse Premium',
            'fb_content_category': 'subscription',
            'fb_content_id': 'premium_monthly',
            'source': source || String((params as any)?.source || ''),
            'plan_type': planType
          });
          
          // Track Subscription Event (Better for subscriptions)
          AppEventsLogger.logEvent('SubscriptionInitiated', {
            'fb_currency': 'USD',
            'fb_value': 9.99,
            'fb_content_type': 'subscription',
            'fb_content_name': 'CalmPulse Premium',
            'fb_content_category': 'wellness',
            'fb_content_id': 'premium_monthly',
            'source': source || String((params as any)?.source || ''),
            'plan_type': planType,
            'user_id': auth.currentUser?.uid || 'anonymous'
          });
          
          // Track Custom Event for Campaign Optimization
          AppEventsLogger.logEvent('Premium_Purchase', {
            'plan_type': planType,
            'source': source || String((params as any)?.source || ''),
            'user_id': auth.currentUser?.uid || 'anonymous',
            'campaign_source': 'facebook_ads',
            'conversion_value': 9.99
          });
          
          console.log('✅ Facebook events logged for purchase');
        } catch (fbError) {
          console.log('⚠️ Facebook events failed:', fbError);
        }
        
        Toast.show({ type: 'success', text1: 'Premium activated. Enjoy full access 🎉' });
        doRedirect();
        } else {
        Alert.alert('Network error', 'Network error. Try again.');
      }
    } catch (e: any) {
      const msg = String(e?.message || '').toLowerCase();
      if (msg.includes('cancel')) {
        Toast.show({ type: 'info', text1: 'Purchase cancelled.' });
      } else {
        Toast.show({ type: 'error', text1: 'Network error. Try again.' });
      }
    } finally {
      setBusy(false);
    }
  };

  const handleRestore = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await restorePurchases();
      if (res.active) {
        Toast.show({ type: 'success', text1: 'Premium restored to your current account.' });
        doRedirect();
        } else {
        Alert.alert('No active subscription', 'No active subscription found. Make sure you are signed in with the same Apple ID/Google account used for the purchase.');
      }
    } catch {
      Toast.show({ type: 'error', text1: 'Network error. Try again.' });
    } finally {
      setBusy(false);
    }
  };

  const showClose = (source === 'pulse-ai') || (String((params as any)?.source || '') === 'pulse-ai');

  // Start animation when component mounts
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 3,
        useNativeDriver: true,
      }),
    ]).start();
    
    // Facebook Pixel Event - Paywall Viewed
    try {
      AppEventsLogger.logEvent('Paywall_Viewed', {
        'source': source || String((params as any)?.source || ''),
        'user_id': auth.currentUser?.uid || 'anonymous',
        'timestamp': new Date().toISOString()
      });
      console.log('✅ Facebook event: Paywall_Viewed logged');
    } catch (fbError) {
      console.log('⚠️ Facebook Paywall_Viewed event failed:', fbError);
    }
  }, []);


  return (
    <ImageBackground
      source={OnboardingImages.pulseBackground}
      style={styles.container}
      resizeMode="cover"
      fadeDuration={0}
      progressiveRenderingEnabled={false}
      onLoad={() => setImageLoaded(true)}
      onError={() => setImageLoaded(true)}
      onLoadStart={() => {
        setTimeout(() => setShowSlowConnectionMessage(true), 4000);
      }}
    >
      <View style={styles.overlay} />
      
      {!imageLoaded && (
        <View style={styles.backgroundLoadingContainer}>
          <ActivityIndicator size="large" color="#60A5FA" />
          <Text style={styles.backgroundLoadingText} allowFontScaling={false}>Loading...</Text>
          {showSlowConnectionMessage && (
            <Text style={styles.slowConnectionText} allowFontScaling={false}>
              Slow network connection, just a few moments and we'll overcome this
            </Text>
          )}
        </View>
      )}
      
            <SafeAreaView style={[styles.safeArea, { paddingTop: insets.top, paddingBottom: insets.bottom + 8 }]}>
        <View style={styles.content}>
          {/* Top Buttons */}
          <View style={[styles.topButtonsContainer, { justifyContent: showClose ? 'space-between' : 'flex-end' }]}>
            {showClose && (
              <View style={styles.closeButton}>
                <Pressable onPress={() => { if (busy) return; doRedirect(); }} disabled={busy}>
                  <Ionicons name="close" size={24} color="white" />
                </Pressable>
              </View>
            )}
            <Pressable style={styles.restoreButton} onPress={handleRestore} disabled={busy}>
              <Text style={styles.restoreText} allowFontScaling={false}>Restore Purchase</Text>
            </Pressable>
          </View>

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.premiumTitle} allowFontScaling={false}>Get Premium</Text>
            <Text style={styles.premiumSubtitle} allowFontScaling={false}>Premium Features</Text>
          </View>

          {/* Premium Benefits */}
          <View style={styles.benefitsContainer}>
              <View style={styles.benefitsGrid}>
                <View style={styles.benefitItem}>
                  <Ionicons name="sparkles" size={32} color="#FFD700" />
                  <Text style={styles.benefitText} allowFontScaling={false}>AI Features</Text>
                </View>
                <View style={styles.benefitItem}>
                  <Ionicons name="videocam" size={32} color="#FF6B6B" />
                  <Text style={styles.benefitText} allowFontScaling={false}>Video Creator</Text>
                </View>
                <View style={styles.benefitItem}>
                  <Ionicons name="shield-checkmark" size={32} color="#4ECDC4" />
                  <Text style={styles.benefitText} allowFontScaling={false}>No Ads</Text>
                </View>
                <View style={styles.benefitItem}>
                  <Ionicons name="infinite" size={32} color="#A8E6CF" />
                  <Text style={styles.benefitText} allowFontScaling={false}>Unlimited</Text>
                </View>
              </View>
              <Animated.Text 
                style={[
                  styles.compellingText, 
                  {
                    opacity: fadeAnim,
                    transform: [{ scale: scaleAnim }]
                  }
                ]} 
                allowFontScaling={false}
              >
                Start your journey to inner peace today 💫
              </Animated.Text>
          </View>

          {/* Pricing Section */}
          <View style={[styles.pricingContainer, { alignItems: 'center' }]}>
            <View style={styles.pricingRow}>
              {/* Monthly Plan - Left */}
              <Pressable style={({ pressed }) => [styles.monthlyPlan, { flex: 1, marginRight: 6 }, pressed && styles.pressed]} onPress={() => handlePurchase('monthly')} disabled={busy}>
                <View style={styles.popularBadge}><Text style={styles.popularText} allowFontScaling={false}>POPULAR</Text></View>
                <Text style={styles.planTitle} allowFontScaling={false}>Monthly</Text>
                <View style={styles.priceContainer}>
                  <Text style={styles.originalPrice} allowFontScaling={false}>$19.99</Text>
                  <View style={styles.glowContainer}>
                    <Text style={styles.price} allowFontScaling={false}>$9.99</Text>
                  </View>
                </View>
              </Pressable>

              {/* 6 Months Plan - Right */}
              <Pressable style={({ pressed }) => [styles.yearlyPlan, { flex: 1, marginLeft: 6 }, pressed && styles.pressed]} onPress={() => handlePurchase('sixMonth')} disabled={busy}>
                <Text style={styles.planTitle} allowFontScaling={false}>6 Month</Text>
                <View style={styles.priceContainer}>
                  <Text style={styles.originalPrice} allowFontScaling={false}>$59.94</Text>
                  <View style={styles.glowContainer}>
                    <Text style={styles.price} allowFontScaling={false}>$8.33</Text>
                  </View>
                </View>
              </Pressable>
            </View>
          </View>

          {/* Action Button */}
          <View style={[styles.actionContainer, { alignItems: 'center' }]}>
            <Pressable style={({ pressed }) => [styles.yearlyButton, { width: '92%', maxWidth: 720 }, pressed && styles.pressed]} onPress={() => handlePurchase('monthly')} disabled={busy}>
              <Text style={styles.yearlyButtonText} allowFontScaling={false}>Start Now Feel Calm</Text>
            </Pressable>
          </View>

          {/* Privacy & Terms */}
          <View style={styles.legalContainer}>
            <Pressable style={styles.legalLink} onPress={() => { /* UI only */ }}>
              <Text style={styles.legalText} allowFontScaling={false}>Privacy</Text>
            </Pressable>
            <Text style={styles.legalSeparator} allowFontScaling={false}>|</Text>
            <Pressable style={styles.legalLink} onPress={() => { /* UI only */ }}>
              <Text style={styles.legalText} allowFontScaling={false}>Terms</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
      {busy && (
        <View style={styles.blockingOverlay} pointerEvents="auto">
          <View style={styles.blockingCard}>
            <ActivityIndicator size="large" color="#60A5FA" />
            <Text style={styles.blockingText} allowFontScaling={false}>Processing purchase…</Text>
            <Text style={styles.blockingSubText} allowFontScaling={false}>Please wait until the process completes</Text>
          </View>
        </View>
      )}
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1e293b', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  overlay: { position: 'absolute', width: '100%', height: '100%', backgroundColor: 'rgba(0, 0, 0, 0.15)' },
  safeArea: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 16, paddingTop: 16, justifyContent: 'space-between', zIndex: 100 },
  topButtonsContainer: { position: 'absolute', top: Platform.OS === 'android' ? 5 : 5, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, zIndex: 1000 },
  closeButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0, 0, 0, 0.3)', alignItems: 'center', justifyContent: 'center' },
  restoreButton: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: 'rgba(255, 255, 255, 0.2)' },
  restoreText: { color: 'white', fontSize: 14, fontWeight: '600' },
  header: { alignItems: 'center', marginTop: 40, marginBottom: 20 },
  premiumTitle: { fontSize: 36, fontWeight: '800', color: '#FFFFFF', textAlign: 'center', marginBottom: 8, textShadowColor: 'rgba(0, 0, 0, 0.7)', textShadowOffset: { width: 0, height: 3 }, textShadowRadius: 4 },
  premiumSubtitle: { fontSize: 18, color: '#FFFFFF', textAlign: 'center', textShadowColor: 'rgba(0, 0, 0, 0.6)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 3, fontWeight: '600' },
  benefitsContainer: { marginBottom: 25, paddingHorizontal: 20, marginTop: -30 },
  benefitsGrid: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 5, gap: 12 },
  benefitItem: { alignItems: 'center', backgroundColor: 'rgba(255, 255, 255, 0.2)', borderRadius: 12, padding: 14, width: 80, height: 80, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 6, justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.4)' },
  benefitText: { fontSize: 9, fontWeight: '800', color: '#FFFFFF', marginTop: 4, textAlign: 'center', textShadowColor: 'rgba(0, 0, 0, 0.7)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
  compellingText: { fontSize: 16, fontWeight: '800', color: '#FFFFFF', textAlign: 'center', marginTop: 16, textShadowColor: 'rgba(0, 0, 0, 0.9)', textShadowOffset: { width: 0, height: 3 }, textShadowRadius: 4, lineHeight: 20 },
  pricingContainer: { marginBottom: 20, marginTop: 20, paddingHorizontal: 20, position: 'relative' },
  pricingRow: { flexDirection: 'row', width: '100%', gap: 16, justifyContent: 'space-between', position: 'absolute', left: 20, right: 20, top: 40, zIndex: 10 },
  monthlyPlan: { backgroundColor: 'rgba(96, 165, 250, 0.95)', borderRadius: 16, padding: 16, borderWidth: 3, borderColor: '#60A5FA', shadowColor: '#60A5FA', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.8, shadowRadius: 12, elevation: 8, alignItems: 'center', justifyContent: 'center', flex: 1, minHeight: 110, maxHeight: 110, transform: [{ scale: 1.02 }] },
  yearlyPlan: { backgroundColor: 'rgba(255, 255, 255, 0.85)', borderRadius: 16, padding: 16, borderWidth: 2, borderColor: 'rgba(255, 255, 255, 0.9)', position: 'relative', shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.25, shadowRadius: 6, elevation: 5, alignItems: 'center', justifyContent: 'center', flex: 1, minHeight: 110, maxHeight: 110 },
  popularBadge: { position: 'absolute', top: -8, right: -8, backgroundColor: '#EF4444', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, zIndex: 10 },
  popularText: { fontSize: 9, fontWeight: '700', color: 'white' },
  planHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  planTitle: { fontSize: 16, fontWeight: '900', color: '#FFFFFF', letterSpacing: 0.3, textShadowColor: 'rgba(0, 0, 0, 0.7)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 3, marginBottom: 6, textAlign: 'center' },
  priceContainer: { alignItems: 'center', flexDirection: 'column', gap: 2 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  originalPrice: { fontSize: 12, fontWeight: '500', color: 'rgba(255, 255, 255, 0.6)', textDecorationLine: 'line-through', textShadowColor: 'rgba(0, 0, 0, 0.8)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2, textAlign: 'center' },
  price: { fontSize: 24, fontWeight: '900', color: '#FFFFFF', letterSpacing: 0.5, textShadowColor: 'rgba(0, 0, 0, 0.6)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4, textAlign: 'center', borderBottomWidth: 2, borderBottomColor: 'rgba(255, 255, 255, 0.9)', paddingBottom: 2 },
  glowContainer: { shadowColor: '#60A5FA', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.9, shadowRadius: 12, elevation: 8 },
  period: { fontSize: 12, color: '#FFFFFF', fontWeight: '600', textShadowColor: 'rgba(0, 0, 0, 0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
  planDescription: { fontSize: 12, color: '#FFFFFF', marginBottom: 3, fontWeight: '700', textShadowColor: 'rgba(0, 0, 0, 0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
  savingsText: { fontSize: 11, color: '#10B981', fontWeight: '700', textShadowColor: 'rgba(0, 0, 0, 0.7)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 3 },
  actionContainer: { marginBottom: Platform.OS === 'android' ? 20 : 30, marginTop: 80, paddingHorizontal: 20, position: 'relative' },
  yearlyButton: { backgroundColor: '#10B981', borderRadius: 16, paddingVertical: 18, paddingHorizontal: 40, alignItems: 'center', marginBottom: 8, shadowColor: '#10B981', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.7, shadowRadius: 12, elevation: 8, borderWidth: 2, borderColor: 'rgba(255, 255, 255, 0.3)', position: 'absolute', left: 35, right: 20, top: 0, zIndex: 10 },
  yearlyButtonText: { color: '#FFFFFF', fontSize: 18, fontWeight: '900', letterSpacing: 0.8, textShadowColor: 'rgba(0, 0, 0, 0.7)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 3 },
  legalContainer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingBottom: Platform.OS === 'android' ? 5 : 10 },
  legalLink: { paddingHorizontal: 8 },
  legalText: { fontSize: 12, color: '#FFFFFF', textDecorationLine: 'underline', fontWeight: '600', textShadowColor: 'rgba(0, 0, 0, 0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
  legalSeparator: { fontSize: 12, color: '#FFFFFF', marginHorizontal: 8, fontWeight: '600', textShadowColor: 'rgba(0, 0, 0, 0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
  backgroundLoadingContainer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#1e293b', justifyContent: 'center', alignItems: 'center', zIndex: 999 },
  backgroundLoadingText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600', marginTop: 10, textAlign: 'center' },
  slowConnectionText: { color: '#FFFFFF', fontSize: 14, fontWeight: '400', marginTop: 15, textAlign: 'center', opacity: 0.8, paddingHorizontal: 20, lineHeight: 20 },
  pressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },
  blockingOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', zIndex: 2000 },
  blockingCard: { backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 16, paddingVertical: 18, paddingHorizontal: 22, alignItems: 'center', minWidth: 220, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.25, shadowRadius: 10, elevation: 10 },
  blockingText: { marginTop: 10, fontSize: 16, fontWeight: '800', color: '#1f2937' },
  blockingSubText: { marginTop: 4, fontSize: 13, fontWeight: '600', color: '#64748b' },
});
