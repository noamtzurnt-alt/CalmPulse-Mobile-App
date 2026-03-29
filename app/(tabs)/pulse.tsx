import React, { useState, useRef, useEffect, useContext } from 'react';
import { 
  StyleSheet, 
  View, 
  Text,
  TextInput, 
  TouchableOpacity,
  ScrollView, 
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  ActivityIndicator,
  Alert,
  Keyboard,
  TouchableWithoutFeedback,
  Image,
  Animated,
  Easing,
  ImageStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Constants from 'expo-constants';
import { getUserData } from '@/lib/userDataUtils';
// import OpenAI from "openai"; // Removed client-side SDK usage
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLayout, ChatContext } from '@/app/(tabs)/_layout';
import { auth, db } from '@/lib/firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { checkPremiumStatus } from '@/lib/premiumUtils';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Helper: build 2-3 word title from first two USER messages (English/Hebrew)
const STOPWORDS = new Set([
  // English
  'the','a','an','is','are','am','i','you','he','she','it','we','they','me','my','your','yours','his','her','its','our','their',
  'to','for','from','of','in','on','at','and','or','but','with','about','as','this','that','these','those','be','was','were','do','does','did',
  'can','could','should','would','will','shall','have','has','had','how','what','why','when','where','which','who',
  // Hebrew (basic/common)
  'אני','אתה','את','הוא','היא','אנחנו','אתם','אתן','הם','הן',
  'של','עם','על','אל','אליי','אליך','מ','מן','מה','את','זה','זאת','אלה','אם',
  'להיות','יש','אין','יכול','יכולה','רוצה','צריך','צריכה','מאוד','גם','אבל','או','כי','אז','כש','כאשר','למה','איך','מתי','איפה','איזה',
  'שלום','היי'
]);

function toTitle(words: string[]): string {
  const s = words.slice(0, 3).join(' ').trim();
  if (!s) return 'New chat';
  // Capitalize first letter of each word (safe for latin; hebrew unaffected)
  return s.replace(/(^|\s)([a-zA-Z])/g, (m) => m.toUpperCase());
}

function generateConversationTitle(messages: { text: string; isUser: boolean }[]): string {
  const userMsgs = messages.filter(m => m.isUser).slice(0, 2);
  const base = userMsgs.map(m => m.text).join(' ').trim();
  if (!base) return 'New chat';
  const cleaned = base
    .toLowerCase()
    .replace(/[.,!?;:()\[\]{}"'`/\\]|\s+/g, ' ') // remove punctuation & normalize whitespace
    .trim();
  const tokens = cleaned.split(' ').filter(w => w && !STOPWORDS.has(w));
  if (tokens.length === 0) {
    // fallback to first 3 words of first user message
    const first = userMsgs[0]?.text || '';
    const simple = first.replace(/\s+/g, ' ').trim().split(' ').slice(0, 3);
    return toTitle(simple);
  }
  return toTitle(tokens);
}

const INITIAL_PROMPT = `You are PULSE AI, a supportive and empathetic AI assistant designed to help users manage anxiety and stress.

IMPORTANT INSTRUCTIONS:
1. You have access to the user's journal entries. This is CRITICAL information.
2. When the user asks about what they wrote in their journal, you MUST directly reference the specific content from their journal entries.
3. If the user asks "what did I write in my journal" or similar questions, ALWAYS respond with the actual content from their journal entries.
4. Be very specific when referencing journal entries - mention exact topics, concerns, and emotions the user wrote about.
5. Remember details about the user from previous conversations and their journal entries.
6. Be warm, supportive, and personalized in your responses.

For example, if the user wrote in their journal "I have anxiety about mice" and later asks "what did I write about my anxiety?", you MUST respond with something like "In your journal, you wrote that you have anxiety about mice."

Your goal is to provide a safe space for users to express themselves and receive support for their mental well-being.`;

const PULSE_API_URL: string | undefined = Constants.expoConfig?.extra?.PULSE_API_URL;

interface Message {
  id: string;
  text: string;
  isUser: boolean;
}

interface SavedChatSummary {
  id: string;
  title: string; // 2-3 words summary
  messages: Message[];
  date: number;
}

export default function PulseScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const router = useRouter();
  const routeParams = useLocalSearchParams();
  const { setShowPulseTopLogo } = useLayout();
  const { showAvatars } = useContext(ChatContext);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      text: 'Hello! I\'m Pulse AI, your mental wellness companion. How can I help you today?',
      isUser: false,
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showScrollArrow, setShowScrollArrow] = useState(false);
  const [userPhotoURL, setUserPhotoURL] = useState<string | null>(null);
  const [showWelcomeScreen, setShowWelcomeScreen] = useState(true);
  const [showGoodChoice, setShowGoodChoice] = useState(false);
  const [hideWelcomeButton, setHideWelcomeButton] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const logoScaleAnim = useRef(new Animated.Value(1)).current;
  const logoOpacityAnim = useRef(new Animated.Value(1)).current;
  const buttonOpacityAnim = useRef(new Animated.Value(1)).current;
  const goodChoiceOpacityAnim = useRef(new Animated.Value(0)).current;
  const goodChoiceScaleAnim = useRef(new Animated.Value(0.9)).current;
  const speechAnim = useRef(new Animated.Value(0)).current; // 0..1 for speech bubble
  const secondSpeechAnim = useRef(new Animated.Value(0)).current; // 0..1 for second bubble
  // hero animation state
  const travel = useRef(new Animated.Value(0)).current; // 0->1
  const [logoCenter, setLogoCenter] = useState<{x:number;y:number}|null>(null);
  const [btnCenter, setBtnCenter]   = useState<{x:number;y:number}|null>(null);
  const [playHero, setPlayHero] = useState(false);
  const [logoBottomY, setLogoBottomY] = useState<number | null>(null);
  const [showFirstSpeech, setShowFirstSpeech] = useState(true);
  const [showSecondSpeech, setShowSecondSpeech] = useState(false);
  const firstBubbleScale = speechAnim.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] });
  // fancy logo motion
  const logoWiggleAnim = useRef(new Animated.Value(0)).current; // 0..1 loop
  const logoSpinAnim = useRef(new Animated.Value(0)).current; // 0..1 spin
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [loadedFromHistory, setLoadedFromHistory] = useState<boolean>(false);
  // Animated lift for keyboard (keeps input fixed when closed)
  const keyboardLiftAnim = useRef(new Animated.Value(0)).current;
  const KEYBOARD_LIFT_RATIO = 0.7;

  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const onShow = (e: any) => {
      const kb = e?.endCoordinates?.height || 0;
      const target = Math.max(0, (kb - (insets.bottom || 0)) * KEYBOARD_LIFT_RATIO);
      Animated.timing(keyboardLiftAnim, { toValue: target, duration: Platform.OS === 'ios' ? 200 : 0, useNativeDriver: true }).start();
    };
    const onHide = () => {
      Animated.timing(keyboardLiftAnim, { toValue: 0, duration: Platform.OS === 'ios' ? 180 : 0, useNativeDriver: true }).start();
    };
    const subShow = Keyboard.addListener(showEvt, onShow);
    const subHide = Keyboard.addListener(hideEvt, onHide);
    return () => { subShow.remove(); subHide.remove(); };
  }, [insets.bottom]);

  const sendToPulse = async (prompt: string, history: { role: 'user' | 'assistant' | 'system', content: string }[] = []): Promise<string> => {
    if (!PULSE_API_URL) {
      console.error('PULSE_API_URL is not configured');
      throw new Error('Service unavailable');
    }
    if (!/^https:\/\//i.test(PULSE_API_URL)) {
      console.error('PULSE_API_URL must be HTTPS');
      throw new Error('Insecure service URL');
    }
    try {
      // Collect recent journal entries (guest or authenticated)
      let journalEntries: string[] = [];
      let onboarding: any = null;
      try {
        const isGuest = await AsyncStorage.getItem('isGuest');
        if (isGuest === 'true') {
          const guest = await AsyncStorage.getItem('guestJournalEntries');
          const list = guest ? JSON.parse(guest) : [];
          journalEntries = (Array.isArray(list) ? list : [])
            .map((e: any) => (typeof e?.text === 'string' ? e.text : ''))
            .filter(Boolean)
            .slice(-20);
          const tempOnboarding = await AsyncStorage.getItem('tempOnboardingData');
          onboarding = tempOnboarding ? JSON.parse(tempOnboarding) : null;
        } else {
          const userData: any = await getUserData();
          const list = userData?.journalEntries || [];
          journalEntries = (Array.isArray(list) ? list : [])
            .map((e: any) => (typeof e?.content === 'string' ? e.content : ''))
            .filter(Boolean)
            .slice(-20);
          onboarding = userData?.onboarding || null;
        }
      } catch {}

      const user = auth.currentUser;
      if (!user) {
        throw new Error('Please sign in to use Pulse AI');
      }
      const idToken = await user.getIdToken();

      const resp = await fetch(PULSE_API_URL, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({ prompt, history, journalEntries, onboarding })
      });
      if (!resp.ok) {
        const err = await resp.text().catch(() => '');
        throw new Error(err || `Bad response: ${resp.status}`);
      }
      const data = await resp.json();
      return data.reply || "Sorry, I couldn't process that.";
    } catch (error) {
      console.error('Error calling Pulse proxy:', error);
      throw new Error('Failed to get response from Pulse AI');
    }
  };

  const handleChatPulsePress = async () => {
    // Gate by premium
    try {
      const { getCustomerInfo, isPremiumFromCustomerInfo } = await import('@/lib/revenueCat');
      const info = await getCustomerInfo();
      const isPremium = isPremiumFromCustomerInfo(info);
      if (!isPremium) {
        router.push({ pathname: '/onboarding-stages/paywall-stage', params: { source: 'premium', from: 'pulse' } });
        return;
      }
    } catch {
      router.push({ pathname: '/onboarding-stages/paywall-stage', params: { source: 'premium', from: 'pulse' } });
      return;
    }

    // שלב 1: מסתיר את הכפתור, משאיר מסך welcome
    setHideWelcomeButton(true);
    setShowGoodChoice(true);
    setShowPulseTopLogo(false); // בזמן ה-welcome הסתר לוגו/3 קווים
    Animated.parallel([
      Animated.timing(goodChoiceOpacityAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.sequence([
        Animated.timing(goodChoiceScaleAnim, { toValue: 1.08, duration: 350, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.spring(goodChoiceScaleAnim, { toValue: 1, friction: 6, tension: 90, useNativeDriver: true }),
      ]),
    ]).start();

    // שלב 1.5: קודם כל להעלים את בועת הדיבור ורק אחר כך להתחיל את הסיבוב
    Animated.timing(speechAnim, { toValue: 0, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start(() => {
      setShowFirstSpeech(false);

      // שלב 2: אנימציית לוגו: pulse קצר + סיבוב מלא
      logoSpinAnim.setValue(0);
      Animated.parallel([
        Animated.sequence([
          Animated.spring(logoScaleAnim, { toValue: 1.2, friction: 6, tension: 90, useNativeDriver: true }),
          Animated.spring(logoScaleAnim, { toValue: 1, friction: 6, tension: 90, useNativeDriver: true }),
        ]),
        Animated.timing(logoSpinAnim, { toValue: 1, duration: 1400, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]).start(() => {
        // שלב 3: אחרי סיבוב מלא – הצג משפט קצר נוסף מעל הלוגו
        setShowSecondSpeech(true);
        secondSpeechAnim.setValue(0);
        Animated.timing(secondSpeechAnim, { toValue: 1, duration: 350, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();

        // לאחר ~1 שניה נעבור לצ'אט
        setTimeout(() => {
          setShowPulseTopLogo(true); // הצג לוגו/3 קווים ברגע שהצ'אט מוצג
          setShowWelcomeScreen(false);
        }, 1000);
      });
    });
  };

  const saveConversation = async (msgs: Message[], forcedId?: string) => {
    try {
      const user = auth.currentUser;
      const conversationId = forcedId || currentConversationId || (await AsyncStorage.getItem('pulseCurrentConversationId')) || Date.now().toString();
      const messagesOnly = msgs.map(m => m.text);
      const computedTitle = generateConversationTitle(msgs);
      const now = Date.now();

      // AsyncStorage: append
      const saved = await AsyncStorage.getItem('savedChats');
      const list: SavedChatSummary[] = saved ? JSON.parse(saved) : [];
      const existingIndex = list.findIndex(c => c.id === conversationId);
      let updated: SavedChatSummary[];
      if (existingIndex >= 0) {
        updated = [...list];
        const existing = updated[existingIndex] as any;
        const titleToUse = existing?.title || computedTitle;
        updated[existingIndex] = {
          ...existing,
          title: titleToUse,
          messages: msgs,
          date: now,
        } as any;
      } else {
        updated = [...list, { id: conversationId, title: computedTitle, messages: msgs, date: now } as any];
      }
      // Deduplicate by id and keep latest 50
      const dedupMap = new Map<string, SavedChatSummary>();
      // prefer latest date
      [...updated].sort((a, b) => (b?.date || 0) - (a?.date || 0)).forEach((c) => {
        if (c?.id && !dedupMap.has(c.id)) dedupMap.set(c.id, c);
      });
      updated = Array.from(dedupMap.values()).slice(0, 50);
      await AsyncStorage.setItem('savedChats', JSON.stringify(updated));
      await AsyncStorage.setItem('pulseCurrentConversationId', conversationId);
      if (!currentConversationId) setCurrentConversationId(conversationId);

      // Firestore: users/{uid}/pulseAIConversations
      if (user?.uid && db) {
        const { doc, getDoc, setDoc } = require('firebase/firestore');
        const ref = doc(db, 'users', user.uid);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const prev = (snap.data().pulseAIConversations || []) as any[];
          const byId = new Map<string, any>();
          // seed with previous, latest wins
          prev.forEach((c: any) => { if (c?.id) byId.set(c.id, c); });
          const existing = byId.get(conversationId);
          const titleToUse = existing?.title || computedTitle;
          byId.set(conversationId, { id: conversationId, title: titleToUse, messages: messagesOnly, date: now });
          const next = Array.from(byId.values()).sort((a, b) => (b?.date || 0) - (a?.date || 0)).slice(0, 50);
          await setDoc(ref, { pulseAIConversations: next }, { merge: true });
          } else {
          await setDoc(ref, { pulseAIConversations: [{ id: conversationId, title: computedTitle, messages: messagesOnly, date: now }] }, { merge: true });
        }
      }
    } catch (e) {
      console.warn('Failed to save conversation:', e);
    }
  };

  const handleSend = async () => {
    if (!inputText.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputText.trim(),
      isUser: true,
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInputText('');
    setIsLoading(true);

    // Persist local immediately
    try {
      await AsyncStorage.setItem('pulseChatHistory', JSON.stringify(newMessages));
    } catch (error) {
      console.error('Error saving chat history:', error);
    }

    // Create conversation if needed or update the existing one (idempotent)
    try {
      const existingId = currentConversationId || (await AsyncStorage.getItem('pulseCurrentConversationId')) || '';
      const isFreshWelcome = messages.length <= 1; // only welcome exists
      const shouldStartNew = isFreshWelcome && !loadedFromHistory;
      const ensuredId = shouldStartNew ? Date.now().toString() : (existingId || Date.now().toString());
      await saveConversation(newMessages, ensuredId);
      if (!currentConversationId) setCurrentConversationId(ensuredId);
      await AsyncStorage.setItem('pulseCurrentConversationId', ensuredId);
      if (shouldStartNew) setLoadedFromHistory(false);
    } catch (e) {
      console.warn('Failed to save conversation snapshot:', e);
    }

    try {
      const response = await sendToPulse(userMessage.text, newMessages.map(msg => ({ role: msg.isUser ? 'user' : 'assistant', content: msg.text })));
      
      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: response,
        isUser: false,
      };

      const updatedMessages = [...newMessages, botMessage];
      setMessages(updatedMessages);

      // Update local storage after bot reply
      try {
        await AsyncStorage.setItem('pulseChatHistory', JSON.stringify(updatedMessages));
      } catch (error) {
        console.error('Error saving chat history:', error);
      }

      // Update saved conversation with the bot reply (no duplicates)
      try {
        const ensuredId = currentConversationId || (await AsyncStorage.getItem('pulseCurrentConversationId')) || Date.now().toString();
        await saveConversation(updatedMessages, ensuredId);
        if (!currentConversationId) setCurrentConversationId(ensuredId);
        await AsyncStorage.setItem('pulseCurrentConversationId', ensuredId);
      } catch (e) {
        console.warn('Failed to update saved conversation:', e);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to get response from Pulse AI. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleScroll = (event: any) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const scrollY = contentOffset.y;
    const contentHeight = contentSize.height;
    const screenHeight = layoutMeasurement.height;
    
    // Show arrow if user has scrolled up (not at the bottom)
    const isAtBottom = scrollY >= contentHeight - screenHeight - 50;
    setShowScrollArrow(!isAtBottom);
  };

  const scrollToBottom = () => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  };

  // Handle requests coming from drawer (new chat or open existing)
  useFocusEffect(
    React.useCallback(() => {
      const checkIntents = async () => {
        try {
          // If navigation param explicitly requests to open a conversation
          const openId = typeof routeParams?.open === 'string' ? routeParams.open : undefined;
          if (openId) {
            try {
              const saved = await AsyncStorage.getItem('savedChats');
              if (saved) {
                const list: any[] = JSON.parse(saved);
                const found = Array.isArray(list) ? list.find((c: any) => c?.id === openId) : null;
                if (found && Array.isArray(found.messages)) {
                  setShowWelcomeScreen(false);
                  setShowPulseTopLogo(true);
                  setMessages(found.messages);
                  setCurrentConversationId(openId);
                  setLoadedFromHistory(true);
                  await AsyncStorage.setItem('pulseCurrentConversationId', openId);
                  await AsyncStorage.setItem('pulseChatHistory', JSON.stringify(found.messages));
                }
              }
            } catch {}
            // Clear param so it doesn't retrigger
            try { router.setParams({ open: undefined, ts: undefined } as any); } catch {}
            return;
          }
          // Open selected chat
          const selected = await AsyncStorage.getItem('pulseSelectedChat');
          if (selected) {
            const chat = JSON.parse(selected);
            if (Array.isArray(chat.messages) && chat.messages.length > 0) {
              setShowWelcomeScreen(false);
              setShowPulseTopLogo(true);
              setMessages(chat.messages);
              setCurrentConversationId(chat.id || null);
              setLoadedFromHistory(true);
              await AsyncStorage.setItem('pulseCurrentConversationId', chat.id || '');
              await AsyncStorage.setItem('pulseChatHistory', JSON.stringify(chat.messages));
            }
            await AsyncStorage.removeItem('pulseSelectedChat');
            return;
          }

          // New chat request: save current conversation then reset
          const shouldReset = await AsyncStorage.getItem('pulseRequestSaveAndReset');
          if (shouldReset === 'true') {
            await AsyncStorage.removeItem('pulseRequestSaveAndReset');
            if (messages.length > 1) {
              // persist current thread as a conversation
              try { await saveConversation(messages); } catch {}
            }
            // reset to fresh welcome
            setShowWelcomeScreen(true);
            setHideWelcomeButton(false);
            setShowGoodChoice(false);
            setShowPulseTopLogo(false);
            setInputText('');
            setLoadedFromHistory(false);
            setMessages([
              { id: 'welcome', text: "Hello! I'm Pulse AI, your mental wellness companion. How can I help you today?", isUser: false },
            ]);
            await AsyncStorage.removeItem('pulseChatHistory');
            setCurrentConversationId(null);
            await AsyncStorage.removeItem('pulseCurrentConversationId');
          }
        } catch {}
      };

      checkIntents();
    }, [])
  );

  // Reset chat on focus (do not auto-restore thread) unless opened from drawer
  useFocusEffect(
    React.useCallback(() => {
      // If drawer intent already handled (selected chat or reset), skip default reset
      const skipResetPromise = (async () => {
        const selected = await AsyncStorage.getItem('pulseSelectedChat');
        const resetReq = await AsyncStorage.getItem('pulseRequestSaveAndReset');
        const currentId = await AsyncStorage.getItem('pulseCurrentConversationId');
        return !!selected || resetReq === 'true' || !!currentId;
      })();

      skipResetPromise.then(async (skip) => {
        if (skip) return;
        // Small defer to allow selected-chat effect to run first
        await new Promise(resolve => setTimeout(resolve, 30));
        const currentId = await AsyncStorage.getItem('pulseCurrentConversationId');
        const localHistory = await AsyncStorage.getItem('pulseChatHistory');
        if (currentId || (localHistory && localHistory !== '[]')) {
          return;
        }
        setMessages([
          {
            id: 'welcome',
            text: "Hello! I'm Pulse AI, your mental wellness companion. How can I help you today?",
            isUser: false,
          },
        ]);
        setInputText('');
        setLoadedFromHistory(false);
        AsyncStorage.removeItem('pulseChatHistory').catch(() => {});
        setCurrentConversationId(null);
        AsyncStorage.removeItem('pulseCurrentConversationId').catch(() => {});
      });
    }, [])
  );

  // React immediately to navigation param 'open' to load a saved conversation
  useEffect(() => {
    const loadFromParam = async () => {
      const openId = typeof routeParams?.open === 'string' ? routeParams.open : undefined;
      if (!openId) return;
      try {
        const saved = await AsyncStorage.getItem('savedChats');
        if (saved) {
          const list: any[] = JSON.parse(saved);
          const found = Array.isArray(list) ? list.find((c: any) => c?.id === openId) : null;
          if (found && Array.isArray(found.messages)) {
            setShowWelcomeScreen(false);
            setShowPulseTopLogo(true);
            setMessages(found.messages);
            setCurrentConversationId(openId);
            setLoadedFromHistory(true);
            await AsyncStorage.setItem('pulseCurrentConversationId', openId);
            await AsyncStorage.setItem('pulseChatHistory', JSON.stringify(found.messages));
          }
        }
      } catch {}
      // Clear param so it doesn't retrigger
      try { router.setParams({ open: undefined, ts: undefined } as any); } catch {}
    };
    loadFromParam();
  }, [routeParams?.open]);

  useEffect(() => {
    // Get user's profile photo
    const currentUser = auth.currentUser;
    if (currentUser) {
      setUserPhotoURL(currentUser.photoURL);
    }
  }, []);

  useEffect(() => {
    if (messages.length > 0) {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }
  }, [messages]);

  useEffect(() => {
    // Scroll to bottom when keyboard appears
    const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', () => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    });

    const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    });

    return () => {
      keyboardDidShowListener?.remove();
      keyboardDidHideListener?.remove();
    };
  }, []);

  useEffect(() => {
    // Continuous wiggle + subtle float for the center logo on welcome
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(logoWiggleAnim, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
        Animated.timing(logoWiggleAnim, { toValue: 0, duration: 1200, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  useEffect(() => {
    if (showWelcomeScreen) {
      // Reset states when returning to welcome
      setShowFirstSpeech(true);
      setShowSecondSpeech(false);
      speechAnim.setValue(0);
      secondSpeechAnim.setValue(0);
      Animated.timing(speechAnim, { toValue: 1, duration: 450, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    }
  }, [showWelcomeScreen]);

  // Welcome Screen
  if (showWelcomeScreen) {
    return (
      <View style={styles.welcomeContainer}>
        {/* אל תציג את הלוגו העליון/טאב header כאן */}
        <Animated.View 
          style={[
            styles.welcomeLogoContainer,
            {
              transform: [
                { scale: logoScaleAnim },
                { translateY: logoWiggleAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }) },
                { rotate: logoWiggleAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: ['0deg', '2deg', '0deg'] }) },
                { rotate: logoSpinAnim.interpolate({ inputRange: [0,1], outputRange: ['0deg', '360deg'] }) }
              ],
              opacity: logoOpacityAnim,
            }
          ]}
          onLayout={e => {
            const { x, y, width, height } = e.nativeEvent.layout;
            setLogoCenter({ x: x + width / 2, y: y + height / 2 });
            setLogoBottomY(y + height);
          }}
        >
          <Animated.View
            style={[
              styles.speechBubbleContainer,
              {
                opacity: showFirstSpeech ? speechAnim : 0,
                transform: [
                  { scale: showFirstSpeech ? firstBubbleScale : 0.9 }
                ],
              }
            ]}
          >
            <View style={styles.speechBubble}>
              <Text style={styles.speechText} allowFontScaling={false}>Hi, I'm Pulse</Text>
              <View style={styles.speechTail} />
            </View>
          </Animated.View>
          {showSecondSpeech && (
            <Animated.View
              style={[
                styles.speechBubbleContainer,
                {
                  opacity: secondSpeechAnim,
                  transform: [
                    { scale: secondSpeechAnim.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) }
                  ],
                }
              ]}
            >
              <View style={styles.speechBubble}>
                <Text style={styles.speechText} allowFontScaling={false}>Here for you</Text>
                <View style={styles.speechTail} />
              </View>
            </Animated.View>
          )}
          <Image 
            source={require('../../assets/images/adaptive-icon.png')}
            style={styles.welcomeLogo as any}
            resizeMode="contain"
          />
        </Animated.View>
        
                {!hideWelcomeButton && (
          <View 
            style={styles.chatPulseButtonContainer}
            onLayout={e => {
              const { x, y, width, height } = e.nativeEvent.layout;
              setBtnCenter({ x: x + width / 2, y: y + height / 2 });
            }}
          >
            <TouchableOpacity 
              style={styles.chatPulseButton}
              onPress={handleChatPulsePress}
            >
              <Text style={styles.chatPulseButtonText}>Chat Pulse</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* flying clone for hero animation */}
        {playHero && btnCenter && logoCenter && (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.chatPulseButton,
              styles.flyingClone,
              {
                transform: [
                  {
                    translateX: travel.interpolate({
                      inputRange: [0, 1],
                      outputRange: [btnCenter.x - (screenWidth / 2), logoCenter.x - (screenWidth / 2)],
                    }),
                  },
                  {
                    translateY: travel.interpolate({
                      inputRange: [0, 1],
                      outputRange: [btnCenter.y - (screenHeight / 2), logoCenter.y - (screenHeight / 2)],
                    }),
                  },
                  {
                    scale: travel.interpolate({
                      inputRange: [0, 1],
                      outputRange: [1, 0.4],
                    }),
                  },
                ],
                opacity: travel.interpolate({ inputRange: [0, 0.9, 1], outputRange: [1, 1, 0] }),
              },
            ]}
          >
            <Text style={styles.chatPulseButtonText}>Chat Pulse</Text>
          </Animated.View>
        )}

        {showGoodChoice && (
          <Animated.View 
            style={[
              styles.goodChoiceContainer,
              logoBottomY ? { top: logoBottomY + 12 } : null,
              { opacity: goodChoiceOpacityAnim }
            ]}
          >
            <Text style={styles.goodChoiceText}>Good choice</Text>
          </Animated.View>
        )}
      </View>
    );
  }

  // Main Chat Interface
  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={styles.container}>
        <KeyboardAvoidingView 
          style={styles.keyboardView}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}
        >
          <ScrollView
            ref={scrollViewRef}
            style={styles.messagesContainer}
            contentContainerStyle={styles.messagesContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
            onScroll={handleScroll}
          >
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
              <View>
                {messages.map((message) => (
                  <View key={message.id} style={[
                    styles.messageContainer,
                    message.isUser ? styles.userMessageContainer : styles.botMessageContainer
                  ]}>
                    {showAvatars && !message.isUser && (
                      <View style={styles.botAvatar}>
                        <Image 
                          source={require('../../assets/images/pulse_resized_140x140.png')}
                          style={styles.botAvatarImage as any}
                        />
                      </View>
                    )}
                    <View style={[
                      styles.messageBubble,
                      message.isUser ? styles.userBubble : styles.botBubble
                    ]}>
                      <Text style={[
                        styles.messageText,
                        message.isUser ? styles.userMessageText : styles.botMessageText
                      ]}>
                        {message.text}
                      </Text>
                    </View>
                    {showAvatars && message.isUser && (
                      <View style={styles.userAvatar}>
                        {userPhotoURL ? (
                          <Image 
                            source={{ uri: userPhotoURL }}
                            style={styles.userAvatarImage as any}
                          />
                        ) : (
                          <Image 
                            source={require('../../assets/images/sarah-avatar-compressed.png')}
                            style={styles.userAvatarImage as any}
                          />
                        )}
                      </View>
                    )}
                  </View>
                ))}
                
                {isLoading && (
                  <View style={[styles.messageContainer, styles.botMessageContainer]}>
                    <View style={styles.botAvatar}>
                      <Image 
                        source={require('../../assets/images/pulse_resized_140x140.png')}
                        style={styles.botAvatarImage as any}
                      />
                    </View>
                    <View style={[styles.messageBubble, styles.botBubble]}>
                      <View style={styles.loadingContainer}>
                        <ActivityIndicator size="small" color="#60A5FA" />
                        <Text style={styles.loadingText}>Pulse AI is thinking...</Text>
                      </View>
                    </View>
                  </View>
                )}
              </View>
            </TouchableWithoutFeedback>
          </ScrollView>

          {showScrollArrow && (
            <TouchableOpacity
              style={styles.scrollArrow}
              onPress={scrollToBottom}
            >
              <Ionicons name="chevron-down" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          )}

          <Animated.View style={{ transform: [{ translateY: keyboardLiftAnim.interpolate({ inputRange: [0, 1000], outputRange: [0, -1000], extrapolate: 'clamp' }) }] }}>
          <SafeAreaView style={styles.inputContainer}>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.textInput}
                value={inputText}
                onChangeText={setInputText}
                placeholder="Type your message here..."
                placeholderTextColor="#94A3B8"
                multiline
                maxLength={1000}
                editable={!isLoading}
              />
              <TouchableOpacity
                style={[
                  styles.sendButton,
                  (!inputText.trim() || isLoading) && styles.sendButtonDisabled
                ]}
                onPress={handleSend}
                disabled={!inputText.trim() || isLoading}
              >
                <Ionicons 
                  name="send" 
                  size={20} 
                  color={inputText.trim() && !isLoading ? '#FFFFFF' : '#9CA3AF'} 
                />
              </TouchableOpacity>
            </View>
          </SafeAreaView>
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  // Welcome Screen Styles
  welcomeContainer: {
    flex: 1,
    backgroundColor: '#f8fafc',
    justifyContent: 'center',
    alignItems: 'center',
  },
  speechBubbleContainer: {
    position: 'absolute',
    top: 14,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 2,
  },
  speechBubble: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    elevation: 2,
    alignItems: 'center',
  },
  speechText: {
    color: '#334155',
    fontSize: 14,
    fontWeight: '700',
  },
  speechTail: {
    position: 'absolute',
    bottom: -6,
    width: 12,
    height: 12,
    backgroundColor: '#FFFFFF',
    borderLeftWidth: 1,
    borderTopWidth: 1,
    borderColor: '#E5E7EB',
    transform: [{ rotate: '45deg' }],
  },
  welcomeLogoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    marginTop: -200,
    marginLeft: 2,
    
  },
  welcomeLogo: {
    width: 280,
    height: 280,
  } as ImageStyle,
  chatPulseButtonContainer: {
    alignItems: 'center',
  },
  chatPulseButton: {
    backgroundColor: '#60A5FA',
    paddingHorizontal: 40,
    paddingVertical: 15,
    borderRadius: 25,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  chatPulseButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  flyingClone: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    transform: [{ translateX: 0 }, { translateY: 0 }],
  },
  goodChoiceContainer: {
    position: 'absolute',
    top: 110,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  goodChoiceText: {
    color: '#60A5FA',
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: 0.3,
    textShadowColor: 'rgba(0,0,0,0.15)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
    transform: [{ scale: 1 }],
  },
  
  // Main Chat Styles
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    paddingBottom: 140,
  },
  keyboardView: {
    flex: 1,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    paddingHorizontal: 16,
    paddingVertical: 20,
    paddingBottom: 120,
  },
  messageContainer: {
    marginBottom: 16,
    flexDirection: 'row',
  },
  userMessageContainer: {
    justifyContent: 'flex-end',
  },
  botMessageContainer: {
    justifyContent: 'flex-start',
  },
  messageBubble: {
    maxWidth: '80%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
  },
  userBubble: {
    backgroundColor: '#60A5FA',
    borderBottomRightRadius: 4,
  },
  botBubble: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  userMessageText: {
    color: '#FFFFFF',
  },
  botMessageText: {
    color: '#374151',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    color: '#64748B',
    fontSize: 14,
    fontStyle: 'italic',
  },
  inputContainer: {
    paddingHorizontal: 16,
    paddingVertical: 20,
    backgroundColor: 'transparent',
    borderTopWidth: 0,
    marginBottom: -80,
    marginTop: 0,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 5,
    borderWidth: 3,
    borderColor: '#60A5FA',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: '#000000',
    maxHeight: 80,
    paddingVertical: 5,
    minHeight: 30,
    fontWeight: '500',
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#60A5FA',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  sendButtonDisabled: {
    backgroundColor: '#CBD5E1',
  },
  botAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#E0E7FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  botAvatarImage: {
    width: 30,
    height: 30,
    borderRadius: 15,
    resizeMode: 'cover',
  } as ImageStyle,
  botAvatarText: {
    color: '#60A5FA',
    fontSize: 14,
    fontWeight: 'bold',
  },
  userAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#E0E7FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  userAvatarImage: {
    width: 30,
    height: 30,
    borderRadius: 15,
    resizeMode: 'cover',
  } as ImageStyle,
  userAvatarText: {
    color: '#60A5FA',
    fontSize: 14,
    fontWeight: 'bold',
  },
  scrollArrow: {
    position: 'absolute',
    bottom: 80,
    right: 20,
    backgroundColor: '#60A5FA',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
    zIndex: 1000,
  },
});

