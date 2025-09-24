import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { BannerAd, BannerAdSize, TestIds } from 'react-native-google-mobile-ads';
import { Platform } from 'react-native';
import { checkPremiumStatus } from '@/lib/premiumUtils';
import { ensureAdsConsentInitialized, getAdRequestOptions } from '@/lib/adsConsent';

interface AdBannerProps {
  style?: ViewStyle;
  size?: string;
}

const BANNER_AD_UNIT_ID = __DEV__
  ? TestIds.BANNER
  : Platform.OS === 'ios'
    ? 'ca-app-pub-9135457753563605/8917498032'
    : 'ca-app-pub-9135457753563605/7680437984';

export default function AdBanner({ style, size }: AdBannerProps) {
  const [shouldShow, setShouldShow] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const isPremium = await checkPremiumStatus(true);
        setShouldShow(!isPremium);
        await ensureAdsConsentInitialized();
        setReady(true);
      } catch {
        // On error, err on the side of not showing ads
        setShouldShow(false);
      }
    })();
  }, []);

  if (!shouldShow || !ready) return null;

  return (
    <View style={[styles.container, style]}>
      <BannerAd
        unitId={BANNER_AD_UNIT_ID}
        size={size || BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        requestOptions={getAdRequestOptions()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
}); 