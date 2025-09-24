import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  SafeAreaView,
  StatusBar
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Asset } from 'expo-asset';
import { OnboardingImages } from '@/constants/Images';
import TeaserStage from './onboarding-stages/teaser-stage';
import BenefitsBreathingStage from './onboarding-stages/benefits-breathing-stage';
import BenefitsJournalStage from './onboarding-stages/benefits-journal-stage';
import VideoCreationStage from './onboarding-stages/video-creation-stage';
import PulseAIStage from './onboarding-stages/pulse-ai-stage';
import PaywallStage from './onboarding-stages/paywall-stage';
import AfterInfoStage from './onboarding-stages/afterinfo';
import OnSignupStage from './onboarding-stages/onsignup';
import OnLoginStage from './onboarding-stages/onlogin';
import InfoStage from './onboarding-stages/info';
import MyPlanStage from './onboarding-stages/myplan';
import { checkPremiumStatus } from '@/lib/premiumUtils';
import { getTempPremiumPurchase } from '@/lib/premiumUtils';
import { auth } from '@/lib/firebase';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

type OnboardingStage = 'teaser' | 'benefits-breathing' | 'benefits-journal' | 'video-creation' | 'pulse-ai' | 'paywall' | 'afterinfo' | 'onsignup' | 'onlogin' | 'info' | 'myplan';

export default function OnboardingScreen() {
  console.log('🔍 OnboardingScreen component rendered');

  const [currentStage, setCurrentStage] = useState<OnboardingStage>('onsignup');
  const [imagesLoaded, setImagesLoaded] = useState(false);
  const [hasVisitedPaywall, setHasVisitedPaywall] = useState(false);
  const [paywallSource, setPaywallSource] = useState<'pulse-ai' | 'afterinfo'>('pulse-ai');
  const [fromScreen, setFromScreen] = useState<string>('');
  const [restoredFromProgress, setRestoredFromProgress] = useState(false);
  const router = useRouter();
  const params = useLocalSearchParams();

  const getProgressKey = () => 'onboarding_progress';

  // Restore progress (and optionally skip if completed)
  useEffect(() => {
    (async () => {
      try {
        const seen = await AsyncStorage.getItem('hasSeenOnboarding');
        if (seen === 'true') {
          console.log('✅ Onboarding already completed, routing to tabs');
          router.replace('/(tabs)');
          return;
        }
      } catch {}

      try {
        const user = auth.currentUser;
        const uid = user && !user.isAnonymous ? user.uid : null;
        const key = getProgressKey();
        const savedStage = await AsyncStorage.getItem(key);
        if (savedStage) {
          console.log('🔄 Restoring onboarding stage from progress:', savedStage);
          setCurrentStage(savedStage as OnboardingStage);
          setRestoredFromProgress(true);
          return;
        }
        if (uid) {
          console.log('🚦 Logged-in user without saved progress, starting at teaser');
          setCurrentStage('teaser');
        } else {
          console.log('🚦 No user, starting at onsignup');
          setCurrentStage('onsignup');
        }
      } catch (e) {
        console.log('⚠️ Failed to restore onboarding progress, defaulting');
      }
    })();
  }, []);

  // Check URL parameters
  useEffect(() => {
    if (restoredFromProgress) return; // Don't override a restored stage
    if (params?.from === 'journal') {
      setFromScreen('journal');
      setCurrentStage('paywall');
      console.log('📱 Coming from journal, going directly to paywall');
    } else if (params?.from === 'ai-tracker') {
      setFromScreen('ai-tracker');
      setCurrentStage('paywall');
      console.log('📱 Coming from ai-tracker, going directly to paywall');
    } else if (params?.from === 'calmVideo') {
      setFromScreen('calmVideo');
      setCurrentStage('paywall');
      console.log('📱 Coming from calmVideo, going directly to paywall');
    } else if (params?.from === 'musicnew') {
      setFromScreen('musicnew');
      setCurrentStage('paywall');
      console.log('📱 Coming from musicnew, going directly to paywall');
    }
  }, [params, restoredFromProgress]);

  // Persist progress on stage changes (except when completed)
  useEffect(() => {
    (async () => {
      try {
        if (!currentStage) return;
        const user = auth.currentUser;
        const uid = user && !user.isAnonymous ? user.uid : null;
        // Always persist current stage until completion
        const key = getProgressKey();
        await AsyncStorage.setItem(key, currentStage);
      } catch {}
    })();
  }, [currentStage]);

  // Preload images when component mounts
  useEffect(() => {
    const preloadImages = async () => {
      try {
        console.log('🖼️ Preloading onboarding images in onboarding component...');
        
        // Use cached images for instant loading
        await Promise.all([
          Asset.loadAsync(OnboardingImages.teaserBackground),
          Asset.loadAsync(OnboardingImages.breathingBackground),
          Asset.loadAsync(OnboardingImages.journalBackground),
          Asset.loadAsync(OnboardingImages.videoBackground),
          Asset.loadAsync(OnboardingImages.pulseAIBackground),
          Asset.loadAsync(OnboardingImages.pulseLogo),
        ]);
        
        console.log('✅ Onboarding images preloaded in onboarding component');
        setImagesLoaded(true);
      } catch (error) {
        console.error('❌ Error preloading images in onboarding:', error);
        setImagesLoaded(true); // Continue anyway
      }
    };

    preloadImages();
  }, []);

  // Track stage changes with screen-specific names
  useEffect(() => {
    const mapStageToEvent = (): string | null => {
      switch (currentStage) {
        case 'teaser':
          return 'onboarding_view_teaser';
        case 'benefits-breathing':
          return 'onboarding_view_breathing';
        case 'benefits-journal':
          return 'onboarding_view_journal';
        case 'video-creation':
          return 'onboarding_view_video';
        case 'pulse-ai':
          return 'onboarding_view_pulse_ai';
        case 'paywall':
          return paywallSource === 'afterinfo' ? 'onboarding_view_paywall_after_info' : 'onboarding_view_paywall';
        case 'info':
          return 'onboarding_view_info';
        case 'afterinfo':
          return 'onboarding_view_after_info';
        case 'onsignup':
          return 'onboarding_view_signup';
        case 'myplan':
          return 'onboarding_view_my_plan';
        default:
          return null;
      }
    };
    const evt = mapStageToEvent();
  }, [currentStage, paywallSource]);

  const handleNextStage = () => {
    const from = currentStage;
    if (currentStage === 'teaser') {
      setCurrentStage('benefits-breathing');
    } else if (currentStage === 'benefits-breathing') {
      setCurrentStage('benefits-journal');
    } else if (currentStage === 'benefits-journal') {
      setCurrentStage('video-creation');
    } else if (currentStage === 'video-creation') {
      setCurrentStage('pulse-ai');
    } else if (currentStage === 'pulse-ai') {
      setPaywallSource('pulse-ai');
      setCurrentStage('paywall');
    } else if (currentStage === 'paywall') {
      setCurrentStage('afterinfo');
    } else if (currentStage === 'afterinfo') {
      handleAfterInfoComplete();
    } else if (currentStage === 'onsignup') {
      setCurrentStage('teaser');
    } else if (currentStage === 'myplan') {
      handleComplete();
    }
  };

  const handleBackStage = () => {
    if (currentStage === 'paywall') {
      if (fromScreen === 'journal') {
        router.replace('/(tabs)/journal');
      } else if (fromScreen === 'ai-tracker') {
        router.replace('/(tabs)/ai-tracker');
      } else if (fromScreen === 'calmVideo') {
        router.replace('/(tabs)/CalmVideo');
      } else if (fromScreen === 'musicnew') {
        router.replace('/(tabs)/musicnew');
      } else {
        setCurrentStage('pulse-ai');
      }
    } else if (currentStage === 'pulse-ai') {
      setCurrentStage('video-creation');
    } else if (currentStage === 'video-creation') {
      setCurrentStage('benefits-journal');
    } else if (currentStage === 'benefits-journal') {
      setCurrentStage('benefits-breathing');
    } else if (currentStage === 'benefits-breathing') {
      setCurrentStage('teaser');
    } else if (currentStage === 'afterinfo') {
      setCurrentStage('paywall');
    } else if (currentStage === 'onsignup') {
      setCurrentStage('afterinfo');
    } else if (currentStage === 'onlogin') {
      setCurrentStage('onsignup');
    } else if (currentStage === 'info') {
      setCurrentStage('paywall');
    } else if (currentStage === 'myplan') {
      setCurrentStage('afterinfo');
    }
  };

  const handleAfterInfoComplete = async () => {
    try {
      console.log('🔍 Checking premium status in afterinfo...');
      
      // Check if user has temporary premium purchase
      const tempPremium = await getTempPremiumPurchase();
      console.log('📦 Temporary premium:', tempPremium ? 'Found' : 'Not found');
      
      // Check if user has active premium
      const isPremium = await checkPremiumStatus(true);
      console.log('💎 Active premium:', isPremium ? 'Yes' : 'No');
      
      if (tempPremium || isPremium) {
        console.log('✅ User has premium, going to myplan');
        setCurrentStage('myplan');
      } else {
        console.log('⚠️ User has no premium, going to paywall');
        // User doesn't have premium, go to paywall again
        setHasVisitedPaywall(true);
        setPaywallSource('afterinfo');
        setCurrentStage('paywall');
      }
    } catch (error) {
      console.error('❌ Error checking premium status:', error);
      // Default to paywall if there's an error
      setHasVisitedPaywall(true);
      setPaywallSource('afterinfo');
      setCurrentStage('paywall');
    }
  };

  const handlePaywallComplete = () => {
    if (fromScreen === 'journal') {
      router.replace('/(tabs)/journal');
    } else if (fromScreen === 'ai-tracker') {
      router.replace('/(tabs)/ai-tracker');
    } else if (fromScreen === 'calmVideo') {
      router.replace('/(tabs)/CalmVideo');
    } else if (fromScreen === 'musicnew') {
      router.replace('/(tabs)/musicnew');
    } else if (paywallSource === 'pulse-ai') {
      // If coming from pulse-ai, go to info
      setCurrentStage('info');
    } else if (paywallSource === 'afterinfo') {
      // If coming from afterinfo, go to myplan
      setCurrentStage('myplan');
    }
  };

  const handleComplete = async () => {
    // Save that user has seen onboarding
    await AsyncStorage.setItem('hasSeenOnboarding', 'true');
    try {
      const user = auth.currentUser;
      const uid = user && !user.isAnonymous ? user.uid : null;
      await AsyncStorage.removeItem(getProgressKey());
    } catch {}
    router.replace('/(tabs)');
  };

  const handleSkipToOnsignup = () => {
    setCurrentStage('onsignup');
  };

  const handleSkipToInfo = () => {
    setCurrentStage('info');
  };

  const renderTeaserStage = () => (
    <TeaserStage
      onNext={handleNextStage}
      onSkip={handleSkipToOnsignup}
    />
  );

  const renderBenefitsBreathingStage = () => (
    <BenefitsBreathingStage
      onNext={handleNextStage}
      onBack={handleBackStage}
    />
  );

  const renderBenefitsJournalStage = () => (
    <BenefitsJournalStage
      onNext={handleNextStage}
      onBack={handleBackStage}
    />
  );

  const renderVideoCreationStage = () => (
    <VideoCreationStage
      onNext={handleNextStage}
      onBack={handleBackStage}
    />
  );

  const renderPulseAIStage = () => (
    <PulseAIStage
      onNext={handleNextStage}
      onBack={handleBackStage}
    />
  );

  const renderPaywallStage = () => (
    <PaywallStage
      source={paywallSource}
      onComplete={handlePaywallComplete}
      onBack={handleBackStage}
    />
  );

  const renderAfterInfoStage = () => (
    <AfterInfoStage
      onComplete={handleAfterInfoComplete}
      onBack={handleBackStage}
    />
  );

  const renderOnSignupStage = () => (
    <OnSignupStage
      onBack={handleBackStage}
      onComplete={() => setCurrentStage('teaser')}
      onLogin={() => setCurrentStage('onlogin')}
    />
  );

  const renderOnLoginStage = () => (
    <OnLoginStage
      onBack={handleBackStage}
      onComplete={handleComplete}
    />
  );

  const renderInfoStage = () => (
    <InfoStage
      onComplete={() => { setCurrentStage('afterinfo'); }}
      onBack={handleBackStage}
    />
  );

  const renderMyPlanStage = () => (
    <MyPlanStage
      onComplete={handleComplete}
      onBack={handleBackStage}
    />
  );

  if (!imagesLoaded) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {currentStage === 'teaser' && renderTeaserStage()}
      {currentStage === 'benefits-breathing' && renderBenefitsBreathingStage()}
      {currentStage === 'benefits-journal' && renderBenefitsJournalStage()}
      {currentStage === 'video-creation' && renderVideoCreationStage()}
      {currentStage === 'pulse-ai' && renderPulseAIStage()}
      {currentStage === 'paywall' && renderPaywallStage()}
      {currentStage === 'afterinfo' && renderAfterInfoStage()}
      {currentStage === 'onsignup' && renderOnSignupStage()}
      {currentStage === 'onlogin' && renderOnLoginStage()}
      {currentStage === 'info' && renderInfoStage()}
      {currentStage === 'myplan' && renderMyPlanStage()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  loadingText: {
    fontSize: 18,
    color: '#60A5FA',
    fontWeight: '600',
  },
}); 