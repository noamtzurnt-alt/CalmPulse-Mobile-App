import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Pressable,
  Animated,
  SafeAreaView,
  ImageBackground,
  Image,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { OnboardingImages } from '@/constants/Images';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface VideoCreationStageProps {
  onNext: () => void;
  onBack?: () => void;
}

export default function VideoCreationStage({ onNext, onBack }: VideoCreationStageProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const slideAnim = new Animated.Value(0);
  const fadeAnim = new Animated.Value(0);
  const scaleAnim = new Animated.Value(0.8);

  useEffect(() => {
    if (imageLoaded) {
      // Animate slide in
      slideAnim.setValue(screenWidth);
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }).start();

      // Animate content fade in
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [imageLoaded]);



  return (
    <ImageBackground
      source={OnboardingImages.videoBackground}
      style={styles.container}
      resizeMode="cover"
      fadeDuration={0}
      onLoad={() => {
        console.log('✅ Video background image loaded');
        setImageLoaded(true);
      }}
      onError={(error) => {
        console.error('❌ Video background image error:', error);
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
            <View style={[styles.progressSegment, styles.progressSegmentActive]} />
            <View style={styles.progressDivider} />
            <View style={[styles.progressSegment, styles.progressSegmentActive]} />
            <View style={styles.progressDivider} />
            <View style={styles.progressSegment} />
          </View>
        </View>
        <Text allowFontScaling={false} maxFontSizeMultiplier={1} style={styles.progressText}>4 of 5</Text>
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
          

          {/* Main Title - Top */}
          <View style={styles.titleContainer}>
            <Text allowFontScaling={false} maxFontSizeMultiplier={1} style={styles.mainTitle}>Create</Text>
            <Text allowFontScaling={false} maxFontSizeMultiplier={1} style={styles.mainTitleBold}>Videos</Text>
          </View>

          {/* Video Creation Visualization */}
          <View style={styles.videoExample}>
            <View style={styles.videoCard}>
              <View style={styles.videoHeader}>
                <Ionicons name="play-circle" size={24} color="#60A5FA" />
                <Text allowFontScaling={false} maxFontSizeMultiplier={1} style={styles.videoTitle}>Your Story</Text>
              </View>
              <Text allowFontScaling={false} maxFontSizeMultiplier={1} style={styles.videoDescription}>
                Transform your photos into beautiful stories
              </Text>
              <View style={styles.featuresList}>
                <View style={styles.featureItem}>
                  <Ionicons name="images" size={16} color="#10B981" />
                  <Text allowFontScaling={false} maxFontSizeMultiplier={1} style={styles.featureText}>Photos & Videos</Text>
                </View>
                <View style={styles.featureItem}>
                  <Ionicons name="musical-notes" size={16} color="#EF4444" />
                  <Text allowFontScaling={false} maxFontSizeMultiplier={1} style={styles.featureText}>Music Selection</Text>
                </View>
                                 <View style={styles.featureItem}>
                   <Ionicons name="create" size={16} color="#F59E0B" />
                   <Text allowFontScaling={false} maxFontSizeMultiplier={1} style={styles.featureText}>Personal Edit</Text>
                 </View>
              </View>
            </View>
          </View>

          {/* Simple Benefits */}
          <View style={styles.benefitsContainer}>
            <View style={styles.benefitItem}>
              <Ionicons name="camera" size={24} color="white" />
              <Text allowFontScaling={false} maxFontSizeMultiplier={1} style={styles.benefitText}>Gallery</Text>
            </View>
            <View style={styles.benefitItem}>
              <Ionicons name="musical-note" size={24} color="white" />
              <Text allowFontScaling={false} maxFontSizeMultiplier={1} style={styles.benefitText}>Music</Text>
            </View>
            <View style={styles.benefitItem}>
              <Ionicons name="create" size={24} color="white" />
              <Text allowFontScaling={false} maxFontSizeMultiplier={1} style={styles.benefitText}>Edit</Text>
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
    backgroundColor: '#FFFFFF',
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
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: screenHeight * 0.05, // 5% מהגובה
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
  titleContainer: {
    alignItems: 'center',
    marginTop: screenHeight >= 3000 ? screenHeight * 0.12 : (Platform.OS === 'ios' ? screenHeight * 0 : screenHeight * 0.05), // S24 Ultra: 12%, iOS: 5%, Galaxy: 25%
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
  videoExample: {
    alignItems: 'center',
    marginTop: Platform.OS === 'android' ? screenHeight * 0.25 : screenHeight * 0.25, // Galaxy: 20%, iOS: 25%
    marginBottom: screenHeight * 0.03, // 3% מהגובה
  },
  videoCard: {
    width: 320,
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  videoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  videoTitle: {
    fontSize: 18,
    color: '#1e293b',
    fontWeight: '700',
    marginLeft: 8,
  },
  videoDescription: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
    marginBottom: 16,
  },
  featuresList: {
    gap: 8,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  featureText: {
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 8,
    color: '#64748b',
  },
  benefitsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginBottom: screenHeight >= 3000 ? screenHeight * 0.10 : (Platform.OS === 'ios' ? screenHeight * 0.05 : screenHeight * 0.05), // S24 Ultra: 10%, iOS: 5%, Galaxy S23: 5%
    paddingHorizontal: 20,
  },
  benefitItem: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    minWidth: 80,
  },
  benefitText: {
    fontSize: 14,
    color: 'white',
    fontWeight: '600',
    marginTop: 8,
    textAlign: 'center',
  },
  actionContainer: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? screenHeight * 0.02 : screenHeight * 0.05, // iOS: 8%, Android: 52
    left: 20,
    right: 20,
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