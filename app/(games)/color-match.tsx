import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useLanguage } from '@/lib/LanguageContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AdBanner from '@/components/AdBanner';

const COLORS = ['#FF6B6B', '#60A5FA', '#45B7D1', '#96CEB4', '#FFEEAD', '#D4A5A5'];
const FEEDBACK_DURATION = 1000;
const COLOR_CHANGE_INTERVAL = 5000;

export default function ColorMatchScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  
  const getRandomColor = useCallback(() => {
    const randomIndex = Math.floor(Math.random() * COLORS.length);
    return COLORS[randomIndex];
  }, []);

  const [targetColor, setTargetColor] = useState(COLORS[0]);
  const [feedback, setFeedback] = useState('');
  const [score, setScore] = useState(0);
  const [gameEnded, setGameEnded] = useState(false);
  const [message, setMessage] = useState('');
  const [currentColor, setCurrentColor] = useState(getRandomColor());
  const [isClickable, setIsClickable] = useState(true);
  const [showWelcome, setShowWelcome] = useState(true);

  useEffect(() => {
    setTargetColor(getRandomColor());
    const interval = setInterval(() => {
      setTargetColor(getRandomColor());
    }, COLOR_CHANGE_INTERVAL);

    return () => clearInterval(interval);
  }, [getRandomColor]);

  const handleColorPress = (selectedColor: string) => {
    if (!isClickable) return;
    
    setIsClickable(false);
    
    if (selectedColor === targetColor) {
      setScore(prev => prev + 1);
      setMessage('Correct!');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } else {
      setMessage('Try again');
    }

    setTimeout(() => {
      setMessage('');
    }, 1000);

    setTimeout(() => {
      const newColor = getRandomColor();
      setTargetColor(newColor);
      setIsClickable(true);
    }, 1000);
  };

  const handleEndGame = async () => {
    await updateGameStats(score);
    router.push('/(tabs)/games');
  };

  const updateGameStats = async (score: number) => {
    try {
      // עדכון מספר המשחקים
      const currentPlays = await AsyncStorage.getItem('colorMatchPlays');
      const newPlays = currentPlays ? parseInt(currentPlays) + 1 : 1;
      await AsyncStorage.setItem('colorMatchPlays', newPlays.toString());
      
      // עדכון שיא
      const currentHighScore = await AsyncStorage.getItem('colorMatchHighScore');
      const highScore = currentHighScore ? parseInt(currentHighScore) : 0;
      if (score > highScore) {
        await AsyncStorage.setItem('colorMatchHighScore', score.toString());
      }
      
      // עדכון המשחק האחרון ששוחק
      await AsyncStorage.setItem('lastGamePlayed', 'colorMatch');
      await AsyncStorage.setItem('lastGamePlayedDate', new Date().toISOString());
    } catch (error) {
      console.error('Error updating game stats:', error);
    }
  };

  return (
    <View style={styles.container}>
      {showWelcome ? (
        <View style={styles.welcomeOverlay}>
          <View style={styles.welcomeCard}>
            <Text style={styles.welcomeTitle}>{t('welcomeToColorMatch')}</Text>
            <Text style={styles.welcomeDescription}>{t('colorMatchInstructions')}</Text>

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
            <Text style={styles.score}>{t('score')}: {score}</Text>
          </View>
          <View style={[styles.colorBox, { backgroundColor: targetColor }]} />
          <View style={styles.colorsContainer}>
            {COLORS.map((color) => (
              <Pressable
                key={color}
                style={[
                  styles.colorButton,
                  { backgroundColor: color },
                  !isClickable && styles.disabledButton
                ]}
                onPress={() => handleColorPress(color)}
                disabled={!isClickable}
              />
            ))}
          </View>

          {message && <Text style={styles.feedback}>{message === 'Correct!' ? t('correct') : t('tryAgain')}</Text>}

          <View style={styles.endButtonContainer}>
            <Pressable 
              style={styles.endButton}
              onPress={handleEndGame}
            >
              <Text style={styles.endButtonText}>{t('endGame')}</Text>
            </Pressable>
          </View>
        </>
      )}
      <View style={{ position: 'absolute', bottom: 20, left: 0, right: 0, alignItems: 'center' }}>
        <AdBanner />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    padding: 20,
    paddingTop: 40,
  },
  header: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 10,
    marginTop: 20,
  },
  score: {
    fontSize: 24,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 10,
  },
  colorBox: {
    width: 150,
    height: 150,
    marginTop: 0,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  colorsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 20,
    marginTop: 30,
    paddingHorizontal: 20,
  },
  colorButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  feedback: {
    fontSize: 24,
    fontWeight: '600',
    color: '#334155',
    marginTop: 20,
    textAlign: 'center',
    minHeight: 36,
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
  disabledButton: {
    opacity: 0.7,
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
});
