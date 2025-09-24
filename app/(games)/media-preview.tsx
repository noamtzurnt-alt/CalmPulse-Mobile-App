import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Image, FlatList, Dimensions, Pressable, Text, TouchableOpacity, Alert, Modal, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { VideoView, useVideoPlayer } from 'expo-video';
import { StatusBar } from 'expo-status-bar';
import { useLanguage } from '@/lib/LanguageContext';
import { Ionicons } from '@expo/vector-icons';
import { TranslationKey } from '@/lib/translations';
import { auth } from '@/lib/firebase';
import { loadUserMedia, saveUserMedia, deleteFilesFromR2 } from '@/lib/mediaApi';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import * as VideoThumbnails from 'expo-video-thumbnails';

const { width } = Dimensions.get('window');

// Generate and persist a thumbnail for the first video (at ~1s)
async function ensureFirstVideoThumb(list: any[]): Promise<any[] | null> {
  if (!Array.isArray(list) || list.length === 0) return null;
  const first = list[0] as any;
  if (first?.thumb || !first?.uri) return null;
  try {
    const { uri: thumb } = await VideoThumbnails.getThumbnailAsync(first.uri, { time: 1000, quality: 0.6 });
    const updated = [{ ...first, thumb }, ...list.slice(1)];
    try {
      const uid = auth.currentUser?.uid;
      const key = uid ? `selectedVideos_${uid}` : 'selectedVideos';
      await AsyncStorage.setItem(key, JSON.stringify(updated));
    } catch {}
    return updated;
  } catch (e) {
    console.error('Error generating first video thumb (media-preview):', e);
    return null;
  }
}

// Tag and persist a thumb for the first photo (use its uri)
async function ensureFirstPhotoThumb(list: any[]): Promise<any[] | null> {
  if (!Array.isArray(list) || list.length === 0) return null;
  const first = list[0] as any;
  if (first?.thumb || !first?.uri) return null;
  try {
    const updated = [{ ...first, thumb: first.uri }, ...list.slice(1)];
    try {
      const uid = auth.currentUser?.uid;
      const key = uid ? `selectedPhotos_${uid}` : 'selectedPhotos';
      await AsyncStorage.setItem(key, JSON.stringify(updated));
    } catch {}
    return updated;
  } catch {
    return null;
  }
}

// Deduplicate media items by remoteKey (preferred), assetId, or uri
function dedupMedia(list: any[]): any[] {
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
      // Prefer the uploaded (remoteKey) version over local-only
      if (hasRemoteNow && !hadRemoteBefore) {
        out[existingIdx] = it;
      }
    }
  }
  return out;
}

export default function MediaPreviewScreen() {
  const { type, items } = useLocalSearchParams<{ type: string; items: string }>();
  const router = useRouter();
  // נטען מדיה מהפרמטרים או מ-AsyncStorage
  const [mediaItems, setMediaItems] = useState<any[]>(items ? dedupMedia(JSON.parse(items)) : []);
  const { t } = useLanguage();
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState<number[]>([]);
  // Lazy thumbnails for videos
  const [videoThumbs, setVideoThumbs] = useState<Record<number, string>>({});
  const thumbGenRunning = useRef(false);
  // Video preview modal state
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [previewVideoUri, setPreviewVideoUri] = useState<string | null>(null);
  const previewPlayer = useVideoPlayer(null);
  // Loading overlay while preparing data
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isDeletingBusy, setIsDeletingBusy] = useState<boolean>(false);

  // טעינה מ-AsyncStorage אם אין items בפרמטרים
  useEffect(() => {
    const loadMediaFromStorage = async () => {
      setIsLoading(true);
      console.log('📸 Loading media from storage for type:', type);
      try {
        const uid = auth.currentUser?.uid;
        if (type === 'photos') {
          const key = uid ? `selectedPhotos_${uid}` : 'selectedPhotos';
          const storedPhotos = await AsyncStorage.getItem(key);
          if (storedPhotos) {
            const photos = dedupMedia(JSON.parse(storedPhotos));
            const updated = await ensureFirstPhotoThumb(photos);
            setMediaItems(dedupMedia(updated || photos));
            console.log('📸 Loaded', photos.length, 'photos from AsyncStorage');
          } else {
            setMediaItems([]);
            console.log('📸 No photos found in AsyncStorage');
          }
        } else if (type === 'videos') {
          const key = uid ? `selectedVideos_${uid}` : 'selectedVideos';
          const storedVideos = await AsyncStorage.getItem(key);
          if (storedVideos) {
            const videos = dedupMedia(JSON.parse(storedVideos));
            const updated = await ensureFirstVideoThumb(videos);
            setMediaItems(dedupMedia(updated || videos));
            console.log('🎥 Loaded', videos.length, 'videos from AsyncStorage');
          } else {
            setMediaItems([]);
            console.log('🎥 No videos found in AsyncStorage');
          }
        }
      } finally {
        setIsLoading(false);
      }
    };
    loadMediaFromStorage();
  }, [type]);

  // טעינה מ-Firebase ושמירה ל-AsyncStorage
  useEffect(() => {
    const loadVideosFromR2 = async () => {
      const uid = auth.currentUser?.uid;
      if (type === 'videos') {
        setIsLoading(true);
        try {
          if (!auth) return;
          const user = auth.currentUser;
          if (!user?.uid) return;
          const items = dedupMedia(await loadUserMedia(user.uid, 'videos'));
          if (Array.isArray(items) && items.length) {
            const updated = await ensureFirstVideoThumb(items);
            const finalList = dedupMedia(updated || items);
            setMediaItems(finalList);
            const key = uid ? `selectedVideos_${uid}` : 'selectedVideos';
            await AsyncStorage.setItem(key, JSON.stringify(finalList));
          } else {
            const key = uid ? `selectedVideos_${uid}` : 'selectedVideos';
            const storedVideos = await AsyncStorage.getItem(key);
            const localVideos = storedVideos ? dedupMedia(JSON.parse(storedVideos)) : [];
            const updated = await ensureFirstVideoThumb(localVideos);
            setMediaItems(dedupMedia(updated || localVideos));
          }
        } catch (error) {
          console.error('Error loading videos from R2:', error);
        } finally {
          setIsLoading(false);
        }
      } else if (type === 'photos') {
        setIsLoading(true);
        try {
          if (!auth) return;
          const user = auth.currentUser;
          if (!user?.uid) return;
          const items = dedupMedia(await loadUserMedia(user.uid, 'photos'));
          if (Array.isArray(items) && items.length) {
            const updated = await ensureFirstPhotoThumb(items);
            const finalList = dedupMedia(updated || items);
            setMediaItems(finalList);
            const key = uid ? `selectedPhotos_${uid}` : 'selectedPhotos';
            await AsyncStorage.setItem(key, JSON.stringify(finalList));
          } else {
            const key = uid ? `selectedPhotos_${uid}` : 'selectedPhotos';
            const storedPhotos = await AsyncStorage.getItem(key);
            const localPhotos = storedPhotos ? dedupMedia(JSON.parse(storedPhotos)) : [];
            const updated = await ensureFirstPhotoThumb(localPhotos);
            setMediaItems(dedupMedia(updated || localPhotos));
          }
        } catch (error) {
          console.error('Error loading photos from R2:', error);
        } finally {
          setIsLoading(false);
        }
      }
    };
    loadVideosFromR2();
  }, [type]);

  // טעינת נתונים כשהמסך ממוקד (כשחוזרים למסך)
  useFocusEffect(
    React.useCallback(() => {
      const loadMediaData = async () => {
        try {
          console.log('📸 Loading media data when screen focused');
          const uid = auth.currentUser?.uid;
          
          if (type === 'photos') {
            const key = uid ? `selectedPhotos_${uid}` : 'selectedPhotos';
            const storedPhotos = await AsyncStorage.getItem(key);
            if (storedPhotos) {
              const photos = dedupMedia(JSON.parse(storedPhotos));
              const updated = await ensureFirstPhotoThumb(photos);
              setMediaItems(dedupMedia(updated || photos));
              console.log('📸 Loaded', photos.length, 'photos from AsyncStorage');
            } else {
              // Clear generic cache to avoid cross-user bleed
              try { await AsyncStorage.removeItem('selectedPhotos'); } catch {}
              setMediaItems([]);
              console.log('📸 No photos found in AsyncStorage');
            }
          } else if (type === 'videos') {
            const key = uid ? `selectedVideos_${uid}` : 'selectedVideos';
            const storedVideos = await AsyncStorage.getItem(key);
            if (storedVideos) {
              const videos = dedupMedia(JSON.parse(storedVideos));
              const updated = await ensureFirstVideoThumb(videos);
              setMediaItems(dedupMedia(updated || videos));
              console.log('🎥 Loaded', videos.length, 'videos from AsyncStorage');
            } else {
              // Clear generic cache to avoid cross-user bleed
              try { await AsyncStorage.removeItem('selectedVideos'); } catch {}
              setMediaItems([]);
              console.log('🎥 No videos found in AsyncStorage');
            }
          }
        } catch (error) {
          console.error('Error loading media data:', error);
        }
      };
      
      loadMediaData();
    }, [type])
  );

  // יצירת נגני וידאו מחוץ לרנדר איטם
  const videoPlayers = type === 'videos' ? 
    mediaItems.map((item: { uri: string }) => item.uri) : [];

  const handleReset = () => {
    if (type === 'videos') {
      router.back();
      router.setParams({ resetVideos: 'true' });
    } else if (type === 'photos') {
      router.back();
      router.setParams({ resetPhotos: 'true' });
    }
  };

  const toggleSelectionMode = () => {
    setSelectionMode(!selectionMode);
    setSelectedItems([]);
  };

  const toggleItemSelection = (index: number) => {
    let newSelections: number[];
    if (selectedItems.includes(index)) {
      newSelections = selectedItems.filter(i => i !== index);
    } else {
      newSelections = [...selectedItems, index];
    }
    setSelectedItems(newSelections);
  };

  // מחיקת תמונות מ-Firebase
  const deletePhotosFromFirebase = async (remainingPhotos: any[]) => {
    try {
      if (!auth) return;
      const user = auth.currentUser;
      if (!user?.uid) return;
      // Try to delete remote objects by remoteKey if present
      try {
        const keys = (mediaItems || []).filter((_: any, index: number) => selectedItems.includes(index)).map((it: any) => it?.remoteKey).filter((k: any) => typeof k === 'string');
        if (keys.length) {
          await deleteFilesFromR2(user.uid, keys);
        }
      } catch {}
      await saveUserMedia(user.uid, 'photos', remainingPhotos);
      // עדכון גם ב-AsyncStorage
      try {
        const finalList = dedupMedia(remainingPhotos);
        if (finalList && finalList.length > 0) {
          await AsyncStorage.setItem(`selectedPhotos_${user.uid}`, JSON.stringify(finalList));
        } else {
          await AsyncStorage.removeItem(`selectedPhotos_${user.uid}`);
          // מנקה גם את המפתח הגנרי כדי למנוע תצוגה מקדימה ישנה במסכים אחרים
          await AsyncStorage.removeItem('selectedPhotos');
        }
        console.log('Updated selectedPhotos (per-user) in AsyncStorage after delete:', finalList);
      } catch (error) {
        console.error('Error updating selectedPhotos in AsyncStorage:', error);
      }
    } catch (error) {
      console.error('Error deleting photos in R2:', error);
    }
  };

  // מחיקת סרטונים מ-Firebase
  const deleteVideosFromFirebase = async (remainingVideos: any[]) => {
    try {
      if (!auth) return;
      const user = auth.currentUser;
      if (!user?.uid) return;
      // Try to delete remote objects by remoteKey if present
      try {
        const keys = (mediaItems || []).filter((_: any, index: number) => selectedItems.includes(index)).map((it: any) => it?.remoteKey).filter((k: any) => typeof k === 'string');
        if (keys.length) {
          await deleteFilesFromR2(user.uid, keys);
        }
      } catch {}
      await saveUserMedia(user.uid, 'videos', remainingVideos);
      // עדכון גם ב-AsyncStorage
      try {
        const finalList = dedupMedia(remainingVideos);
        if (finalList && finalList.length > 0) {
          await AsyncStorage.setItem(`selectedVideos_${user.uid}`, JSON.stringify(finalList));
        } else {
          await AsyncStorage.removeItem(`selectedVideos_${user.uid}`);
          // מנקה גם את המפתח הגנרי כדי למנוע תצוגה מקדימה ישנה במסכים אחרים
          await AsyncStorage.removeItem('selectedVideos');
        }
        console.log('Updated selectedVideos (per-user) in AsyncStorage after delete:', finalList);
      } catch (error) {
        console.error('Error updating selectedVideos in AsyncStorage:', error);
      }
    } catch (error) {
      console.error('Error deleting videos in R2:', error);
    }
  };

  const deleteSelectedItems = async () => {
    if (selectedItems.length === 0) return;

    Alert.alert(
      String(t('deleteSelected')),
      String(t('deleteSelectedConfirm')),
      [
        {
          text: String(t('cancel')),
          style: 'cancel'
        },
        {
          text: String(t('delete')),
          style: 'destructive',
          onPress: async () => {
            try {
              setIsDeletingBusy(true);
              const updatedItems = mediaItems.filter((_: any, index: number) => 
                !selectedItems.includes(index)
              );
              // עדכון תמידי של AsyncStorage (גם ל-guest)
              if (type === 'photos') {
                await deletePhotosFromFirebase(updatedItems);
                setMediaItems(dedupMedia(updatedItems));
              } else if (type === 'videos') {
                await deleteVideosFromFirebase(updatedItems);
                setMediaItems(dedupMedia(updatedItems));
              }
              setSelectedItems([]);
              setSelectionMode(false);
              setIsDeletingBusy(false);
              Alert.alert(
                String(t('success')),
                '',
                [{ 
                  text: 'OK',
                  onPress: () => {
                    // רענון מסך CalmVideo עם פרמטר reset
                    if (type === 'photos') {
                      router.replace({ pathname: '/(tabs)/CalmVideo', params: { resetPhotos: 'true' } });
                    } else if (type === 'videos') {
                      router.replace({ pathname: '/(tabs)/CalmVideo', params: { resetVideos: 'true' } });
                    }
                  }
                }]
              );
            } catch (error) {
              setIsDeletingBusy(false);
              console.error('Error deleting items:', error);
              Alert.alert(String(t('error')), String(t('deleteError')));
            }
          }
        }
      ]
    );
  };

  const renderItem = ({ item, index }: { item: { uri: string }, index: number }) => {
    if (type === 'photos') {
      return (
        <View style={styles.itemContainer}>
          <Image
            source={{ uri: item.uri }}
            style={styles.mediaItem}
            resizeMode="cover"
          />
          {selectionMode && (
            <TouchableOpacity 
              style={[
                styles.selectionCircle, 
                selectedItems.includes(index) && styles.selectedCircle
              ]}
              onPress={() => toggleItemSelection(index)}
            >
              {selectedItems.includes(index) && (
                <Ionicons name="checkmark" size={16} color="#fff" />
              )}
            </TouchableOpacity>
          )}
        </View>
      );
    } else {
      const persistedThumb = (item as any)?.thumb;
      const thumbUri = persistedThumb || videoThumbs[index];
      const handlePress = () => {
        if (selectionMode) {
          toggleItemSelection(index);
          return;
        }
        setPreviewVideoUri(item.uri);
        try { previewPlayer.replace({ uri: item.uri }); previewPlayer.play(); } catch {}
        setShowVideoModal(true);
      };
      return (
        <Pressable style={styles.itemContainer} onPress={handlePress}>
          <View style={styles.videoContainer}>
            {thumbUri ? (
              <Image source={{ uri: thumbUri }} style={styles.video} resizeMode="cover" />
            ) : (
              <View style={styles.videoPlaceholder}>
                <Ionicons name="videocam-outline" size={28} color="#94A3B8" />
                <Text style={styles.placeholderText}>Video</Text>
              </View>
            )}
          </View>
          {selectionMode && (
            <TouchableOpacity 
              style={[
                styles.selectionCircle, 
                selectedItems.includes(index) && styles.selectedCircle
              ]}
              onPress={() => toggleItemSelection(index)}
            >
              {selectedItems.includes(index) && (
                <Ionicons name="checkmark" size={16} color="#fff" />
              )}
            </TouchableOpacity>
          )}
        </Pressable>
      );
    }
  };

  // viewability: generate thumbnails lazily for visible videos
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 50 }).current;
  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: any[] }) => {
    if (type !== 'videos') return;
    if (thumbGenRunning.current) return;
    thumbGenRunning.current = true;
    (async () => {
      try {
        for (const v of viewableItems) {
          if (!v?.isViewable) continue;
          const index = v.index as number;
          if (videoThumbs[index]) continue;
          const uri = mediaItems[index]?.uri;
          if (!uri) continue;
          try {
            const { uri: thumb } = await VideoThumbnails.getThumbnailAsync(uri, { time: 200, quality: 0.5 });
            setVideoThumbs(prev => ({ ...prev, [index]: thumb }));
          } catch {}
        }
      } finally {
        thumbGenRunning.current = false;
      }
    })();
  }).current;

  // Background thumbnail generation for all videos with limited concurrency
  useEffect(() => {
    if (type !== 'videos') return;
    if (!mediaItems || mediaItems.length === 0) return;

    let cancelled = false;
    const generateAll = async () => {
      const concurrency = 2;
      let cursor = 0;
      const runNext = async () => {
        const idx = cursor++;
        if (idx >= mediaItems.length || cancelled) return;
        if (videoThumbs[idx]) return runNext();
        const uri = mediaItems[idx]?.uri;
        if (!uri) return runNext();
        try {
          const { uri: thumb } = await VideoThumbnails.getThumbnailAsync(uri, { time: 200, quality: 0.5 });
          if (!cancelled) setVideoThumbs(prev => ({ ...prev, [idx]: thumb }));
        } catch {}
        return runNext();
      };
      await Promise.all(Array.from({ length: Math.min(concurrency, mediaItems.length) }, runNext));
    };

    // slight delay to avoid blocking initial UI
    const id = setTimeout(() => { generateAll(); }, 400);
    return () => { cancelled = true; clearTimeout(id); };
  }, [type, mediaItems]);

  // הוספת תרגומים חסרים
  const headerTitle = type === 'photos' ? 'allPhotos' : 'allVideos';

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <View style={styles.headerSection} />
      <View style={styles.whiteSection} />
      
      <View style={styles.headerContainer}>
        <Text style={styles.headerTitle}>
          {String(t(headerTitle as TranslationKey))}
        </Text>
        
        {selectionMode && selectedItems.length > 0 && (
          <TouchableOpacity 
            style={styles.deleteButton}
            onPress={deleteSelectedItems}
          >
            <Ionicons name="checkmark" size={24} color="#fff" />
          </TouchableOpacity>
        )}
      </View>
      
      <Pressable style={styles.closeButton} onPress={() => router.back()}>
        <Text style={styles.closeButtonText}>×</Text>
      </Pressable>
      
      <FlatList
        data={mediaItems}
        renderItem={renderItem}
        keyExtractor={(_, index) => index.toString()}
        numColumns={2}
        style={styles.list}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
      />
      
      <View style={styles.buttonContainer}>
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={toggleSelectionMode}
        >
          <Text style={styles.actionButtonText}>
            {selectionMode ? String(t('cancelSelection')) : String(t('selectItems'))}
          </Text>
        </TouchableOpacity>
      </View>

      {isLoading && (
        <View style={{
          ...StyleSheet.absoluteFillObject,
          backgroundColor: 'rgba(255,255,255,0.92)',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 9999,
        }}>
          <ActivityIndicator size="large" color="#60A5FA" />
          <Text style={{ marginTop: 10, color: '#334155', fontWeight: '700' }}>Loading...</Text>
        </View>
      )}

      {isDeletingBusy && (
        <View style={{
          ...StyleSheet.absoluteFillObject,
          backgroundColor: 'rgba(255,255,255,0.92)',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 10000,
        }}>
          <ActivityIndicator size="large" color="#60A5FA" />
          <Text style={{ marginTop: 10, color: '#334155', fontWeight: '700' }}>Deleting...</Text>
        </View>
      )}

      {showVideoModal && (
        <Modal
          visible
          transparent={false}
          animationType="fade"
          onRequestClose={() => setShowVideoModal(false)}
        >
          <View style={styles.modalContainer}>
            <Pressable style={styles.modalClose} onPress={() => { setShowVideoModal(false); try { previewPlayer.pause(); previewPlayer.replace(null); } catch {} }}>
              <Ionicons name="close" size={28} color="#fff" />
            </Pressable>
            {previewVideoUri ? (
              <VideoView
                player={previewPlayer}
                style={styles.modalVideo}
                nativeControls
                contentFit="contain"
              />
            ) : null}
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  headerSection: {
    height: 100,
    backgroundColor: '#000',
  },
  whiteSection: {
    flex: 1,
    backgroundColor: '#fff',
  },
  list: {
    flex: 1,
    backgroundColor: '#fff',
    position: 'absolute',
    top: 100,
    left: 0,
    right: 0,
    bottom: 80,
  },
  itemContainer: {
    position: 'relative',
    width: width / 2,
    height: width / 2,
  },
  mediaItem: {
    width: '100%',
    height: '100%',
    margin: 0,
    borderRadius: 0,
    borderWidth: 2,
    borderColor: '#000',
  },
  closeButton: {
    position: 'absolute',
    top: 55,
    right: 20,
    zIndex: 2,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 32,
    fontWeight: 'bold',
  },
  videoContainer: {
    width: '100%',
    height: '100%',
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 0,
    margin: 0,
    overflow: 'hidden',
  },
  video: {
    width: '100%',
    height: '100%',
    borderWidth: 2,
    borderColor: '#000',
    margin: 0,
    padding: 0,
    backgroundColor: '#fff',
  },
  headerContainer: {
    position: 'absolute',
    top: 65,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  headerTitle: {
    textAlign: 'center',
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  buttonContainer: {
    position: 'absolute',
    bottom: 20,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  actionButton: {
    backgroundColor: '#60A5FA',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  actionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  selectionCircle: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderWidth: 2,
    borderColor: '#60A5FA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedCircle: {
    backgroundColor: '#60A5FA',
  },
  deleteButton: {
    position: 'absolute',
    right: 340,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoPlaceholder: {
    width: '100%',
    height: '100%',
    borderWidth: 2,
    borderColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    gap: 6,
  },
  placeholderText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalVideo: {
    width: '100%',
    height: '100%',
  },
  modalClose: {
    position: 'absolute',
    top: 48,
    right: 20,
    zIndex: 3,
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
