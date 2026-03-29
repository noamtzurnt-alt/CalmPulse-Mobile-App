import React, { useState, useEffect, useContext } from 'react';
import { StyleSheet, View, Text, Pressable, Image, ActivityIndicator, I18nManager, TouchableOpacity, Alert, ScrollView, Dimensions, Modal, Platform, Animated, ImageStyle } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as VideoThumbnails from 'expo-video-thumbnails';
import * as FileSystem from 'expo-file-system';
import { MediaTypeOptions } from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ChatContext } from './_layout';
import { LayoutContext } from './_layout';
import { useLanguage } from '@/lib/LanguageContext';
import Constants from 'expo-constants';
import { auth } from '@/lib/firebase';
import { loadUserMedia, saveUserMedia, uploadFileToR2, addQuota, getQuota } from '@/lib/mediaApi';
import { purchaseNonSubscriptionProduct, hasNonSubscriptionPurchase } from '@/lib/revenueCat';
import { checkPremiumStatus } from '@/lib/premiumUtils';
import { showInterstitialAd, showRewardedAd } from '@/lib/adUtils';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Loading 'Loading...' with animated dots only, no frame
function LoadingDots({ labelBase }: { labelBase: string }) {
  const [dots, setDots] = React.useState('...');
  React.useEffect(() => {
    const id = setInterval(() => {
      setDots(prev => (prev === '...' ? '.' : prev + '.'));
    }, 700);
    return () => clearInterval(id);
  }, []);
  return (
    <Text style={styles.loadingTitle}>{labelBase}{dots}</Text>
  );
}

// Animated text pulse for status lines (no trailing dots), inside a unified badge
function AnimatedPulseText({ label }: { label: string }) {
  const translateX = React.useRef(new Animated.Value(-20)).current;
  const opacity = React.useRef(new Animated.Value(0.2)).current;
  React.useEffect(() => {
    const loop = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(translateX, { toValue: 0, duration: 900, useNativeDriver: true }),
          Animated.timing(translateX, { toValue: 10, duration: 900, useNativeDriver: true }),
          Animated.timing(translateX, { toValue: -20, duration: 0, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(opacity, { toValue: 1, duration: 900, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.35, duration: 900, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.2, duration: 0, useNativeDriver: true }),
        ])
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [translateX, opacity]);
  return (
    <View style={styles.loadingBadge}>
      <Animated.Text style={[styles.loadingText, { opacity, transform: [{ translateX }] }]}>
        {label}
      </Animated.Text>
    </View>
  );
}

// פונקציה לשמירת סרטונים ב-AsyncStorage ועדכון selectedVideos
export const persistVideos = async (videos: any[], setSelectedVideosFn?: (v: any[]) => void) => {
  if (setSelectedVideosFn) {
    setSelectedVideosFn(videos);
  }
  try {
    await AsyncStorage.setItem('selectedVideos', JSON.stringify(videos));
    console.log('Persisted videos to AsyncStorage:', videos);
  } catch (error) {
    console.error('Error persisting videos to AsyncStorage:', error);
  }
};

export default function CalmVideoScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { openSettings } = React.useContext(LayoutContext);

  const [selectedPhotos, setSelectedPhotos] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [selectedVideos, setSelectedVideos] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [videoThumbnail, setVideoThumbnail] = useState<string | null>(null);
  const [isLoadingThumbnail, setIsLoadingThumbnail] = useState(false);
  const [isAllVideosReady, setIsAllVideosReady] = useState(false);
  const [selectedVideosCount, setSelectedVideosCount] = useState(0);
  const [loadedThumbnailsCount, setLoadedThumbnailsCount] = useState(0);
  const [isLoadingVideos, setIsLoadingVideos] = useState(false);
  const [isUploadingPhotos, setIsUploadingPhotos] = useState(false);
  const { isMuted } = useContext(ChatContext);
  const { t, language } = useLanguage();
  const [isLoadingPhotos, setIsLoadingPhotos] = useState(false);
  const [isLoadingUserData, setIsLoadingUserData] = useState(true);
  const [showLongLoadingMessage, setShowLongLoadingMessage] = useState(false);
  const [showExtraLongLoadingMessage, setShowExtraLongLoadingMessage] = useState(false);
  const [showFinalLoadingMessage, setShowFinalLoadingMessage] = useState(false);
  const [showAfterFinalLoadingMessage, setShowAfterFinalLoadingMessage] = useState(false);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [showFullscreenVideo, setShowFullscreenVideo] = useState(false);
  const [showVideoBack, setShowVideoBack] = useState(false);
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [unlockLoading, setUnlockLoading] = useState(false);
  const [showPhotoAdModal, setShowPhotoAdModal] = useState(false);
  const [allowPhotoPickAfterAd, setAllowPhotoPickAfterAd] = useState(false);
  const [isOpeningPicker, setIsOpeningPicker] = useState(false);
  const [premiumQuick, setPremiumQuick] = useState<boolean | null>(null);
  const [extraVideos, setExtraVideos] = useState<number>(0);
  const hasSyncedRemoteRef = React.useRef(false);
  const suppressBackgroundSyncRef = React.useRef(false);
  const skipFirstVideoThumbGenRef = React.useRef(false);

  // Local ad video players (expo-video)
  const adPlayer = useVideoPlayer(null, (p) => {
    p.loop = false;
    p.muted = true; // preview is always muted and paused
  });
  const adPlayerFull = useVideoPlayer(null, (p) => {
    p.loop = false;
    p.muted = false;
  });

  // Preload preview player with first frame (muted, paused)
  useEffect(() => {
    const assetId = require('../../assets/videos/ads-video-fixed-aspect-h264.mp4');
    (async () => {
      try {
        adPlayer.muted = true;
        adPlayer.loop = false;
        await adPlayer.replaceAsync(assetId);
      } catch {}
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      (async () => {
        try {
          const vh = await AsyncStorage.getItem('videoBackIntent');
          setShowVideoBack(vh === 'true');
        } catch {}
        // Refresh video quota when returning to screen
        try {
          const uid = auth.currentUser?.uid;
          if (uid) {
            const q = await getQuota(uid);
            setExtraVideos(Number(q?.extraVideos || 0));
          }
        } catch {}
      })();
      return () => {};
    }, [])
  );

  useEffect(() => {
    // Hide native header to prevent covering the raised video frame
    try {
      navigation.setOptions({ headerShown: false } as any);
    } catch {}

    if (params.resetVideos === 'true') {
      setSelectedVideos([]);
      setVideoThumbnail(null);
      router.setParams({ resetVideos: 'false' });
    }
    if (params.resetPhotos === 'true') {
      setSelectedPhotos([]);
      router.setParams({ resetPhotos: 'false' });
    }
    if (params.refresh === 'true') {
      loadUserMediaData();
      router.setParams({ 
        refresh: 'false',
        type: undefined
      });
    }
    // Light load on mount (avoid heavy overlay): load from AsyncStorage only
    loadFromAsyncStorage();

    // Removed expo-av audio control on this screen to avoid deprecation warning at app open
  }, [params.resetVideos, params.resetPhotos, params.refresh]);

  useEffect(() => {
    // Premium status stored elsewhere on app start; keep AsyncStorage in sync via global flows
  }, []);

  // Reset media state on user switch and reload per-user storage
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async () => {
      try {
        setSelectedPhotos([]);
        setSelectedVideos([]);
        setVideoThumbnail(null);
        // Clear generic caches to avoid cross-user bleed
        try { await AsyncStorage.removeItem('selectedPhotos'); } catch {}
        try { await AsyncStorage.removeItem('selectedVideos'); } catch {}
      } catch {}
      await loadFromAsyncStorage();
    });
    return () => { try { unsub(); } catch {} };
  }, []);

  // Preload premium flag quickly and pre-request gallery permission to reduce first-open delay
  useEffect(() => {
    (async () => {
      try {
        const p = await AsyncStorage.getItem('isPremium');
        setPremiumQuick(p === 'true');
      } catch {}
      try {
        const perm = await ImagePicker.getMediaLibraryPermissionsAsync();
        if (perm.status !== 'granted' && perm.canAskAgain) {
          await ImagePicker.requestMediaLibraryPermissionsAsync();
        }
      } catch {}
      // Initial quota load
      try {
        const uid = auth.currentUser?.uid;
        if (uid) {
          const q = await getQuota(uid);
          setExtraVideos(Number(q?.extraVideos || 0));
        }
      } catch {}
    })();
  }, []);

  // One-time background sync: upload any items missing remoteKey to R2 for authenticated users
  useEffect(() => {
    (async () => {
      if (hasSyncedRemoteRef.current) return;
      if (suppressBackgroundSyncRef.current) return;
      const user = auth.currentUser;
      if (!user?.uid) return;
      const hasLocalOnlyPhotos = (selectedPhotos || []).some((p: any) => !p?.remoteKey && p?.uri && p.uri.startsWith('file://'));
      const hasLocalOnlyVideos = (selectedVideos || []).some((v: any) => !v?.remoteKey && v?.uri && v.uri.startsWith('file://'));
      if (!hasLocalOnlyPhotos && !hasLocalOnlyVideos) return;
      hasSyncedRemoteRef.current = true;
      try { await AsyncStorage.removeItem('isGuest'); } catch {}
      try { await auth.currentUser?.getIdToken?.(true); } catch {}
      // Photos sync
      if (hasLocalOnlyPhotos) {
        try {
          const newlyAdded = (selectedPhotos as any[]).filter((p: any) => !p?.remoteKey && p?.uri);
          if (newlyAdded.length) await uploadPhotosInBackground(newlyAdded as any);
        } catch {}
      }
      // Videos sync
      if (hasLocalOnlyVideos) {
        try {
          const newlyAddedV = (selectedVideos as any[]).filter((v: any) => !v?.remoteKey && v?.uri);
          if (newlyAddedV.length) await uploadVideosInBackground(newlyAddedV as any);
        } catch {}
      }
      // After background upload helpers run, they will save merged lists to R2 and AsyncStorage
    })();
  }, [selectedPhotos, selectedVideos]);

  const generateThumbnail = async (videoUri: string) => {
    const resolveLocalUri = async (uri: string): Promise<string> => {
      if (uri.startsWith('file://')) return uri;
      try {
        // Try to refresh signed URL via /sign if we have remoteKey on the item
        const current = selectedVideos.find(v => v?.uri === uri || (v as any)?.remoteKey);
        const remoteKey = (current as any)?.remoteKey;
        if (remoteKey) {
          try {
            const mediaUrl = (Constants.expoConfig?.extra as any)?.MEDIA_API_URL;
            const token = await auth.currentUser?.getIdToken?.(true);
            const res = await fetch(`${mediaUrl}/sign?key=${encodeURIComponent(remoteKey)}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
            if (res.ok) {
              const data = await res.json().catch(() => ({}));
              if (data?.url) uri = data.url;
            }
          } catch {}
        }
        let ext = 'mp4';
        try {
          const clean = uri.split('?')[0];
          const name = clean.split('/').pop() || '';
          const maybeExt = name.split('.').pop();
          if (maybeExt && maybeExt.length <= 5) ext = maybeExt.toLowerCase();
          if (ext === 'mov' || ext === 'quicktime') ext = 'mov';
        } catch {}
        const dest = `${FileSystem.cacheDirectory}vid_${Date.now()}.${ext}`;
        const dl = await FileSystem.downloadAsync(uri, dest);
        return dl?.uri || uri;
      } catch {
        return uri;
      }
    };

    const attempt = async (tries: number, targetUri: string, at: number[]): Promise<string | null> => {
      try {
        const { uri } = await VideoThumbnails.getThumbnailAsync(targetUri, { time: at[0], quality: 0.6 });
        return uri;
      } catch (e) {
        if (tries > 0) {
          await new Promise(r => setTimeout(r, 300));
          const nextTimes = at.length > 1 ? at.slice(1) : [400, 1000, 1500];
          return attempt(tries - 1, targetUri, nextTimes);
        }
        // נסה קצה שני אם אפשר
        if (at[0] !== 0) {
          try {
            const { uri } = await VideoThumbnails.getThumbnailAsync(targetUri, { time: 0, quality: 0.5 });
            return uri;
          } catch {}
        }
        console.error('Error generating thumbnail:', e);
        return null;
      }
    };

    try {
      setIsLoadingThumbnail(true);
      const local = await resolveLocalUri(videoUri);
      const uri = await attempt(2, local, [200, 800, 1200]);
      if (uri) setVideoThumbnail(uri);
      setLoadedThumbnailsCount(prev => {
        const newCount = prev + 1;
        if (newCount >= selectedVideosCount) setIsAllVideosReady(true);
        return newCount;
      });
    } finally {
      setIsLoadingThumbnail(false);
    }
  };

  const generateThumbnails = async (videos: ImagePicker.ImagePickerAsset[]) => {
    setIsLoadingThumbnail(true);
    setIsAllVideosReady(false);
    setLoadedThumbnailsCount(0);
    
    try {
      for (const video of videos) {
        await generateThumbnail(video.uri);
        setLoadedThumbnailsCount(prev => prev + 1);
      }
      setIsAllVideosReady(true);
    } catch (e) {
      console.warn(e);
    } finally {
      setIsLoadingThumbnail(false);
    }
  };

  // Generate thumbnails in background with limited concurrency; start from index 1
  const generateThumbnailsLimited = async (
    videos: ImagePicker.ImagePickerAsset[],
    concurrency: number = 2,
    startIndex: number = 1
  ) => {
    if (!videos || videos.length <= startIndex) return;
    setIsAllVideosReady(false);
    setIsLoadingThumbnail(true);
    const queue = videos.slice(startIndex);
    let idx = 0;
    const runNext = async (): Promise<void> => {
      const current = queue[idx++];
      if (!current) return;
      try {
        await generateThumbnail(current.uri);
        setLoadedThumbnailsCount(prev => prev + 1);
      } catch {}
      if (idx < queue.length) {
        return runNext();
      }
    };
    const workers = Array.from(
      { length: Math.min(concurrency, queue.length) },
      () => runNext()
    );
    await Promise.all(workers);
    setIsAllVideosReady(true);
    setIsLoadingThumbnail(false);
  };

  // Upload selected photos in background with limited concurrency and batch save
  const uploadPhotosInBackground = async (newlyAdded: ImagePicker.ImagePickerAsset[]) => {
    try {
      const user = auth.currentUser;
      if (!(user?.uid)) return;
      // Authenticated user should not be treated as guest; clear flag and prefetch token
      try { await AsyncStorage.removeItem('isGuest'); } catch {}
      try { await auth.currentUser?.getIdToken?.(true); } catch {}
      const concurrency = 2;
      const queue = [...newlyAdded];
      const uploadedPairs: { localUri: string; remote: ImagePicker.ImagePickerAsset }[] = [];
      let active = 0;
      await new Promise<void>((resolve) => {
        const runNext = () => {
          if (queue.length === 0 && active === 0) { resolve(); return; }
          while (active < concurrency && queue.length > 0) {
            const asset = queue.shift()!;
            active++;
            (async () => {
              try {
                const up = await uploadFileToR2({ uid: user.uid, type: 'photos', fileUri: asset.uri, filename: asset.fileName || undefined, mime: (asset as any)?.mimeType });
                if (up) uploadedPairs.push({ localUri: asset.uri, remote: { ...asset, uri: up.url, remoteKey: up.key } as any });
              } catch {}
              active--;
              runNext();
            })();
          }
        };
        runNext();
      });
      if (uploadedPairs.length > 0) {
        // Replace local URIs with remote URLs in the state and persist once
        setSelectedPhotos(prev => {
          const replaced = prev.map(p => {
            const found = uploadedPairs.find(x => x.localUri === p.uri);
            return found ? found.remote : p;
          });
          (async () => {
            try {
              await AsyncStorage.setItem('selectedPhotos', JSON.stringify(replaced));
              try { if (user?.uid) await AsyncStorage.setItem(`selectedPhotos_${user.uid}`, JSON.stringify(replaced)); } catch {}
              await saveUserMedia(user.uid, 'photos', replaced);
            } catch {}
          })();
          return replaced;
        });
      }
    } catch {}
  };

  // Upload selected videos in background with limited concurrency and batch save
  const uploadVideosInBackground = async (newlyAdded: ImagePicker.ImagePickerAsset[]) => {
    try {
      const user = auth.currentUser;
      if (!(user?.uid)) return;
      // Authenticated user should not be treated as guest; clear flag and prefetch token
      try { await AsyncStorage.removeItem('isGuest'); } catch {}
      try { await auth.currentUser?.getIdToken?.(true); } catch {}
      const concurrency = 2;
      const queue = [...newlyAdded];
      const uploadedPairs: { localUri: string; remote: ImagePicker.ImagePickerAsset }[] = [];
      let active = 0;
      await new Promise<void>((resolve) => {
        const runNext = () => {
          if (queue.length === 0 && active === 0) { resolve(); return; }
          while (active < concurrency && queue.length > 0) {
            const asset = queue.shift()!;
            active++;
            (async () => {
              try {
                const up = await uploadFileToR2({ uid: user.uid, type: 'videos', fileUri: asset.uri, filename: asset.fileName || undefined, mime: (asset as any)?.mimeType || 'video/mp4' });
                if (up) uploadedPairs.push({ localUri: asset.uri, remote: { ...asset, uri: up.url, remoteKey: up.key } as any });
              } catch {}
              active--;
              runNext();
            })();
          }
        };
        runNext();
      });
      if (uploadedPairs.length > 0) {
        setSelectedVideos(prev => {
          const replaced = prev.map(p => {
            const found = uploadedPairs.find(x => x.localUri === p.uri);
            return found ? found.remote : p;
          });
          (async () => {
            try {
              await AsyncStorage.setItem('selectedVideos', JSON.stringify(replaced));
              try { if (user?.uid) await AsyncStorage.setItem(`selectedVideos_${user.uid}`, JSON.stringify(replaced)); } catch {}
              await saveUserMedia(user.uid, 'videos', replaced);
              // Persist remoteKey->thumb mapping
              try {
                const key = `videoThumbs_${user.uid}`;
                const raw = await AsyncStorage.getItem(key);
                const map = raw ? JSON.parse(raw) : {};
                for (const pair of uploadedPairs) {
                  const rk = (pair.remote as any)?.remoteKey;
                  const thumb = (pair.remote as any)?.thumb;
                  if (rk && thumb) map[rk] = thumb;
                }
                await AsyncStorage.setItem(key, JSON.stringify(map));
              } catch {}
            } catch {}
          })();
          return replaced;
        });
      }
    } catch {}
  };

  const launchImagePicker = async () => {
    let isPremiumUser: boolean | null = premiumQuick;
    if (isPremiumUser == null) {
      try { const v = await AsyncStorage.getItem('isPremium'); isPremiumUser = (v === 'true'); } catch {}
    }
    const isPremium = !!isPremiumUser;
    const currentCount = selectedPhotos.length;
    const maxPhotos = isPremium ? 10000 : 40;
    const remainingSlots = Math.max(0, maxPhotos - currentCount);
    if (!isPremium && remainingSlots <= 0) {
      alert('You reached the photo limit. Upgrade to Premium for unlimited photos.');
      try {
        const untilStr = await AsyncStorage.getItem('rc_suppress_until');
        const until = untilStr ? Number(untilStr) : 0;
        const now = Date.now();
        const local = await AsyncStorage.getItem('hasPremium');
        if (!(until && now < until) && local !== 'true') {
          try { await AsyncStorage.setItem('rc_suppress', 'true'); } catch {}
      router.push({ pathname: '/onboarding-stages/paywall-stage', params: { source: 'premium', from: 'CalmVideo' } });
      return;
        }
      } catch {
        try { await AsyncStorage.setItem('rc_suppress', 'true'); } catch {}
        router.push({ pathname: '/onboarding-stages/paywall-stage', params: { source: 'premium', from: 'CalmVideo' } });
        return;
      }
    }
    // Suppress RevenueCat checks during picker flow
    try { await AsyncStorage.setItem('rc_suppress', 'true'); } catch {}
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      allowsMultipleSelection: true,
      selectionLimit: Math.min(10, remainingSlots || 10),
      orderedSelection: true,
      quality: 1,
    });
    if (result.canceled || !result.assets || result.assets.length === 0) {
      try { await AsyncStorage.removeItem('rc_suppress'); } catch {}
      return;
    }
    // Start overlay immediately for photos upload
    setIsUploadingPhotos(true);
    // Prevent the background sync from racing this flow (first add duplication)
    suppressBackgroundSyncRef.current = true;
    // Yield a frame so the overlay renders before heavy work
    await new Promise(r => setTimeout(r, 0));
    // proceed with existing photo merge/upload logic (duplicated minimal path)
    console.log('Images selected:', result.assets);
    const totalPhotos = selectedPhotos.length + result.assets.length;
    // reuse maxPhotos from above (40 for non-premium)
    if (totalPhotos > maxPhotos) {
      alert('You reached the photo limit.');
      const remainingSlots = Math.max(0, maxPhotos - selectedPhotos.length);
      const slice = result.assets.slice(0, remainingSlots);
      // Optimistic preview: append local picks now
      const optimistic = dedupMediaList([...(selectedPhotos || []), ...slice]);
      setSelectedPhotos(optimistic);
      try {
        await AsyncStorage.setItem('selectedPhotos', JSON.stringify(optimistic));
        try { if (auth.currentUser?.uid) await AsyncStorage.setItem(`selectedPhotos_${auth.currentUser.uid}`, JSON.stringify(optimistic)); } catch {}
      } catch {}
      // Upload and persist only the limited slice; do not pre-append
      try {
        await uploadAndSavePhotosNow(slice);
      } finally {
        setIsUploadingPhotos(false);
        setAllowPhotoPickAfterAd(false);
        try { await AsyncStorage.removeItem('rc_suppress'); } catch {}
        suppressBackgroundSyncRef.current = false;
      }
      return;
    }
    // within limit
    // Optimistic preview: append local picks now
    const optimistic = dedupMediaList([...(selectedPhotos || []), ...result.assets]);
    setSelectedPhotos(optimistic);
    try {
      await AsyncStorage.setItem('selectedPhotos', JSON.stringify(optimistic));
      try { if (auth.currentUser?.uid) await AsyncStorage.setItem(`selectedPhotos_${auth.currentUser.uid}`, JSON.stringify(optimistic)); } catch {}
    } catch {}
    // Upload and then replace local items with remote
    try {
      await uploadAndSavePhotosNow(result.assets);
    } finally {
      setIsUploadingPhotos(false);
      setAllowPhotoPickAfterAd(false);
      try { await AsyncStorage.removeItem('rc_suppress'); } catch {}
      suppressBackgroundSyncRef.current = false;
    }
  };

  const pickMedia = async (type: 'images' | 'videos') => {
    console.log('pickMedia called with type:', type);
    const isImages = type === 'images';
    // Photos gating: free up to 20; then require rewarded ad to unlock +10 (now up to 40 unless premium)
    if (isImages) {
      const current = selectedPhotos.length;
      const quick = premiumQuick ?? ((await AsyncStorage.getItem('isPremium')) === 'true');
      if (!quick) {
        if (current >= 40) {
          alert('You reached the photo limit. Upgrade to Premium for unlimited photos.');
          try {
            const untilStr = await AsyncStorage.getItem('rc_suppress_until');
            const until = untilStr ? Number(untilStr) : 0;
            const now = Date.now();
            const local = await AsyncStorage.getItem('hasPremium');
            if (!(until && now < until) && local !== 'true') {
              try { await AsyncStorage.setItem('rc_suppress', 'true'); } catch {}
          router.push({ pathname: '/onboarding-stages/paywall-stage', params: { source: 'premium', from: 'CalmVideo' } });
          return;
            }
          } catch {
            try { await AsyncStorage.setItem('rc_suppress', 'true'); } catch {}
            router.push({ pathname: '/onboarding-stages/paywall-stage', params: { source: 'premium', from: 'CalmVideo' } });
            return;
          }
        }
        if (current >= 20) {
          setShowPhotoAdModal(true);
          return;
        }
      }
      // No gating needed → open picker
      await launchImagePicker();
      return;
    }
    if (type === 'videos') {
      const maxVideos = 10 + (Number(extraVideos) || 0);
      if (selectedVideos.length >= maxVideos) {
        if ((Number(extraVideos) || 0) < 15) {
          setShowUnlockModal(true);
        } else {
          alert('You reached your current video limit.');
        }
        return;
      }
    }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      console.log('Media library permission not granted');
      alert('CalmPulse needs photo library access to help you save and organize your calming moments. Please grant permission in your device settings to continue.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: isImages ? ['images'] : ['videos'],
      allowsEditing: false,
      allowsMultipleSelection: isImages,
      selectionLimit: isImages ? 10 : 1,
      orderedSelection: true,
      quality: 1,
    });
    console.log('ImagePicker result:', result);
    if (result.canceled || !result.assets || result.assets.length === 0) {
      // Allow user to cancel without forcing selection
      return;
    }
    if (!result.canceled) {
      if (isImages) {
        console.log('Images selected:', result.assets);
        const totalPhotos = selectedPhotos.length + result.assets.length;
        let isPremiumUserNow: boolean | null = premiumQuick;
        if (isPremiumUserNow == null) {
          try { isPremiumUserNow = (await AsyncStorage.getItem('isPremium')) === 'true'; } catch { isPremiumUserNow = false; }
        }
        const maxPhotos = isPremiumUserNow ? 10000 : 30;
        if (totalPhotos > maxPhotos) {
          alert('You reached the photo limit.');
          const remainingSlots = Math.max(0, maxPhotos - selectedPhotos.length);
          const newPhotos = [...selectedPhotos, ...result.assets.slice(0, remainingSlots)];
          const dedup = dedupMediaList(newPhotos);
          setSelectedPhotos(dedup);
          try {
            await AsyncStorage.setItem('selectedPhotos', JSON.stringify(dedup));
            try { if (auth.currentUser?.uid) await AsyncStorage.setItem(`selectedPhotos_${auth.currentUser.uid}`, JSON.stringify(dedup)); } catch {}
            console.log(' Saved', dedup.length, 'photos to AsyncStorage');
          } catch (error) {
            console.error('Error saving photos to AsyncStorage:', error);
          }
          
          // Save to Firebase if user is authenticated and not guest
          const user = auth.currentUser;
          console.log('🔍 Saving photos - User status:', {
            hasUser: !!user,
            userUid: user?.uid,
            isAnonymous: user?.isAnonymous
          });
          
          if (user?.uid) {
            try { await AsyncStorage.removeItem('isGuest'); } catch {}
            try { await auth.currentUser?.getIdToken?.(true); } catch {}
            try {
              // Upload only the newly added slice (limit applied)
              setIsUploadingPhotos(true);
              try { await AsyncStorage.setItem('rc_suppress', 'true'); } catch {}
              const uploaded = await Promise.all(result.assets.slice(0, remainingSlots).map(async (asset) => {
                const up = await uploadFileToR2({ uid: user.uid, type: 'photos', fileUri: asset.uri, filename: asset.fileName || undefined, mime: (asset as any)?.mimeType });
                if (up) return { ...asset, uri: up.url, remoteKey: up.key };
                return asset;
              }));
              const localToRemote = new Map<string, any>();
              for (const it of uploaded) {
                if (it?.uri) localToRemote.set((result.assets.find(a => a.uri === it.uri) ? (result.assets.find(a => a.uri === it.uri) as any).uri : '') || '', it);
              }
              let nextPhotos: any[] = [];
              setSelectedPhotos(prev => {
                nextPhotos = prev.map(p => {
                  const repl = (uploaded.find(u => u.assetId === (p as any)?.assetId) || uploaded.find(u => (u as any)?.uri !== p.uri && (p.uri || '').startsWith('file://') && (u as any)?.remoteKey)) as any;
                  const byUri = uploaded.find(u => (p as any)?.uri && (u as any)?.localUri === (p as any)?.uri);
                  const mapped = uploaded.find(u => (u as any)?.uri && (p as any)?.uri && (p as any)?.uri === (u as any)?.localUri);
                  const mapByLocal = uploaded.find(u => (p as any)?.uri && (u as any)?.uri && (u as any)?.uri === (p as any)?.uri);
                  return (repl as any)?.remote || (mapped as any) || (byUri as any) || (mapByLocal as any) || p;
                });
                return nextPhotos;
              });
              await AsyncStorage.setItem('selectedPhotos', JSON.stringify(nextPhotos));
              try { if (user?.uid) await AsyncStorage.setItem(`selectedPhotos_${user.uid}`, JSON.stringify(nextPhotos)); } catch {}
              const ok = await saveUserMedia(user.uid, 'photos', nextPhotos);
              console.log('🔥 Saved', nextPhotos.length, 'photos to R2 list for user:', user.uid, 'ok=', ok);
              setIsUploadingPhotos(false);
              try { await AsyncStorage.removeItem('rc_suppress'); } catch {}
            } catch (r2Error) {
              console.error('Error uploading/saving photos to R2:', r2Error);
              setIsUploadingPhotos(false);
              try { await AsyncStorage.removeItem('rc_suppress'); } catch {}
            }
          } else {
            console.log('💾 Skipping Firebase save - user is guest or not authenticated');
          }
        } else {
          const newPhotos = [...selectedPhotos, ...result.assets];
          const dedup = dedupMediaList(newPhotos);
          setSelectedPhotos(dedup);
          try {
            await AsyncStorage.setItem('selectedPhotos', JSON.stringify(dedup));
            try { if (auth.currentUser?.uid) await AsyncStorage.setItem(`selectedPhotos_${auth.currentUser.uid}`, JSON.stringify(dedup)); } catch {}
            console.log('💾 Saved', dedup.length, 'photos to AsyncStorage');
          } catch (error) {
            console.error('Error saving photos to AsyncStorage:', error);
          }
          
          // Save to Firebase if user is authenticated and not guest
          const user = auth.currentUser;
          console.log('🔍 Saving photos - User status:', {
            hasUser: !!user,
            userUid: user?.uid,
            isAnonymous: user?.isAnonymous
          });
          
          if (user?.uid) {
            try { await AsyncStorage.removeItem('isGuest'); } catch {}
            try { await auth.currentUser?.getIdToken?.(true); } catch {}
            try {
              setIsUploadingPhotos(true);
              try { await AsyncStorage.setItem('rc_suppress', 'true'); } catch {}
              const appended = await Promise.all(result.assets.map(async (asset) => {
                const up = await uploadFileToR2({ uid: user.uid, type: 'photos', fileUri: asset.uri, filename: asset.fileName || undefined, mime: (asset as any)?.mimeType });
                if (up) return { ...asset, uri: up.url, remoteKey: up.key };
                return asset;
              }));
              let nextPhotos2: any[] = [];
              setSelectedPhotos(prev => {
                nextPhotos2 = prev.map(p => {
                  const repl = appended.find(u => (u as any)?.assetId && (u as any)?.assetId === (p as any)?.assetId);
                  const byLocalUri = appended.find(u => (u as any)?.uri && (p as any)?.uri && (p as any)?.uri === (u as any)?.localUri);
                  return (repl as any)?.remote || (byLocalUri as any) || repl || p;
                });
                return nextPhotos2;
              });
              await AsyncStorage.setItem('selectedPhotos', JSON.stringify(nextPhotos2));
              try { if (user?.uid) await AsyncStorage.setItem(`selectedPhotos_${user.uid}`, JSON.stringify(nextPhotos2)); } catch {}
              const ok = await saveUserMedia(user.uid, 'photos', nextPhotos2);
              console.log('🔥 Saved', nextPhotos2.length, 'photos to R2 list for user:', user.uid, 'ok=', ok);
              setIsUploadingPhotos(false);
              try { await AsyncStorage.removeItem('rc_suppress'); } catch {}
            } catch (r2Error) {
              console.error('Error uploading/saving photos to R2:', r2Error);
              setIsUploadingPhotos(false);
              try { await AsyncStorage.removeItem('rc_suppress'); } catch {}
            }
          } else {
            console.log('💾 Skipping Firebase save - user is guest or not authenticated');
          }
        }
      } else {
        console.log('Videos selected:', result.assets);
        const pickedVideos = result.assets;
        const maxVideos = 10 + (Number(extraVideos) || 0);
        if (selectedVideos.length >= maxVideos || (selectedVideos.length + pickedVideos.length > maxVideos)) {
          setIsLoadingVideos(false);
          setIsLoadingThumbnail(false);
          setShowUnlockModal(true);
          return;
        }
        console.log('Picked videos:', pickedVideos);
        if (pickedVideos.length > 0) {
          setIsLoadingVideos(true);
          setIsLoadingThumbnail(true);
          setSelectedVideosCount(pickedVideos.length);
          setLoadedThumbnailsCount(0);
          setIsAllVideosReady(false);
          // Prevent race with background sync on first add
          suppressBackgroundSyncRef.current = true;
          try {
            // Yield one frame so the overlay renders immediately
            await new Promise(resolve => setTimeout(resolve, 0));
            // Generate local thumbnails for newly picked videos
            const withThumbs = await Promise.all(
              pickedVideos.map(async (asset: any) => {
                const thumb = asset?.uri ? (await createLocalVideoThumbnail(asset.uri)) : null;
                return thumb ? { ...asset, thumb } : asset;
              })
            );

            const newVideos = [...selectedVideos, ...withThumbs];
            // Dedup immediate list by assetId/uri to avoid visual duplicates pre-upload
            const indexById = new Map<string, number>();
            const dedupImmediate: any[] = [];
            const makeId = (it: any): string | null => {
              if (typeof it?.assetId === 'string' && it.assetId) return `aid:${it.assetId}`;
              if (typeof it?.uri === 'string' && it.uri) return `u:${it.uri}`;
              return null;
            };
            for (const it of newVideos) {
              const id = makeId(it);
              if (!id) { dedupImmediate.push(it); continue; }
              if (indexById.has(id)) continue;
              indexById.set(id, dedupImmediate.length);
              dedupImmediate.push(it);
            }
            setSelectedVideos(dedupImmediate);
            try {
              await AsyncStorage.setItem('selectedVideos', JSON.stringify(dedupImmediate));
              try { if (auth.currentUser?.uid) await AsyncStorage.setItem(`selectedVideos_${auth.currentUser.uid}`, JSON.stringify(dedupImmediate)); } catch {}
              console.log(' Saved', dedupImmediate.length, 'videos to AsyncStorage');
            } catch (error) {
              console.error('Error saving videos to AsyncStorage:', error);
            }
            // Immediate upload-and-save to R2 before proceeding
            await uploadAndSaveVideosNow(withThumbs as any);
            
            // Prefer stored thumb for preview; if missing, fall back to generator
            const first = dedupImmediate[0] as any;
            if (first?.thumb) {
              setVideoThumbnail(first.thumb);
            }

            // Block UI with overlay until thumbnails are generated (start from index 0)
            await generateThumbnailsLimited(dedupImmediate as any, 2, 0);
            console.log('Thumbnails generation completed for:', withThumbs.length, 'videos');
          } finally {
            setIsLoadingThumbnail(false);
            setIsLoadingVideos(false);
            try { await AsyncStorage.removeItem('rc_suppress'); } catch {}
            suppressBackgroundSyncRef.current = false;
          }
        } else {
          console.log('No valid videos to save');
      }
    }
    } else {
    setIsLoadingVideos(false);
      console.log('Media picker canceled');
    }
  };

  const [isStarting, setIsStarting] = useState(false);

  const handleStart = async () => {
    if (isStarting) return;
    if (!(selectedPhotos.length > 0 || selectedVideos.length > 0)) return;
    setIsStarting(true);
    try {
      // Show interstitial ad immediately only for non-premium users
      try {
        let isPremiumUser: boolean | null = premiumQuick;
        if (isPremiumUser == null) {
          try { const v = await AsyncStorage.getItem('isPremium'); isPremiumUser = (v === 'true'); } catch {}
        }
        if (isPremiumUser == null) {
          try { isPremiumUser = await checkPremiumStatus(true); } catch {}
        }
        if (!isPremiumUser) {
          try { await showInterstitialAd(); } catch {}
        }
      } catch {}
      router.push({
        pathname: '/(games)/videos',
        params: { 
          photos: JSON.stringify(selectedPhotos || []),
          videos: JSON.stringify(selectedVideos || []),
          shuffle: 'false'
        }
      });
    } catch (e) {
      setIsStarting(false);
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });

    if (!result.canceled) {
      // המשך הטיפול בתמונה שנבחרה
    }
  };

  const handleVideoPreviewPress = async () => {
    if (selectedVideos.length > 0) {
      const dedup = dedupMediaList(selectedVideos);
      router.push({
        pathname: '/(games)/media-preview',
        params: { type: 'videos', items: JSON.stringify(dedup) }
      });
    }
  };

  const loadUserMediaData = async () => {
    try {
      setIsLoadingUserData(true);
      console.log('🔄 Loading user media data...');
      
      // Check if user is guest
      const isGuest = await AsyncStorage.getItem('isGuest');
      const user = auth.currentUser;
      
      console.log('🔍 User status:', {
        isGuest,
        hasUser: !!user,
        userEmail: user?.email,
        userUid: user?.uid,
        isAnonymous: user?.isAnonymous
      });
      
      if (isGuest === 'true') {
        console.log('👤 User is guest, loading from AsyncStorage only...');
        await loadFromAsyncStorage();
      } else if (user?.email) {
        console.log('👤 User is authenticated, loading from Firebase...');
        try {
          console.log('📄 Loading media from R2 for user:', user.uid);
          const [photosR2, videosR2] = await Promise.all([
            loadUserMedia(user.uid, 'photos'),
            loadUserMedia(user.uid, 'videos')
          ]);
          // Merge video thumbs mapping
          let mergedVideos = Array.isArray(videosR2) ? videosR2 : [];
          try {
            const mapRaw = await AsyncStorage.getItem(`videoThumbs_${user.uid}`);
            const thumbMap = mapRaw ? JSON.parse(mapRaw) : {};
            mergedVideos = mergedVideos.map((v: any) => (v?.remoteKey && thumbMap[v.remoteKey] && !v.thumb) ? { ...v, thumb: thumbMap[v.remoteKey] } : v);
          } catch {}
          if (Array.isArray(photosR2) && photosR2.length > 0) {
            setSelectedPhotos(photosR2);
            try { await AsyncStorage.setItem(`selectedPhotos_${user.uid}`, JSON.stringify(photosR2)); } catch {}
            console.log('📸 Loaded', photosR2.length, 'photos from R2');
          } else {
            const storedPhotos = await AsyncStorage.getItem(`selectedPhotos_${user.uid}`);
            if (storedPhotos) {
              const photos = JSON.parse(storedPhotos);
              const dedupP = dedupMediaList(photos);
              setSelectedPhotos(dedupP);
              console.log('📸 Loaded', dedupP.length, 'photos from AsyncStorage');
            }
          }
          if (Array.isArray(mergedVideos) && mergedVideos.length > 0) {
            setSelectedVideos(mergedVideos);
            try { await AsyncStorage.setItem(`selectedVideos_${user.uid}`, JSON.stringify(mergedVideos)); } catch {}
            console.log('🎥 Loaded', mergedVideos.length, 'videos from R2');
          } else {
            const storedVideos = await AsyncStorage.getItem(`selectedVideos_${user.uid}`);
            if (storedVideos) {
              const videos = JSON.parse(storedVideos);
              const dedupV = dedupMediaList(videos);
              setSelectedVideos(dedupV);
              console.log('🎥 Loaded', dedupV.length, 'videos from AsyncStorage');
            }
          }
        } catch (r2Err) {
          console.error('Error loading from R2:', r2Err);
          await loadFromAsyncStorage();
        }
      } else {
        console.log('👤 User is not authenticated, loading from AsyncStorage only...');
        // Load from AsyncStorage for guest users
        await loadFromAsyncStorage();
      }
      
      // Final check: if no data was loaded, try AsyncStorage one more time
      if (selectedPhotos.length === 0 && selectedVideos.length === 0) {
        console.log('🔄 No data loaded, trying AsyncStorage one more time...');
        await loadFromAsyncStorage();
      }
      
      // Additional check: if we're authenticated but no Firebase data, load from AsyncStorage
      if (user?.uid && selectedPhotos.length === 0 && selectedVideos.length === 0) {
        console.log('🔄 Authenticated user but no Firebase data, loading from AsyncStorage...');
        await loadFromAsyncStorage();
      }
      
      // Log final state
      console.log('📊 Final data state:', {
        photosCount: selectedPhotos.length,
        videosCount: selectedVideos.length,
        isGuest,
        hasUser: !!user,
        userUid: user?.uid
      });
      
      setIsLoadingUserData(false);
    } catch (error) {
      console.error('Error loading user media data:', error);
      setIsLoadingUserData(false);
    }
  };

  const loadFromAsyncStorage = async () => {
    try {
      const u = auth.currentUser;
      let storedVideos: string | null = null;
      if (u?.uid) {
        storedVideos = await AsyncStorage.getItem(`selectedVideos_${u.uid}`);
      } else {
        storedVideos = await AsyncStorage.getItem('selectedVideos');
      }
      if (storedVideos) {
        const videos = JSON.parse(storedVideos);
        const dedupV = dedupMediaList(videos);
        setSelectedVideos(dedupV);
        console.log('🎥 Loaded', dedupV.length, 'videos from AsyncStorage');
      } else {
        console.log('🎥 No videos found in AsyncStorage');
        // Clear generic cache to avoid cross-user bleed
        try { await AsyncStorage.removeItem('selectedVideos'); } catch {}
      }
    } catch (error) {
      console.error('Error loading videos from AsyncStorage:', error);
    }

    try {
      const u = auth.currentUser;
      let storedPhotos: string | null = null;
      if (u?.uid) {
        storedPhotos = await AsyncStorage.getItem(`selectedPhotos_${u.uid}`);
      } else {
        storedPhotos = await AsyncStorage.getItem('selectedPhotos');
      }
      if (storedPhotos) {
        const photos = JSON.parse(storedPhotos);
        const dedupP = dedupMediaList(photos);
        setSelectedPhotos(dedupP);
        console.log('📸 Loaded', dedupP.length, 'photos from AsyncStorage');
      } else {
        console.log('📸 No photos found in AsyncStorage');
        // Clear generic cache to avoid cross-user bleed
        try { await AsyncStorage.removeItem('selectedPhotos'); } catch {}
      }
    } catch (error) {
      console.error('Error loading photos from AsyncStorage:', error);
    }
  };

  const pickPhotos = async () => {
    try {
      setIsLoadingPhotos(true);
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.7,
        selectionLimit: 10,
      });

      if (!result.canceled) {
        setSelectedPhotos(result.assets);
      }
    } catch (error) {
      console.error('Error picking photos:', error);
    } finally {
      setIsLoadingPhotos(false);
    }
  };

  const handleChooseVideos = async () => {
    const quick = premiumQuick ?? ((await AsyncStorage.getItem('isPremium')) === 'true');
    console.log('Premium (quick) status in CalmVideo:', quick);
    if (!quick) {
      router.push({ pathname: '/onboarding-stages/paywall-stage', params: { source: 'premium', from: 'CalmVideo' } });
      return;
    }
    await pickMedia('videos');
  };


  // Removed loadSelectedSong; audio is handled in music screen only

  // Removed audio play/stop on this screen
  const handleChooseMusic = async () => {
    try {
      router.push('/musicnew');
    } catch (error) {
      console.error('Error navigating to music screen:', error);
    }
  };

  useEffect(() => {
    let t1: NodeJS.Timeout;
    let t2: NodeJS.Timeout;
    let t3: NodeJS.Timeout;
    if (isLoadingVideos) {
      // After 6s show first message
      t1 = setTimeout(() => {
        setShowLongLoadingMessage(true);
      }, 6000);
      // After 20s hide first and show second
      t2 = setTimeout(() => {
        setShowLongLoadingMessage(false);
        setShowExtraLongLoadingMessage(true);
      }, 20000);
      // After 35s hide second and show third
      t3 = setTimeout(() => {
        setShowExtraLongLoadingMessage(false);
        setShowFinalLoadingMessage(true);
      }, 35000);
    } else {
      setShowLongLoadingMessage(false);
      setShowExtraLongLoadingMessage(false);
      setShowFinalLoadingMessage(false);
      setShowAfterFinalLoadingMessage(false);
    }
    return () => {
      if (t1) clearTimeout(t1);
      if (t2) clearTimeout(t2);
      if (t3) clearTimeout(t3);
    };
  }, [isLoadingVideos]);

  // טעינה מ-AsyncStorage ב-useFocusEffect בכל חזרה למסך
  useFocusEffect(
    React.useCallback(() => {
      console.log('🔄 Screen focused');
      setIsStarting(false);
      setIsUploadingPhotos(false);
      setIsLoadingThumbnail(false);
      setIsOpeningPicker(false);
    }, [])
  );

  // יצירת תמונה מקדימה לסרטון הראשון בכל שינוי ב-selectedVideos
  useEffect(() => {
    if (!skipFirstVideoThumbGenRef.current) {
      // Skip first run on mount to avoid setting loading flags
      skipFirstVideoThumbGenRef.current = true;
      return;
    }
    if (selectedVideos.length > 0) {
      const first: any = selectedVideos[0];
      if (first?.thumb) {
        setVideoThumbnail(first.thumb);
      } else {
        generateThumbnail(selectedVideos[0].uri);
      }
    } else {
      setVideoThumbnail(null);
    }
  }, [selectedVideos]);

  // Control fullscreen promo playback: play only when modal is open; stop on close
  useEffect(() => {
    const assetId = require('../../assets/videos/ads-video-fixed-aspect-h264.mp4');
    (async () => {
      try {
        if (showFullscreenVideo) {
          adPlayerFull.muted = false;
          adPlayerFull.loop = true;
          await adPlayerFull.replaceAsync(assetId);
          adPlayerFull.play();
        } else {
          adPlayerFull.pause();
          await adPlayerFull.replaceAsync(null);
        }
      } catch {}
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showFullscreenVideo]);

  // Small helper to cap async operations duration
  const withTimeout = async <T,>(p: Promise<T>, ms: number, onTimeout?: () => void): Promise<T> => {
    return await Promise.race([
      p,
      new Promise<T>((_, reject) => setTimeout(() => { try { onTimeout?.(); } catch {} reject(new Error('timeout')); }, ms))
    ]) as T;
  };

  // Immediate upload-and-save helpers (await R2 persistence)
  const uploadAndSavePhotosNow = async (newlyAdded: ImagePicker.ImagePickerAsset[]) => {
    const uid = await ensureAuthUser();
    const user = auth.currentUser;
    if (!uid || !user?.uid) return;
    try { await AsyncStorage.removeItem('isGuest'); } catch {}
    try { await auth.currentUser?.getIdToken?.(true); } catch {}
    const uploadedPairs: { localUri: string; remote: ImagePicker.ImagePickerAsset }[] = [];
    for (const asset of newlyAdded) {
      try {
        const up = await withTimeout(uploadFileToR2({ uid: user.uid, type: 'photos', fileUri: asset.uri, filename: asset.fileName || undefined, mime: (asset as any)?.mimeType }), 15000);
        if (up) uploadedPairs.push({ localUri: asset.uri, remote: { ...asset, uri: up.url, remoteKey: up.key } as any });
      } catch {}
    }
    // Replace local URIs with remote URLs (no append) to avoid duplicates
    let nextList: any[] = [];
    setSelectedPhotos(prev => {
      const map = new Map(uploadedPairs.map(p => [p.localUri, p.remote]));
      nextList = prev.map(p => (map.has((p as any)?.uri) ? (map.get((p as any)?.uri) as any) : p));
      return nextList;
    });
    try {
      await withTimeout(AsyncStorage.setItem('selectedPhotos', JSON.stringify(nextList)), 3000).catch(() => {});
      try { await AsyncStorage.setItem(`selectedPhotos_${user.uid}`, JSON.stringify(nextList)); } catch {}
      let ok = await withTimeout(saveUserMedia(user.uid, 'photos', nextList), 8000).catch(() => false) as any;
      if (!ok) {
        try { await auth.currentUser?.getIdToken?.(true); } catch {}
        await withTimeout(saveUserMedia(user.uid, 'photos', nextList), 8000).catch(() => {});
      }
    } catch {}
  };

  const uploadAndSaveVideosNow = async (newlyAdded: ImagePicker.ImagePickerAsset[]) => {
    const uid = await ensureAuthUser();
    const user = auth.currentUser;
    if (!uid || !user?.uid) return;
    try { await AsyncStorage.removeItem('isGuest'); } catch {}
    try { await auth.currentUser?.getIdToken?.(true); } catch {}
    const uploadedPairs: { localUri: string; remote: ImagePicker.ImagePickerAsset }[] = [];
    for (const asset of newlyAdded) {
      try {
        const up = await withTimeout(uploadFileToR2({ uid: user.uid, type: 'videos', fileUri: asset.uri, filename: asset.fileName || undefined, mime: (asset as any)?.mimeType || 'video/mp4' }), 20000);
        if (up) uploadedPairs.push({ localUri: asset.uri, remote: { ...asset, uri: up.url, remoteKey: up.key } as any });
      } catch {}
    }
    let nextList: any[] = [];
    setSelectedVideos(prev => {
      const map = new Map(uploadedPairs.map(p => [p.localUri, p.remote]));
      nextList = prev.map(v => (map.has((v as any)?.uri) ? (map.get((v as any)?.uri) as any) : v));
      return nextList;
    });
    try {
      await AsyncStorage.setItem('selectedVideos', JSON.stringify(nextList));
      try { await AsyncStorage.setItem(`selectedVideos_${user.uid}`, JSON.stringify(nextList)); } catch {}
      let ok = await withTimeout(saveUserMedia(user.uid, 'videos', nextList), 8000).catch(() => false) as any;
      if (!ok) {
        try { await auth.currentUser?.getIdToken?.(true); } catch {}
        await withTimeout(saveUserMedia(user.uid, 'videos', nextList), 8000).catch(() => {});
      }
    } catch {}
  };

  // Ensure there is a Firebase user (sign in anonymously if needed) and refresh token
  const ensureAuthUser = async (): Promise<string | null> => {
    try {
      if (!auth.currentUser) {
        await signInAnonymously(auth);
      }
      const uid = auth.currentUser?.uid || null;
      if (uid) {
        try { await auth.currentUser?.getIdToken?.(true); } catch {}
        try { await AsyncStorage.removeItem('isGuest'); } catch {}
        return uid;
      }
    } catch (e) {
      console.warn('ensureAuthUser failed', e);
    }
    return null;
  };

  // Helper: deduplicate by remoteKey, assetId, or uri
  const dedupMediaList = (list: any[]): any[] => {
    if (!Array.isArray(list)) return [];
    const indexById = new Map<string, number>();
    const out: any[] = [];
    const makeId = (it: any): string | null => {
      if (typeof it?.assetId === 'string' && it.assetId) return `aid:${it.assetId}`;
      if (typeof it?.remoteKey === 'string' && it.remoteKey) return `rk:${it.remoteKey}`;
      if (typeof it?.uri === 'string' && it.uri) return `u:${it.uri}`;
      return null;
    };
    for (const it of list) {
      const id = makeId(it);
      if (!id) continue;
      const existingIdx = indexById.get(id);
      if (existingIdx == null) {
        indexById.set(id, out.length);
        out.push(it);
      } else {
        const existing = out[existingIdx];
        const hasRemoteNow = typeof it?.remoteKey === 'string' && it.remoteKey;
        const hadRemoteBefore = typeof existing?.remoteKey === 'string' && existing.remoteKey;
        if (hasRemoteNow && !hadRemoteBefore) out[existingIdx] = it;
      }
    }
    return out;
  };

  return (
    <View style={[styles.container, { direction: 'ltr', paddingTop: Math.max(4, insets.top * 0.25) }]}> 
      {/* Inline Top Bar (replaces native header) */}
      <View style={[styles.inlineHeader, { paddingTop: insets.top * 0.1 }]}>
        {showVideoBack ? (
          <TouchableOpacity
            onPress={async () => { try { await AsyncStorage.removeItem('videoBackIntent'); } catch {}; router.push('/(tabs)/before'); }}
            style={styles.inlineHeaderButton}
          >
            <Ionicons name="arrow-back" size={24} color="#334155" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={() => router.push({ pathname: '/onboarding-stages/paywall-stage', params: { source: 'premium', from: 'CalmVideo' } })}
            style={styles.inlineHeaderButton}
          >
            <Ionicons name="sparkles" size={22} color="#60A5FA" />
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={openSettings} style={styles.inlineHeaderButton}>
          <Ionicons name="settings-outline" size={24} color="#1e293b" />
        </TouchableOpacity>
      </View>

      {/* Overlay חוסם עם ספינר וטקסט */}
      {(isStarting || isUploadingPhotos || isLoadingVideos) && (
        <View style={{
          ...StyleSheet.absoluteFillObject,
          backgroundColor: 'rgba(255,255,255,0.85)',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 9999,
          direction: 'ltr',
        }} pointerEvents="none">
          <ActivityIndicator size="large" color="#60A5FA" />
          <LoadingDots labelBase={language === 'he' ? 'טוען' : 'Loading'} />
          {showLongLoadingMessage && (
            <AnimatedPulseText label={language === 'he' ? 'אנחנו עובדים על זה' : "We're on it"} />
          )}
          {showExtraLongLoadingMessage && (
            <AnimatedPulseText label={language === 'he' ? 'הווידאו קצת גדול, אבל עוד רגע מסיימים' : 'The video is a bit large, almost done'} />
          )}
          {showFinalLoadingMessage && (
            <AnimatedPulseText label={language === 'he' ? 'ממש עוד רגע מסיימים' : 'Just a moment more'} />
          )}
        </View>
      )}

      <View style={styles.videoWrapper}>
        <Pressable 
          style={styles.videoContainer}
          onPress={() => {
            // פתיחת הסרטון במסך מלא
            setShowFullscreenVideo(true);
          }}
        >
          <VideoView
            player={adPlayer}
            style={styles.centerImage}
            nativeControls={false}
            contentFit="contain"
            onFirstFrameRender={() => { /* first frame ready for preview */ }}
          />
          {!isVideoPlaying && (
            <View style={styles.playButton}>
              <Ionicons name="play-circle" size={60} color="white" />
            </View>
          )}
        </Pressable>
      </View>
      
      <View style={[styles.topButtons, { direction: 'ltr' }]}>
        <View style={[styles.optionsContainer, { direction: 'ltr' }]}>
          <Pressable 
            style={[
              styles.startButton,
              (isLoadingVideos || isUploadingPhotos || (!selectedPhotos.length && !selectedVideos.length)) && styles.startButtonDisabled
            ]}
            onPress={handleStart}
            disabled={isLoadingVideos || isUploadingPhotos || (!selectedPhotos.length && !selectedVideos.length)}
          >
            {isLoadingVideos || isUploadingPhotos ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <ActivityIndicator color="#fff" size="small" />
                <Text style={styles.startButtonText}>{language === 'he' ? 'טוען…' : 'Loading…'}</Text>
              </View>
            ) : (
              <Text style={styles.startButtonText}>{t('start')}</Text>
            )}
          </Pressable>
        </View>
        
        <Pressable 
          style={styles.musicButton}
          onPress={() => {
            // בדיקה אם יש שיר שמנגן כרגע
            const checkPlayingSong = async () => {
              try {
                // לא מוחקים את השיר הנבחר כדי שיישאר נבחר
                // const selectedSongId = await AsyncStorage.getItem('selectedSongId');
                // if (selectedSongId) {
                //   // אם יש שיר שנבחר, נמחק אותו כדי למנוע נגינה אוטומטית
                //   await AsyncStorage.removeItem('selectedSongId');
                // }
                try { await AsyncStorage.setItem('musicFrom', 'calmVideo'); } catch {}
                try { await AsyncStorage.setItem('musicBackIntent', 'true'); } catch {}
                try { await AsyncStorage.removeItem('videoBackIntent'); } catch {}
                router.push('/(tabs)/musicnew');
              } catch (error) {
                console.error('Error checking for playing song:', error);
                router.push('/(tabs)/musicnew');
              }
            };
            
            checkPlayingSong();
          }}
        >
          <Ionicons name="musical-notes" size={24} color="#60A5FA" />
          <Text style={styles.musicButtonText}>{t('chooseMusic')}</Text>
        </Pressable>
      </View>

      <View style={[styles.bottomSection, { direction: 'ltr' }]}>
        <Pressable 
          style={[styles.button, styles.choosePhotosButton, isOpeningPicker && { opacity: 0.7 }]}
          disabled={isOpeningPicker}
          onPress={async () => {
            if (isOpeningPicker) return;
            setIsOpeningPicker(true);
            try {
              await pickMedia("images");
            } finally {
              setIsOpeningPicker(false);
            }
          }}
        >
          <Text style={[styles.buttonText, { textAlign: 'left' }]}>{t('choosePhotos')}</Text>
        </Pressable>

        <Pressable 
          style={[styles.previewContainer, styles.topPreview]}
          onPress={() => {
            if (selectedPhotos.length > 0) {
              const dedup = dedupMediaList(selectedPhotos);
              router.push({
                pathname: '/(games)/media-preview',
                params: { type: 'photos', items: JSON.stringify(dedup) }
              });
            }
          }}
        >
          {selectedPhotos.length > 0 ? (
            <Image 
              source={{ uri: selectedPhotos[0].uri }}
              style={styles.previewImage as any}
            />
          ) : (
            <View style={styles.emptyPreview}>
              <Text style={styles.emptyText}>{t('empty')}</Text>
            </View>
          )}
        </Pressable>

        <View style={[styles.rowContainer, { direction: 'ltr' }]}>
          <Pressable 
            style={[styles.button, styles.chooseVideosButton]}
            onPress={handleChooseVideos}
          >
            <Text style={[styles.buttonText, { textAlign: 'left' }]}>{t('chooseVideos')}</Text>
          </Pressable>

          <Pressable 
            style={[
              styles.previewContainer,
              styles.bottomPreview,
              !isAllVideosReady && selectedVideos.length > 0 && styles.disabledPreview
            ]}
            onPress={handleVideoPreviewPress}
          >
            {selectedVideos.length > 0 && videoThumbnail ? (
              <>
                <Image 
                  source={{ uri: videoThumbnail }}
                  style={styles.previewImage as any}
                />
                {isLoadingThumbnail && (
                  <View style={styles.loadingOverlay}>
                    <ActivityIndicator color="#60A5FA" size="small" />
                  </View>
                )}
              </>
            ) : (
              <View style={styles.emptyPreview}>
                <Text style={styles.emptyText}>{t('empty')}</Text>
              </View>
            )}
          </Pressable>
        </View>
      </View>

      {isLoadingUserData ? (
        <ActivityIndicator size="large" color="#60A5FA" style={styles.loader} />
      ) : null}

      {/* Fullscreen Video Modal */}
      <Modal
        animationType="fade"
        transparent={false}
        visible={showFullscreenVideo}
        onRequestClose={() => setShowFullscreenVideo(false)}
        statusBarTranslucent={Platform.OS === 'android'}
      >
        <View style={styles.fullscreenContainer}>
          <Pressable 
            style={styles.fullscreenVideoContainer}
            onPress={() => {
              setShowFullscreenVideo(false);
            }}
          >
            <VideoView
              player={adPlayerFull}
              style={styles.fullscreenVideo}
              nativeControls={false}
              contentFit={Platform.OS === 'android' ? 'contain' : 'cover'}
            />
            <View style={styles.fullscreenCloseButton}>
              <Ionicons name="close-circle" size={50} color="white" />
            </View>
          </Pressable>
        </View>
      </Modal>

      {/* Unlock Modal for +10 videos at $0.99 */}
      <Modal visible={showUnlockModal} transparent animationType="fade" onRequestClose={() => setShowUnlockModal(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(15,23,42,0.55)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 18 }}>
          <View style={{ width: '100%', maxWidth: 460, backgroundColor: '#fff', borderRadius: 20, paddingVertical: 18, paddingHorizontal: 18, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 10, shadowOffset: { width: 0, height: 6 }, elevation: 8 }}>
            <View style={{ backgroundColor: '#EFF6FF', borderColor: '#BFDBFE', borderWidth: 1, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 999, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="sparkles" size={18} color="#3B82F6" />
              <Text style={{ color: '#1D4ED8', fontWeight: '700' }}>{language === 'he' ? 'שדרוג קטן, ערך גדול' : 'Small upgrade, big value'}</Text>
            </View>

            <Ionicons name="videocam" size={44} color="#60A5FA" style={{ marginTop: 14 }} />
            <Text style={{ marginTop: 10, fontSize: 20, fontWeight: '800', color: '#0f172a', textAlign: 'center' }}>
              {language === 'he' ? 'עוד רגעים של שקט' : 'More moments of calm'}
            </Text>
            <Text style={{ marginTop: 6, fontSize: 15, color: '#475569', textAlign: 'center', lineHeight: 22 }}>
              {language === 'he' ? 'כרגע עד 10 סרטונים. פתח +15 נוספים ותיצור רצף מרגיע מושלם.' : 'Up to 10 videos now. Unlock +15 to create your perfect relaxing flow.'}
            </Text>

            <View style={{ width: '100%', marginTop: 12, backgroundColor: '#F8FAFC', borderRadius: 12, padding: 12, borderColor: '#E2E8F0', borderWidth: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="checkmark-circle" size={18} color="#10B981" />
                <Text style={{ color: '#0f172a', fontWeight: '700' }}>{language === 'he' ? '+15 סרטונים' : '+15 videos'}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 }}>
                <Ionicons name="checkmark-circle" size={18} color="#10B981" />
                <Text style={{ color: '#0f172a', fontWeight: '700' }}>{language === 'he' ? 'תשלום חד‑פעמי' : 'One‑time payment'}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 }}>
                <Ionicons name="checkmark-circle" size={18} color="#10B981" />
                <Text style={{ color: '#0f172a', fontWeight: '700' }}>{language === 'he' ? 'ללא התחייבות' : 'No commitment'}</Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16, width: '100%', justifyContent: 'center' }}>
              <TouchableOpacity onPress={() => setShowUnlockModal(false)} style={{ paddingVertical: 12, paddingHorizontal: 18, borderRadius: 12, backgroundColor: '#F1F5F9', minWidth: 120, alignItems: 'center' }}>
                <Text style={{ color: '#334155', fontWeight: '700' }}>{language === 'he' ? 'אח"כ' : 'Later'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={async () => {
                  try {
                    setUnlockLoading(true);
                    const uid = auth.currentUser?.uid;
                    if (!uid) { setUnlockLoading(false); setShowUnlockModal(false); return; }
                    // RevenueCat one-time product purchase
                    try {
                      const already = await hasNonSubscriptionPurchase('com.calmpulse.extra15videos');
                      if (already) {
                        // If already purchased, ensure quota is granted
                        try {
                          const q = await getQuota(uid);
                          const currentExtra = Number(q?.extraVideos || 0);
                          if (currentExtra >= 15) {
                            setExtraVideos(currentExtra);
                            setUnlockLoading(false);
                            setShowUnlockModal(false);
                            Alert.alert(language === 'he' ? 'כבר פתוח' : 'Already unlocked', language === 'he' ? '+15 סרטונים זמינים לך כבר' : '+15 videos are already available.');
                            return;
                          }
                        } catch {}
                        let resGrant = await addQuota(uid, 15);
                        if (!resGrant.ok) {
                          // Retry once after brief delay and verify via getQuota
                          await new Promise(r => setTimeout(r, 900));
                          try {
                            const q2 = await getQuota(uid);
                            const extra2 = Number(q2?.extraVideos || 0);
                            if (extra2 >= 15) {
                              setExtraVideos(extra2);
                              setUnlockLoading(false);
                              setShowUnlockModal(false);
                              Alert.alert(language === 'he' ? 'שוחזר' : 'Restored', language === 'he' ? 'נוספו לך +15 סרטונים' : 'You now have +15 videos available.');
                              return;
                            }
                          } catch {}
                          resGrant = await addQuota(uid, 15);
                        }
                        setUnlockLoading(false);
                        if (resGrant.ok) {
                          try { setExtraVideos(Number(resGrant.extraVideos || 15)); } catch {}
                          setShowUnlockModal(false);
                          Alert.alert(language === 'he' ? 'שוחזר' : 'Restored', language === 'he' ? 'נוספו לך +15 סרטונים' : 'You now have +15 videos available.');
                        } else {
                          Alert.alert(language === 'he' ? 'שגיאה' : 'Error', language === 'he' ? 'לא ניתן לשחזר את הרכישה' : 'Could not restore your purchase.');
                        }
                        return;
                      }
                      await purchaseNonSubscriptionProduct('com.calmpulse.extra15videos');
                    } catch (e: any) {
                      setUnlockLoading(false);
                      Alert.alert(language === 'he' ? 'בוטל' : 'Cancelled', language === 'he' ? 'הרכישה בוטלה' : 'Purchase cancelled');
                      return;
                    }
                    // On success, grant quota on server
                    let res = await addQuota(uid, 15);
                    if (!res.ok) {
                      // Retry once after brief delay and verify via getQuota
                      await new Promise(r => setTimeout(r, 900));
                      try {
                        const q3 = await getQuota(uid);
                        const extra3 = Number(q3?.extraVideos || 0);
                        if (extra3 >= 15) {
                          setExtraVideos(extra3);
                          setUnlockLoading(false);
                          setShowUnlockModal(false);
                          Alert.alert(language === 'he' ? 'הצלחה' : 'Success', language === 'he' ? 'נוספו לך +15 סרטונים' : 'You now have +15 videos available.');
                          return;
                        }
                      } catch {}
                      res = await addQuota(uid, 15);
                    }
                    setUnlockLoading(false);
                    if (res.ok) {
                      setShowUnlockModal(false);
                      Alert.alert(language === 'he' ? 'הצלחה' : 'Success', language === 'he' ? 'נוספו לך +15 סרטונים' : 'You now have +15 videos available.');
                      try { setExtraVideos(Number(res.extraVideos || 15)); } catch {}
                    } else {
                      Alert.alert(language === 'he' ? 'שגיאה' : 'Error', language === 'he' ? 'הרכישה נכשלה, נסה שוב' : 'Purchase failed. Try again.');
                    }
                  } catch (e) {
                    setUnlockLoading(false);
                    Alert.alert(language === 'he' ? 'שגיאה' : 'Error', language === 'he' ? 'משהו השתבש' : 'Something went wrong.');
                  }
                }}
                disabled={unlockLoading}
                style={{ paddingVertical: 14, paddingHorizontal: 22, borderRadius: 14, backgroundColor: unlockLoading ? '#93c5fd' : '#2563EB', minWidth: 160, alignItems: 'center', shadowColor: '#2563EB', shadowOpacity: 0.35, shadowRadius: 8, shadowOffset: { width: 0, height: 6 }, elevation: 6 }}
              >
                <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>
                  {unlockLoading ? (language === 'he' ? 'מעבד…' : 'Processing…') : (language === 'he' ? 'פתח ב‑$1.49' : 'Unlock $1.49')}
                </Text>
                <Text style={{ color: '#DBEAFE', fontWeight: '600', fontSize: 11, marginTop: 2 }}>
                  {language === 'he' ? '+15 וידאו, חד‑פעמי' : '+15 videos, one‑time'}
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={{ marginTop: 12, fontSize: 12, color: '#64748B', textAlign: 'center' }}>
              {language === 'he' ? 'תוכל לשדרג גם מאוחר יותר במסך הווידאו' : 'You can always upgrade later from the video screen.'}
            </Text>
          </View>
        </View>
      </Modal>

      {/* Photo Reward Modal */}
      <Modal visible={showPhotoAdModal} transparent animationType="fade" onRequestClose={() => setShowPhotoAdModal(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(15,23,42,0.55)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 18 }}>
          <View style={{ width: '100%', maxWidth: 460, backgroundColor: '#fff', borderRadius: 18, paddingVertical: 18, paddingHorizontal: 18, alignItems: 'center' }}>
            <Ionicons name="images" size={40} color="#60A5FA" />
            <Text style={{ marginTop: 10, fontSize: 18, fontWeight: '800', color: '#0f172a', textAlign: 'center' }}>
              {language === 'he' ? 'עוד 10 תמונות' : 'Add 10 more photos'}
            </Text>
            <Text style={{ marginTop: 6, fontSize: 14, color: '#475569', textAlign: 'center' }}>
              {language === 'he' ? 'צפה בפרסומת קצרה כדי להוסיף עוד 10 תמונות' : 'Watch a short ad to unlock +10 photos'}
            </Text>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <TouchableOpacity onPress={() => setShowPhotoAdModal(false)} style={{ paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12, backgroundColor: '#F1F5F9' }}>
                <Text style={{ color: '#334155', fontWeight: '700' }}>{language === 'he' ? 'לא עכשיו' : 'Not now'}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={async () => {
                const earned = await showRewardedAd();
                if (earned) {
                  setShowPhotoAdModal(false);
                  setAllowPhotoPickAfterAd(true);
                  await launchImagePicker();
                } else {
                  setShowPhotoAdModal(false);
                }
              }} style={{ paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12, backgroundColor: '#60A5FA' }}>
                <Text style={{ color: '#fff', fontWeight: '800' }}>{language === 'he' ? 'צפה עכשיו' : 'Watch Ad'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    direction: 'ltr',
  },
  inlineHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  inlineHeaderButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  topButtons: {
    position: 'absolute',
    top: screenHeight * 0.43, // הרמה נוספת כלפי מעלה
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  bottomSection: {
    position: 'absolute',
    bottom: screenHeight * 0.02,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 20,
  },
  button: {
    backgroundColor: '#60A5FA',
    paddingHorizontal: screenWidth * 0.08,
    paddingVertical: screenHeight * 0.02,
    borderRadius: screenWidth * 0.03,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  buttonText: {
    color: 'white',
    fontSize: screenWidth * 0.045,
    fontWeight: '600',
  },
  marginBottom: {
    marginBottom: 20,
  },
  rowContainer: {
    flexDirection: 'row',
    direction: 'ltr',
    alignItems: 'center',
    gap: screenWidth * 0.05,
    justifyContent: 'center',
  },
  previewContainer: {
    width: screenWidth * 0.17,
    height: screenWidth * 0.17,
    borderRadius: screenWidth * 0.03,
    backgroundColor: '#f1f5f9',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    left: '70%',
    top: -screenHeight * 0.01,
  },
  previewImage: {
    width: '100%',
    height: '100%',
  } as ImageStyle,
  emptyPreview: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: screenWidth * 0.03,
    gap: screenHeight * 0.01,
  },
  emptyText: {
    color: '#94a3b8',
    fontSize: screenWidth * 0.03,
  },
  disabledPreview: {
    opacity: 0.7,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(248, 250, 252, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    gap: 12,
  },
  choosePhotosButton: {
    position: 'absolute',
    top: -screenHeight * 0.305,
    right: '50%',
    transform: [{ translateX: screenWidth * 0.12 }],
  },
  topPreview: {
    position: 'absolute',
    top: -screenHeight * 0.31,
    left: '77%',
    transform: [{ translateX: -screenWidth * 0.1 }],
  },
  optionsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: screenWidth * 0.05,
    marginTop: screenHeight * 0.005,
  },
  startButton: {
    backgroundColor: '#60A5FA',
    paddingHorizontal: screenWidth * 0.08,
    paddingVertical: screenHeight * 0.02,
    borderRadius: screenWidth * 0.03,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  startButtonText: {
    color: 'white',
    fontSize: screenWidth * 0.045,
    fontWeight: '600',
  },
  startButtonDisabled: {
    backgroundColor: '#94a3b8',
  },
  centerImage: {
    width: '100%',
    height: '100%',
    borderRadius: 3,
    position: 'absolute',
    top: 0,
    left: 0,
  },
  loader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(248, 250, 252, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  chooseVideosButton: {
    position: 'absolute',
    top: -screenHeight * 0.212,
    right: '0%',
    transform: [{ translateX: screenWidth * 0.12 }],
  },
  bottomPreview: {
    position: 'absolute',
    left: '17%',
    top: -screenHeight * 0.22,
  },
  musicButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'white',
    padding: screenHeight * 0.02,
    borderRadius: screenWidth * 0.03,
    gap: screenWidth * 0.02,
    width: '80%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
    marginTop: screenHeight * 0.015,
  },
  musicButtonText: {
    color: '#334155',
    fontSize: screenWidth * 0.04,
    fontWeight: '600',
  },
  loadingTitle: {
    marginTop: 10,
    color: '#334155',
    fontSize: screenWidth * 0.045,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  loadingText: {
    color: 'white',
    fontSize: screenWidth * 0.034,
    fontWeight: '700',
  },
  finalLoadingText: {
    color: '#60A5FA',
    fontSize: screenWidth * 0.045,
    fontWeight: 'bold',
    marginTop: screenHeight * 0.02,
    textAlign: 'center',
  },
  afterFinalLoadingText: {
    color: '#60A5FA',
    fontSize: screenWidth * 0.042,
    fontWeight: 'bold',
    marginTop: screenHeight * 0.02,
    textAlign: 'center',
    paddingHorizontal: screenWidth * 0.06,
  },
  loadingBadge: {
    marginTop: 10,
    backgroundColor: '#60A5FA',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#60A5FA',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  loadingBadgeFinal: {
    marginTop: 10,
    backgroundColor: '#2563EB',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 5,
  },
  videoWrapper: {
    position: 'relative',
    marginTop: screenHeight * 0.085,
    alignSelf: 'center',
    borderWidth: Platform.OS === 'android' ? 3 : 5,
    borderColor: '#60A5FA',
    borderStyle: 'solid',
    borderRadius: Platform.OS === 'android' ? 6 : 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 6,
    zIndex: 5,
  },
  videoContainer: {
    position: 'relative',
    borderRadius: 3,
    overflow: 'hidden',
    backgroundColor: 'transparent',
    padding: 0,
    marginHorizontal: 0,
    width: Platform.OS === 'android' ? screenWidth * 0.65 : screenWidth * 0.75,
    height: Platform.OS === 'android' ? screenHeight * 0.25 : screenHeight * 0.3,
  },
  playButton: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -35 }, { translateY: -35 }],
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
    width: 70,
    height: 70,
  },
  fullscreenContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 99999,
  },
  fullscreenVideoContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenVideo: {
    width: '100%',
    height: '100%',
  },
  fullscreenCloseButton: {
    position: 'absolute',
    top: 60,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 30,
    padding: 8,
    zIndex: 10000,
  },
}); 

// Helper: create a local thumbnail for a given local video URI
const createLocalVideoThumbnail = async (uri: string): Promise<string | null> => {
  const attemptTimes = [200, 800, 1200];
  for (const t of attemptTimes) {
    try {
      const { uri: thumb } = await VideoThumbnails.getThumbnailAsync(uri, { time: t, quality: 0.6 });
      return thumb;
    } catch {}
  }
  return null;
};
