import React, { useEffect, useMemo, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Platform, Linking, ActivityIndicator, BackHandler, AppState, Image, ImageBackground } from 'react-native';
import * as Application from 'expo-application';
import { StatusBar } from 'expo-status-bar';

interface VersionConfig {
  minVersion: string;
  latestVersion?: string;
  force?: boolean;
  message?: string;
  storeUrls?: {
    ios?: string;
    android?: string;
  };
}

interface VersionGateProps {
  children: React.ReactNode;
}

// Compare two semver strings (e.g., 3.0.1 < 3.0.2)
export function compareSemver(a: string, b: string): number {
  const parse = (v: string) => v.split('.').map((x) => parseInt(x, 10) || 0);
  const [a1, a2, a3] = parse(a);
  const [b1, b2, b3] = parse(b);
  if (a1 !== b1) return a1 < b1 ? -1 : 1;
  if (a2 !== b2) return a2 < b2 ? -1 : 1;
  if (a3 !== b3) return a3 < b3 ? -1 : 1;
  return 0;
}

// Fetch with timeout to avoid hanging requests
async function fetchWithTimeout(url: string, ms = 6000): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
    return r;
  } finally {
    clearTimeout(t);
  }
}

export default function VersionGate({ children }: VersionGateProps) {
  const [config, setConfig] = useState<VersionConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const currentVersion = useMemo(() => String(Application.nativeApplicationVersion || '0.0.0'), []);

  useEffect(() => {
    let cancelled = false;
    const fetchConfig = async () => {
      try {
        setLoading(true);
        setError(null);
        const ts = Date.now();
        const resp = await fetchWithTimeout(`https://calmpulseapp.com/version.json?ts=${ts}`);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const json = (await resp.json()) as VersionConfig;
        if (!cancelled) setConfig(json);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Failed to load');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchConfig();
    return () => {
      cancelled = true;
    };
  }, []);

  // Refetch when app returns to foreground (e.g., coming back from the store)
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        (async () => {
          try {
            const resp = await fetchWithTimeout(`https://calmpulseapp.com/version.json?ts=${Date.now()}`);
            if (resp.ok) setConfig(await resp.json());
          } catch {}
        })();
      }
    });
    return () => sub.remove();
  }, []);

  const mustBlock = useMemo(() => {
    if (!config) return false;
    const min = config.minVersion || '0.0.0';
    const belowMin = compareSemver(currentVersion, min) < 0;
    return belowMin || !!config.force;
  }, [config, currentVersion]);

  // Prevent Android hardware back when blocking
  useEffect(() => {
    if (!mustBlock) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, [mustBlock]);

  const openStore = () => {
    const iosUrl = config?.storeUrls?.ios || 'itms-apps://itunes.apple.com/app/id6743389519?mt=8';
    const androidUrl = config?.storeUrls?.android || 'market://details?id=com.noam_tzur21.finaltest';
    const url = Platform.OS === 'ios' ? iosUrl : androidUrl;
    Linking.openURL(url).catch(() => {
      // Fallback to https URLs if deep link failed
      const fallback = Platform.OS === 'ios'
        ? 'https://apps.apple.com/app/id6743389519'
        : 'https://play.google.com/store/apps/details?id=com.noam_tzur21.finaltest';
      Linking.openURL(fallback).catch(() => {});
    });
  };

  return (
    <>
      {children}
      <Modal
        animationType="fade"
        visible={!!mustBlock}
        presentationStyle="fullScreen"
        onRequestClose={() => {}}
      >
        <ImageBackground
          source={require('../assets/images/CalmPulse.png')}
          style={styles.bg}
          resizeMode="cover"
        >
          <View style={styles.scrim} />
          <View style={styles.container}>
            <View style={styles.panel}>
            <StatusBar style="light" backgroundColor="transparent" />
            <Image
              source={require('../assets/images/pulse-transperant.png')}
              style={styles.logo}
              resizeMode="contain"
              onError={() => {}}
            />
            <Text style={styles.title}>Update Required</Text>
            {loading ? (
              <ActivityIndicator size="large" color="#93C5FD" />
            ) : (
              <Text style={styles.message}>
                {config?.message || 'A new version is required. Please update to continue using CalmPulse.'}
              </Text>
            )}
            <TouchableOpacity style={styles.button} onPress={openStore} activeOpacity={0.9}>
              <Text style={styles.buttonText}>Update Now</Text>
            </TouchableOpacity>
            <Text style={styles.versionText}>Current: {currentVersion} • Min: {config?.minVersion || '—'}</Text>
            </View>
          </View>
        </ImageBackground>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  bg: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  container: {
    flex: 1,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  panel: {
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 20,
    alignItems: 'center',
    marginHorizontal: 24,
  },
  icon: {
    fontSize: 64,
    marginBottom: 12,
  },
  logo: {
    width: 96,
    height: 96,
    marginBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 10,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    color: '#E5E7EB',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  button: {
    backgroundColor: '#60A5FA',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 28,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  versionText: {
    marginTop: 16,
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
  },
}); 