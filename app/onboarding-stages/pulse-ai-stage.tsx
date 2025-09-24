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
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { OnboardingImages } from '@/constants/Images';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface PulseAIStageProps {
  onNext: () => void;
  onBack?: () => void;
}

export default function PulseAIStage({ onNext, onBack }: PulseAIStageProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const slideAnim = new Animated.Value(0);
  const fadeAnim = new Animated.Value(0);
  const pulseAnim = new Animated.Value(1);
  const chatAnim1 = new Animated.Value(0);
  const chatAnim2 = new Animated.Value(0);
  const chatAnim3 = new Animated.Value(0);
  const titleAnim = new Animated.Value(0);
  const logoAnim = new Animated.Value(0);
  const buttonAnim = new Animated.Value(0);

  useEffect(() => {
    if (imageLoaded) {
      // Start all animations immediately
      slideAnim.setValue(0);
      fadeAnim.setValue(1);

      // Start title, logo and button animations immediately
      Animated.timing(titleAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }).start();

      Animated.timing(logoAnim, {
        toValue: 1,
        duration: 700,
        useNativeDriver: true,
      }).start();

      Animated.timing(buttonAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }).start();

      // Start pulse animation immediately
      const pulseAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: true,
          }),
        ])
      );
      pulseAnimation.start();

      // Start chat animations after a short delay
      setTimeout(() => {
        Animated.timing(chatAnim1, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }).start();
      }, 200);

      setTimeout(() => {
        Animated.timing(chatAnim2, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }).start();
      }, 500);

      setTimeout(() => {
        Animated.timing(chatAnim3, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }).start();
      }, 800);
    }
  }, [imageLoaded]);



  return (
    <ImageBackground
      source={OnboardingImages.pulseAIBackground}
      style={styles.container}
      resizeMode="cover"
      fadeDuration={0}
      onLoad={() => {
        console.log('✅ Pulse AI background image loaded');
        setImageLoaded(true);
      }}
      onError={(error) => {
        console.error('❌ Pulse AI background image error:', error);
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
            <View style={[styles.progressSegment, styles.progressSegmentActive]} />
          </View>
        </View>
        <Text allowFontScaling={false} maxFontSizeMultiplier={1} style={styles.progressText}>5 of 5</Text>
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
          

          {/* Main Title - Top */}
          <Animated.View 
            style={[
              styles.titleContainer,
              {
                opacity: titleAnim,
                transform: [{ translateY: titleAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-30, 0]
                })}]
              }
            ]}
          >
            <Text allowFontScaling={false} maxFontSizeMultiplier={1} style={styles.mainTitle}>Pulse</Text>
            <Text allowFontScaling={false} maxFontSizeMultiplier={1} style={styles.mainTitleBold}>AI</Text>
          </Animated.View>

          {/* AI Pulse Animation */}
          <Animated.View 
            style={[
              styles.pulseContainer,
              {
                opacity: logoAnim,
                transform: [{ translateY: logoAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [30, 0]
                })}]
              }
            ]}
          >
            <Animated.View 
              style={[
                styles.pulseCircle,
                {
                  transform: [{ scale: pulseAnim }]
                }
              ]}
            >
              <Image 
                source={OnboardingImages.pulseLogo}
                style={styles.pulseLogo}
                resizeMode="contain"
              />
            </Animated.View>
          </Animated.View>

          {/* AI Chat Example */}
          <View style={styles.chatExample}>
            <Animated.View 
              style={[
                styles.chatBubble,
                {
                  opacity: chatAnim1,
                  transform: [{ translateX: chatAnim1.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-50, 0]
                  })}]
                }
              ]}
            >
              <Ionicons name="sparkles" size={20} color="#60A5FA" />
              <Text allowFontScaling={false} maxFontSizeMultiplier={1} style={styles.chatText}>How are you feeling today?</Text>
            </Animated.View>
            <Animated.View 
              style={[
                styles.userBubble,
                {
                  opacity: chatAnim2,
                  transform: [{ translateX: chatAnim2.interpolate({
                    inputRange: [0, 1],
                    outputRange: [50, 0]
                  })}]
                }
              ]}
            >
              <Text allowFontScaling={false} maxFontSizeMultiplier={1} style={styles.userText}>I'm feeling a bit stressed...</Text>
              <Ionicons name="person" size={16} color="white" />
            </Animated.View>
            <Animated.View 
              style={[
                styles.chatBubble,
                {
                  opacity: chatAnim3,
                  transform: [{ translateX: chatAnim3.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-50, 0]
                  })}]
                }
              ]}
            >
              <Ionicons name="sparkles" size={20} color="#60A5FA" />
              <Text allowFontScaling={false} maxFontSizeMultiplier={1} style={styles.chatText}>Let's take a deep breath together</Text>
            </Animated.View>
          </View>




          {/* Action Section */}
          <Animated.View 
            style={[
              styles.actionContainer,
              {
                opacity: buttonAnim,
                transform: [{ translateY: buttonAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [30, 0]
                })}]
              }
            ]}
          >
            <Pressable style={styles.letsGoButton} onPress={() => { onNext(); }}>
              <Text allowFontScaling={false} maxFontSizeMultiplier={1} style={styles.letsGoText}>Continue</Text>
            </Pressable>
          </Animated.View>
        </Animated.View>
        </ScrollView>
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
    paddingTop: 40,
    justifyContent: 'space-between',
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
    marginTop: Platform.OS === 'android' ? screenHeight * 0.08 : 20, // Galaxy: 8%, iOS: 20px
  },
  mainTitle: {
    fontSize: 28,
    fontWeight: '300',
    color: 'white',
    textAlign: 'center',
  },
  mainTitleBold: {
    fontSize: 36,
    fontWeight: '700',
    color: 'white',
    textAlign: 'center',
    marginTop: 4,
  },
  aiExample: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 30,
  },
  aiCard: {
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
  aiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  aiTitle: {
    fontSize: 18,
    color: '#1e293b',
    fontWeight: '700',
    marginLeft: 8,
  },
  aiDescription: {
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
  pulseContainer: {
    alignItems: 'center',
    marginBottom: 20,
    marginTop: Platform.OS === 'android' ? screenHeight * 0.28 : 270 // Galaxy: 25%, iOS: 270px
  },
  pulseCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(96, 165, 250, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -20,
    shadowColor: '#60A5FA',
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  pulseLogo: {
    width: 180,
    height: 180,
  },
  benefitsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginBottom: 20,
    paddingHorizontal: 20,
    marginTop: 10,
  },
  benefitItem: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    width: 100,
    height: 80,
    justifyContent: 'center',
  },
  benefitText: {
    fontSize: 14,
    color: 'white',
    fontWeight: '600',
    marginTop: 8,
    textAlign: 'center',
  },
  actionContainer: {
    marginBottom: 50,
    marginTop: Platform.OS === 'android' ? 0 : 0,
  },
  chatExample: {
    alignItems: 'center',
    marginTop: Platform.OS === 'android' ? -0 : 10,
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  chatBubble: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 12,
    width: 320,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: Platform.OS === 'android' ? 'flex-start' : 'flex-start',
    marginLeft: Platform.OS === 'android' ? -20 : 0,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  chatText: {
    fontSize: 14,
    color: '#1e293b',
    fontWeight: '500',
    marginLeft: 8,
    flex: 1,
  },
  userBubble: {
    backgroundColor: '#60A5FA',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 12,
    width: 320,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: Platform.OS === 'android' ? 'flex-end' : 'flex-end',
    marginRight: Platform.OS === 'android' ? -18 : -7,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  userText: {
    fontSize: 14,
    color: 'white',
    fontWeight: '500',
    marginRight: 8,
    flex: 1,
    textAlign: 'right',
  },
  chatIcon: {
    width: 20,
    height: 20,
    marginRight: 8,
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