import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, View, Text, Pressable, Animated, TouchableOpacity, Switch, ScrollView, Platform } from 'react-native';
import Slider from '@react-native-community/slider';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useIsFocused } from '@react-navigation/native';
import { loadHapticsSettings, saveHapticsSettings } from '../../store/haptics';
import { useLanguage } from '@/lib/LanguageContext';
import { auth } from '@/lib/firebase';
import AdBanner from '@/components/AdBanner';

export type VibrationType = 'continuous' | 'pulse' | 'exhale';

interface VibrationSettings {
  intensity: number;
  duration: number;
}

// הוספת פונקציה לקבלת מפתח ייחודי למשתמש
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

// עדכון הפונקציה לקבלת הגדרות
export const getHapticsSettings = async (): Promise<{
  type: VibrationType;
  intensity: number;
  duration: number;
  enabled: boolean;
}> => {
  try {
    // בדיקה אם הרטט מופעל גלובלית
    const globalHapticsState = await AsyncStorage.getItem('globalHapticsEnabled');
    const globallyEnabled = globalHapticsState !== 'false';
    
    const settingsKey = getUserSpecificKey('haptics_settings');
    const typeKey = getUserSpecificKey('selected_vibration_type');
    
    const savedSettings = await AsyncStorage.getItem(settingsKey);
    const savedType = await AsyncStorage.getItem(typeKey);
    
    if (!savedSettings || !savedType) {
      // ברירת מחדל אם אין הגדרות שמורות
      return {
        type: 'continuous',
        intensity: 50,
        duration: 100,
        enabled: globallyEnabled
      };
    }

    const parsedSettings = JSON.parse(savedSettings);
    const savedIntensity = parsedSettings[savedType].intensity;
    const savedDuration = parsedSettings[savedType].duration;

    return {
      type: savedType as VibrationType,
      intensity: savedIntensity,
      duration: savedDuration,
      enabled: globallyEnabled
    };
  } catch (error) {
    console.error('Error getting haptics settings:', error);
    return {
      type: 'continuous',
      intensity: 50,
      duration: 100,
      enabled: true
    };
  }
};

export default function HapticsScreen() {
  const [selectedType, setSelectedType] = useState<VibrationType | null>(null);
  const [settings, setSettings] = useState<Record<VibrationType, VibrationSettings>>({
    continuous: { intensity: 50, duration: 1000 },
    pulse: { intensity: 70, duration: 900 },
    exhale: { intensity: 50, duration: 1000 },
  });

  const continuousAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const exhaleAnim = useRef(new Animated.Value(0)).current;

  const vibrationInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const isFocused = useIsFocused();
  const { t, language } = useLanguage();

  // נוסיף state לניהול מצב הרטט הגלובלי
  const [globalHapticsEnabled, setGlobalHapticsEnabled] = useState(true);

  // נוסיף state חדש שיציין אם המסך מוכן לקבל אינטראקציות
  const [isScreenReady, setIsScreenReady] = useState(false);

  const stopCurrentVibration = () => {
    if (vibrationInterval.current) {
      clearInterval(vibrationInterval.current);
      vibrationInterval.current = null;
    }
  };

  const animateContinuous = (settings: Record<VibrationType, VibrationSettings>) => {
    // נעצור אנימציות קודמות
    continuousAnim.stopAnimation();
    continuousAnim.setValue(0);
    
    const { duration } = settings.continuous;
    Animated.loop(
      Animated.sequence([
        Animated.timing(continuousAnim, {
          toValue: 1,
          duration: duration,
          useNativeDriver: true,
        }),
        Animated.timing(continuousAnim, {
          toValue: 0,
          duration: duration,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const animatePulse = (settings: Record<VibrationType, VibrationSettings>) => {
    // נעצור אנימציות קודמות
    pulseAnim.stopAnimation();
    pulseAnim.setValue(0);
    
    const { duration } = settings.pulse;
    const minDuration = 300;
    const actualDuration = Math.max(duration, minDuration);
    
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: actualDuration / 2,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0,
          duration: actualDuration / 2,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const animateExhale = (settings: Record<VibrationType, VibrationSettings>) => {
    // נעצור אנימציות קודמות
    exhaleAnim.stopAnimation();
    exhaleAnim.setValue(0);
    
    const { duration } = settings.exhale;
    Animated.loop(
      Animated.sequence([
        Animated.timing(exhaleAnim, {
          toValue: 1,
          duration: duration,
          useNativeDriver: true,
        }),
        Animated.timing(exhaleAnim, {
          toValue: 0,
          duration: duration,
          useNativeDriver: true,
        }),
        Animated.delay(duration / 2),
      ])
    ).start();
  };

  // נוסיף פונקציה לאיפוס כל האנימציות
  const resetAllAnimations = () => {
    // עצירת כל האנימציות הקיימות
    continuousAnim.stopAnimation();
    pulseAnim.stopAnimation();
    exhaleAnim.stopAnimation();
    
    // איפוס הערכים
    continuousAnim.setValue(0);
    pulseAnim.setValue(0);
    exhaleAnim.setValue(0);
  };

  // עדכון פונקציית handleVibrationTest
  const handleVibrationTest = async (type: VibrationType | null) => {
    if (!type) return; // אם אין סוג רטט נבחר, לא עושים כלום
    
    // עצירת רטט קודם
    stopCurrentVibration();
    
    // איפוס כל האנימציות לפני התחלת אנימציה חדשה
    resetAllAnimations();
    
    // הפעלת האנימציה המתאימה עם ההגדרות העדכניות
    switch (type) {
      case 'continuous':
        animateContinuous(settings);
        break;
      case 'pulse':
        animatePulse(settings);
        break;
      case 'exhale':
        animateExhale(settings);
        break;
    }
    
    // רק אם הרטט מופעל, נפעיל את הרטט עצמו
    if (globalHapticsEnabled) {
      startVibration(type);
    }
  };

  // פונקציה חדשה להפעלת הרטט עצמו
  const startVibration = (type: VibrationType) => {
    const { intensity, duration } = settings[type];
    
    const getImpactStyle = (intensity: number) => {
      if (intensity >= 75) return Haptics.ImpactFeedbackStyle.Heavy;
      if (intensity >= 50) return Haptics.ImpactFeedbackStyle.Medium;
      return Haptics.ImpactFeedbackStyle.Light;
    };
    
    switch (type) {
      case 'continuous':
        vibrationInterval.current = setInterval(() => {
          Haptics.impactAsync(getImpactStyle(intensity));
        }, Math.max(100, duration / 5));
        break;
        
      case 'pulse':
        vibrationInterval.current = setInterval(() => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }, duration);
        break;
        
      case 'exhale':
        vibrationInterval.current = setInterval(() => {
          Haptics.impactAsync(getImpactStyle(intensity));
        }, duration);
        break;
    }
  };

  useEffect(() => {
    return () => {
      stopCurrentVibration();
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    
    if (isFocused) {
      // איפוס כל האנימציות
      resetAllAnimations();
      
      // טעינת ההגדרות
      const initializeScreen = async () => {
        try {
          // נסמן שהמסך עדיין לא מוכן
          setIsScreenReady(false);
          
          // טעינת ההגדרות
          const settingsKey = getUserSpecificKey('haptics_settings');
          const typeKey = getUserSpecificKey('selected_vibration_type');
          const globalHapticsKey = 'globalHapticsEnabled';
          
          const [savedSettings, savedType, savedHapticsState] = await Promise.all([
            AsyncStorage.getItem(settingsKey),
            AsyncStorage.getItem(typeKey),
            AsyncStorage.getItem(globalHapticsKey)
          ]);
          
          if (!isMounted) return;
          
          // עדכון מצב הרטט הגלובלי
          if (savedHapticsState !== null) {
            setGlobalHapticsEnabled(savedHapticsState === 'true');
          }
          
          // עדכון ההגדרות
          let parsedSettings;
          if (savedSettings) {
            parsedSettings = JSON.parse(savedSettings);
            setSettings(parsedSettings);
          } else {
            parsedSettings = settings; // השתמש בהגדרות הנוכחיות
          }
          
          // עדכון סוג הרטט
          const vibrationType = savedType as VibrationType || 'continuous';
          setSelectedType(vibrationType);
          
          // המתנה ארוכה יותר לאפשר ל-state להתעדכן
          setTimeout(() => {
            if (!isMounted) return;
            
            // הפעלת הרטט עם ההגדרות המעודכנות
            if (parsedSettings && vibrationType) {
              // עדכון ידני של הרטט עם ההגדרות המעודכנות
              stopCurrentVibration();
              resetAllAnimations();
              
              // הפעלת האנימציה המתאימה
              switch (vibrationType) {
                case 'continuous':
                  animateContinuous(parsedSettings);
                  break;
                case 'pulse':
                  animatePulse(parsedSettings);
                  break;
                case 'exhale':
                  animateExhale(parsedSettings);
                  break;
              }
              
              // הפעלת הרטט אם מופעל
              if (savedHapticsState !== 'false') {
                const { intensity, duration } = parsedSettings[vibrationType];
                
                const getImpactStyle = (intensity: number) => {
                  if (intensity >= 75) return Haptics.ImpactFeedbackStyle.Heavy;
                  if (intensity >= 50) return Haptics.ImpactFeedbackStyle.Medium;
                  return Haptics.ImpactFeedbackStyle.Light;
                };
                
                switch (vibrationType) {
                  case 'continuous':
                    vibrationInterval.current = setInterval(() => {
                      Haptics.impactAsync(getImpactStyle(intensity));
                    }, Math.max(100, duration / 5));
                    break;
                    
                  case 'pulse':
                    vibrationInterval.current = setInterval(() => {
                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    }, duration);
                    break;
                    
                  case 'exhale':
                    vibrationInterval.current = setInterval(() => {
                      Haptics.impactAsync(getImpactStyle(intensity));
                    }, duration);
                    break;
                }
              }
              
              // סימון שהמסך מוכן לקבל אינטראקציות
              setIsScreenReady(true);
            }
          }, 500); // זמן ארוך יותר
        } catch (error) {
          console.error('Error initializing haptics screen:', error);
          // במקרה של שגיאה, נסמן שהמסך מוכן בכל זאת
          setIsScreenReady(true);
        }
      };
      
      initializeScreen();
    } else {
      // כשיוצאים מהמסך, נעצור את האנימציות והרטט
      stopCurrentVibration();
      resetAllAnimations();
    }
    
    return () => {
      isMounted = false;
    };
  }, [isFocused]);

  // עדכון השמירה של ההגדרות
  const saveSettings = async () => {
    try {
      const settingsKey = getUserSpecificKey('haptics_settings');
      const typeKey = getUserSpecificKey('selected_vibration_type');
      
      await AsyncStorage.setItem(settingsKey, JSON.stringify(settings));
      
      // בדיקה שהערך אינו null לפני השמירה
      if (selectedType) {
        await AsyncStorage.setItem(typeKey, selectedType);
      }
    } catch (error) {
      console.error('Error saving haptics settings:', error);
    }
  };

  // עדכון useEffect לטעינת הגדרות
  useEffect(() => {
    saveSettings();
  }, [settings, selectedType]);

  // עדכון useEffect לטעינת מצב הרטט בעת טעינת המסך
  useEffect(() => {
    const loadGlobalHapticsState = async () => {
      try {
        const savedState = await AsyncStorage.getItem('globalHapticsEnabled');
        if (savedState !== null) {
          setGlobalHapticsEnabled(savedState === 'true');
        }
      } catch (error) {
        console.error('Error loading haptics state:', error);
      }
    };
    
    loadGlobalHapticsState();
  }, []);

  // פונקציה להחלפת מצב הרטט הגלובלי
  const toggleGlobalHaptics = async () => {
    const newState = !globalHapticsEnabled;
    setGlobalHapticsEnabled(newState);
    
    try {
      await AsyncStorage.setItem('globalHapticsEnabled', newState.toString());
      
      if (newState && selectedType) {
        // אם הרטט מופעל, נפעיל את הרטט (בלי להפעיל מחדש את האנימציה)
        startVibration(selectedType);
      } else {
        // אם הרטט כבוי, נעצור את הרטט הנוכחי
        stopCurrentVibration();
      }
    } catch (error) {
      console.error('Error saving haptics state:', error);
    }
  };

  const handleTypeSelect = (type: VibrationType) => {
    // אם המסך לא מוכן או שזה אותו סוג שכבר נבחר, לא עושים כלום
    if (!isScreenReady || type === selectedType) return;
    
    setSelectedType(type);
    handleVibrationTest(type);
  };

  const renderVisualization = (type: VibrationType) => {
    if (selectedType !== type) return null;

    const animation = {
      continuous: continuousAnim,
      pulse: pulseAnim,
      exhale: exhaleAnim,
    }[type];

    const getOutputRange = () => {
      switch (type) {
        case 'continuous':
          return [0.2, 1];
        case 'pulse':
          return [0.3, 1];
        case 'exhale':
          return [0.1, 1];
        default:
          return [0, 1];
      }
    };

    return (
      <View style={styles.visualizationContainer}>
        <Animated.View
          style={[
            styles.progressBar,
            {
              transform: [{
                scaleX: animation.interpolate({
                  inputRange: [0, 1],
                  outputRange: getOutputRange(),
                }),
              }],
              transformOrigin: 'left',
            },
          ]}
        />
      </View>
    );
  };

  const renderSliders = (type: VibrationType) => {
    if (selectedType !== type) return null;

    const getMinDuration = () => {
      switch (type) {
        case 'continuous':
          return 400;
        case 'pulse':
          return 600;
        case 'exhale':
          return 600;
        default:
          return 400;
      }
    };

    const handleIntensityChange = (increment: boolean) => {
      const currentValue = settings[type].intensity;
      const newValue = increment 
        ? Math.min(100, currentValue + 10)
        : Math.max(0, currentValue - 10);
      
      setSettings(prev => ({
        ...prev,
        [type]: { ...prev[type], intensity: newValue }
      }));
      handleVibrationTest(type);
    };

    const handleDurationChange = (increment: boolean) => {
      const currentValue = settings[type].duration;
      const minDuration = getMinDuration();
      const newValue = increment 
        ? Math.min(2000, currentValue + 100)
        : Math.max(minDuration, currentValue - 100);
      
      setSettings(prev => ({
        ...prev,
        [type]: { ...prev[type], duration: newValue }
      }));
      handleVibrationTest(type);
    };

    if (Platform.OS === 'android') {
      return (
        <View style={[
          styles.slidersContainer,
          language === 'he' && { alignItems: 'flex-end' }
        ]}>
          <View style={styles.controlRow}>
            <Text style={[
              styles.sliderLabel,
              language === 'he' && { textAlign: 'right', width: '100%' }
            ]}>{t('intensity')}</Text>
            <View style={styles.buttonContainer}>
              <TouchableOpacity 
                style={styles.controlButton}
                onPress={() => handleIntensityChange(false)}
              >
                <Text style={styles.controlButtonText}>-</Text>
              </TouchableOpacity>
              <Text style={styles.valueText}>{settings[type].intensity}%</Text>
              <TouchableOpacity 
                style={styles.controlButton}
                onPress={() => handleIntensityChange(true)}
              >
                <Text style={styles.controlButtonText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
          
          <View style={styles.controlRow}>
            <Text style={[
              styles.sliderLabel,
              language === 'he' && { textAlign: 'right', width: '100%' }
            ]}>{t('duration')}</Text>
            <View style={styles.buttonContainer}>
              <TouchableOpacity 
                style={styles.controlButton}
                onPress={() => handleDurationChange(false)}
              >
                <Text style={styles.controlButtonText}>-</Text>
              </TouchableOpacity>
              <Text style={styles.valueText}>{settings[type].duration}ms</Text>
              <TouchableOpacity 
                style={styles.controlButton}
                onPress={() => handleDurationChange(true)}
              >
                <Text style={styles.controlButtonText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      );
    }

    // iOS keeps the original slider implementation
    return (
      <View style={[
        styles.slidersContainer,
        language === 'he' && { alignItems: 'flex-end' }
      ]}>
        <Text style={[
          styles.sliderLabel,
          language === 'he' && { textAlign: 'right', width: '100%' }
        ]}>{t('intensity')}</Text>
        <Slider
          style={styles.slider}
          minimumValue={0}
          maximumValue={100}
          value={settings[type].intensity}
          onValueChange={(value) => {
            setSettings(prev => ({
              ...prev,
              [type]: { ...prev[type], intensity: value }
            }));
            handleVibrationTest(type);
          }}
          minimumTrackTintColor="#60A5FA"
          maximumTrackTintColor="#E5E7EB"
        />
        
        <Text style={[
          styles.sliderLabel,
          language === 'he' && { textAlign: 'right', width: '100%' }
        ]}>{t('duration')}</Text>
        <Slider
          style={styles.slider}
          minimumValue={getMinDuration()}
          maximumValue={2000}
          value={settings[type].duration}
          onValueChange={(value) => {
            setSettings(prev => ({
              ...prev,
              [type]: { ...prev[type], duration: value }
            }));
            handleVibrationTest(type);
          }}
          minimumTrackTintColor="#60A5FA"
          maximumTrackTintColor="#E5E7EB"
        />
      </View>
    );
  };

  // עדכון האנימציות כאשר ההגדרות משתנות
  useEffect(() => {
    if (isFocused && selectedType) {
      // איפוס האנימציות הקודמות
      resetAllAnimations();
      
      // הפעלת האנימציה המתאימה עם ההגדרות העדכניות
      switch (selectedType) {
        case 'continuous':
          animateContinuous(settings);
          break;
        case 'pulse':
          animatePulse(settings);
          break;
        case 'exhale':
          animateExhale(settings);
          break;
      }
      
      // עדכון הרטט אם מופעל
      if (globalHapticsEnabled) {
        stopCurrentVibration();
        startVibration(selectedType);
      }
    }
  }, [settings, isFocused]);

  return (
    <View style={styles.container}>
      <Text style={styles.headerTitle}>{t('hapticsSettings')}</Text>
      
        <View style={styles.androidHapticsToggleContainer}>
          <View style={styles.hapticsToggleRow}>
            <Text style={styles.hapticsToggleLabel}>
              {globalHapticsEnabled ? t('hapticsOn') : t('hapticsOff')}
            </Text>
            <Switch
              value={globalHapticsEnabled}
              onValueChange={toggleGlobalHaptics}
              trackColor={{ false: '#cbd5e1', true: '#93c5fd' }}
              thumbColor={globalHapticsEnabled ? '#60A5FA' : '#f4f4f5'}
              disabled={!isScreenReady}
            />
          </View>
        </View>
      
      {!isScreenReady && (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>{t('loadingSettings')}</Text>
        </View>
      )}
      
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollViewContent}
        showsVerticalScrollIndicator={true}
        indicatorStyle="black"
      >
        {selectedType && isScreenReady && (
          <>
            <View style={styles.optionWrapper}>
              <Pressable 
                style={styles.optionButton}
                onPress={() => handleTypeSelect('continuous')}
              >
                <View style={styles.optionHeader}>
                  <View style={styles.radioContainer}>
                    <View style={[
                      styles.radioOuter,
                      selectedType === 'continuous' && styles.radioOuterSelected
                    ]}>
                      <View style={[
                        styles.radioInner,
                        selectedType === 'continuous' && styles.radioInnerSelected
                      ]} />
                    </View>
                  </View>
                  <View style={[
                    styles.textContainer,
                    language === 'he' && { alignItems: 'flex-end' }
                  ]}>
                    <Text style={[
                      styles.optionText,
                      language === 'he' && { textAlign: 'right' }
                    ]}>{t('continuousVibration')}</Text>
                    <Text style={[
                      styles.descriptionText,
                      language === 'he' && { textAlign: 'right' }
                    ]}>{t('continuousDescription')}</Text>
                  </View>
                </View>
                {selectedType === 'continuous' && (
                  <View style={styles.visualizationContainer}>
                    <Animated.View
                      style={[
                        styles.progressBar,
                        {
                          transform: [{
                            scaleX: continuousAnim.interpolate({
                              inputRange: [0, 1],
                              outputRange: [0, 1],
                            }),
                          }],
                          transformOrigin: 'left',
                        },
                      ]}
                    />
                  </View>
                )}
              </Pressable>
              {selectedType === 'continuous' && renderSliders('continuous')}
            </View>

            <View style={styles.optionWrapper}>
              <Pressable 
                style={styles.optionButton}
                onPress={() => handleTypeSelect('pulse')}
              >
                <View style={styles.optionHeader}>
                  <View style={styles.radioContainer}>
                    <View style={[
                      styles.radioOuter,
                      selectedType === 'pulse' && styles.radioOuterSelected
                    ]}>
                      <View style={[
                        styles.radioInner,
                        selectedType === 'pulse' && styles.radioInnerSelected
                      ]} />
                    </View>
                  </View>
                  <View style={[
                    styles.textContainer,
                    language === 'he' && { alignItems: 'flex-end' }
                  ]}>
                    <Text style={[
                      styles.optionText,
                      language === 'he' && { textAlign: 'right' }
                    ]}>{t('pulseVibration')}</Text>
                    <Text style={[
                      styles.descriptionText,
                      language === 'he' && { textAlign: 'right' }
                    ]}>{t('pulseDescription')}</Text>
                  </View>
                </View>
                {selectedType === 'pulse' && (
                  <View style={styles.visualizationContainer}>
                    <Animated.View
                      style={[
                        styles.progressBar,
                        {
                          transform: [{
                            scaleX: pulseAnim.interpolate({
                              inputRange: [0, 1],
                              outputRange: [0, 1],
                            }),
                          }],
                          transformOrigin: 'left',
                        },
                      ]}
                    />
                  </View>
                )}
              </Pressable>
              {selectedType === 'pulse' && renderSliders('pulse')}
            </View>

            <View style={styles.optionWrapper}>
              <Pressable 
                style={styles.optionButton}
                onPress={() => handleTypeSelect('exhale')}
              >
                <View style={styles.optionHeader}>
                  <View style={styles.radioContainer}>
                    <View style={[
                      styles.radioOuter,
                      selectedType === 'exhale' && styles.radioOuterSelected
                    ]}>
                      <View style={[
                        styles.radioInner,
                        selectedType === 'exhale' && styles.radioInnerSelected
                      ]} />
                    </View>
                  </View>
                  <View style={[
                    styles.textContainer,
                    language === 'he' && { alignItems: 'flex-end' }
                  ]}>
                    <Text style={[
                      styles.optionText,
                      language === 'he' && { textAlign: 'right' }
                    ]}>{t('exhaleOnly')}</Text>
                    <Text style={[
                      styles.descriptionText,
                      language === 'he' && { textAlign: 'right' }
                    ]}>{t('exhaleDescription')}</Text>
                  </View>
                </View>
                {selectedType === 'exhale' && (
                  <View style={styles.visualizationContainer}>
                    <Animated.View
                      style={[
                        styles.progressBar,
                        {
                          transform: [{
                            scaleX: exhaleAnim.interpolate({
                              inputRange: [0, 1],
                              outputRange: [0, 1],
                            }),
                          }],
                          transformOrigin: 'left',
                        },
                      ]}
                    />
                  </View>
                )}
              </Pressable>
              {selectedType === 'exhale' && renderSliders('exhale')}
            </View>
          </>
        )}
      </ScrollView>
      <View style={{ alignItems: 'center', marginTop: 8 }}>
        <AdBanner />
          </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    padding: 20,
    paddingTop: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    paddingBottom: 100, // מרווח בתחתית כדי שהתוכן לא יוסתר על ידי ה-toggle
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 40,
    marginTop: -55,
    textAlign: 'center',
    paddingTop: 10,
  },
  optionWrapper: {
    marginBottom: 24,
    marginTop: 0,
  },
  optionButton: {
    backgroundColor: 'white',
    padding: 13,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  optionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  radioContainer: {
    marginRight: 14,
  },
  radioOuter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#60A5FA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterSelected: {
    borderColor: '#60A5FA',
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: 'transparent',
  },
  radioInnerSelected: {
    backgroundColor: '#60A5FA',
  },
  textContainer: {
    flex: 1,
  },
  optionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 4,
  },
  descriptionText: {
    fontSize: 14,
    color: '#64748b',
  },
  visualizationContainer: {
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    marginTop: 12,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    width: '100%',
    backgroundColor: '#60A5FA',
    borderRadius: 4,
  },
  slidersContainer: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 12,
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  sliderLabel: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 8,
  },
  slider: {
    width: '100%',
    height: 40,
    marginBottom: 15,
  },
  hapticsToggleContainer: {
    position: 'absolute',
    bottom: 20,
    width: '100%',
    alignItems: 'center',
    zIndex: 5,
    backgroundColor: 'transparent',
  },
  hapticsToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'white',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 30,
    width: '80%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    marginRight: -20,
  },
  hapticsToggleLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#334155',
    marginRight: 10,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#64748b',
  },
  controlRow: {
    marginBottom: Platform.OS === 'android' ? 10 : 15,
  },
  buttonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    padding: Platform.OS === 'android' ? 4 : 8,
    marginTop: Platform.OS === 'android' ? 4 : 8,
    width: Platform.OS === 'android' ? '90%' : '100%',
  },
  controlButton: {
    backgroundColor: '#60A5FA',
    width: Platform.OS === 'android' ? 32 : 40,
    height: Platform.OS === 'android' ? 32 : 40,
    borderRadius: Platform.OS === 'android' ? 16 : 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlButtonText: {
    color: 'white',
    fontSize: Platform.OS === 'android' ? 20 : 24,
    fontWeight: 'bold',
  },
  valueText: {
    fontSize: Platform.OS === 'android' ? 14 : 16,
    color: '#334155',
    fontWeight: '600',
    minWidth: Platform.OS === 'android' ? 50 : 60,
    textAlign: 'center',
  },
  androidHapticsToggleContainer: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 20,
  },
});

// עדכון פונקציית הרטט המלאה
export const triggerHapticFeedback = async (type: VibrationType, intensity: number = 50, duration: number = 100) => {
  try {
    // בדיקה אם הרטט מופעל גלובלית
    const globalHapticsState = await AsyncStorage.getItem('globalHapticsEnabled');
    if (globalHapticsState === 'false') {
      return; // אם הרטט כבוי גלובלית, לא עושים כלום
    }
    
    // הפעלת הרטט בהתאם לסוג
    switch (type) {
      case 'continuous':
        // רטט רציף
        Haptics.impactAsync(
          intensity >= 75 ? Haptics.ImpactFeedbackStyle.Heavy :
          intensity >= 50 ? Haptics.ImpactFeedbackStyle.Medium :
          Haptics.ImpactFeedbackStyle.Light
        );
        break;
        
      case 'pulse':
        // רטט פועם
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        break;
        
      case 'exhale':
        // רטט בנשיפה בלבד
        Haptics.impactAsync(
          intensity >= 75 ? Haptics.ImpactFeedbackStyle.Heavy :
          intensity >= 50 ? Haptics.ImpactFeedbackStyle.Medium :
          Haptics.ImpactFeedbackStyle.Light
        );
        break;
        
      default:
        // ברירת מחדל
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  } catch (error) {
    console.error('Error triggering haptic feedback:', error);
  }
};
