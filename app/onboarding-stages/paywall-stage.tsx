import React, { useState } from 'react';
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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { OnboardingImages } from '@/constants/Images';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { getOfferings, purchasePackage, restorePurchases, getCustomerInfo, isPremiumFromCustomerInfo, syncRevenueCatUser } from '@/lib/revenueCat';

interface PaywallStageProps {
  onComplete: () => void;
  onBack?: () => void;
  source?: 'pulse-ai' | 'afterinfo';
}

export default function PaywallStage({ onComplete }: PaywallStageProps) {
  const insets = useSafeAreaInsets();
  const [imageLoaded, setImageLoaded] = useState(false);
  const [showSlowConnectionMessage, setShowSlowConnectionMessage] = useState(false);
  const [busy, setBusy] = useState<boolean>(false);
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

  const handlePurchase = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const offerings = await getOfferings();
      const available = offerings?.availablePackages || [];
      const monthly = available.find((p: any) => p?.identifier === '$rc_monthly') || available[0];
      if (!monthly) {
        Alert.alert('Network error', 'Network error. Try again.');
        setBusy(false);
      return;
    }
      const result: any = await purchasePackage(monthly);
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
          <View style={styles.topButtonsContainer}>
            <View style={styles.closeButton}>
              <Pressable onPress={() => { if (busy) return; doRedirect(); }} disabled={busy}>
                <Ionicons name="close" size={24} color="white" />
              </Pressable>
            </View>
            <Pressable style={styles.restoreButton} onPress={handleRestore} disabled={busy}>
              <Text style={styles.restoreText} allowFontScaling={false}>Restore Purchase</Text>
            </Pressable>
          </View>

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.premiumTitle} allowFontScaling={false}>Get Premium</Text>
            <Text style={styles.premiumSubtitle} allowFontScaling={false}>Unlock all premium features</Text>
          </View>

          {/* Features List */}
          <ScrollView
            style={styles.featuresContainer}
            contentContainerStyle={{ paddingBottom: 8 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={[styles.featureItem, { borderColor: 'rgba(96, 165, 250, 0.8)' }]}>
              <View style={styles.featureIcon}><Ionicons name="chatbubble-ellipses" size={24} color="#60A5FA" /></View>
              <View style={styles.featureText}><Text style={styles.featureTitle} allowFontScaling={false}>Pulse AI - Personal AI companion</Text></View>
            </View>

            <View style={[styles.featureItem, { borderColor: 'rgba(239, 68, 68, 0.8)' }]}>
              <View style={styles.featureIcon}><Ionicons name="videocam" size={24} color="#EF4444" /></View>
              <View style={styles.featureText}><Text style={styles.featureTitle} allowFontScaling={false}>Video Creator - Create videos</Text></View>
            </View>

            <View style={[styles.featureItem, { borderColor: 'rgba(16, 185, 129, 0.8)' }]}>
              <View style={styles.featureIcon}><Ionicons name="book" size={24} color="#10B981" /></View>
              <View style={styles.featureText}><Text style={styles.featureTitle} allowFontScaling={false}>Personal Journal - Track mood</Text></View>
            </View>

            <View style={[styles.featureItem, { borderColor: 'rgba(168, 85, 247, 0.8)' }]}>
              <View style={styles.featureIcon}><Ionicons name="shield-checkmark" size={24} color="#A855F7" /></View>
              <View style={styles.featureText}><Text style={styles.featureTitle} allowFontScaling={false}>No Ads - Ad free experience</Text></View>
            </View>
          </ScrollView>

          {/* Pricing Section */}
          <View style={[styles.pricingContainer, { alignItems: 'center' }]}>
                                    {/* Monthly Plan */}
            <Pressable style={({ pressed }) => [styles.monthlyPlan, { width: '92%', maxWidth: 720 }, pressed && styles.pressed]} onPress={handlePurchase} disabled={busy}>
              <View style={styles.popularBadge}><Text style={styles.popularText} allowFontScaling={false}>BEST DEAL</Text></View>
                          <View style={styles.planHeader}>
                <Text style={styles.planTitle} allowFontScaling={false}>Monthly</Text>
                            <View style={styles.priceContainer}>
                              <View style={styles.priceRow}>
                    <Text style={styles.originalPrice} allowFontScaling={false}>$19.99</Text>
                    <Text style={styles.price} allowFontScaling={false}>$9.99</Text>
                              </View>
                  <Text style={styles.period} allowFontScaling={false}>/month</Text>
                            </View>
                          </View>
              <Text style={styles.planDescription} numberOfLines={1} allowFontScaling={false}>Get started now - Join thousands of users</Text>
                          <Text style={styles.savingsText} numberOfLines={1} allowFontScaling={false}>Save 50%</Text>
                        </Pressable>

            {/* 6 Months Plan */}
            <Pressable style={({ pressed }) => [styles.yearlyPlan, { width: '92%', maxWidth: 720 }, pressed && styles.pressed]} onPress={handlePurchase} disabled={busy}>
              <View style={styles.planHeader}>
                <Text style={styles.planTitle} allowFontScaling={false}>6 Months</Text>
                <View style={styles.priceContainer}>
                  <View style={styles.priceRow}>
                    <Text style={styles.originalPrice} allowFontScaling={false}>$119.94</Text>
                    <Text style={styles.price} allowFontScaling={false}>$49.99</Text>
                  </View>
                  <Text style={styles.period} allowFontScaling={false}>/6 months</Text>
                </View>
              </View>
              <Text style={styles.planDescription} numberOfLines={1} allowFontScaling={false}>Best value - Limited time offer</Text>
              <Text style={styles.savingsText} numberOfLines={1} allowFontScaling={false}>Save $9.95</Text>
            </Pressable>
          </View>

          {/* Action Button */}
          <View style={[styles.actionContainer, { alignItems: 'center' }]}>
            <Pressable style={({ pressed }) => [styles.yearlyButton, { width: '92%', maxWidth: 720 }, pressed && styles.pressed]} onPress={handlePurchase} disabled={busy}>
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
  header: { alignItems: 'center', marginTop: 24, marginBottom: 12 },
  premiumTitle: { fontSize: 32, fontWeight: '700', color: '#FFFFFF', textAlign: 'center', marginBottom: 8, textShadowColor: 'rgba(0, 0, 0, 0.5)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 3 },
  premiumSubtitle: { fontSize: 16, color: '#FFFFFF', textAlign: 'center', textShadowColor: 'rgba(0, 0, 0, 0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
  featuresContainer: { marginBottom: Platform.OS === 'android' ? 5 : 12, paddingHorizontal: 12, marginTop: Platform.OS === 'android' ? -10 : -4, flexShrink: 1, maxHeight: 360 },
  featureItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255, 255, 255, 0.8)', borderRadius: 8, padding: 8, marginBottom: 6, borderWidth: 1.5 },
  featureIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255, 255, 255, 0.4)', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  featureText: { flex: 1 },
  featureTitle: { fontSize: 13, fontWeight: '900', color: '#FFFFFF', marginBottom: 2, textShadowColor: 'rgba(0, 0, 0, 0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
  pricingContainer: { marginBottom: Platform.OS === 'android' ? 10 : 20, marginTop: Platform.OS === 'android' ? -20 : 4, minHeight: 180, justifyContent: 'flex-start', gap: Platform.OS === 'android' ? 4 : 8 },
  monthlyPlan: { backgroundColor: 'rgba(96, 165, 250, 0.95)', borderRadius: 14, padding: 16, marginBottom: 8, borderWidth: 2.5, borderColor: '#60A5FA', shadowColor: '#60A5FA', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.6, shadowRadius: 8, elevation: 6 },
  yearlyPlan: { backgroundColor: 'rgba(255, 255, 255, 0.7)', borderRadius: 14, padding: 16, borderWidth: 2, borderColor: 'rgba(255, 255, 255, 0.8)', position: 'relative', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 6, elevation: 4 },
  popularBadge: { alignSelf: 'flex-end', backgroundColor: '#EF4444', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, marginBottom: 8 },
  popularText: { fontSize: 10, fontWeight: '700', color: 'white' },
  planHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  planTitle: { fontSize: 17, fontWeight: '900', color: '#FFFFFF', letterSpacing: 0.3, textShadowColor: 'rgba(0, 0, 0, 0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
  priceContainer: { alignItems: 'flex-end' },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  originalPrice: { fontSize: 14, fontWeight: '400', color: 'rgba(255, 255, 255, 0.9)', textDecorationLine: 'line-through', textShadowColor: 'rgba(0, 0, 0, 0.6)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 2 },
  price: { fontSize: 24, fontWeight: '900', color: '#FFFFFF', letterSpacing: 0.5, textShadowColor: 'rgba(0, 0, 0, 0.4)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
  period: { fontSize: 12, color: '#FFFFFF', fontWeight: '600', textShadowColor: 'rgba(0, 0, 0, 0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
  planDescription: { fontSize: 12, color: '#FFFFFF', marginBottom: 3, fontWeight: '700', textShadowColor: 'rgba(0, 0, 0, 0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
  savingsText: { fontSize: 11, color: '#10B981', fontWeight: '700', textShadowColor: 'rgba(0, 0, 0, 0.7)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 3 },
  actionContainer: { marginBottom: Platform.OS === 'android' ? 0 : 20, marginTop: Platform.OS === 'android' ? -5 : -5 },
  yearlyButton: { backgroundColor: '#3B82F6', borderRadius: 12, paddingVertical: 20, paddingHorizontal: 40, alignItems: 'center', marginBottom: 8, shadowColor: '#3B82F6', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 8, elevation: 6 },
  yearlyButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900', letterSpacing: 0.5, textShadowColor: 'rgba(0, 0, 0, 0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
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
