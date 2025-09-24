import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Pressable,
  Animated,
  SafeAreaView,
  Image,
  ImageBackground,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { OnboardingImages } from '@/constants/Images';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface BenefitsBreathingStageProps {
  onNext: () => void;
  onBack?: () => void;
}

export default function BenefitsBreathingStage({ onNext, onBack }: BenefitsBreathingStageProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const slideAnim = new Animated.Value(0);
  const fadeAnim = new Animated.Value(0);
  const scaleAnim = new Animated.Value(0.8);
  const message1Anim = new Animated.Value(0);
  const message2Anim = new Animated.Value(0);

  useEffect(() => {
    if (imageLoaded) {
      // Animate slide in
      slideAnim.setValue(screenWidth);
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }).start();

      // Animate content fade in
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
      ]).start(() => {
        // Start continuous breathing animation
        setTimeout(() => {
          startBreathingAnimation();
        }, 1000);
      });
    }
  }, [imageLoaded]);

  const startBreathingAnimation = () => {
    // Continuous breathing cycle
    const breathingCycle = Animated.loop(
      Animated.sequence([
        // Inhale - expand
        Animated.timing(scaleAnim, {
          toValue: 1.1,
          duration: 4000, // 4 seconds inhale
          useNativeDriver: true,
        }),
        // Hold
        Animated.timing(scaleAnim, {
          toValue: 1.1,
          duration: 7000, // 7 seconds hold
          useNativeDriver: true,
        }),
        // Exhale - contract
        Animated.timing(scaleAnim, {
          toValue: 0.9,
          duration: 8000, // 8 seconds exhale
          useNativeDriver: true,
        }),
      ])
    );
    breathingCycle.start();
  };



  return (
    <ImageBackground
      source={OnboardingImages.breathingBackground}
      style={styles.container}
      resizeMode="cover"
      fadeDuration={0}
      onLoad={() => {
        console.log('✅ Breathing background image loaded');
        setImageLoaded(true);
      }}
      onError={(error) => {
        console.error('❌ Breathing background image error:', error);
        setImageLoaded(true); // Continue anyway
      }}
    >
      {/* Overlay */}
      <View style={styles.overlay} />
      
      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View style={styles.progressSegments}>
            <View style={[styles.progressSegment, styles.progressSegmentActive]} />
            <View style={styles.progressDivider} />
            <View style={[styles.progressSegment, styles.progressSegmentActive]} />
            <View style={styles.progressDivider} />
            <View style={styles.progressSegment} />
            <View style={styles.progressDivider} />
            <View style={styles.progressSegment} />
            <View style={styles.progressDivider} />
            <View style={styles.progressSegment} />
          </View>
        </View>
        <Text allowFontScaling={false} maxFontSizeMultiplier={1} style={styles.progressText}>2 of 5</Text>
      </View>

      <SafeAreaView style={styles.safeArea}>
        <Animated.View 
          style={[
            styles.content,
            {
              opacity: imageLoaded ? fadeAnim : 0,
              transform: [{ translateY: slideAnim }]
            }
          ]}
        >



          {/* Main Title */}
          <View style={styles.titleContainer}>
            <Text allowFontScaling={false} maxFontSizeMultiplier={1} style={styles.mainTitle}>Mindful</Text>
            <Text allowFontScaling={false} maxFontSizeMultiplier={1} style={styles.mainTitleBold}>Breathing</Text>
          </View>

          {/* Breathing Visualization */}
          <View style={styles.breathingVisualization}>
            {/* Main Breathing Circle */}
            <Animated.View 
              style={[
                styles.mainBreathingCircle,
                {
                  transform: [{ scale: scaleAnim }]
                }
              ]}
            >
              <Animated.Text allowFontScaling={false} maxFontSizeMultiplier={1}
                style={[
                  styles.breathingInstruction,
                  { opacity: fadeAnim }
                ]}
              >
                Breathe
              </Animated.Text>
            </Animated.View>
            

            
            {/* Breathing Stats */}
            <View style={styles.breathingStats}>
              <View style={styles.statItem}>
                <Text allowFontScaling={false} maxFontSizeMultiplier={1} style={styles.statNumber}>4</Text>
                <Text allowFontScaling={false} maxFontSizeMultiplier={1} style={styles.statLabel}>Inhale</Text>
              </View>
              <View style={styles.statItem}>
                <Text allowFontScaling={false} maxFontSizeMultiplier={1} style={styles.statNumber}>7</Text>
                <Text allowFontScaling={false} maxFontSizeMultiplier={1} style={styles.statLabel}>Hold</Text>
              </View>
              <View style={styles.statItem}>
                <Text allowFontScaling={false} maxFontSizeMultiplier={1} style={styles.statNumber}>8</Text>
                <Text allowFontScaling={false} maxFontSizeMultiplier={1} style={styles.statLabel}>Exhale</Text>
              </View>
            </View>
          </View>



          {/* Action Section */}
          <View style={styles.actionContainer}>
            <Pressable style={styles.letsGoButton} onPress={() => { onNext(); }}>
              <Text allowFontScaling={false} maxFontSizeMultiplier={1} style={styles.letsGoText}>Continue</Text>
            </Pressable>
          </View>
        </Animated.View>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF', // White background
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  backButton: {
    position: 'absolute',
    top: 60,
    left: 20,
    zIndex: 10,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  overlay: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.1)', // הרבה יותר שקוף
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: screenHeight * 0.05, // 5% מהגובה
    justifyContent: 'space-between',
  },

  titleContainer: {
    alignItems: 'center',
    marginTop: screenHeight * 0.05, // 5% מהגובה
  },
  mainTitle: {
    fontSize: 32,
    fontWeight: '400',
    color: 'white',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.7)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 3,
  },
  mainTitleBold: {
    fontSize: 40,
    fontWeight: '800',
    color: 'white',
    textAlign: 'center',
    marginTop: 4,
    textShadowColor: 'rgba(0, 0, 0, 0.7)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 3,
  },



  actionContainer: {
    marginBottom: Platform.OS === 'ios' ? screenHeight * 0.06 : screenHeight * 0.08, // iOS: 12%, Android: 8%
  },
  letsGoButton: {
    backgroundColor: '#60A5FA',
    borderRadius: 25,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  letsGoText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '700',
  },
  breathingVisualization: {
    alignItems: 'center',
    marginTop: screenHeight * 0.21, // 10% מהגובה
  },
  mainBreathingCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'transparent',
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 30,
    shadowColor: 'transparent',
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  breathingInstruction: {
    fontSize: 18,
    color: 'white',
    fontWeight: '600',
  },

  breathingStats: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 20,
  },
  statItem: {
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 6,
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    shadowColor: 'transparent',
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
    width: 85,
    height: 85,
    justifyContent: 'center',
  },
  statNumber: {
    fontSize: 32,
    color: 'white',
    fontWeight: '800',
  },
  statLabel: {
    fontSize: 12,
    color: 'white',
    fontWeight: '500',
    opacity: 0.9,
    marginTop: 4,
  },

  progressContainer: {
    position: 'absolute',
    top: Platform.OS === 'android' ? screenHeight * 0.05 : screenHeight * 0.08, // Android: 5%, iOS: 8%
    left: 20,
    right: 20,
    zIndex: 1000,
  },
  progressBar: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
    marginBottom: 8,
  },
  progressSegments: {
    flexDirection: 'row',
    alignItems: 'center',
    height: '100%',
  },
  progressSegment: {
    flex: 1,
    height: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
  },
  progressSegmentActive: {
    backgroundColor: '#60A5FA',
  },
  progressDivider: {
    width: 2,
    height: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    marginHorizontal: 1,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#60A5FA',
    borderRadius: 2,
  },
  progressText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },

}); 