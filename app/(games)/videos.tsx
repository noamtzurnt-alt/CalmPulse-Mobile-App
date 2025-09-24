import React, { useState, useRef, useEffect, useContext } from 'react';
import { StyleSheet, View, Pressable, Text, Image } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ImagePickerAsset } from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { ChatContext } from '../(tabs)/_layout';
import { auth } from '@/lib/firebase';
import { loadUserMedia } from '@/lib/mediaApi';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useEventListener } from 'expo';

export default function VideosScreen() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const { photos, videos, shuffle } = useLocalSearchParams<{ 
    photos: string; 
    videos: string;
    shuffle: string;
  }>();
  
  const parseParamArray = (param?: string | string[] | null): any[] => {
    try {
      if (!param) return [];
      const raw = Array.isArray(param) ? param[0] : param;
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const [photosList, setPhotosList] = useState<ImagePickerAsset[]>(parseParamArray(photos));
  const [videosList, setVideosList] = useState<ImagePickerAsset[]>(parseParamArray(videos));
  
  const router = useRouter();
  const player = useVideoPlayer(null);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const { isMuted } = useContext(ChatContext);
  const [isGloballyMuted, setIsGloballyMuted] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  const [isMusicMuted, setIsMusicMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const endedRef = useRef(false);

  // משתנים לנגן המוזיקה
  const [sound, setSound] = useState<any | null>(null);
  const [isMusicPlaying, setIsMusicPlaying] = useState(false);
  const [selectedSongId, setSelectedSongId] = useState<string | null>(null);
  const [customSongUri, setCustomSongUri] = useState<string | null>(null);
  const [customSongName, setCustomSongName] = useState<string | null>(null);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const updateIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const positionRef = useRef(0);
  const durationRef = useRef(0);
  const startTimeRef = useRef<number | null>(null);
  const animationProgressRef = useRef(0);

  // מפת קבצי המוזיקה - כל שיר מקושר לקובץ הספציפי שלו
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

  // פונקציה לעדכון מיקום השיר
  const updatePosition = async () => {
    if (sound && !isVideoMuted) {
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

  // פונקציה להנפשת הסליידר
  const animateSlider = (duration: number, startPosition: number = 0) => {
    // בטל את האינטרוול הקודם אם קיים
    if (updateIntervalRef.current) {
      clearInterval(updateIntervalRef.current);
      updateIntervalRef.current = null;
    }
    
    // שמירת זמן ההתחלה
    const startTime = Date.now();
    
    // עדכון מיקום הסליידר בזמן אמת
    const animationInterval = setInterval(() => {
      // חישוב הזמן שחלף מאז תחילת ההנפשה
      const elapsedTime = (Date.now() - startTime) / 1000;
      
      // חישוב המיקום החדש
      const newPosition = startPosition + elapsedTime;
      
      // בדיקה אם הגענו לסוף
      if (newPosition >= durationRef.current) {
        clearInterval(animationInterval);
        updateIntervalRef.current = null;
        setPosition(durationRef.current);
        positionRef.current = durationRef.current;
        return;
      }
      
      // עדכון המיקום
      setPosition(newPosition);
      positionRef.current = newPosition;
    }, 16); // עדכון כל 16 מילישניות (60fps)
    
    // שמירת האינטרוול
    updateIntervalRef.current = animationInterval;
  };

  // פונקציה לנגינת שיר
  const playSound = async (songId: string) => {
    try {
      console.log("Starting to play sound:", songId);
      
      // אם יש שיר שכבר מנגן, נעצור אותו
      if (sound) {
        console.log("Unloading previous sound");
        await sound.unloadAsync();
      }
      
      // נקה את האינטרוול הקודם אם קיים
      if (updateIntervalRef.current) {
        console.log("Clearing previous interval");
        clearInterval(updateIntervalRef.current);
        updateIntervalRef.current = null;
      }

      // טעינת השיר החדש (ייבוא דינמי)
      console.log("Loading new sound file");
      const { Audio } = await import('expo-av');
      const { sound: newSound } = await Audio.Sound.createAsync(
        songFiles[songId as keyof typeof songFiles],
        { shouldPlay: true },
        updatePosition
      );
      
      console.log("Sound loaded successfully");
      setSound(newSound);
      setIsMusicPlaying(true);
      setPosition(0);
      positionRef.current = 0;
      
      // קבלת אורך השיר
      const status = await newSound.getStatusAsync();
      if (status.isLoaded && status.durationMillis) {
        const totalDuration = status.durationMillis / 1000;
        console.log("Song duration:", totalDuration, "seconds");
        setDuration(totalDuration);
        durationRef.current = totalDuration;
        
        // התחלת הנפשת הסליידר
        animateSlider(totalDuration, 0);
      }
    } catch (error) {
      console.error('Error playing sound:', error);
    }
  };

  // פונקציה לעצירת השיר - גרסה משופרת
  const stopSound = async () => {
    try {
      if (sound) {
        console.log('Stopping sound...');
        try {
          await sound.stopAsync();
        } catch (stopError) {
          console.log('Error stopping sound, proceeding to unload:', stopError);
        }
        
        try {
          await sound.unloadAsync();
        } catch (unloadError) {
          console.log('Error unloading sound:', unloadError);
        }
        
        setSound(null);
        setIsMusicPlaying(false);
        setPosition(0);
        positionRef.current = 0;
        
        if (updateIntervalRef.current) {
          clearInterval(updateIntervalRef.current);
          updateIntervalRef.current = null;
        }
      }
    } catch (error) {
      console.error('Error in stopSound:', error);
      // Even if we encounter an error, try to clean up the state
      setSound(null);
      setIsMusicPlaying(false);
      setPosition(0);
      positionRef.current = 0;
    }
  };

  // פונקציה לקבלת שם השיר מהמזהה
  const getSongName = (songId: string): string => {
    // מיפוי של מזהה השיר לשם השיר
    const songNames: Record<string, string> = {
      'deckTheHalls': 'Deck The Halls - The Soundlings',
      'dreaming432Hz': 'Dreaming in 432Hz - Unicorn Heads',
      'carouselDreams': 'Carousel Dreams - The Soundlings',
      'jingleBells': 'Jingle Bells - The Soundlings',
      'allegro': 'Allegro - Emmit Fenn',
      'anton': 'Anton - Dan Bodan',
      'heavenly': 'Heavenly - Aakash Gandhi',
      'silentNight': 'Silent Night - DJ Williams',
      'rainFuse': 'Rain Fuse - French Fuse',
      'iDontThinkSo': 'I Don\'t Think So - The Soundlings',
      'amongTheStars': 'Among The Stars - Everet Almond',
      'rainsOfMeghalaya': 'Rains Of Meghalaya - Hanu Dixit',
      'tillILetGo': 'Till I Let Go - NEFFEX'
    };
    
    return songNames[songId] || songId;
  };

  // פונקציה לבדיקת השמעת סאונד
  const testSound = async () => {
    try {
      console.log("Testing sound playback...");
      
      // וידוא שהמערכת מוכנה לנגן מוזיקה
      const { Audio } = await import('expo-av');
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });
      
      // עצור כל שיר קיים לפני הבדיקה
      if (sound) {
        console.log("Stopping existing sound before test");
        await sound.stopAsync();
        await sound.unloadAsync();
        setSound(null);
      }
      
      // נגן שיר קצר לבדיקה
      console.log("Creating test sound...");
      const { sound: testSound } = await Audio.Sound.createAsync(
        require('@/assets/sounds_compressed/Jingle Bells - The Soundlings_96k_mono.mp3'),
        { shouldPlay: true, volume: 1.0, isMuted: false },
        (status) => {
          console.log("Test sound status:", status);
        }
      );
      
      // וידוא שהשיר מתנגן
      console.log("Setting test sound properties...");
      await testSound.setIsMutedAsync(false);
      await testSound.setVolumeAsync(1.0);
      await testSound.playAsync();
      
      console.log("Test sound started playing");
      
      // עצור את השיר אחרי 3 שניות
      setTimeout(async () => {
        console.log("Stopping test sound...");
        await testSound.stopAsync();
        await testSound.unloadAsync();
        console.log("Test sound stopped");
      }, 3000);
      
    } catch (error) {
      console.error('Error testing sound:', error);
    }
  };

  // שימוש ב-useFocusEffect כדי לטפל בכניסה ויציאה מהמסך
  useFocusEffect(
    React.useCallback(() => {
      let isActive = true;
      
      // קוד שרץ כשהמסך מקבל פוקוס (כניסה למסך)
      const loadSelectedSong = async () => {
        if (!isActive) return;
        
        try {
          // וידוא שהמערכת מוכנה לנגן מוזיקה
          const { Audio } = await import('expo-av');
          await Audio.setAudioModeAsync({
            playsInSilentModeIOS: true,
            staysActiveInBackground: false,
            shouldDuckAndroid: true,
            playThroughEarpieceAndroid: false,
          });
          
          // קודם כל נבדוק אם יש שיר שכבר מנגן ונעצור אותו
          if (sound) {
            console.log("Stopping previous sound before loading new one");
            await sound.stopAsync();
            await sound.unloadAsync();
            setSound(null);
          }
          
          console.log("Loading selected song from AsyncStorage...");
          const savedSongId = await AsyncStorage.getItem('selectedSongId');
          const savedCustomSongUri = await AsyncStorage.getItem('customSongUri');
          const savedCustomSongName = await AsyncStorage.getItem('customSongName');
          
          console.log("Selected song ID from AsyncStorage:", savedSongId);
          console.log("Custom song URI from AsyncStorage:", savedCustomSongUri);
          
          if (savedCustomSongUri) {
            // Play custom song if one is selected
            console.log("Playing custom song:", savedCustomSongName);
            setCustomSongUri(savedCustomSongUri);
            setCustomSongName(savedCustomSongName);
            
            // וודא שהמוזיקה לא מושתקת כשנכנסים למסך זה
            const { sound: newSound } = await Audio.Sound.createAsync(
              { uri: savedCustomSongUri },
              { shouldPlay: true, volume: 1.0, isMuted: false },
              updatePosition
            );
            
            // וידוא שהשיר מתנגן
            await newSound.setIsMutedAsync(false);
            await newSound.setVolumeAsync(1.0);
            await newSound.playAsync();
            
            setSound(newSound);
            setIsMusicPlaying(true);
            setPosition(0);
            positionRef.current = 0;
            
            // קבלת אורך השיר
            const status = await newSound.getStatusAsync();
            if (status.isLoaded && status.durationMillis) {
              const totalDuration = status.durationMillis / 1000;
              console.log("Custom song duration:", totalDuration, "seconds");
              setDuration(totalDuration);
              durationRef.current = totalDuration;
              
              // התחלת הנפשת הסליידר
              animateSlider(totalDuration, 0);
            }
          } else if (savedSongId && songFiles[savedSongId as keyof typeof songFiles]) {
            // Play built-in song if one is selected
            console.log("Song found in songFiles, playing:", savedSongId);
            setSelectedSongId(savedSongId);
            
            // מציאת שם השיר מהרשימה
            const songName = getSongName(savedSongId);
            console.log(`Loading selected song: "${songName}"`);
            
            // וודא שהמוזיקה לא מושתקת כשנכנסים למסך זה
            const { sound: newSound } = await Audio.Sound.createAsync(
              songFiles[savedSongId as keyof typeof songFiles],
              { shouldPlay: true, volume: 1.0, isMuted: false },
              updatePosition
            );
            
            // וידוא שהשיר מתנגן
            await newSound.setIsMutedAsync(false);
            await newSound.setVolumeAsync(1.0);
            await newSound.playAsync();
            
            setSound(newSound);
            setIsMusicPlaying(true);
            setPosition(0);
            positionRef.current = 0;
            
            // קבלת אורך השיר
            const status = await newSound.getStatusAsync();
            if (status.isLoaded && status.durationMillis) {
              const totalDuration = status.durationMillis / 1000;
              console.log("Song duration:", totalDuration, "seconds");
              setDuration(totalDuration);
              durationRef.current = totalDuration;
              
              // התחלת הנפשת הסליידר
              animateSlider(totalDuration, 0);
            }
          } else {
            console.log("No song selected");
          }
        } catch (error) {
          console.error('Error loading selected song:', error);
        }
      };
      
      loadSelectedSong();
      
      // קוד שרץ כשהמסך מאבד פוקוס (יציאה מהמסך)
      return () => {
        console.log("Screen losing focus - cleaning up resources...");
        isActive = false;
        stopSound();
      };
    }, [])
  );

  // הוספת useEffect נוסף לניקוי בעת unmount
  useEffect(() => {
    return () => {
      console.log("Component unmounting - cleaning up resources...");
      stopSound();
      try { player.pause(); player.replace(null); } catch {}
    };
  }, []);

  useEffect(() => {
    const loadUserMediaData = async () => {
      try {
        setIsLoading(true);
        
        // If we already have items from params, skip remote loading
        if ((photosList && photosList.length > 0) || (videosList && videosList.length > 0)) {
          setIsLoading(false);
          return;
        }
        
        if (!auth) {
          console.log('Firebase auth not initialized');
          setIsLoading(false);
          return;
        }
        
        const user = auth.currentUser;
        if (!user?.uid) {
          setIsLoading(false);
          return;
        }
        const [photosR2, videosR2] = await Promise.all([
          loadUserMedia(user.uid, 'photos'),
          loadUserMedia(user.uid, 'videos')
        ]);
        if (Array.isArray(photosR2) && photosR2.length) {
          setPhotosList(photosR2);
        }
        if (Array.isArray(videosR2) && videosR2.length) {
          setVideosList(videosR2);
        }
        
        setIsLoading(false);
      } catch (error) {
        console.error('Error loading user media data:', error);
        setIsLoading(false);
      }
    };
    
    loadUserMediaData();
  }, [photosList, videosList]);

  const mediaSequence = React.useMemo(() => {
    const combined = [
      ...photosList.map(item => ({ ...item, type: 'photo' as const })),
      ...videosList.map(item => ({ ...item, type: 'video' as const }))
    ];

    if (shuffle === 'true') {
      const shuffled = [];
      const tempArray = [...combined];
      
      while (tempArray.length > 0) {
        const randomIndex = Math.floor(Math.random() * tempArray.length);
        shuffled.push(tempArray[randomIndex]);
        tempArray.splice(randomIndex, 1);
      }
      
      return shuffled;
    }

    return combined;
  }, [photosList, videosList, shuffle]);

  const moveToNextItem = () => {
    if (currentIndex >= mediaSequence.length - 1) {
      // עצירת השיר לפני חזרה למסך הקודם
      stopSound();
      // לא מוחקים את השיר הנבחר מ-AsyncStorage כדי שיישאר נבחר
      // AsyncStorage.removeItem('selectedSongId');
      router.back();
    } else {
      setCurrentIndex(prev => prev + 1);
      if (mediaSequence[currentIndex + 1]?.type === 'video') {
        setIsVideoReady(false);
      }
    }
  };

  // התקדם לפריט הבא כשסרטון מסתיים (באמצעות timeUpdate)
  useEventListener(player, 'timeUpdate', ({ currentTime }) => {
    try {
      if (!isVideoReady || endedRef.current) return;
      const dur = player.duration;
      if (!dur || dur <= 0) return;
      if (currentTime >= dur - 0.1) {
        endedRef.current = true;
        moveToNextItem();
      }
    } catch {}
  });

  useEffect(() => {
    let timeout: NodeJS.Timeout;
    const currentItem = mediaSequence[currentIndex];
    if (!currentItem) return;

    if (currentItem.type === 'photo') {
      timeout = setTimeout(moveToNextItem, 3000);
    }

    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [currentIndex]);

  useEffect(() => {
    const currentItem = mediaSequence[currentIndex];
    if (!currentItem || currentItem.type !== 'video') return;

    let isMounted = true;

    const loadVideo = async () => {
      try {
        await new Promise(resolve => setTimeout(resolve, 100));
        if (isMounted) {
          player.muted = isGloballyMuted || isVideoMuted;
          player.loop = false;
          player.timeUpdateEventInterval = 0.25;
          endedRef.current = false;
          await player.replace({ uri: currentItem.uri });
          if (isMounted) {
            setIsVideoReady(true);
            player.play();
          }
        }
      } catch (error) {
        console.error('Error loading video:', error);
      }
    };

    loadVideo();

    return () => {
      isMounted = false;
      try { player.pause(); player.replace(null); } catch {}
      setIsVideoReady(false);
    };
  }, [currentIndex]);

  // פונקציה חדשה לעדכון מצב המיוט של הסרטון
  const updateVideoMute = async () => {
    const currentItem = mediaSequence[currentIndex];
    if (!currentItem || currentItem.type !== 'video' || !isVideoReady) {
      console.log("Skipped updateVideoMute: video not ready or not a video item");
      return;
    }
  
    try {
      player.muted = isGloballyMuted || isVideoMuted;
      if (player.playing) {
        player.play();
      }
    } catch (error) {
      console.error('Error updating video mute:', error);
    }
  };
  

  // עדכון מצב המיוט של הסרטון כאשר משתנה isGloballyMuted או isVideoMuted
  useEffect(() => {
    updateVideoMute();
  }, [isGloballyMuted, isVideoMuted]);

  const toggleSound = async () => {
    // Toggle only video mute state
    setIsVideoMuted(!isVideoMuted);
    
    // Don't toggle music mute state anymore
    // setIsMusicMuted(!isMusicMuted);
    
    // Don't update music mute state
    // if (sound) {
    //   try {
    //     await sound.setIsMutedAsync(!isMusicMuted);
    //   } catch (error) {
    //     console.error('Error toggling music mute:', error);
    //   }
    // }
  };

  useEffect(() => {
    const checkGlobalMute = async () => {
      const muteSetting = await AsyncStorage.getItem('isMuted');
      setIsGloballyMuted(muteSetting === 'true');
    };
    checkGlobalMute();
  }, []);

  useEffect(() => {
    setIsGloballyMuted(isMuted);
  }, [isMuted]);

  // פונקציה לנגינת שיר מותאם אישית
  const playCustomSong = async (uri: string) => {
    try {
      console.log("Starting to play custom song:", uri);
      
      // אם יש שיר שכבר מנגן, נעצור אותו
      if (sound) {
        console.log("Unloading previous sound");
        await sound.unloadAsync();
      }
      
      // נקה את האינטרוול הקודם אם קיים
      if (updateIntervalRef.current) {
        console.log("Clearing previous interval");
        clearInterval(updateIntervalRef.current);
        updateIntervalRef.current = null;
      }

      // טעינת השיר המותאם אישית (ייבוא דינמי)
      console.log("Loading custom sound file");
      const { Audio } = await import('expo-av');
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: uri },
        { shouldPlay: true },
        updatePosition
      );
      
      console.log("Custom sound loaded successfully");
      setSound(newSound);
      setIsMusicPlaying(true);
      setPosition(0);
      positionRef.current = 0;
      
      // קבלת אורך השיר
      const status = await newSound.getStatusAsync();
      if (status.isLoaded && status.durationMillis) {
        const totalDuration = status.durationMillis / 1000;
        console.log("Custom song duration:", totalDuration, "seconds");
        setDuration(totalDuration);
        durationRef.current = totalDuration;
        
        // התחלת הנפשת הסליידר
        animateSlider(totalDuration, 0);
        }
      } catch (error) {
      console.error('Error playing custom sound:', error);
      }
    };

  // Add cleanup when component unmounts
  useEffect(() => {
    return () => {
      if (sound) {
        sound.stopAsync().then(() => {
        sound.unloadAsync();
        setSound(null);
        });
      }
    };
  }, [sound]);

  // Update the mute button icon to reflect only video mute state
  const getMuteIcon = () => {
    if (isGloballyMuted || isVideoMuted) {
      return "volume-mute";
    }
    return "volume-high";
  };

  if (!mediaSequence.length) return null;

  const currentItem = mediaSequence[currentIndex];

  return (
    <View style={styles.container}>
      <Pressable 
        style={[styles.closeButton, { top: 40 }]}
        onPress={async () => {
          await stopSound();
          router.back();
        }}
      >
        <Text style={styles.closeButtonText}>×</Text>
      </Pressable>

      <Pressable 
        style={[styles.closeButton, { top: 40, left: 20 }]}
        onPress={toggleSound}
      >
        <Ionicons 
          name={getMuteIcon()} 
          size={24} 
          color="white" 
        />
      </Pressable>

      {currentItem && (
        currentItem.type === 'photo' ? (
          <Image
            source={{ uri: currentItem.uri }}
            style={styles.fullScreenMedia}
            resizeMode="contain"
          />
        ) : (
          <VideoView
            style={styles.fullScreenMedia}
            player={player}
            nativeControls
            contentFit="contain"
            onFirstFrameRender={() => setIsVideoReady(true)}
          />
        )
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreenMedia: {
    width: '100%',
    height: '100%',
  },
  closeButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 2,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  }
});
