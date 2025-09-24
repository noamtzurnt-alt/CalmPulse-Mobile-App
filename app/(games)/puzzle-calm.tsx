import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, Animated, Pressable, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useLanguage } from '@/lib/LanguageContext';
import AdBanner from '@/components/AdBanner';

interface Bubble {
  id: number;
  x: number;
  y: number;
  color: string;
  points: number;
  scale: Animated.Value;
  opacity: Animated.Value;
}

interface PointAnimation {
  id: number;
  x: number;
  y: number;
  points: number;
  opacity: Animated.Value;
  translateY: Animated.Value;
}

const BUBBLE_TYPES = [
  { color: '#60A5FA', points: 1 },  // כחול
  { color: '#A78BFA', points: 2 },  // סגול
  { color: '#F87171', points: -1 }, // אדום
];

const { width, height } = Dimensions.get('window');

export default function BubblePopScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [score, setScore] = useState(0);
  const [gameEnded, setGameEnded] = useState(false);
  const [spawnInterval, setSpawnInterval] = useState(2000);
  const bubbleCount = useRef(0);
  const [hasBubbleOnScreen, setHasBubbleOnScreen] = useState(false);
  const [showStageTwo, setShowStageTwo] = useState(false);
  const [stageTwoPaused, setStageTwoPaused] = useState(false);
  const prevScore = useRef(0);
  const [gameWon, setGameWon] = useState(false);
  const [usedMessages, setUsedMessages] = useState<string[]>([]);
  const [currentMessage, setCurrentMessage] = useState<string>('');
  const [showMessage, setShowMessage] = useState(false);
  const prevScoreRef = useRef(0);
  const [pointAnimations, setPointAnimations] = useState<PointAnimation[]>([]);
  const [showWelcome, setShowWelcome] = useState(true);

  // פונקציה לבדיקת התנגשות בין בועות
  const checkBubbleCollision = (x1: number, y1: number, existingBubbles: Bubble[]) => {
    const bubbleSize = 70; // גודל הבועה + מרווח ביטחון
    
    for (const bubble of existingBubbles) {
      const distance = Math.sqrt(
        Math.pow(x1 - bubble.x, 2) + 
        Math.pow(y1 - bubble.y, 2)
      );
      
      if (distance < bubbleSize) {
        return true; // יש התנגשות
      }
    }
    return false; // אין התנגשות
  };

  // פונקציה ליצירת מיקום חדש לבועה
  const getValidBubblePosition = (existingBubbles: Bubble[]) => {
    const padding = 30;
    const bubbleSize = 60;
    const safeAreaBottom = height - 140; // גובה הקו מהתחתית
    
    let x, y;
    let attempts = 0;
    const maxAttempts = 50;

    do {
      x = Math.random() * (width - bubbleSize - padding * 2) + padding;
      // מגביל את ה-y להיות מעל הקו עם מרווח ביטחון
      y = Math.random() * (safeAreaBottom - bubbleSize - padding - 100) + padding;
      attempts++;
      
      if (attempts > maxAttempts) {
        return null;
      }
    } while (
      checkBubbleCollision(x, y, existingBubbles) || 
      y + bubbleSize > safeAreaBottom || // וידוא שכל הבועה (כולל הגודל שלה) תהיה מעל הקו
      x < padding ||
      x > width - bubbleSize - padding
    );

    return { x, y };
  };

  // פונקציה ליצירת אנימציית נקודות
  const createPointAnimation = (x: number, y: number, points: number) => {
    const id = Math.random();
    const animation: PointAnimation = {
      id,
      x,
      y,
      points,
      opacity: new Animated.Value(1),
      translateY: new Animated.Value(0)
    };

    setPointAnimations(prev => [...prev, animation]);

    Animated.parallel([
      Animated.timing(animation.opacity, {
        toValue: 0,
        duration: 1000,
        useNativeDriver: true
      }),
      Animated.timing(animation.translateY, {
        toValue: -50,
        duration: 1000,
        useNativeDriver: true
      })
    ]).start(() => {
      setPointAnimations(prev => prev.filter(a => a.id !== id));
    });
  };

  // נעדכן את אפקט יצירת הבועות
  useEffect(() => {
    if (!gameEnded) {
      const createBubble = () => {
        const random = Math.random();
        let bubbleType;
        if (random < 0.5) {
          bubbleType = { color: '#60A5FA', points: 1 };
        } else if (random < 0.7) {
          bubbleType = { color: '#A78BFA', points: 2 };
        } else {
          bubbleType = { color: '#F87171', points: -1 };
        }

        return bubbleType;
      };

      const interval = setInterval(() => {
        if (hasBubbleOnScreen) return;

        // Always start with 3 bubbles per wave; cap at 4 max
        const bubblesCount = Math.min(Math.floor(score / 10) + 3, 4);
        const bubbleLifetime = Math.max(1700 - (score * 55), 800);
        
        // מערך זמני לשמירת הבועות החדשות
        const newBubbles: Bubble[] = [];

        for (let i = 0; i < bubblesCount; i++) {
          const bubbleType = createBubble();
          const position = getValidBubblePosition([...bubbles, ...newBubbles]);
          
          if (position) {
            const newBubble: Bubble = {
              id: bubbleCount.current++,
              x: position.x,
              y: position.y,
              color: bubbleType.color,
              points: bubbleType.points,
              scale: new Animated.Value(0),
              opacity: new Animated.Value(1)
            };

            newBubbles.push(newBubble);
            
            Animated.spring(newBubble.scale, {
              toValue: 1,
              useNativeDriver: true,
              friction: 7,
              tension: 40
            }).start();
          }
        }

        if (newBubbles.length > 0) {
          setBubbles(prev => {
            const updatedBubbles = [...prev, ...newBubbles];
            setHasBubbleOnScreen(true);
            return updatedBubbles;
          });

          // הגדרת טיימר להעלמת הבועות
          newBubbles.forEach(bubble => {
            setTimeout(() => {
              setBubbles(prev => {
                const newBubbles = prev.filter(b => b.id !== bubble.id);
                if (newBubbles.length === 0) {
                  setHasBubbleOnScreen(false);
                }
                return newBubbles;
              });
            }, bubbleLifetime);
          });
        }
      }, 500);

      return () => clearInterval(interval);
    }
  }, [gameEnded, score, width, height, hasBubbleOnScreen, bubbles]);

  // התאמת קושי
  useEffect(() => {
    if (score > 0 && score % 10 === 0) {
      setSpawnInterval(prev => Math.max(prev * 0.9, 500));
    }
  }, [score]);

  // נעדכן את פונקציית הפיצוץ
  const popBubble = (bubble: Bubble) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    // יצירת אנימציית נקודות במיקום הבועה
    createPointAnimation(bubble.x, bubble.y, bubble.points);

    Animated.parallel([
      Animated.timing(bubble.scale, {
        toValue: 1.2,
        duration: 150,
        useNativeDriver: true
      }),
      Animated.timing(bubble.opacity, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true
      })
    ]).start(() => {
      setBubbles(prev => {
        const newBubbles = prev.filter(b => b.id !== bubble.id);
        if (newBubbles.length === 0) {
          setHasBubbleOnScreen(false);
        }
        return newBubbles;
      });
      setScore(prev => Math.max(0, prev + bubble.points));
    });
  };

  // פונקציה לבחירת הודעה רנדומלית שעוד לא הייתה בשימוש
  const getRandomMessage = () => {
    const availableMessages = t('encouragementMessages') as string[];
    if (availableMessages.length === 0) {
      setUsedMessages([]); // אם השתמשנו בכל ההודעות, נאפס את הרשימה
      return availableMessages[
        Math.floor(Math.random() * availableMessages.length)
      ];
    }
    return availableMessages[
      Math.floor(Math.random() * availableMessages.length)
    ];
  };

  // בדיקת שינוי בניקוד והצגת הודעה
  useEffect(() => {
    const currentTen = Math.floor(score / 10);
    const prevTen = Math.floor(prevScoreRef.current / 10);
    
    if (currentTen > prevTen) {
      const newMessage = getRandomMessage();
      setCurrentMessage(newMessage);
      setUsedMessages(prev => [...prev, newMessage]);
      setShowMessage(true);
      
      // הסתרת ההודעה אחרי שתי שניות במקום שנייה אחת
      setTimeout(() => {
        setShowMessage(false);
      }, 2000);
    }
    
    prevScoreRef.current = score;
  }, [score]);

  return (
    <View style={styles.container}>
      {showWelcome ? (
        <View style={styles.welcomeOverlay}>
          <View style={styles.welcomeCard}>
            <Text style={styles.welcomeTitle}>{t('welcomeToBubbleDash')}</Text>
            <Text style={styles.welcomeDescription}>{t('bubbleDashInstructions')}</Text>
            
            <View style={styles.pointsGuide}>
              <View style={styles.pointRow}>
                <View style={[styles.bubbleExample, { backgroundColor: '#F87171' }]} />
                <Text style={styles.pointText}>-1 {t('point')}</Text>
              </View>
              <View style={styles.pointRow}>
                <View style={[styles.bubbleExample, { backgroundColor: '#60A5FA' }]} />
                <Text style={styles.pointText}>+1 {t('point')}</Text>
              </View>
              <View style={styles.pointRow}>
                <View style={[styles.bubbleExample, { backgroundColor: '#A78BFA' }]} />
                <Text style={styles.pointText}>+2 {t('points')}</Text>
              </View>
            </View>

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
            {showMessage && (
              <Animated.Text style={styles.encouragementMessage}>
                {currentMessage}
              </Animated.Text>
            )}
          </View>

          {showStageTwo && (
            <View style={styles.stageOverlay}>
              <Text style={styles.stageText}>Stage 2</Text>
            </View>
          )}

          {!gameEnded && !showStageTwo && (
            bubbles.map(bubble => (
              <Animated.View
                key={bubble.id}
                style={[
                  styles.bubble,
                  {
                    left: bubble.x,
                    top: bubble.y,
                    backgroundColor: bubble.color,
                    transform: [{ scale: bubble.scale }],
                    opacity: bubble.opacity,
                  },
                ]}
              >
                <Pressable
                  style={styles.bubblePress}
                  onPress={() => popBubble(bubble)}
                />
              </Animated.View>
            ))
          )}

          {gameWon && (
            <View style={styles.winOverlay}>
              <Text style={styles.winText}>{t('thatWasImpressive')}</Text>
              <Text style={[styles.winText, { marginBottom: 30 }]}>{t('keepGoing')}</Text>
              <Pressable 
                style={styles.playAgainButton}
                onPress={() => {
                  setScore(0);
                  setGameEnded(false);
                  setGameWon(false);
                  setBubbles([]);
                  setHasBubbleOnScreen(false);
                }}
              >
                <Text style={styles.playAgainText}>{t('playAgain')}</Text>
              </Pressable>
            </View>
          )}

          <View style={styles.dividerLine} />

          <View style={styles.endButtonContainer}>
            <Pressable 
              style={styles.endButton}
              onPress={() => router.push('/(tabs)/games')}
            >
              <Text style={styles.endButtonText}>{t('endGame')}</Text>
            </Pressable>
          </View>

          {/* אנימציות הנקודות */}
          {pointAnimations.map(animation => (
            <Animated.Text
              key={animation.id}
              style={[
                styles.pointAnimation,
                {
                  left: animation.x + 15,
                  top: animation.y - 20,
                  opacity: animation.opacity,
                  transform: [{ translateY: animation.translateY }],
                  color: animation.points === 2 ? '#A78BFA' :  // סגול
                        animation.points === 1 ? '#60A5FA' :   // כחול
                                               '#F87171'       // אדום
                }
              ]}
            >
              {animation.points > 0 ? `+${animation.points}` : animation.points}
            </Animated.Text>
          ))}
          <View style={{ position: 'absolute', bottom: 20, left: 0, right: 0, alignItems: 'center' }}>
            <AdBanner />
          </View>
        </>
      )}
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
    alignItems: 'center', // מרכוז
    paddingTop: 60,
    paddingBottom: 20,
  },
  score: {
    fontSize: 28, // גודל גדול יותר
    fontWeight: '600',
    color: '#334155',
  },
  bubble: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  bubblePress: {
    width: '100%',
    height: '100%',
  },
  endGameContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 100,
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
  dividerLine: {
    position: 'absolute',
    bottom: 140,
    width: '100%',
    height: 4,
    backgroundColor: '#CBD5E1',
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
  stageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  stageText: {
    color: 'white',
    fontSize: 48,
    fontWeight: 'bold',
  },
  winOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  winText: {
    color: 'white',
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
  },
  encouragementMessage: {
    fontSize: 24,
    fontWeight: '600',
    color: '#334155',
    textAlign: 'center',
    marginTop: 10,
    position: 'absolute',
    top: 100,
    width: '100%',
  },
  pointAnimation: {
    position: 'absolute',
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    zIndex: 1000,
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
  pointsGuide: {
    width: '100%',
    marginBottom: 24,
  },
  pointRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  bubbleExample: {
    width: 30,
    height: 30,
    borderRadius: 15,
    marginRight: 12,
  },
  pointText: {
    fontSize: 16,
    color: '#334155',
    fontWeight: '500',
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
