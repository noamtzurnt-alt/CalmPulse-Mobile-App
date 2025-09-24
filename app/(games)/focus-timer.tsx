import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, Pressable, Animated, Dimensions, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useLanguage } from '@/lib/LanguageContext';
import { useIsFocused } from '@react-navigation/native';
import AdBanner from '@/components/AdBanner';

const GAME_DURATION = 30; // משך המשחק בשניות

export default function FocusTimerScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const isFocused = useIsFocused();
  const [currentNumber, setCurrentNumber] = useState(1);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameEnded, setGameEnded] = useState(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const { width, height } = Dimensions.get('window');
  const [position, setPosition] = useState(getRandomPosition());
  const [showWelcome, setShowWelcome] = useState(true);
  const [count, setCount] = useState(1);
  const [isActive, setIsActive] = useState(true);
  const [showRetryModal, setShowRetryModal] = useState(false);

  // פונקציה ליצירת מיקום אקראי על המסך
  function getRandomPosition() {
    const padding = 100;
    const circleSize = 80; // גודל העיגול
    const buttonAreaHeight = 200; // אזור הכפתור + מרווח ביטחון
    const safeAreaBottom = height - buttonAreaHeight; // גובה בטוח מעל הכפתור והקו
    
    let x, y;
    do {
      x = Math.random() * (width - circleSize - padding * 2) + padding;
      // מגביל את ה-y להיות הרבה מעל אזור הכפתור
      y = Math.random() * (safeAreaBottom - padding - circleSize - 50) + padding;
    } while (
      // בדיקה שהעיגול לא חורג מהאזור הבטוח
      y + circleSize > safeAreaBottom ||
      // בדיקה שהעיגול לא נמצא באזור הכפתור
      y + circleSize > height - buttonAreaHeight ||
      // בדיקות נוספות למניעת חפיפה
      x < padding ||
      x > width - circleSize - padding
    );

    return { x, y };
  }

  // טיימר המשחק
  useEffect(() => {
    let interval: NodeJS.Timeout | undefined;
    if (isActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((time) => time - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      // רק אם המשתמש עדיין במסך, הצג את המודל
      if (isFocused) {
      setShowRetryModal(true);
      }
      setIsActive(false);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [timeLeft, isActive, isFocused]);

  // טיפול בלחיצה על מספר
  const handleNumberPress = () => {
    if (!gameStarted) {
      setGameStarted(true);
    }

    // קודם נעדכן את המספר והמיקום
    setCurrentNumber(prev => prev + 1);
    setScore(prev => prev + 1);
    setPosition(getRandomPosition());
    
    // אז נפעיל את האנימציה
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    fadeAnim.setValue(0); // מיד נעלים
    
    // אנימציית הופעה מחדש
    Animated.spring(fadeAnim, {
      toValue: 1,
      useNativeDriver: true,
      friction: 7,
      tension: 50,
    }).start();
  };

  // התחלת משחק חדש
  const startNewGame = () => {
    setCurrentNumber(1);
    setScore(0);
    setTimeLeft(GAME_DURATION);
    setGameStarted(false);
    setGameEnded(false);
    setPosition(getRandomPosition());
  };

  const handleRetry = (retry: boolean) => {
    if (retry) {
      setTimeLeft(30);
      setCurrentNumber(1);
      setScore(0);
      setIsActive(true);
      setPosition(getRandomPosition());
    } else {
      router.push('/(tabs)/games');
    }
    setShowRetryModal(false);
  };

  return (
    <View style={styles.container}>
      {showWelcome ? (
        <View style={styles.welcomeOverlay}>
          <View style={styles.welcomeCard}>
            <Text style={styles.welcomeTitle}>{t('welcomeToFocusTimer')}</Text>
            <Text style={styles.welcomeDescription}>{t('focusTimerInstructions')}</Text>

            <Pressable 
              style={styles.startButton}
              onPress={() => setShowWelcome(false)}
            >
              <Text style={styles.startButtonText}>{t('start')}</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <>
          <View style={styles.header}>
            <Text style={styles.timer}>{t('time')}: {timeLeft}s</Text>
          </View>

          <Animated.View
            style={[
              styles.numberContainer,
              {
                left: position.x,
                top: position.y,
                opacity: fadeAnim,
                transform: [{
                  scale: fadeAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.5, 1],
                  }),
                }],
              },
            ]}
          >
            <Pressable onPress={handleNumberPress}>
              <Text style={styles.number}>{currentNumber}</Text>
            </Pressable>
          </Animated.View>

          <View style={styles.dividerLine} />

          <View style={styles.endButtonContainer}>
            <Pressable 
              style={styles.endButton}
              onPress={() => router.push('/(tabs)/games')}
            >
              <Text style={styles.endButtonText}>{t('endGame')}</Text>
            </Pressable>
          </View>
        </>
      )}
      <View style={{ position: 'absolute', bottom: 20, left: 0, right: 0, alignItems: 'center' }}>
        <AdBanner />
      </View>

      <Modal
        visible={showRetryModal}
        transparent={true}
        animationType="fade"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('tryBeatScore')}</Text>
            <View style={styles.buttonContainer}>
              <Pressable 
                style={[styles.button, styles.noButton]}
                onPress={() => handleRetry(false)}
              >
                <Text style={styles.buttonText}>{t('no')}</Text>
              </Pressable>
              <Pressable 
                style={[styles.button, styles.yesButton]}
                onPress={() => handleRetry(true)}
              >
                <Text style={styles.buttonText}>{t('yes')}</Text>
              </Pressable>
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
  },
  header: {
    width: '100%',
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
  },
  timer: {
    fontSize: 24,
    fontWeight: '600',
    color: '#334155',
  },
  numberContainer: {
    position: 'absolute',
    width: 80,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#60A5FA',
    borderRadius: 40,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  number: {
    fontSize: 32,
    fontWeight: 'bold',
    color: 'white',
  },
  endGameContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  endGameText: {
    fontSize: 24,
    fontWeight: '600',
    color: '#334155',
    textAlign: 'center',
    marginBottom: 30,
  },
  playAgainButton: {
    backgroundColor: '#60A5FA',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  playAgainText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  endButtonContainer: {
    position: 'absolute',
    bottom: 80,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  endButton: {
    backgroundColor: '#60A5FA',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  endButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  dividerLine: {
    position: 'absolute',
    bottom: 140,
    width: '100%',
    height: 4,
    backgroundColor: '#CBD5E1',
  },
  welcomeOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    zIndex: 9999,
  },
  welcomeCard: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 24,
    width: '90%',
    maxWidth: 400,
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
  welcomeTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#334155',
    marginBottom: 16,
    textAlign: 'center',
  },
  welcomeDescription: {
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  startButton: {
    backgroundColor: '#60A5FA',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
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
    fontSize: 18,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    width: '80%',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#334155',
    marginBottom: 24,
    textAlign: 'center',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 16,
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 8,
    minWidth: 100,
    alignItems: 'center',
  },
  noButton: {
    backgroundColor: '#EF4444',
  },
  yesButton: {
    backgroundColor: '#60A5FA',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
