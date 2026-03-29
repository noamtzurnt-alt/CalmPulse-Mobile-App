import React, { useState, useEffect, createContext, useRef } from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar, StyleSheet, View, Image, Modal, Text, TouchableOpacity, SafeAreaView, Linking, Platform, Switch, Pressable, Alert, Dimensions, Button, ScrollView, TextInput, ActivityIndicator, Animated, PanResponder } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { MaterialIcons } from '@expo/vector-icons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, usePathname } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Message } from '../../lib/types';
import { useLanguage } from '@/lib/LanguageContext';
import { translations } from '../../lib/translations';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { checkPremiumStatus, checkSubscriptionExpiration, updatePremiumStatus } from '@/lib/premiumUtils';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';
// Premium removed
// import { identifyUser, PREMIUM_ENTITLEMENT_ID } from '@/lib/revenueCat';
// Premium removed
// import Purchases from 'react-native-purchases';
import mobileAds from 'react-native-google-mobile-ads';
import { BottomTabBar } from '@react-navigation/bottom-tabs';

import 'expo-router/entry';


function clearAllVibrations() {
  const highestTimeoutId = window.setTimeout(() => {}, 0);
  for (let i = highestTimeoutId; i >= 0; i--) {
    window.clearTimeout(i);
    window.clearInterval(i);
  }
}

const openStoreFeedback = () => {
  if (Platform.OS === 'ios') {
    // מפנה למשתמש iOS לדף דירוג באפסטור
    Linking.openURL('https://apps.apple.com/app/id6743389519');
  } else {
    // מפנה למשתמש אנדרואיד לדף דירוג בגוגל פליי
    Linking.openURL('https://play.google.com/store/apps/details?id=com.noam_tzur21.finaltest');
  }
};

export const ChatContext = createContext<{
  chatHistory: Message[];
  setChatHistory: (history: Message[]) => void;
  isMuted: boolean;
  setIsMuted: (muted: boolean) => void;
  showAvatars: boolean;
  setShowAvatars: (value: boolean) => void;
}>({ chatHistory: [], setChatHistory: () => {}, isMuted: false, setIsMuted: () => {}, showAvatars: true, setShowAvatars: () => {} });

export const LayoutContext = createContext<{
  showSuccessButton: boolean;
  setShowSuccessButton: (value: boolean) => void;
  showPulseTopLogo: boolean;
  setShowPulseTopLogo: (value: boolean) => void;
  openSettings: () => void;
}>({ showSuccessButton: false, setShowSuccessButton: () => {}, showPulseTopLogo: true, setShowPulseTopLogo: () => {}, openSettings: () => {} });

export function useLayout() {
  const context = React.useContext(LayoutContext);
  if (!context) {
    throw new Error('useLayout must be used within a LayoutProvider');
  }
  return context;
}

function TabBarIcon(props: {
  name: React.ComponentProps<typeof Ionicons>['name'];
  color: string;
}) {
  return <Ionicons size={28} style={{ marginBottom: -3 }} {...props} />;
}

function NoRippleTabBarButton(props: any) {
  if (Platform.OS === 'android') {
    return <TouchableOpacity activeOpacity={1} {...props} />;
  }
  return <TouchableOpacity {...props} />;
}

function MyTabBar(props: any) {
  return (
    <BottomTabBar
      {...props}
      {...(Platform.OS === 'android' && { pressColor: 'transparent' })}
    />
  );
}

export default function Layout() {
  console.log('🔍 (tabs)/_layout.tsx rendered');
  
  const insets = useSafeAreaInsets();
  // Heuristic: devices with 3-button nav usually report very small bottom inset
  const extraBottom = Platform.OS === 'android' && (insets.bottom < 16) ? 14 : 0;
  const [showSettings, setShowSettings] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const [hasPremium, setHasPremium] = useState(false);
  const [chatHistory, setChatHistory] = useState<Message[]>([]);
  const { setLanguage, t } = useLanguage();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [premiumButtonDisabled, setPremiumButtonDisabled] = useState(false);
  const [showSuccessButton, setShowSuccessButton] = useState(false);
  // Side drawer for chat history
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);
  const drawerAnim = useRef(new Animated.Value(0)).current; // 0 closed, 1 open
  const [savedChats, setSavedChats] = useState<any[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyBadgeCount, setHistoryBadgeCount] = useState(0);
  const { width, height } = Dimensions.get('window');
  const drawerWidth = Math.min(Dimensions.get('window').width * 0.78, 380);
  const [showDrawerHints, setShowDrawerHints] = useState(false);

  const openHistoryDrawer = async () => {
    setShowHistoryDrawer(true);
    Animated.timing(drawerAnim, { toValue: 1, duration: 260, useNativeDriver: true }).start();
    try {
      const seen = await AsyncStorage.getItem('pulseDrawerHintsSeen');
      if (seen !== 'true') {
        setShowDrawerHints(true);
      }
    } catch {}
  };
  const closeHistoryDrawer = () => {
    Animated.timing(drawerAnim, { toValue: 0, duration: 220, useNativeDriver: true }).start(({ finished }) => {
      if (finished) setShowHistoryDrawer(false);
    });
  };

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_evt, gesture) => Math.abs(gesture.dx) > 8,
      onPanResponderRelease: (_evt, gesture) => {
        if (gesture.dx > 60 || gesture.vx > 0.4) {
          closeHistoryDrawer();
        }
      },
    })
  ).current;

  // Initialize Google Mobile Ads - TEMPORARILY DISABLED
  useEffect(() => {
    console.log('🚫 Google Mobile Ads disabled for all platforms during testing');
  }, []);
  
  // Get screen dimensions to detect iPad
  const isIPad = Platform.OS === 'ios' && (width >= 768 || height >= 768);

  async function syncAndSetPremium() {
    try {
      const isPremium = await checkPremiumStatus(true);
      if (isPremium !== hasPremium) {
        setHasPremium(isPremium);
        const uid = auth.currentUser?.uid;
        if (uid) {
          await AsyncStorage.setItem(`premium_${uid}`, isPremium ? 'true' : 'false');
          await setDoc(doc(db, 'users', uid), {
            isPremium: isPremium,
            updatedAt: new Date().toISOString(),
          }, { merge: true });
        }
      }
    } catch (error) {
      console.error('Error syncing premium status:', error);
    }
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      console.log('🔍 Auth state changed:', user ? 'User logged in' : 'No user');
      if (user) {
        setIsAuthenticated(true);
        setIsLoading(false);
      } else {
        setIsAuthenticated(false);
        setIsLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const loadMuteState = async () => {
      try {
        const muteSetting = await AsyncStorage.getItem('isMuted');
        setIsMuted(muteSetting === 'true');
      } catch (error) {
        console.error('Error loading mute state:', error);
      }
    };
    loadMuteState();
  }, []);

  useEffect(() => {
    const checkExpiration = async () => {
      try {
        const isExpired = await checkSubscriptionExpiration();
        if (isExpired) {
          setHasPremium(false);
          // Removed expired subscription alert - user might not have premium
        } else {
          // If not expired, make sure premium status is correct
          const isPremium = await checkPremiumStatus(true);
          setHasPremium(isPremium);
        }
      } catch (error) {
        console.error('Error checking subscription expiration:', error);
      }
    };

    checkExpiration();
  }, []);

  useEffect(() => {
    // Premium removed: skip early RC check
  }, []);

  useFocusEffect(
    useCallback(() => {
      syncAndSetPremium();
    }, [hasPremium])
  );

  // Handle tab navigation
  const handleTabPress = async (e: any, route: string) => {
    e.preventDefault();
    
    try {
      // Save chat history if needed
      if (pathname === '/(tabs)/pulse' && chatHistory.length > 0) {
        const savedChats = await AsyncStorage.getItem('savedChats');
        const currentChats = savedChats ? JSON.parse(savedChats) : [];
        const newSavedChat = {
          id: Date.now().toString(),
          title: chatHistory[0].content.split(' ').slice(0, 2).join(' '),
          messages: [...chatHistory],
          timestamp: Date.now()
        };
        const updatedChats = [...currentChats, newSavedChat];
        await AsyncStorage.setItem('savedChats', JSON.stringify(updatedChats));
      }
      
      // Navigate to the new route
      router.push(route);
    } catch (error) {
      console.error('Error during tab navigation:', error);
    }
  };

  // Handle premium feature access
  const handlePremiumFeatureAccess = async (featureName: string) => {
    try {
      const isPremium = await checkPremiumStatus(true);
      if (isPremium) {
        return true;
      } else {
        router.push({ pathname: '/onboarding-stages/paywall-stage', params: { source: 'premium', from: 'index' } });
        return false;
      }
    } catch (error) {
      console.error(`Error checking access for ${featureName}:`, error);
      router.push({ pathname: '/onboarding-stages/paywall-stage', params: { source: 'premium', from: 'index' } });
      return false;
    }
  };

  const handleSetIsMuted = async (value: boolean) => {
    setIsMuted(value);
    try {
      await AsyncStorage.setItem('isMuted', value.toString());
    } catch (error) {
      console.error('Error saving mute state:', error);
    }
  };

  const handlePulseAIPress = async () => {
    try {
      // Check premium status using the updated function
      const hasPremium = await checkPremiumStatus(true);
      console.log('Premium status for Pulse AI navigation:', hasPremium);
      
      if (hasPremium) {
        router.push('/(tabs)/pulse');
      } else {
        router.push({ pathname: '/onboarding-stages/paywall-stage', params: { source: 'premium', from: 'index' } });
      }
    } catch (error) {
      console.error('Error checking premium status for Pulse AI:', error);
      router.push({ pathname: '/onboarding-stages/paywall-stage', params: { source: 'premium', from: 'index' } });
    }
  };

  const loadSavedChats = async () => {
    try {
      if (!auth) {
        console.log('Firebase auth not initialized');
        return;
      }
      
      const user = auth.currentUser;
      if (!user?.uid) return;

      if (!db) {
        console.log('Firestore not initialized');
        return;
      }
      
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);
      
      if (userDoc.exists()) {
        if (userDoc.data().pulseAIConversations) {
          const chats = userDoc.data().pulseAIConversations;
          console.log('Loaded chats from Firestore (pulseAIConversations):', chats.length);
          setSavedChats(chats);
        } else {
          console.log('No chat history found in Firestore');
          setSavedChats([]);
        }
      } else {
        console.log('No user data found in Firestore');
        setSavedChats([]);
      }
    } catch (error) {
      console.error('Error loading saved chats:', error);
    }
  };

  const handleEditTitle = async (chatId: string, newTitle: string) => {
    try {
      const words = newTitle.trim().split(/\s+/);
      if (words.length > 5) {
        Alert.alert('Error', 'Title cannot be longer than 5 words');
        return;
      }
      
      if (!auth) {
        console.log('Firebase auth not initialized');
        return;
      }
      
      const user = auth.currentUser;
      if (!user?.uid) return;

      if (!db) {
        console.log('Firestore not initialized');
        return;
      }
      
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);
      
      if (userDoc.exists() && userDoc.data().pulseAIConversations) {
        const conversations = userDoc.data().pulseAIConversations;
        const updatedChats = conversations.map((chat: any) => {
          if (chat.id === chatId) {
            return {
              ...chat,
              title: newTitle
            };
          }
          return chat;
        });
        
        await updateDoc(userDocRef, {
          pulseAIConversations: updatedChats,
          updatedAt: new Date(),
        });
        
        setSavedChats(updatedChats);
        console.log('Chat title updated successfully');
      }
      
      setEditingId(null);
      setEditingTitle(null);
      
    } catch (error) {
      console.error('Error updating chat title:', error);
      Alert.alert('Error', 'Failed to update chat title');
    }
  };

  const handleDeleteChat = async (chatId: string) => {
    try {
      const updatedChats = savedChats.filter(chat => chat.id !== chatId);
      setSavedChats(updatedChats);
      
      if (!auth) {
        console.log('Firebase auth not initialized');
        return;
      }
      
      const user = auth.currentUser;
      if (user?.uid) {
        if (!db) {
          console.log('Firestore not initialized');
          return;
        }
        
        const userDocRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userDocRef);
        
        if (userDoc.exists()) {
          if (userDoc.data().pulseAIConversations) {
            const conversations = userDoc.data().pulseAIConversations;
            const updatedConversations = conversations.filter((chat: any) => chat.id !== chatId);
            
            await updateDoc(userDocRef, {
              pulseAIConversations: updatedConversations,
              updatedAt: new Date(),
            });
          }
          
          console.log('Chat deleted from Firestore successfully');
        }
      }
    } catch (error) {
      console.error('Error deleting chat:', error);
      Alert.alert('Error', 'Failed to delete chat');
    }
  };

  const showLanguageOptions = () => {
    Alert.alert(
      'בחר שפה | Choose Language',
      '',
      [
        {
          text: 'English',
          onPress: async () => {
            await setLanguage('en');
            setShowSettings(false);
          }
        },
        {
          text: 'עברית',
          onPress: async () => {
            await setLanguage('he');
            setShowSettings(false);
          }
        },
        {
          text: 'Cancel',
          style: 'cancel'
        }
      ],
      { cancelable: true }
    );
  };

  const handleSendFeedback = () => {
    if (Platform.OS === 'ios') {
      // מפנה למשתמש iOS לדף דירוג באפסטור
      Linking.openURL('https://apps.apple.com/app/id6743389519');
    } else {
      // מפנה למשתמש אנדרואיד לדף דירוג בגוגל פליי
      Linking.openURL('https://play.google.com/store/apps/details?id=com.noam_tzur21.finaltest');
    }
  };

  const checkPremium = async () => {
    const hasPremium = await checkPremiumStatus(true);
    setHasPremium(hasPremium);
  };

  const checkPremiumAccess = async () => {
    try {
      const user = auth.currentUser;
      if (!user?.uid) {
        return false;
      }

      // Check local storage first for quick response
      const localStatus = await AsyncStorage.getItem(`premium_${user.uid}`);
      if (localStatus === 'true') {
        return true;
      }

      // Then verify with RevenueCat
      const isPremium = await checkPremiumStatus(true);
      if (isPremium) {
        await AsyncStorage.setItem(`premium_${user.uid}`, 'true');
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error checking premium status:', error);
      return false;
    }
  };

  const [showPulseTopLogo, setShowPulseTopLogo] = useState(false);
  const [showAvatars, setShowAvatars] = useState(true);
  const [pulseBackIntent, setPulseBackIntent] = useState(false);
  const [gamesBackIntent, setGamesBackIntent] = useState(false);
  const [journalBackIntent, setJournalBackIntent] = useState(false);
  const [musicBackIntent, setMusicBackIntent] = useState(false);
  const [musicHeaderBackIntent, setMusicHeaderBackIntent] = useState(false);
  const [videoHeaderBackIntent, setVideoHeaderBackIntent] = useState(false);
  const [breathingHeaderBackIntent, setBreathingHeaderBackIntent] = useState(false);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        try {
          const flag = await AsyncStorage.getItem('pulseBackIntent');
          setPulseBackIntent(flag === 'true');
          const gflag = await AsyncStorage.getItem('gamesBackIntent');
          if (gflag === 'true') {
            setGamesBackIntent(true);
            await AsyncStorage.removeItem('gamesBackIntent');
          } else {
            setGamesBackIntent(false);
          }
          const jflag = await AsyncStorage.getItem('journalBackIntent');
          if (jflag === 'true') {
            setJournalBackIntent(true);
            await AsyncStorage.removeItem('journalBackIntent');
          } else {
            setJournalBackIntent(false);
          }
          const mflag = await AsyncStorage.getItem('musicBackIntent');
          setMusicBackIntent(mflag === 'true');
          const mh = await AsyncStorage.getItem('musicHeaderBackIntent');
          setMusicHeaderBackIntent(mh === 'true');
          const vh = await AsyncStorage.getItem('videoBackIntent');
          setVideoHeaderBackIntent(vh === 'true');
          const bh = await AsyncStorage.getItem('breathingHeaderBackIntent');
          setBreathingHeaderBackIntent(bh === 'true');
        } catch {}
      })();
    }, [pathname])
  );

  // Load avatar visibility preference
  useEffect(() => {
    (async () => {
      try {
        const v = await AsyncStorage.getItem('pulseShowAvatars');
        if (v === 'false') setShowAvatars(false);
      } catch {}
    })();
  }, []);
  const toggleShowAvatars = async () => {
    try {
      const next = !showAvatars;
      setShowAvatars(next);
      await AsyncStorage.setItem('pulseShowAvatars', next ? 'true' : 'false');
    } catch {}
  };

  const handleHeaderPremiumPress = async () => {
    try {
      if (premiumButtonDisabled) return;
      setPremiumButtonDisabled(true);
      // Fast-path: if within suppress window and local cache says premium, show active and exit
      try {
        const untilStr = await AsyncStorage.getItem('rc_suppress_until');
        const until = untilStr ? Number(untilStr) : 0;
        const now = Date.now();
        const local = await AsyncStorage.getItem('hasPremium');
        if (until && now < until && local === 'true') {
          Alert.alert('Premium Active', 'You already have access to all premium features ✨');
        return;
      }
        // If local premium is true, don't route to paywall
        if (local === 'true') {
          Alert.alert('Premium Active', 'You already have access to all premium features ✨');
          return;
        }
      } catch {}
      // Navigate to paywall immediately without remote RC calls to avoid sandbox delays
      try { await AsyncStorage.setItem('rc_suppress', 'true'); } catch {}
      router.push({ pathname: '/onboarding-stages/paywall-stage', params: { source: 'premium', from: 'index' } });
    } catch (e) {
      // Fallback: route to paywall
      try { await AsyncStorage.setItem('rc_suppress', 'true'); } catch {}
      router.push({ pathname: '/onboarding-stages/paywall-stage', params: { source: 'premium', from: 'index' } });
    } finally {
      setTimeout(() => setPremiumButtonDisabled(false), 600);
    }
  };
  return (
    <LayoutContext.Provider value={{ 
      showSuccessButton, 
      setShowSuccessButton, 
      showPulseTopLogo, 
      setShowPulseTopLogo,
      openSettings: () => setShowSettings(true),
    }}>
      <ChatContext.Provider value={{ 
        chatHistory, 
        setChatHistory,
        isMuted,
        setIsMuted: handleSetIsMuted,
        showAvatars,
        setShowAvatars,
      }}>
        <View style={[styles.container, { paddingTop: insets.top, direction: 'ltr', backgroundColor: '#f8fafc' }]}>
          <StatusBar backgroundColor="#f8fafc" barStyle="dark-content" />
          
          {/* Pulse Logo - Center of Pulse Screen */}
          {(() => {
            console.log('🔍 Pulse Logo Debug - pathname:', pathname);
            const isPulse = (pathname === '/(tabs)/pulse' || pathname.includes('pulse'));
            return isPulse && showPulseTopLogo;
          })() && (
            <View pointerEvents="none" style={styles.pulseLogoContainer}>
              <Image 
                source={require('../../assets/images/adaptive-icon.png')}
                style={styles.pulseLogo}
                resizeMode="contain"
              />
            </View>
          )}
          
          <Tabs
            tabBar={props => <MyTabBar {...props} />}
            screenOptions={{
              ...(Platform.OS === 'android' && { tabBarPressColor: 'transparent' }),
              headerStyle: {
                backgroundColor: '#f8fafc',
                height: (Platform.OS === 'android' ? 56 : 64) + insets.top,
              },
              headerTitle: '',
              headerTitleContainerStyle: {
                justifyContent: 'flex-end',
                paddingRight: 20,
              },
              headerLeftContainerStyle: {
                marginTop: Platform.OS === 'android' ? -8 : -92,
                paddingLeft: 16,
              },
              headerRightContainerStyle: {
                marginTop: Platform.OS === 'android' ? -8 : -92,
                paddingRight: 16,
              },
              headerShadowVisible: false,
              tabBarStyle: {
                backgroundColor: '#FFFFFF',
                // הגובה כולל את ה-safe area כדי שלא ייחתך ע"י פס הניווט
                height: (Platform.OS === 'android' ? 72 : 72) + insets.bottom + extraBottom,
                paddingBottom: insets.bottom + extraBottom,      // זה הדבר החשוב
                paddingTop: 8,
                borderTopWidth: 1,
                borderTopColor: '#E5E5E5',
                position: 'absolute',
                bottom: extraBottom,
                left: 0,
                right: 0,
              },
              tabBarActiveTintColor: '#60A5FA',
              tabBarInactiveTintColor: '#94A3B8',
              tabBarLabelStyle: { 
                fontSize: 12,
                marginBottom: 6,
                marginTop: Platform.OS === 'ios' ? 2 : 4
              },
              headerLeft: () => {
                console.log('🔍 Current pathname:', pathname);
                const isPulseScreen = pathname === '/(tabs)/pulse' || pathname.includes('pulse') || pathname === '/pulse';
                const isGamesScreen = pathname === '/(tabs)/games' || pathname === '/games';
                const isJournalScreen = pathname === '/(tabs)/journal' || pathname === '/journal';
                const isMusicScreen = pathname === '/(tabs)/musicnew' || pathname === '/musicnew';
                const isCalmTarget = (
                  pathname === '/(tabs)/games' || pathname === '/games' ||
                  pathname === '/(tabs)/journal' || pathname === '/journal' ||
                  pathname === '/(tabs)/CalmVideo' || pathname === '/CalmVideo' ||
                  pathname === '/(tabs)/musicnew' || pathname === '/musicnew' ||
                  pathname === '/(tabs)/breathing' || pathname === '/breathing'
                );
                if (isCalmTarget) {
                  // Special-case Breathing: show back only when coming from before modal
                  if (pathname === '/(tabs)/breathing' || pathname === '/breathing') {
                    if (breathingHeaderBackIntent) {
                      return (
                        <TouchableOpacity
                          onPress={async () => { try { await AsyncStorage.removeItem('breathingHeaderBackIntent'); } catch {}; router.push('/(tabs)/before'); }}
                          style={styles.headerIconButton}
                        >
                          <Ionicons name="arrow-back" size={22} color="#1e293b" />
                        </TouchableOpacity>
                      );
                    }
                    return (
                      <TouchableOpacity
                        onPress={handleHeaderPremiumPress}
                        style={styles.headerPremiumButton}
                      >
                        <Ionicons name="sparkles" size={18} color="#60A5FA" />
                      </TouchableOpacity>
                    );
                  }
                  // Special-case CalmVideo: show back only when coming from before
                  if (pathname === '/(tabs)/CalmVideo' || pathname === '/CalmVideo') {
                    if (videoHeaderBackIntent) {
                      return (
                        <TouchableOpacity
                          onPress={async () => { try { await AsyncStorage.removeItem('videoBackIntent'); } catch {}; router.push('/(tabs)/before'); }}
                          style={styles.headerIconButton}
                        >
                          <Ionicons name="arrow-back" size={22} color="#1e293b" />
                        </TouchableOpacity>
                      );
                    }
                    return (
                      <TouchableOpacity
                        onPress={handleHeaderPremiumPress}
                        style={styles.headerPremiumButton}
                      >
                        <Ionicons name="sparkles" size={18} color="#60A5FA" />
                      </TouchableOpacity>
                    );
                  }
                  // Special-case games: show back only if came from before
                  if (isGamesScreen) {
                    if (gamesBackIntent) {
                      return (
                        <TouchableOpacity
                          onPress={() => router.push('/(tabs)/before')}
                          style={styles.headerIconButton}
                        >
                          <Ionicons name="arrow-back" size={22} color="#1e293b" />
                        </TouchableOpacity>
                      );
                    }
                    // No back intent for games: show premium button like default
                    return (
                      <TouchableOpacity
                        onPress={handleHeaderPremiumPress}
                        style={styles.headerPremiumButton}
                      >
                        <Ionicons name="sparkles" size={18} color="#60A5FA" />
                      </TouchableOpacity>
                    );
                  } else if (isJournalScreen) {
                    if (journalBackIntent) {
                      return (
                        <TouchableOpacity
                          onPress={() => router.push('/(tabs)/before')}
                          style={styles.headerIconButton}
                        >
                          <Ionicons name="arrow-back" size={22} color="#1e293b" />
                        </TouchableOpacity>
                      );
                    }
                    // No back intent for journal: show premium button like default
                    return (
                      <TouchableOpacity
                        onPress={handleHeaderPremiumPress}
                        style={styles.headerPremiumButton}
                      >
                        <Ionicons name="sparkles" size={18} color="#60A5FA" />
                      </TouchableOpacity>
                    );
                  } else if (isMusicScreen) {
                    if (musicHeaderBackIntent) {
                      return (
                        <TouchableOpacity
                          onPress={async () => { try { await AsyncStorage.removeItem('musicHeaderBackIntent'); } catch {}; router.push('/(tabs)/before'); }}
                          style={styles.headerIconButton}
                        >
                          <Ionicons name="arrow-back" size={22} color="#1e293b" />
                        </TouchableOpacity>
                      );
                    }
                    // No back intent for music: show premium button like default
                    return (
                      <TouchableOpacity
                        onPress={handleHeaderPremiumPress}
                        style={styles.headerPremiumButton}
                      >
                        <Ionicons name="sparkles" size={18} color="#60A5FA" />
                      </TouchableOpacity>
                    );
                  } else {
                    return (
                      <TouchableOpacity
                        onPress={() => router.push('/(tabs)/before')}
                        style={styles.headerIconButton}
                      >
                        <Ionicons name="arrow-back" size={22} color="#1e293b" />
                      </TouchableOpacity>
                    );
                  }
                }
                // במסך Pulse: כאשר יש כוונת חזרה מה-before והצ'אט עדיין ב-welcome, הצג חץ חזרה; כאשר הצ'אט פעיל – תפריט היסטוריה
                if (isPulseScreen) {
                  if (showPulseTopLogo) {
                  return (
                    <TouchableOpacity
                      onPress={() => {
                        loadSavedChats();
                        openHistoryDrawer();
                      }}
                      style={styles.headerIconButton}
                    >
                      <View style={{ gap: 4, width: 24, alignItems: 'center' }}>
                        <View style={[styles.historyBar, historyLoading && { opacity: 0.4 }]} />
                        <View style={[styles.historyBar, historyLoading && { opacity: 0.4 }]} />
                        <View style={[styles.historyBar, historyLoading && { opacity: 0.4 }]} />
                        {historyBadgeCount > 0 && (
                          <View style={styles.historyBadge}><Text style={styles.historyBadgeText}>{historyBadgeCount}</Text></View>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                  }
                  if (pulseBackIntent) {
                    return (
                      <TouchableOpacity
                        onPress={async () => { try { await AsyncStorage.removeItem('pulseBackIntent'); } catch {}; router.push('/(tabs)/before'); }}
                        style={styles.headerIconButton}
                      >
                        <Ionicons name="arrow-back" size={22} color="#1e293b" />
                      </TouchableOpacity>
                    );
                  }
                  // Otherwise fall through to premium button
                }
                // כפתור פרימיום לכל שאר המצבים/מסכים
                return (
                  <TouchableOpacity
                    onPress={handleHeaderPremiumPress}
                    style={styles.headerPremiumButton}
                  >
                    <Ionicons name="sparkles" size={18} color="#60A5FA" />
                  </TouchableOpacity>
                );
              },
              headerRight: () => (
                <TouchableOpacity
                  onPress={() => setShowSettings(true)}
                  style={styles.headerIconButton}
                >
                  <Ionicons name="settings-outline" size={24} color="#1e293b" />
                </TouchableOpacity>
              ),
              headerTitleStyle: {
                textAlign: 'left',
                flex: 1,
                marginRight: -35,
                marginTop: isIPad ? -80 : -53,
              },
            }}
            screenListeners={{
              tabPress: () => {
                clearAllVibrations();
              },
            }}
            initialRouteName="index"
          >
            <Tabs.Screen
              name="index"
              options={{
                title: String(t('tabHome')),
                tabBarIcon: ({ color }) => (
                  <Ionicons name="home" size={24} color={color} />
                ),
                tabBarButton: (props) => <NoRippleTabBarButton {...props} />,
              }}
              listeners={{
                tabPress: async (e) => {
                  await handleTabPress(e, '/');
                },
              }}
            />
            <Tabs.Screen
              name="games"
              options={{
                title: String(t('tabGames')),
                tabBarIcon: ({ color }) => (
                  <Ionicons name="game-controller" size={24} color={color} />
                ),
                tabBarButton: (props) => <NoRippleTabBarButton {...props} />,
              }}
              listeners={{
                tabPress: async (e) => {
                  await handleTabPress(e, '/games');
                },
              }}
            />
            <Tabs.Screen
              name="journal"
              options={{
                title: String(t('tabJournal')),
                tabBarIcon: ({ color }) => (
                  <Ionicons name="book" size={24} color={color} />
                ),
                tabBarButton: (props) => <NoRippleTabBarButton {...props} />,
              }}
              listeners={{
                tabPress: async (e) => {
                  await handleTabPress(e, '/journal');
                },
              }}
            />
            <Tabs.Screen
              name="pulse"
              options={{
                title: String(t('tabPulseAI')),
                tabBarIcon: ({ color }) => (
                  <Image 
                    source={require('../../assets/images/adaptive-icon.png')}
                    style={{ 
                      width: 55,
                      height: 55,
                      tintColor: color,
                      marginBottom: Platform.OS === 'ios' ? -20 : -15,
                      marginTop: Platform.OS === 'ios' ? -18 : -10
                    }}
                  />
                ),
                tabBarLabelStyle: {
                  fontSize: 12,
                  marginBottom: 8,
                  marginTop: Platform.OS === 'ios' ? 3 : 3
                },

                tabBarButton: (props) => <NoRippleTabBarButton {...props} />,
              }}
              listeners={{
                tabPress: async (e) => {
                  // e.preventDefault(); // Removed - not available on tabPress event
                  router.push('/(tabs)/pulse');
                },
              }}
            />
            <Tabs.Screen
              name="breathing"
              options={{
                title: '',
                href: null,
              }}
            />
            <Tabs.Screen
              name="haptics"
              options={{
                title: String(t('haptics')),
                href: null,
              }}
            />
            <Tabs.Screen
              name="before"
              options={{
                title: String(t('calmAnxietyOptions')),
                href: null,
              }}
            />
            <Tabs.Screen
              name="CalmVideo"
              options={{
                title: String(t('videoCustomize')),
                href: null,
              }}
            />
            
            <Tabs.Screen
              name="settings"
              options={{
                href: null,
              }}
              />
            <Tabs.Screen
              name="musicnew"
              options={{
                title: String(t('music')),
                tabBarIcon: ({ color }) => <TabBarIcon name="musical-notes" color={color} />,
                href: null,
              }}
              listeners={{
                tabPress: async (e) => {
                  await handleTabPress(e, '/(tabs)/musicnew');
                },
              }}
            />

            <Tabs.Screen
              name="user"
              options={{
                title: String(t('user')),
                href: null,
              }}
            />

            <Tabs.Screen
              name="scientific-references"
              options={{
                title: String(t('scientificReferences')),
                href: null,
              }}
            />
          </Tabs>
        </View>

        <Modal
          animationType="slide"
          transparent={true}
          visible={showSettings}
          onRequestClose={() => setShowSettings(false)}
        >
          <View style={{ flex: 1 }}>
            {/* Pressable overlay that closes the modal when pressed */}
            <Pressable
              style={styles.modalOverlay}
              onPress={() => setShowSettings(false)}
            />
            {/* The white settings content at the bottom */}
            <View style={[styles.settingsContent, { direction: 'ltr', paddingBottom: 40 + insets.bottom }]} pointerEvents="box-none">
              <Text style={[styles.settingsTitle, { textAlign: 'left' }]}>Settings</Text>
              <View style={[styles.settingsList, { direction: 'ltr' }]}>
                <TouchableOpacity 
                  style={styles.settingItem}
                  onPress={() => {
                    setShowSettings(false);
                    router.push('/(tabs)/user');
                  }}
                >
                  <View style={styles.settingContent}>
                    <Ionicons name="person-outline" size={24} color="#334155" />
                    <Text style={styles.settingText}>{t('currentUser')}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
                </TouchableOpacity>



                <TouchableOpacity 
                  style={styles.settingItem}
                  onPress={() => {
                    setShowSettings(false);
                    router.push('/(tabs)/scientific-references');
                  }}
                >
                  <View style={styles.settingContent}>
                    <Ionicons name="book-outline" size={24} color="#334155" />
                    <Text style={styles.settingText}>{t('scientificReferences')}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.settingItem}
                  onPress={() => {
                    setShowSettings(false);
                    handleSendFeedback();
                  }}
                >
                  <View style={styles.settingContent}>
                    <Ionicons name="chatbubble-outline" size={24} color="#334155" />
                    <Text style={styles.settingText}>{t('sendFeedback')}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
                </TouchableOpacity>

                {/* Report a Problem button */}
                <TouchableOpacity 
                  style={styles.settingItem}
                  onPress={() => {
                    setShowSettings(false);
                    const subject = encodeURIComponent('Problem Report');
                    const body = encodeURIComponent('Please describe the problem you encountered:');
                    const email = 'calmpulseapp@gmail.com';
                    const mailto = `mailto:${email}?subject=${subject}&body=${body}`;
                    Linking.openURL(mailto);
                  }}
                >
                  <View style={styles.settingContent}>
                    <Ionicons name="bug-outline" size={24} color="#334155" />
                    <Text style={styles.settingText}>{t('reportProblem')}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.settingItem}
                  onPress={() => {
                    setShowSettings(false);
                    Linking.openURL('https://calmpulseapp.com/policies/terms-of-service');
                  }}
                >
                  <View style={styles.settingContent}>
                    <Ionicons name="document-text-outline" size={24} color="#334155" />
                    <Text style={styles.settingText}>{t('termsOfService')}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.settingItem}
                  onPress={() => {
                    setShowSettings(false);
                    Linking.openURL('https://calmpulseapp.com/policies/privacy-policy');
                  }}
                >
                  <View style={styles.settingContent}>
                    <Ionicons name="shield-outline" size={24} color="#334155" />
                    <Text style={styles.settingText}>{t('privacyPolicy')}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* History Side Drawer */}
        {showHistoryDrawer && (
          <View style={styles.drawerOverlay}>
            <Pressable style={StyleSheet.absoluteFillObject} onPress={closeHistoryDrawer} />
            <Animated.View
              {...panResponder.panHandlers}
              style={[
                styles.drawerPanel,
                {
                  width: drawerWidth,
                  paddingTop: insets.top + 10,
                  paddingBottom: insets.bottom + 20,
                  transform: [
                    {
                      translateX: drawerAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [-drawerWidth, 0],
                      }),
                    },
                  ],
                },
              ]}
            >
              <View style={styles.drawerHeader}> 
                <Text style={styles.drawerTitle}>History</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <TouchableOpacity
                    onPress={toggleShowAvatars}
                    style={styles.drawerCloseButton}
                    accessibilityRole="button"
                    accessibilityLabel="Toggle avatars"
                  >
                    <Ionicons name={showAvatars ? 'eye' : 'eye-off-outline'} size={22} color={showAvatars ? '#60A5FA' : '#94A3B8'} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setShowDrawerHints(prev => !prev)}
                    style={styles.drawerCloseButton}
                    accessibilityRole="button"
                    accessibilityLabel={showDrawerHints ? 'Hide tips' : 'Show tips'}
                  >
                    <Ionicons name={showDrawerHints ? 'chevron-up' : 'chevron-down'} size={20} color="#334155" />
                  </TouchableOpacity>
                </View>
              </View>
              {showDrawerHints && (
                <View style={styles.drawerHints}>
                  <View style={styles.drawerHintRow}>
                    <View style={styles.drawerHintChip}>
                      <Ionicons name="eye" size={16} color="#60A5FA" />
                      <Text style={styles.drawerHintText} allowFontScaling={false}>Show avatars</Text>
                    </View>
                  </View>
                </View>
              )}
              <ScrollView 
                style={styles.drawerList}
                contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
                showsVerticalScrollIndicator={true}
              >
                {savedChats.map((chat) => (
                  <TouchableOpacity
                    key={chat.id}
                    style={styles.drawerItem}
                    onPress={async () => {
                      try {
                        let messagesArray: any[] = [];
                        try {
                          const saved = await AsyncStorage.getItem('savedChats');
                          if (saved) {
                            const list = JSON.parse(saved);
                            const found = Array.isArray(list) ? list.find((c: any) => c?.id === chat.id) : null;
                            if (found && Array.isArray(found.messages) && typeof found.messages[0]?.isUser === 'boolean') {
                              messagesArray = found.messages;
                            }
                          }
                        } catch {}
                        if (messagesArray.length === 0) {
                          // Fallback: reconstruct from string[] (user/assistant alternating assumption)
                          messagesArray = Array.isArray(chat.messages)
                            ? (chat.messages as string[]).map((text: string, idx: number) => ({
                                id: String(Date.now() + idx),
                                text,
                                isUser: idx % 2 === 0
                              }))
                            : [];
                        }
                        await AsyncStorage.setItem('pulseSelectedChat', JSON.stringify({ id: chat.id, messages: messagesArray }));
                      } catch {}
                      closeHistoryDrawer();
                      router.push({ pathname: '/(tabs)/pulse', params: { open: String(chat.id || ''), ts: String(Date.now()) } });
                    }}
                  >
                    {editingId === chat.id ? (
                      <TextInput
                        style={styles.drawerEditInput}
                        value={editingTitle || ''}
                        onChangeText={setEditingTitle}
                        autoFocus
                        onBlur={() => {
                          if (editingTitle && editingTitle.trim()) {
                            handleEditTitle(chat.id, editingTitle);
                          } else {
                            setEditingId(null);
                            setEditingTitle(null);
                          }
                        }}
                        onSubmitEditing={() => {
                          if (editingTitle && editingTitle.trim()) {
                            handleEditTitle(chat.id, editingTitle);
                          }
                        }}
                      />
                    ) : (
                      <Text style={styles.drawerItemText} numberOfLines={1} ellipsizeMode="tail" allowFontScaling={false}>
                        {chat.title}
                      </Text>
                    )}
                    <View style={styles.drawerActions}>
                      <TouchableOpacity
                        onPress={(e) => {
                          e.stopPropagation();
                          setEditingId(chat.id);
                          setEditingTitle(chat.title);
                        }}
                        style={styles.drawerEditBtn}
                      >
                        <Ionicons name="pencil-outline" size={18} color="#60A5FA" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={(e) => {
                          e.stopPropagation();
                          handleDeleteChat(chat.id);
                        }}
                        style={styles.drawerDeleteBtn}
                      >
                        <Ionicons name="trash-outline" size={18} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                    <Text style={styles.drawerItemDate}>{new Date(chat.date).toLocaleDateString()}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </Animated.View>
          </View>
        )}
      </ChatContext.Provider>
    </LayoutContext.Provider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 8,
    backgroundColor: '#f8fafc',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e293b',
    marginTop: Platform.OS === 'ios' ? (Platform.isPad ? -20 : 0) : 0,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: {
    padding: 8,
    marginHorizontal: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 0,
    width: '80%',
    alignItems: 'center',
  },
  modalTitleOld: {
    fontWeight: 'bold',
    fontSize: 20,
    marginBottom: 12,
  },
  modalText: {
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'center',
  },
  settingsContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    width: '100%',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: 100,
    paddingTop: 40,
  },
  settingsTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 30,
  },
  settingsList: {
    gap: 16,
    marginTop: 10,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  settingContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingText: {
    marginLeft: 12,
    fontSize: 16,
    color: '#1e293b',
  },
  disabledButton: {
    opacity: 0.5,
  },
  historyButton: {
    padding: 8,
    backgroundColor: 'white',
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingHorizontal: 0,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#334155',
    marginLeft: 0,
    alignSelf: 'flex-start',
  },
  closeButton: {
    padding: 4,
    marginRight: 0,
    alignSelf: 'flex-end',
  },
  headerIconButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  historyBar: {
    width: 24,
    height: 2,
    backgroundColor: '#334155',
    borderRadius: 1,
  },
  historyBadge: {
    position: 'absolute',
    top: -4,
    right: -6,
    backgroundColor: '#EF4444',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  historyBadgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '700',
  },
  headerPremiumButton: {
    paddingVertical: 14,
    paddingHorizontal: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    shadowColor: '#60A5FA',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  // Drawer styles
  drawerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    zIndex: 2000,
  },
  drawerPanel: {
    backgroundColor: '#FFFFFF',
    height: '100%',
    borderTopRightRadius: 16,
    borderBottomRightRadius: 16,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  drawerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#334155',
  },
  drawerCloseButton: { padding: 6 },
  drawerList: { marginTop: 8 },
  drawerHints: {
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 8,
    marginBottom: 8,
  },
  drawerHintRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  drawerHintChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  drawerHintText: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '600',
  },
  drawerItem: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  drawerItemText: {
    fontSize: 16,
    color: '#334155',
    maxWidth: '70%',
  },
  drawerItemDate: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 4,
  },
  drawerActions: {
    position: 'absolute',
    right: 0,
    top: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  drawerEditBtn: {
    padding: 6,
    backgroundColor: '#F1F5F9',
    borderRadius: 6,
  },
  drawerDeleteBtn: {
    padding: 6,
    backgroundColor: '#FEF2F2',
    borderRadius: 6,
  },
  drawerEditInput: {
    fontSize: 16,
    color: '#334155',
    borderWidth: 1,
    borderColor: '#60A5FA',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginRight: 56,
  },
  pulseLogoContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 5,
    left: '50%',
    transform: [{ translateX: -50 }],
    width: 100,
    height: 100,
    zIndex: 1000,
    marginTop: Platform.OS === 'ios' ? 0 : 0,
  },
  pulseLogo: {
    width: '100%',
    height: '100%',
  },
});
