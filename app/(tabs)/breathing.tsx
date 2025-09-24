import React, { useState, useEffect, useRef, useCallback } from 'react';
import { StyleSheet, View, Text, Animated, Pressable, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLanguage } from '@/lib/LanguageContext';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { auth } from '@/lib/firebase';
import { VibrationType, getHapticsSettings } from './haptics';
import { showInterstitialAd } from '@/lib/adUtils';


// קבועי זמן (במילישניות)
const INHALE_TIME = 4000;
const HOLD_TIME = 7000;
const EXHALE_TIME = 8000;

type BreathingPhase = 'inhale' | 'hold' | 'exhale';



export default function BreathingScreen() {
  const [currentPhase, setCurrentPhase] = useState<BreathingPhase>('inhale');
  const [timeLeft, setTimeLeft] = useState(INHALE_TIME / 1000);
  const [shouldNavigate, setShouldNavigate] = useState(false);
  const scaleAnimation = useRef(new Animated.Value(0)).current;
  const waveAnimation = useRef(new Animated.Value(0)).current;
  const auraAnimation = useRef(new Animated.Value(0)).current;
  const phaseProgress = useRef(new Animated.Value(0)).current;
  const router = useRouter();
  const isFocused = useIsFocused();
  const { t, language } = useLanguage();
  const lastPhaseRef = useRef<BreathingPhase | null>(null);
  const vibrationInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  
  // הוספת state לשמירת הגדרות הרטט
  const [hapticsType, setHapticsType] = useState<VibrationType>('continuous');
  const [hapticsIntensity, setHapticsIntensity] = useState(50);
  const [hapticsDuration, setHapticsDuration] = useState(1000);
  const [hapticsEnabled, setHapticsEnabled] = useState(true);

  
  

  const endExercise = async () => {
    router.replace('/(tabs)');
  };
  
  

  // פונקציה לקבלת מפתח ייחודי למשתמש
  const getUserSpecificKey = (baseKey: string) => {
    if (!auth) {
      console.log('Firebase auth not initialized');
      return baseKey;
    }
    
    const user = auth.currentUser;
    if (user?.email) {
      return `${baseKey}_${user.email}`;
    }
    return baseKey;
  };

  // טעינת הגדרות הרטט
  const loadHapticsSettings = async () => {
    try {
      const settings = await getHapticsSettings();
      setHapticsType(settings.type);
      setHapticsIntensity(settings.intensity);
      setHapticsDuration(settings.duration);
      setHapticsEnabled(settings.enabled);
    } catch (error) {
      console.error('Error loading haptics settings:', error);
    }
  };

  // פונקציה להפעלת רטט
  const triggerVibration = () => {
    if (!hapticsEnabled) return;
    
    const getImpactStyle = (intensity: number) => {
      if (intensity >= 75) return Haptics.ImpactFeedbackStyle.Heavy;
      if (intensity >= 50) return Haptics.ImpactFeedbackStyle.Medium;
      return Haptics.ImpactFeedbackStyle.Light;
    };
    
    switch (hapticsType) {
      case 'continuous':
        Haptics.impactAsync(getImpactStyle(hapticsIntensity));
        break;
      case 'pulse':
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        break;
      case 'exhale':
        if (currentPhase === 'exhale') {
          Haptics.impactAsync(getImpactStyle(hapticsIntensity));
        }
        break;
    }
  };

  // פונקציה להפעלת רטט מתמשך
  const startVibration = useCallback((phase: BreathingPhase) => {
    if (lastPhaseRef.current === phase) return;
    lastPhaseRef.current = phase;
    
    if (vibrationInterval.current) {
      clearInterval(vibrationInterval.current);
    }
    
    if (!hapticsEnabled) return;
    
    // הפעלת רטט בהתאם לסוג הרטט שנבחר
    switch (hapticsType) {
      case 'continuous':
        // רטט רציף - מופעל בכל השלבים
        triggerVibration();
        vibrationInterval.current = setInterval(() => {
          triggerVibration();
        }, Math.max(100, hapticsDuration / 5));
        break;
        
      case 'pulse':
        // רטט פועם - לא מופעל בשלב ההחזקה
        if (phase !== 'hold') {
          triggerVibration();
          vibrationInterval.current = setInterval(() => {
            triggerVibration();
          }, hapticsDuration);
        }
        break;
        
      case 'exhale':
        // רטט בנשיפה בלבד
        if (phase === 'exhale') {
          triggerVibration();
          vibrationInterval.current = setInterval(() => {
            triggerVibration();
          }, hapticsDuration);
        }
        break;
    }
  }, [hapticsType, hapticsIntensity, hapticsDuration, hapticsEnabled, currentPhase]);

  // אנימציות נשימה
  const breathingAnimation = {
    inhale: Animated.timing(scaleAnimation, {
      toValue: 1,
      duration: INHALE_TIME,
      useNativeDriver: true,
    }),
    hold: Animated.timing(scaleAnimation, {
      toValue: 1,
      duration: HOLD_TIME,
      useNativeDriver: true,
    }),
    exhale: Animated.timing(scaleAnimation, {
      toValue: 0,
      duration: EXHALE_TIME,
      useNativeDriver: true,
    }),
  };

  // אנימציית גלים
  const startWaveAnimation = (phase: BreathingPhase) => {
    if (phase === 'inhale') {
      Animated.timing(waveAnimation, {
        toValue: 1,
        duration: INHALE_TIME,
        useNativeDriver: true,
      }).start();
    } else if (phase === 'exhale') {
      Animated.timing(waveAnimation, {
        toValue: 0,
        duration: EXHALE_TIME,
        useNativeDriver: true,
      }).start();
    } else if (phase === 'hold') {
      Animated.sequence([
        Animated.timing(waveAnimation, { toValue: 0.35, duration: 100, useNativeDriver: true }),
        Animated.timing(waveAnimation, { toValue: 1, duration: 1500, useNativeDriver: true }),
        Animated.timing(waveAnimation, { toValue: 0.4, duration: 800, useNativeDriver: true }),
        Animated.timing(waveAnimation, { toValue: 1, duration: 1200, useNativeDriver: true }),
        Animated.timing(waveAnimation, { toValue: 0.5, duration: 600, useNativeDriver: true }),
      ]).start();
    }
  };

  const animateAuraForPhase = (phase: BreathingPhase, duration: number) => {
    if (phase === 'inhale') {
      auraAnimation.setValue(0.2);
      Animated.timing(auraAnimation, { toValue: 1, duration: duration, useNativeDriver: true }).start();
    } else if (phase === 'hold') {
      Animated.sequence([
        Animated.timing(auraAnimation, { toValue: 0.9, duration: 300, useNativeDriver: true }),
        Animated.timing(auraAnimation, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start();
    } else if (phase === 'exhale') {
      Animated.timing(auraAnimation, { toValue: 0.15, duration: duration, useNativeDriver: true }).start();
    }
  };

  const startPhaseProgress = (duration: number) => {
    phaseProgress.stopAnimation();
    phaseProgress.setValue(0);
    Animated.timing(phaseProgress, { toValue: 1, duration, useNativeDriver: false }).start();
  };

  // אתחול מחדש כשנכנסים למסך
  useEffect(() => {
    if (isFocused) {
      // טעינת הגדרות הרטט
      loadHapticsSettings();
      
      scaleAnimation.setValue(0);
      waveAnimation.setValue(0);
      phaseProgress.setValue(0);
      setCurrentPhase('inhale');
      setTimeLeft(INHALE_TIME / 1000);
      startWaveAnimation('inhale');
      startPhaseProgress(INHALE_TIME);
    } else {
      // עצירת הרטט כשיוצאים מהמסך
      if (vibrationInterval.current) {
        clearInterval(vibrationInterval.current);
      }
    }
  }, [isFocused]);

  // עדכון המעברים
  useEffect(() => {
    if (!isFocused) return;

    let interval: NodeJS.Timeout;

    const startPhase = () => {
      const phaseDuration = {
        inhale: INHALE_TIME,
        hold: HOLD_TIME,
        exhale: EXHALE_TIME,
      }[currentPhase];

      setTimeLeft(phaseDuration / 1000);
      breathingAnimation[currentPhase].start();
      startWaveAnimation(currentPhase);
      startPhaseProgress(phaseDuration);
      
      // הפעלת הרטט בהתאם לשלב הנוכחי
      startVibration(currentPhase);

      interval = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            const nextPhase: Record<BreathingPhase, BreathingPhase> = {
              inhale: 'hold',
              hold: 'exhale',
              exhale: 'inhale',
            };
            
            setTimeout(() => {
              setCurrentPhase(nextPhase[currentPhase]);
              startWaveAnimation(nextPhase[currentPhase]);
            }, 1000);
            
            return prev;
          }
          return prev - 1;
        });
      }, 1000);
    };

    startPhase();

    return () => {
      clearInterval(interval);
      breathingAnimation[currentPhase].stop();
      waveAnimation.stopAnimation();
      
      // עצירת הרטט ביציאה
      if (vibrationInterval.current) {
        clearInterval(vibrationInterval.current);
      }
      
      lastPhaseRef.current = null;  // איפוס הרפרנס ביציאה
    };
  }, [currentPhase, isFocused, startVibration]);

  // עדכון מונה תרגילי הנשימה
  useEffect(() => {
    const updateBreathingCount = async () => {
      try {
        const currentCount = await AsyncStorage.getItem('breathingExerciseCount');
        const newCount = currentCount ? parseInt(currentCount) + 1 : 1;
        await AsyncStorage.setItem('breathingExerciseCount', newCount.toString());
        await AsyncStorage.setItem('lastBreathingExercise', new Date().toISOString());
      } catch (error) {
        console.error('Error updating breathing count:', error);
      }
    };
    
    if (isFocused) {
      updateBreathingCount();
    }
  }, [isFocused]);

  const getPhaseMessage = () => {
    switch (currentPhase) {
      case 'inhale':
        return 'שאפו עמוק...';
      case 'hold':
        return 'עצרו את הנשימה...';
      case 'exhale':
        return 'נשפו לאט...';
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <Text style={styles.headerTitle}>{t('breathingExercise')}</Text>
      </View>
      <View style={styles.contentContainer}>
        <View style={styles.circleWrapper}>
          
          <Animated.View
            style={[
              styles.circle,
              {
                transform: [
                  {
                    scale: scaleAnimation.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.8, 1.2],
                    }),
                  },
                ],
              },
            ]}
          >
            <Image
              source={require('../../assets/images/adaptive-icon.png')}
              resizeMode="contain"
              style={styles.pulseLogoFixed}
            />
            <Animated.View
              style={[
                styles.wave,
                {
                  opacity: 1,
                  transform: [
                    {
                      scale: waveAnimation.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.3, 1],
                      }),
                    },
                  ],
                },
              ]}
            />
          </Animated.View>
          <View style={styles.progressContainer}>
            <Animated.View
              style={[
                styles.progressBar,
                { width: phaseProgress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }
              ]}
            />
          </View>
          <Text style={styles.message}>
            {currentPhase === 'inhale'
              ? 'Breathe in - Nose'
              : currentPhase === 'hold'
              ? 'Hold'
              : 'Breathe out - mouse'}
          </Text>
          <Text style={styles.timer}>{timeLeft}</Text>
        </View>
        <View style={styles.buttonContainer}>
          <Pressable style={styles.endButton} onPress={endExercise}>
            <Text style={styles.endButtonText}>{t('endExercise')}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  headerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: -10,
    paddingHorizontal: 20,
    zIndex: 1,
    backgroundColor: '#f8fafc',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '600',
    color: '#334155',
    textAlign: 'center',
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'space-between',
    paddingTop: 100, // מרווח מהכותרת
  },
  circleWrapper: {
    alignItems: 'center',
    marginTop: 40,
  },
  circle: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#60A5FA',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',  // חשוב להגביל את הגלים לתוך העיגול
  },
  waveContainer: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  wave: {
    width: '100%',
    height: '100%',
    borderRadius: 100,
    borderWidth: 8,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    position: 'absolute',
    backgroundColor: 'transparent',
  },
  pulseLogoFixed: {
    position: 'absolute',
    width: 220,
    height: 220,
  },
  progressContainer: {
    width: 200,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E2E8F0',
    marginTop: 28,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#60A5FA',
    borderRadius: 3,
  },
  message: {
    fontSize: 24,
    fontWeight: '600',
    color: '#334155',
    marginTop: 15,
    textAlign: 'center',
  },
  timer: {
    fontSize: 64,
    fontWeight: '700',
    color: '#334155',
    marginTop: -2,
    textAlign: 'center',
  },
  buttonContainer: {
    alignItems: 'center',
    paddingBottom: 150,
  },
  endButton: {
    backgroundColor: '#60A5FA',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
  },
  endButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  noseIconContainer: {
    position: 'absolute',
    zIndex: 999,
    top: -70,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'white',
    borderRadius: 30,
    padding: 10,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  noseText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#334155',
  },
}); 
