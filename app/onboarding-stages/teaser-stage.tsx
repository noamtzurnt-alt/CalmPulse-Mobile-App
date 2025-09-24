import React, { useState, useEffect } from 'react';
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
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { OnboardingImages } from '@/constants/Images';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface TeaserStageProps {
  onNext: () => void;
  onSkip?: () => void;
}

export default function TeaserStage({ onNext, onSkip }: TeaserStageProps) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [imageLoaded, setImageLoaded] = useState(false);
  const slideAnim = new Animated.Value(0);
  const fadeAnim = new Animated.Value(0);
  const pulseAnim = new Animated.Value(1);
  const floatAnim = new Animated.Value(0);

  useEffect(() => {
  }, []);

  const teaserQuestions = [
    "What are you running from – that you're not even willing to admit to yourself?",
    "What do you feel, but have never been able to say out loud?",
    "What would you say to the child you were – if you saw them crying right now?",
    "If your anxiety could speak, what would it tell you?"
  ];

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
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }).start();

      // Start pulse animation
      const pulseAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1500,
            useNativeDriver: true,
          }),
        ])
      );
      pulseAnimation.start();

      // Start float animation
      const floatAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(floatAnim, {
            toValue: 1,
            duration: 3000,
            useNativeDriver: true,
          }),
          Animated.timing(floatAnim, {
            toValue: 0,
            duration: 3000,
            useNativeDriver: true,
          }),
        ])
      );
      floatAnimation.start();
    }
  }, [imageLoaded]);

  const handleContinue = () => {
    onNext();
  };


    return (
    <ImageBackground
      source={OnboardingImages.teaserBackground}
      style={styles.container}
      resizeMode="cover"
      fadeDuration={0}
      onLoad={() => {
        console.log('✅ Teaser background image loaded');
        setImageLoaded(true);
      }}
      onError={(error) => {
        console.error('❌ Teaser background image error:', error);
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
            <View style={styles.progressSegment} />
            <View style={styles.progressDivider} />
            <View style={styles.progressSegment} />
            <View style={styles.progressDivider} />
            <View style={styles.progressSegment} />
            <View style={styles.progressDivider} />
            <View style={styles.progressSegment} />
          </View>
        </View>
        <Text allowFontScaling={false} maxFontSizeMultiplier={1} style={styles.progressText}>1 of 5</Text>
      </View>

      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
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
            <Text allowFontScaling={false} maxFontSizeMultiplier={1} style={styles.mainTitle}>Welcome to</Text>
            <Text allowFontScaling={false} maxFontSizeMultiplier={1} style={styles.mainTitleBold}>CalmPulse</Text>
            <Text allowFontScaling={false} maxFontSizeMultiplier={1} style={styles.subtitle}>
              Your personal AI companion for emotional wellness and mental clarity
            </Text>
          </View>

          {/* Features */}
          <View style={styles.featuresContainer}>
            <View style={styles.featureItem}>
              <Ionicons name="heart" size={24} color="#1e293b" />
              <Text allowFontScaling={false} maxFontSizeMultiplier={1} style={styles.featureText}>Emotional Intelligence</Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="person" size={24} color="#1e293b" />
              <Text allowFontScaling={false} maxFontSizeMultiplier={1} style={styles.featureText}>Personal for You</Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="sparkles" size={24} color="#1e293b" />
              <Text allowFontScaling={false} maxFontSizeMultiplier={1} style={styles.featureText}>AI-Powered Insights</Text>
            </View>
          </View>

          {/* Action Section */}
          <View style={styles.actionContainer}>
            <Pressable style={styles.letsGoButton} onPress={handleContinue}>
              <Text allowFontScaling={false} maxFontSizeMultiplier={1} style={styles.letsGoText}>Get Started</Text>
            </Pressable>
          </View>
        </Animated.View>
        </ScrollView>
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
  logoContainer: {
    alignItems: 'center',
    marginTop: 40,
  },
  logoText: {
    fontSize: 48,
    fontWeight: '300',
    color: 'white',
    letterSpacing: 2,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  logoSubtext: {
    fontSize: 24,
    fontWeight: '700',
    color: '#60A5FA',
    marginTop: -10,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  titleContainer: {
    alignItems: 'center',
    marginTop: screenHeight * 0.20, // 25% מהגובה
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
  subtitle: {
    fontSize: 18,
    color: 'white',
    textAlign: 'center',
    lineHeight: 26,
    marginTop: 20,
    opacity: 1,
    textShadowColor: 'rgba(0, 0, 0, 0.7)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 3,
    fontWeight: '500',
  },
  featuresContainer: {
    marginTop: screenHeight * 0.08, // 8% מהגובה
    alignItems: 'center',
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    backgroundColor: 'white',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    width: 280,
    justifyContent: 'flex-start',
  },
  featureText: {
    fontSize: 16,
    color: '#1e293b',
    fontWeight: '500',
    marginLeft: 12,
  },
  actionContainer: {
    marginBottom: screenHeight * 0.05, // 5% מהגובה
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