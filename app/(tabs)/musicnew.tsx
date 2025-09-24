import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, SafeAreaView, Text, ScrollView, Pressable, Modal, TouchableOpacity, Animated, Alert, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useLanguage } from '@/lib/LanguageContext';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import * as DocumentPicker from 'expo-document-picker';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth } from '@/lib/firebase';

import AdBanner from '@/components/AdBanner';
import { useFocusEffect } from '@react-navigation/native';
import { checkPremiumStatus } from '@/lib/premiumUtils';

export default function MusicNewScreen() {
  const { t, language } = useLanguage();
  const router = useRouter();
  const [sound, setSound] = useState<any | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentSong, setCurrentSong] = useState<string | null>(null);
  const [showPlayer, setShowPlayer] = useState(false);
  const [selectedSongId, setSelectedSongId] = useState<string | null>(null);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isSliding, setIsSliding] = useState(false);
  const [sliderPosition, setSliderPosition] = useState(0);
  const [customSongSelected, setCustomSongSelected] = useState(false);
  const [customSongUri, setCustomSongUri] = useState<string | null>(null);
  const [customSongName, setCustomSongName] = useState<string | null>(null);
  const [isPremium, setIsPremium] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingSongTitle, setLoadingSongTitle] = useState<string | null>(null);
  const [showNoSongAlert, setShowNoSongAlert] = useState(false);
  const positionRef = useRef(0);
  const durationRef = useRef(0);
  const updateIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const animationProgressRef = useRef(0);
  const [showLocalBack, setShowLocalBack] = useState(true);
  const [showGoToCustomVideos, setShowGoToCustomVideos] = useState(false);

  useFocusEffect(
    React.useCallback(() => {
      (async () => {
        try {
          const from = await AsyncStorage.getItem('musicFrom');
          if (from === 'calmVideo') {
            setShowLocalBack(true);
            setShowGoToCustomVideos(false);
          } else if (from === 'before') {
            setShowLocalBack(false);
            setShowGoToCustomVideos(true);
          } else {
            // default: do not show inline back when source is unknown
            setShowLocalBack(false);
            setShowGoToCustomVideos(false);
          }
        } catch {}
      })();
      return () => {};
    }, [])
  );

  // Helper to check premium accurately
  const isPremiumUser = async (): Promise<boolean> => {
    try {
      const rc = await checkPremiumStatus(true);
      if (rc !== undefined) return rc;
    } catch {}
    const cached = await AsyncStorage.getItem('hasPremium');
    return cached === 'true';
  };

  // Map of local song assets
  const songFiles = {
    'deckTheHalls': require('@/assets/sounds_compressed/Deck The Halls - The Soundlings_96k_mono.mp3'),
    'dreaming432Hz': require('@/assets/sounds_compressed/Dreaming in 432Hz - Unicorn Heads_96k_mono.mp3'),
    'carouselDreams': require('@/assets/sounds_compressed/Carousel Dreams - The Soundlings_96k_mono.mp3'),
    'jingleBells': require('@/assets/sounds_compressed/Jingle Bells - The Soundlings_96k_mono.mp3'),
    'allegro': require('@/assets/sounds_compressed/Allegro - Emmit Fenn_96k_mono.mp3'),
    'anton': require('@/assets/sounds_compressed/Anton - Dan Bodan_96k_mono.mp3'),
    'heavenly': require('@/assets/sounds_compressed/Heavenly - Aakash Gandhi_96k_mono.mp3'),
    'silentNight': require('@/assets/sounds_compressed/Silent Night - DJ Williams_96k_mono.mp3'),
    'rainFuse': require('@/assets/sounds_compressed/Rain Fuse - French Fuse_96k_mono.mp3'),
    'iDontThinkSo': require("@/assets/sounds_compressed/I Don't Think So - The Soundlings_96k_mono.mp3"),
    'amongTheStars': require('@/assets/sounds_compressed/Among The Stars - Everet Almond_96k_mono.mp3'),
    'rainsOfMeghalaya': require('@/assets/sounds_compressed/Rains Of Meghalaya - Hanu Dixit_96k_mono.mp3'),
    'tillILetGo': require('@/assets/sounds_compressed/Till I Let Go - NEFFEX_96k_mono.mp3')
  };

  const songs = [
    { id: 'deckTheHalls', title: 'Deck The Halls - The Soundlings', titleHe: 'עטור את האולמות - The Soundlings' },
    { id: 'dreaming432Hz', title: 'Dreaming in 432Hz - Unicorn Heads', titleHe: 'חלימה ב-432Hz - Unicorn Heads' },
    { id: 'carouselDreams', title: 'Carousel Dreams - The Soundlings', titleHe: 'חלומות בקרוסלה - The Soundlings' },
    { id: 'jingleBells', title: 'Jingle Bells - The Soundlings', titleHe: 'צלצולי פעמונים - The Soundlings' },
    { id: 'allegro', title: 'Allegro - Emmit Fenn', titleHe: 'אלגרו - Emmit Fenn' },
    { id: 'anton', title: 'Anton - Dan Bodan', titleHe: 'אנטון - Dan Bodan' },
    { id: 'heavenly', title: 'Heavenly - Aakash Gandhi', titleHe: 'שמימי - Aakash Gandhi' },
    { id: 'silentNight', title: 'Silent Night - DJ Williams', titleHe: 'לילה שקט - DJ Williams' },
    { id: 'rainFuse', title: 'Rain Fuse - French Fuse', titleHe: 'התכת גשם - French Fuse' },
    { id: 'iDontThinkSo', title: 'I Don\'t Think So - The Soundlings', titleHe: 'אני לא חושב כך - The Soundlings' },
    { id: 'amongTheStars', title: 'Among The Stars - Everet Almond', titleHe: 'בין הכוכבים - Everet Almond' },
    { id: 'rainsOfMeghalaya', title: 'Rains Of Meghalaya - Hanu Dixit', titleHe: 'גשמי מגהלאיה - Hanu Dixit' },
    { id: 'tillILetGo', title: 'Till I Let Go - NEFFEX', titleHe: 'עד שאשחרר - NEFFEX' }
  ];

  useEffect(() => {
    (async () => {
      try {
        const { Audio } = await import('expo-av');
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          allowsRecordingIOS: false,
          interruptionModeIOS: 1,
          shouldDuckAndroid: true,
          interruptionModeAndroid: 1,
          playThroughEarpieceAndroid: false,
        });
      } catch {}
    })();
  }, []);

  useEffect(() => {
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
      }
    };
  }, [sound]);

  // Load selected song and premium flags on mount
  useEffect(() => {
    const loadSelectedSong = async () => {
      try {
        const savedSongId = await AsyncStorage.getItem('selectedSongId');
        if (savedSongId) {
          setSelectedSongId(savedSongId);
          console.log('Loaded selected song:', savedSongId);
        }

        const savedCustomSongUri = await AsyncStorage.getItem('customSongUri');
        const savedCustomSongName = await AsyncStorage.getItem('customSongName');
        if (savedCustomSongUri) {
          setCustomSongUri(savedCustomSongUri);
          setCustomSongName(savedCustomSongName);
          setCustomSongSelected(true);
        }

        const premiumStatus = await AsyncStorage.getItem('hasPremium');
        setIsPremium(premiumStatus === 'true');
        console.log('Premium status from AsyncStorage:', premiumStatus === 'true');
      } catch (error) {
        console.error('Error loading selected song:', error);
      }
    };

    loadSelectedSong();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      const loadMusicData = async () => {
        try {
          console.log('🎵 Loading music data when screen focused');

          const savedSongId = await AsyncStorage.getItem('selectedSongId');
          if (savedSongId) {
            setSelectedSongId(savedSongId);
            console.log('🎵 Loaded selected song:', savedSongId);
          }

          const savedCustomSongUri = await AsyncStorage.getItem('customSongUri');
          const savedCustomSongName = await AsyncStorage.getItem('customSongName');
          if (savedCustomSongUri) {
            setCustomSongUri(savedCustomSongUri);
            setCustomSongName(savedCustomSongName);
            setCustomSongSelected(true);
            console.log('🎵 Loaded custom song:', savedCustomSongName);
          }
          // Refresh premium using centralized check (auto-align/transfer), then cache
          try {
            const premium = await checkPremiumStatus(true);
            setIsPremium(premium);
            await AsyncStorage.setItem('hasPremium', premium.toString());
            await AsyncStorage.setItem('isPremium', premium.toString());
            console.log('👤 Premium status refreshed on focus:', premium);
          } catch {
          const premiumStatus = await AsyncStorage.getItem('hasPremium');
          setIsPremium(premiumStatus === 'true');
            console.log('👤 Premium status from AsyncStorage (fallback):', premiumStatus === 'true');
          }
        } catch (error) {
          console.error('Error loading music data:', error);
        }
      };

      loadMusicData();
    }, [])
  );

  // Update position helper stays the same
  const updatePosition = async () => {
    if (sound && !isSliding) {
      try {
        const status = await sound.getStatusAsync();
        if (status.isLoaded) {
          const currentPosition = status.positionMillis / 1000;
          setPosition(currentPosition);
          positionRef.current = currentPosition;

          if (status.durationMillis) {
            const totalDuration = status.durationMillis / 1000;
            setDuration(totalDuration);
            durationRef.current = totalDuration;
          }
        }
      } catch (error) {
        console.error('Error updating position:', error);
      }
    }
  };

  const animateSlider = (duration: number, startPosition: number = 0) => {
    if (updateIntervalRef.current) {
      clearInterval(updateIntervalRef.current);
      updateIntervalRef.current = null;
    }

    const startTime = Date.now();

    const animationInterval = setInterval(() => {
      const elapsedTime = (Date.now() - startTime) / 1000;
      const newPosition = startPosition + elapsedTime;

      if (newPosition >= durationRef.current) {
        clearInterval(animationInterval);
        updateIntervalRef.current = null;
        setPosition(durationRef.current);
        setSliderPosition(durationRef.current);
        positionRef.current = durationRef.current;
        return;
      }

      setPosition(newPosition);
      setSliderPosition(newPosition);
      positionRef.current = newPosition;
    }, 16);

    updateIntervalRef.current = animationInterval;
  };

  const playSound = async (songId: string, songTitle: string) => {
    try {
      setIsLoading(true);
      setLoadingSongTitle(songTitle);

      if (sound) {
        await sound.unloadAsync();
      }

      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
        updateIntervalRef.current = null;
      }

      const { Audio } = await import('expo-av');
      const { sound: newSound } = await Audio.Sound.createAsync(
        songFiles[songId as keyof typeof songFiles],
        { shouldPlay: true },
        updatePosition
      );

      setSound(newSound);
      setIsPlaying(true);
      setCurrentSong(songTitle);
      setShowPlayer(true);
      setPosition(0);
      setSliderPosition(0);
      positionRef.current = 0;

      const status = await newSound.getStatusAsync();
      if (status.isLoaded && status.durationMillis) {
        const totalDuration = status.durationMillis / 1000;
        setDuration(totalDuration);
        durationRef.current = totalDuration;
        animateSlider(totalDuration, 0);
      }

      setIsLoading(false);
      setLoadingSongTitle(null);
    } catch (error) {
      console.error('Error playing sound:', error);
      setIsLoading(false);
      setLoadingSongTitle(null);
    }
  };

  const togglePlayPause = async () => {
    if (!sound) return;

    if (isPlaying) {
      await sound.pauseAsync();
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
        updateIntervalRef.current = null;
      }
    } else {
      await sound.playAsync();
      const remainingDuration = durationRef.current - positionRef.current;
      animateSlider(remainingDuration, positionRef.current);
    }

    setIsPlaying(!isPlaying);
  };

  const closePlayer = async () => {
    if (sound) {
      await sound.stopAsync();
      await sound.unloadAsync();
    }

    if (updateIntervalRef.current) {
      clearInterval(updateIntervalRef.current);
      updateIntervalRef.current = null;
    }

    setSound(null);
    setIsPlaying(false);
    setCurrentSong(null);
    setShowPlayer(false);
    setPosition(0);
    setDuration(0);
    setSliderPosition(0);
    startTimeRef.current = null;
  };

  const toggleSongSelection = async (songId: string) => {
    try {
      if (selectedSongId === songId) {
        setSelectedSongId(null);
        await AsyncStorage.removeItem('selectedSongId');
        console.log('Song selection removed');
      } else {
        setSelectedSongId(songId);
        await AsyncStorage.setItem('selectedSongId', songId);

        const selectedSong = songs.find(song => song.id === songId);
        const songName = selectedSong ? (language === 'he' ? selectedSong.titleHe : selectedSong.title) : songId;
        console.log(`Loading selected song: "${songName}"`);

        setCustomSongSelected(false);
        setCustomSongUri(null);
        setCustomSongName(null);
        await AsyncStorage.removeItem('customSongUri');
        await AsyncStorage.removeItem('customSongName');

        console.log(`Song "${songName}" saved to AsyncStorage with ID: ${songId}`);
      }
    } catch (error) {
      console.error('Error in toggleSongSelection:', error);
    }
  };

  const seekToPosition = async (value: number) => {
    if (sound) {
      try {
        await sound.setPositionAsync(value * 1000);
        setPosition(value);
        setSliderPosition(value);
        positionRef.current = value;

        if (isPlaying) {
          await sound.playAsync();
          const remainingDuration = durationRef.current - value;
          animateSlider(remainingDuration, value);
        }
      } catch (error) {
        console.error('Error seeking to position:', error);
      }
    }
  };

  const onSlidingStart = () => {
    setIsSliding(true);
    if (updateIntervalRef.current) {
      clearInterval(updateIntervalRef.current);
      updateIntervalRef.current = null;
    }
  };

  const onSlidingChange = (value: number) => {
    setSliderPosition(value);
  };

  const onSlidingComplete = async (value: number) => {
    setIsSliding(false);
    await seekToPosition(value);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const pickCustomSong = async () => {
    try {
      const premium = await isPremiumUser();
      if (!premium) {
        router.push({ pathname: '/onboarding-stages/paywall-stage', params: { source: 'premium', from: 'musicnew' } });
        return;
      }
      const result = await DocumentPicker.getDocumentAsync({
        type: 'audio/mpeg',
        copyToCacheDirectory: true
      });

      if (!result.canceled) {
        const customSongName = result.assets[0].name;
        setCustomSongUri(result.assets[0].uri);
        setCustomSongName(customSongName);
        setCustomSongSelected(true);
        setSelectedSongId(null);

        await AsyncStorage.setItem('customSongUri', result.assets[0].uri);
        await AsyncStorage.setItem('customSongName', customSongName);
        await AsyncStorage.removeItem('selectedSongId');

        console.log(`Loading selected song: "${customSongName}"`);

        Alert.alert(
          language === 'he' ? 'השיר נבחר בהצלחה' : 'Song selected successfully',
          language === 'he' ? 'לחץ על השיר כדי להתחיל לנגן' : 'Click on the song to start playing',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Error in pickCustomSong:', error);
      Alert.alert(
        language === 'he' ? 'שגיאה' : 'Error',
        language === 'he' ? 'אירעה שגיאה בבחירת השיר. אנא נסה שוב.' : 'An error occurred while selecting the song. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  const playCustomSong = async () => {
    if (!customSongUri) return;

    try {
      if (sound) {
        await sound.unloadAsync();
      }

      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
        updateIntervalRef.current = null;
      }

      const { Audio } = await import('expo-av');
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: customSongUri },
        { shouldPlay: true },
        updatePosition
      );

      setSound(newSound);
      setIsPlaying(true);
      setCurrentSong(customSongName || (language === 'he' ? 'שיר מותאם אישית' : 'Custom Song'));
      setShowPlayer(true);
      setPosition(0);
      setSliderPosition(0);
      positionRef.current = 0;

      const status = await newSound.getStatusAsync();
      if (status.isLoaded && status.durationMillis) {
        const totalDuration = status.durationMillis / 1000;
        setDuration(totalDuration);
        durationRef.current = totalDuration;
        animateSlider(totalDuration, 0);
      }
    } catch (error) {
      console.error('Error playing custom sound:', error);
      Alert.alert(
        language === 'he' ? 'שגיאה בנגינת השיר' : 'Error playing song',
        language === 'he' ? 'אירעה שגיאה בנגינת השיר. אנא נסה שוב.' : 'An error occurred while playing the song. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  const goBack = () => {
    if (!selectedSongId && !customSongSelected) {
      setShowNoSongAlert(true);
    } else {
      router.push('/(tabs)/CalmVideo');
    }
  };

  const handleCustomSectionPress = async () => {
    try {
      if (isLoading) return;
      const premium = await isPremiumUser();
      if (!premium) {
        router.push({ pathname: '/onboarding-stages/paywall-stage', params: { source: 'premium', from: 'musicnew' } });
        return;
      }
      if (customSongSelected) {
        setCustomSongSelected(false);
        await AsyncStorage.removeItem('customSongUri');
        await AsyncStorage.removeItem('customSongName');
      } else {
        setCustomSongSelected(true);
        setSelectedSongId(null);
        await AsyncStorage.removeItem('selectedSongId');
      }
    } catch (error) {
      console.error('Error in handleCustomSectionPress:', error);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      {showLocalBack && (
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={goBack}
        >
          <Ionicons name="arrow-forward" size={24} color="#60A5FA" style={styles.rotatedArrow} />
          <Text style={styles.backButtonText}>
            {language === 'he' ? 'חזרה לוידאו בהתאמה אישית' : 'Back to Custom Video'}
          </Text>
        </TouchableOpacity>
      </View>
      )}
      {!showLocalBack && showGoToCustomVideos && (
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.push('/(tabs)/CalmVideo')}
          >
            <Ionicons name="arrow-forward" size={24} color="#60A5FA" />
            <Text style={styles.backButtonText}>
              {language === 'he' ? 'לך לוידאו מותאם אישית' : 'Go to Custom Video'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        {/* Custom Song Option */}
        <View style={styles.customSongContainer}>
          <TouchableOpacity style={styles.customSongContent} activeOpacity={0.8} onPress={handleCustomSectionPress}>
            <Text style={styles.customSongText}>
              {language === 'he' ? 'שיר מותאם אישית MP3' : 'Custom MP3 Song'}
            </Text>
            <TouchableOpacity
              style={styles.radioButton}
              onPress={async () => {
                if (isLoading) return; // Prevent interaction during loading
                if (customSongSelected) {
                  setCustomSongSelected(false);
                  AsyncStorage.removeItem('customSongUri');
                  AsyncStorage.removeItem('customSongName');
                } else {
                  try {
                    const premium = await isPremiumUser();
                    if (!premium) {
                      router.push({ pathname: '/onboarding-stages/paywall-stage', params: { source: 'premium', from: 'musicnew' } });
                      return;
                    }
                    setCustomSongSelected(true);
                    setSelectedSongId(null);
                    AsyncStorage.removeItem('selectedSongId');
                  } catch (error) {
                    console.error('Error checking premium status:', error);
                    Alert.alert(
                      language === 'he' ? 'שגיאה' : 'Error',
                      language === 'he' ? 'אירעה שגיאה בבדיקת סטטוס הפרימיום' : 'An error occurred while checking premium status',
                      [{ text: 'OK' }]
                    );
                  }
                }
              }}
            >
              <View style={[
                styles.radioOuter,
                customSongSelected && styles.radioOuterSelected
              ]}>
                {customSongSelected && (
                  <View style={styles.radioInner} />
                )}
              </View>
            </TouchableOpacity>
          </TouchableOpacity>

          {customSongSelected && (
            <View style={styles.customSongActions}>
              <TouchableOpacity
                style={styles.customSongButton}
                onPress={pickCustomSong}
                disabled={isLoading}
              >
                <Text style={styles.customSongButtonText}>
                  {language === 'he' ? 'בחר שיר מהמכשיר' : 'Select song from device'}
                </Text>
              </TouchableOpacity>

              {customSongUri && (
                <TouchableOpacity
                  style={styles.playCustomSongButton}
                  onPress={playCustomSong}
                  disabled={isLoading}
                >
                  <Text style={styles.playCustomSongButtonText}>
                    {customSongName || (language === 'he' ? 'נגן שיר מותאם אישית' : 'Play custom song')}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        {songs.map((song) => (
          <Pressable
            key={song.id}
            style={({ pressed }) => [
              styles.songButton,
              pressed && styles.songButtonPressed,
              isLoading && styles.songButtonDisabled
            ]}
            onPress={() => {
              if (isLoading) return; // Prevent interaction during loading
              playSound(song.id, language === 'he' ? song.titleHe : song.title);
            }}
            disabled={isLoading}
          >
            <View style={styles.songContent}>
              <Text style={styles.songText}>
                {language === 'he' ? song.titleHe : song.title}
              </Text>
              <TouchableOpacity
                style={styles.radioButton}
                onPress={async () => {
                  if (isLoading) return; // Prevent interaction during loading
                  toggleSongSelection(song.id);
                }}
                disabled={isLoading}
              >
                <View style={[
                  styles.radioOuter,
                  selectedSongId === song.id && styles.radioOuterSelected
                ]}>
                  {selectedSongId === song.id && (
                    <View style={styles.radioInner} />
                  )}
                </View>
              </TouchableOpacity>
            </View>
          </Pressable>
        ))}
      </ScrollView>

      {/* Loading Overlay */}
      {isLoading && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#60A5FA" />
            <Text style={styles.loadingText}>
              {language === 'he'
                ? `טוען את השיר: ${loadingSongTitle}`
                : `Loading song: ${loadingSongTitle}`}
            </Text>
          </View>
        </View>
      )}

      {/* Music Player Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showPlayer}
        onRequestClose={closePlayer}
      >
        <View style={styles.modalContainer}>
          <View style={styles.playerContainer}>
            <Text style={styles.nowPlayingText}>
              {language === 'he' ? 'מנגן כרגע:' : 'Now Playing:'}
            </Text>
            <Text style={styles.songTitleText}>{currentSong}</Text>

            <View style={styles.controlsContainer}>
              <TouchableOpacity
                style={styles.controlButton}
                onPress={togglePlayPause}
              >
                <Ionicons
                  name={isPlaying ? "pause" : "play"}
                  size={32}
                  color="#60A5FA"
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.closeButton}
                onPress={closePlayer}
              >
                <Ionicons name="close" size={24} color="#EF4444" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Custom No Song Alert Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={showNoSongAlert}
        onRequestClose={() => setShowNoSongAlert(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.customAlertContainer}>
            <Text style={styles.customAlertTitle}>
              {language === 'he' ? 'לא בחרת שיר' : 'No song selected'}
            </Text>
            <Text style={styles.customAlertMessage}>
              {language === 'he'
                ? 'בחר שיר מהרשימה כדי להמשיך\n\n💡 לחץ על העיגול ליד השיר שבחרת'
                : 'Select a song from the list to continue\n\n💡 Click the circle next to your chosen song'}
            </Text>

            <View style={styles.customAlertButtons}>
              <TouchableOpacity
                style={styles.customAlertButtonSecondary}
                onPress={() => {
                  setShowNoSongAlert(false);
                  router.push('/(tabs)/CalmVideo');
                }}
              >
                <Text style={styles.customAlertButtonTextSecondary}>
                  {language === 'he' ? 'המשך ללא שיר' : 'Continue without song'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.customAlertButtonPrimary}
                onPress={() => setShowNoSongAlert(false)}
              >
                <Text style={styles.customAlertButtonTextPrimary}>
                  {language === 'he' ? 'חזור לבחור שיר' : 'Go back to select song'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      <AdBanner style={{ marginTop: 8 }} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    padding: 20,
  },
  scrollContent: {
    paddingBottom: 120,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  songButton: {
    backgroundColor: '#ffffff',
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  songButtonPressed: {
    backgroundColor: '#f1f5f9',
  },
  songButtonDisabled: {
    opacity: 0.5,
  },
  songContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  songText: {
    fontSize: 16,
    textAlign: 'left',
    flex: 1,
  },
  radioButton: {
    marginLeft: 10,
  },
  radioOuter: {
    height: 24,
    width: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterSelected: {
    borderColor: '#60A5FA',
  },
  radioInner: {
    height: 12,
    width: 12,
    borderRadius: 6,
    backgroundColor: '#60A5FA',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  playerContainer: {
    width: '80%',
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  nowPlayingText: {
    fontSize: 16,
    color: '#64748B',
    marginBottom: 5,
  },
  songTitleText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 20,
    textAlign: 'center',
  },
  controlsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 10,
  },
  controlButton: {
    padding: 15,
    borderRadius: 50,
    backgroundColor: '#F1F5F9',
  },
  closeButton: {
    padding: 15,
    borderRadius: 50,
    backgroundColor: '#FEE2E2',
  },
  customSongContainer: {
    backgroundColor: '#F0F8FF',
    padding: 15,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 3,
    borderColor: '#60A5FA',
    shadowColor: '#60A5FA',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  customSongContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  customSongText: {
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
    flex: 1,
    color: '#FFD700',
    textShadowColor: 'rgba(0, 0, 0, 0.7)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 3,
    marginLeft: 20,
    letterSpacing: 0.5,
  },
  customSongActions: {
    marginTop: 15,
    alignItems: 'center',
  },
  customSongButton: {
    backgroundColor: '#60A5FA',
    padding: 10,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
    marginBottom: 10,
  },
  customSongButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  playCustomSongButton: {
    backgroundColor: '#FFD700',
    padding: 10,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
  },
  playCustomSongButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#60A5FA',
  },
  backButtonText: {
    marginLeft: 4,
    fontSize: 16,
    fontWeight: '600',
    color: '#60A5FA',
  },
  premiumBadge: {
    color: '#FFD700',
    fontSize: 14,
    fontWeight: 'bold',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  loadingContainer: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 10,
    alignItems: 'center',
    width: '80%',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    textAlign: 'center',
  },
  rotatedArrow: {
    transform: [{ rotate: '180deg' }]
  },
  customAlertContainer: {
    backgroundColor: '#60A5FA',
    borderRadius: 20,
    padding: 25,
    margin: 20,
    borderWidth: 3,
    borderColor: '#3B82F6',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  customAlertTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 15,
  },
  customAlertMessage: {
    fontSize: 16,
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 25,
  },
  customAlertButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  customAlertButtonSecondary: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  customAlertButtonTextSecondary: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  customAlertButtonPrimary: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  customAlertButtonTextPrimary: {
    color: '#60A5FA',
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});