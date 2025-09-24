import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  Image,
  Text,
  Pressable,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';


interface AfterInfoStageProps {
  onComplete: () => void;
  onBack?: () => void;
}

export default function AfterInfoStage({ onComplete, onBack }: AfterInfoStageProps) {
  const [loadingProgress, setLoadingProgress] = useState(0);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotationAnim = useRef(new Animated.Value(0)).current;
  const circleColorAnim = useRef(new Animated.Value(0)).current;
  const [visibleSteps, setVisibleSteps] = useState<number[]>([]);
  const fadeAnim1 = useRef(new Animated.Value(0)).current;
  const fadeAnim2 = useRef(new Animated.Value(0)).current;
  const fadeAnim3 = useRef(new Animated.Value(0)).current;
  const colorAnim1 = useRef(new Animated.Value(0)).current;
  const colorAnim2 = useRef(new Animated.Value(0)).current;
  const colorAnim3 = useRef(new Animated.Value(0)).current;
  const [stepColors, setStepColors] = useState(['#9CA3AF', '#9CA3AF', '#9CA3AF']);
  const bottomAnim = useRef(new Animated.Value(0)).current;
  const [isComplete, setIsComplete] = useState(false);
  const borderWidthAnim = useRef(new Animated.Value(0)).current;

  const steps = [
    "Building emotional intelligence",
    "Optimizing your wellness path",
    "Finalizing your experience"
  ];

  useEffect(() => {
    // Start pulse animation with smoother timing
    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
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

    // Start rotation animation
    const rotationAnimation = Animated.loop(
      Animated.timing(rotationAnim, {
        toValue: 1,
        duration: 8000,
        useNativeDriver: false, // Changed to false for Android compatibility
      })
    );
    rotationAnimation.start();

    // Start border width animation for Android
    const borderWidthAnimation = Animated.loop(
      Animated.timing(borderWidthAnim, {
        toValue: 1,
        duration: 8000,
        useNativeDriver: false,
      })
    );
    borderWidthAnimation.start();

    // Start loading animation from 0 to 100 with 8 seconds duration
    const loadingAnimation = Animated.timing(progressAnim, {
      toValue: 1,
      duration: 8000, // 8 seconds
      useNativeDriver: false,
    });

    loadingAnimation.start(({ finished }) => {
      if (finished) {
        // When loading reaches 100%, animate the circle to full blue
        Animated.timing(circleColorAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: false,
        }).start(() => {
          // When circle is fully blue, show completion state
          setIsComplete(true);
        });
      }
    });

    // Start bottom animation after 1 second
    setTimeout(() => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(bottomAnim, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.timing(bottomAnim, {
            toValue: 0,
            duration: 2000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    }, 1000);

    // Update progress state with smoother updates
    const progressListener = progressAnim.addListener(({ value }) => {
      const progress = Math.round(value * 100);
      setLoadingProgress(progress);
    });

    // Show sentences at fixed times
    setTimeout(() => {
      setVisibleSteps([0]);
      showFadeAnimation(fadeAnim1);
      // Change color to blue after 1 second
      setTimeout(() => {
        Animated.timing(colorAnim1, {
          toValue: 1,
          duration: 500,
          useNativeDriver: false,
        }).start();
        setStepColors(prev => [prev[0] === '#9CA3AF' ? '#60A5FA' : prev[0], prev[1], prev[2]]);
      }, 1000);
    }, 1000);

    setTimeout(() => {
      setVisibleSteps([0, 1]);
      showFadeAnimation(fadeAnim2);
      // Change color to blue after 1 second
      setTimeout(() => {
        Animated.timing(colorAnim2, {
          toValue: 1,
          duration: 500,
          useNativeDriver: false,
        }).start();
        setStepColors(prev => [prev[0], prev[1] === '#9CA3AF' ? '#60A5FA' : prev[1], prev[2]]);
      }, 1000);
    }, 3000);

    setTimeout(() => {
      setVisibleSteps([0, 1, 2]);
      showFadeAnimation(fadeAnim3);
      // Change color to blue after 1 second
      setTimeout(() => {
        Animated.timing(colorAnim3, {
          toValue: 1,
          duration: 500,
          useNativeDriver: false,
        }).start();
        setStepColors(prev => [prev[0], prev[1], prev[2] === '#9CA3AF' ? '#60A5FA' : prev[2]]);
      }, 1000);
    }, 5000);

    return () => {
      progressAnim.removeListener(progressListener);
    };
  }, []);

  const showFadeAnimation = (fadeAnim: Animated.Value) => {
    // Reset fade animation
    fadeAnim.setValue(0);
    
    // Fade in animation
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();
  };

  const rotation = rotationAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const borderWidth = borderWidthAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 6],
  });

  const circleBorderColor = circleColorAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['#E5E7EB', '#60A5FA'],
  });

  const bottomScale = bottomAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.1],
  });

  const bottomOpacity = bottomAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.7, 1],
  });

  return (
    <View style={styles.container}>
      <View style={styles.logoContainer}>
        {/* Loading Text - Above Circle */}
        <View style={styles.loadingTextContainer}>
          <Animated.Text allowFontScaling={false} maxFontSizeMultiplier={1} style={styles.loadingText}>
            {loadingProgress}%
          </Animated.Text>
        </View>

        {/* Loading Circle */}
        <View style={styles.circleContainer}>
          {/* Background Circle */}
          <Animated.View 
            style={[
              styles.progressCircle,
              {
                borderColor: circleBorderColor,
              },
            ]}
          />
          
          {/* Beautiful Progress Circle */}
          <Animated.View
            style={[
              styles.progressFill,
              {
                transform: [{ rotate: rotation }],
                backgroundColor: Platform.OS === 'android' ? 'rgba(96, 165, 250, 0.1)' : 'transparent',
                borderTopWidth: Platform.OS === 'android' ? borderWidth : 0,
              },
            ]}
          />
          
          {/* Pulse Logo */}
          <Animated.View
            style={[
              styles.pulseContainer,
              {
                transform: [{ scale: pulseAnim }],
              },
            ]}
          >
            <Image
              source={require('@/assets/images/adaptive-icon.png')}
              style={styles.pulseLogo}
              resizeMode="contain"
              onLoad={() => {
                console.log('✅ Pulse logo loaded in afterinfo');
              }}
              onError={(error) => {
                console.error('❌ Pulse logo error in afterinfo:', error);
              }}
            />
          </Animated.View>
        </View>

        {/* Title */}
        <View style={styles.titleContainer}>
          <Text allowFontScaling={false} maxFontSizeMultiplier={1} style={styles.titleText}>
            Personalizing your plan...
          </Text>
        </View>

        {/* Steps List */}
        <View style={styles.stepsContainer}>
          {steps.map((step, index) => (
            visibleSteps.includes(index) && (
              <Animated.View 
                key={index}
                style={[
                  styles.stepItem,
                  {
                    opacity: index === 0 ? fadeAnim1 : 
                             index === 1 ? fadeAnim2 : fadeAnim3,
                  },
                ]}
              >
                <Animated.View>
                  <Ionicons 
                    name="checkmark-circle" 
                    size={24} 
                    color={stepColors[index]}
                  />
                </Animated.View>
                <Animated.Text allowFontScaling={false} maxFontSizeMultiplier={1} style={[
                  styles.stepText,
                  {
                    color: stepColors[index],
                  },
                ]}>
                  {step}
                </Animated.Text>
              </Animated.View>
            )
          ))}
        </View>

        {/* Bottom Eye-catching Element */}
        <View style={styles.bottomContainer}>
          <Animated.View 
            style={[
              styles.bottomElement,
              {
                transform: [{ scale: bottomScale }],
                opacity: bottomOpacity,
              },
            ]}
          >
            <View style={styles.bottomGradient}>
              <Ionicons name="sparkles" size={24} color="#FFD700" />
              <Text allowFontScaling={false} maxFontSizeMultiplier={1} style={styles.bottomText}>
                {isComplete ? "Analysis Completed" : "AI Processing"}
              </Text>
              <Ionicons name="sparkles" size={24} color="#FFD700" />
            </View>
          </Animated.View>
          
          {isComplete && (
            <View style={styles.buttonContainer}>
              <Pressable style={styles.getPlanButton} onPress={() => { onComplete(); }}>
                <Text allowFontScaling={false} maxFontSizeMultiplier={1} style={styles.buttonText}>Get My Plan</Text>
              </Pressable>
            </View>
          )}
        </View>
      </View>
    </View>
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
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 40,
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    flex: 0.8,
    paddingTop: 20,
  },
  circleContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 0,
    overflow: 'hidden',
  },
  progressCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: '#E5E7EB',
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressFill: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 6,
    borderColor: '#60A5FA',
    borderTopWidth: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    // Fix for Android animation visibility
    elevation: Platform.OS === 'android' ? 5 : 0,
    zIndex: Platform.OS === 'android' ? 1 : 0,
    backgroundColor: 'transparent',
    shadowColor: '#60A5FA',
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  pulseContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseLogo: {
    width: 220,
    height: 220,
  },
  loadingTextContainer: {
    alignItems: 'center',
    marginBottom: 15,
    marginLeft: 15,
    marginTop: 5,
  },
  loadingText: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1F2937',
    textShadowColor: 'rgba(0, 0, 0, 0.1)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  titleContainer: {
    marginTop: 20,
    alignItems: 'center',
    backgroundColor: 'rgba(96, 165, 250, 0.15)',
    paddingHorizontal: 25,
    paddingVertical: 15,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#60A5FA',
    width: 320,
  },
  titleText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#374151',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.05)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  stepsContainer: {
    marginTop: 15,
    alignItems: 'flex-start',
    paddingHorizontal: 30,
    flex: 1,
    justifyContent: 'flex-start',
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(96, 165, 250, 0.1)',
    paddingHorizontal: 25,
    paddingVertical: 15,
    borderRadius: 25,
    marginBottom: 10,
    alignSelf: 'flex-start',
    width: 320,
    justifyContent: 'flex-start',
  },
  stepText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginLeft: 12,
    flex: 1,
    textAlign: 'left',
  },
  bottomContainer: {
    position: 'absolute',
    bottom: Platform.OS === 'android' ? -80 : -50,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  bottomElement: {
    backgroundColor: 'rgba(96, 165, 250, 0.1)',
    borderRadius: 25,
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderWidth: 2,
    borderColor: 'rgba(96, 165, 250, 0.3)',
  },
  bottomGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#60A5FA',
    marginHorizontal: 15,
    textShadowColor: 'rgba(96, 165, 250, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  buttonContainer: {
    marginTop: Platform.OS === 'android' ? 40 : 60,
    alignItems: 'center',
  },
  getPlanButton: {
    backgroundColor: '#60A5FA',
    borderRadius: 25,
    paddingHorizontal: 40,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
