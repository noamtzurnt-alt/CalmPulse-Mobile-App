import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  ScrollView, 
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  Modal,
  Dimensions,
  Pressable,
  Alert,
  ActivityIndicator,
  Keyboard,
  TouchableWithoutFeedback,
  Platform
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLanguage } from '@/lib/LanguageContext';
import { doc, setDoc, getDoc, collection, addDoc, query, where, getDocs, deleteDoc, updateDoc, arrayUnion, Timestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { useFocusEffect } from '@react-navigation/native';
import { checkPremiumStatus } from '@/lib/premiumUtils';
import { saveJournalEntry, getUserData } from '@/lib/userDataUtils';
import { useNavigation } from '@react-navigation/native';
import { showInterstitialAd } from '@/lib/adUtils';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export default function JournalScreen() {
  const { t, language } = useLanguage();
  const AI_SUGGESTIONS: string[] = t('aiSuggestions') as string[];
  const [selectedEmotions, setSelectedEmotions] = useState<number[]>([]);
  const [journalText, setJournalText] = useState('');
  const [selectedTriggers, setSelectedTriggers] = useState<number[]>([]);
  const [promptText, setPromptText] = useState('');
  const [userName, setUserName] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const navigation = useNavigation();
  const [journalEntries, setJournalEntries] = useState<Array<{
    id: string;
    text: string;
    preview: string;
    date: string;
  }>>([]);
  const [deleteConfirm, setDeleteConfirm] = useState<{show: boolean, entryIndex: number}>({
    show: false,
    entryIndex: -1
  });
  const [showSuggestionsModal, setShowSuggestionsModal] = useState(false);
  const [currentSuggestions, setCurrentSuggestions] = useState<string[]>([]);
  const [usedSuggestions, setUsedSuggestions] = useState<Set<string>>(new Set());
  const router = useRouter();
  const [journalHistory, setJournalHistory] = useState<{ text: string; date: string }[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<{ text: string; date: string } | null>(null);
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentEditingEntry, setCurrentEditingEntry] = useState<{ date: string } | null>(null);
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  // Inline AI suggestions state
  const [showInlineSuggestions, setShowInlineSuggestions] = useState(false);
  const [inlineSuggestions, setInlineSuggestions] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<'general' | 'reflection' | 'gratitude' | 'anxiety' | 'goals' | 'relationships'>('general');
  const [pageHeight, setPageHeight] = useState(0);
  const LINE_HEIGHT = 28;
  const FONT_SIZE = 18;
  const HEADER_HEIGHT = 36;
  const LEFT_MARGIN = 36;
  const BASELINE_SHIFT = Platform.OS === 'ios' ? Math.round(FONT_SIZE * 0.28) : Math.round(FONT_SIZE * 0.22);

  useEffect(() => {
    const loadUserName = async () => {
      try {
        const userData = await getUserData();
        const nameFromDb = (userData as any)?.onboarding?.name;
        if (typeof nameFromDb === 'string' && nameFromDb.trim()) {
          setUserName(nameFromDb.trim());
          return;
        }
        const temp = await AsyncStorage.getItem('tempOnboardingData');
        if (temp) {
          const parsed: any = JSON.parse(temp);
          if (typeof parsed?.name === 'string' && parsed.name.trim()) {
            setUserName(parsed.name.trim());
          }
        }
      } catch {}
    };
    loadUserName();
  }, []);

  // Auto-save when leaving the screen
  useEffect(() => {
    const unsubscribeBeforeRemove = navigation.addListener('beforeRemove', async () => {
      if (journalText.trim() && !isAutoSaving) {
        setIsAutoSaving(true);
        try { await saveJournal(true); } catch {}
        setIsAutoSaving(false);
      }
    });
    const unsubscribeBlur = navigation.addListener('blur', async () => {
      if (journalText.trim() && !isAutoSaving) {
        setIsAutoSaving(true);
        try { await saveJournal(true); } catch {}
        setIsAutoSaving(false);
      }
    });
    return () => {
      unsubscribeBeforeRemove();
      unsubscribeBlur();
    };
  }, [navigation, journalText, isAutoSaving]);

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        // Check if user is guest
        const isGuest = await AsyncStorage.getItem('isGuest');
        
        if (isGuest === 'true') {
          console.log('👤 Loading initial journal data for guest user');
          loadJournalHistory();
          return;
        }
        
        // For authenticated users
        if (!auth || !db) {
          console.log('❌ Firebase not initialized - falling back to guest mode');
          loadJournalHistory();
          return;
        }
        
        const user = auth.currentUser;
        if (user) {
          console.log('👤 Loading initial journal data for authenticated user');
          loadJournalEntries();
        } else {
          console.log('❌ No user logged in - falling back to guest mode');
          loadJournalHistory();
        }
      } catch (error) {
        console.error('Error loading initial journal data:', error);
      }
    };
    
    // Only load data if we don't already have entries
    if (journalHistory.length === 0) {
    loadInitialData();
    }
  }, [journalHistory.length]);

  useFocusEffect(
    React.useCallback(() => {
      const loadData = async () => {
        try {
          // Check if user is guest
          const isGuest = await AsyncStorage.getItem('isGuest');
          
          if (isGuest === 'true') {
            console.log('👤 Loading journal data for guest user');
            loadJournalHistory();
            return;
          }
          
          // For authenticated users
          if (!auth || !db) {
            console.log('❌ Firebase not initialized - falling back to guest mode');
            loadJournalHistory();
            return;
          }
          
          const user = auth.currentUser;
          if (user) {
            console.log('👤 Loading journal data for authenticated user');
            loadJournalEntries();
            loadJournalHistory();
          } else {
            console.log('❌ No user logged in - falling back to guest mode');
            loadJournalHistory();
          }
        } catch (error) {
          console.error('Error loading journal data:', error);
        }
      };
      
      // Only load data if we don't already have entries
      if (journalHistory.length === 0) {
      loadData();
      }
    }, [journalHistory.length])
  );


  const loadJournalEntries = async () => {
    try {
      // Check if user is guest
      const isGuest = await AsyncStorage.getItem('isGuest');
      if (isGuest === 'true') {
        console.log('👤 Loading journal entries for guest user');
        const existing = await AsyncStorage.getItem('guestJournalEntries');
        const entries = existing ? JSON.parse(existing) : [];
        setJournalEntries(entries);
        return;
      }
      
      // For authenticated users - check Firebase initialization
      if (!auth || !db) {
        console.log('❌ Firebase not initialized - auth:', !!auth, 'db:', !!db);
        // Try to load from AsyncStorage as fallback
        const existing = await AsyncStorage.getItem('guestJournalEntries');
        const entries = existing ? JSON.parse(existing) : [];
        setJournalEntries(entries);
        return;
      }
      
      const user = auth.currentUser;
      if (!user) {
        console.log('❌ No user logged in');
        return;
      }
      const userRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userRef);
      const data = userDoc.data();
      const entries = (data?.journalEntries || []).map((e: any) => ({ id: e.id, text: e.content, preview: e.content.slice(0, 40), date: '' }));
      setJournalEntries(entries);
    } catch (error) {
      console.error('Error loading entries:', error);
    }
  };

  const loadJournalHistory = async () => {
    try {
      const isGuest = await AsyncStorage.getItem('isGuest');
      if (isGuest === 'true') {
        const existing = await AsyncStorage.getItem('guestJournalEntries');
        const entries = existing ? JSON.parse(existing) : [];
        setJournalHistory(entries);
        return;
      }
      
      // For authenticated users, try to load from user document
      try {
        const userData = await getUserData();
        if (userData?.journalEntries) {
          const entries = userData.journalEntries.map((entry, index) => ({
            text: entry.content,
            date: new Date(Date.now() - (userData.journalEntries!.length - index - 1) * 60000).toISOString(), // Approximate date based on order
        }));
        setJournalHistory(entries);
          console.log('✅ Loaded journal entries from user document:', entries.length);
        } else {
          console.log('⚠️ No journal entries found in user document');
          setJournalHistory([]);
        }
      } catch (firebaseError) {
        console.log('❌ Firebase error, falling back to local storage:', firebaseError);
        // Fallback to local storage
        const existing = await AsyncStorage.getItem('guestJournalEntries');
        const entries = existing ? JSON.parse(existing) : [];
        setJournalHistory(entries);
      }
    } catch (error) {
      console.error('Error loading journal history:', error);
      // Don't show alert, just set empty history
      setJournalHistory([]);
    }
  };

  const getRandomSuggestions = () => {
    if (usedSuggestions.size >= AI_SUGGESTIONS.length - 3) {
      setUsedSuggestions(new Set());
      const shuffled = [...AI_SUGGESTIONS].sort(() => 0.5 - Math.random());
      const newSuggestions = shuffled.slice(0, 3);
      setUsedSuggestions(new Set(newSuggestions));
      return newSuggestions;
    }

    const unusedSuggestions = AI_SUGGESTIONS.filter((suggestion: string) => !usedSuggestions.has(suggestion));
    
    const shuffled = [...unusedSuggestions].sort(() => 0.5 - Math.random());
    const newSuggestions = shuffled.slice(0, 3);
    
    setUsedSuggestions(prev => new Set([...prev, ...newSuggestions]));
    
    return newSuggestions;
  };

  // Basic keyword-driven categorization using recent history
  const inferCategoryFromHistory = (): typeof selectedCategory => {
    const last = journalHistory.slice(-3).map(e => e.text.toLowerCase()).join(' ');
    if (!last) return 'general';
    if (/thank|grateful|appreciat|תודה|מודה|הכרת/i.test(last)) return 'gratitude';
    if (/anxiet|anxious|stress|worry|panic|חרד|לחץ|פחד/i.test(last)) return 'anxiety';
    if (/goal|plan|task|improve|מטרה|תכנית|יעד/i.test(last)) return 'goals';
    if (/friend|family|partner|relationship|חבר|משפחה|זוג|יחסים/i.test(last)) return 'relationships';
    return 'reflection';
  };

  // English-only base suggestions
  const BASE_EN_SUGGESTIONS: string[] = [
    'What’s weighing on my mind right now?',
    'One small win from today was…',
    'If I could change one tiny thing today, it would be…',
    'I felt most like myself when…',
    'Something I’m avoiding and why…',
    'A kind thing I can do for myself this week is…',
    'Today, I learned…',
    'One boundary I want to protect is…',
    'I am proud that I…',
    'What would future-me thank me for doing today?'
  ];

  const CATEGORY_SUGGESTIONS: Record<typeof selectedCategory, string[]> = {
    general: [
      'What’s on my mind right now?',
      'Today I feel… because…',
      'If I could change one small thing today it would be…',
      'One small win from today was…',
      'Something I’m avoiding and why…',
      'A kind thing I can do for myself is…',
      'What would future‑me thank me for?',
      'Where did I feel comfortable or safe today?',
      'What do I need more of? Less of?',
      'One thing I can let go of right now is…',
      'I felt most like myself when…',
      'Something unexpected that happened was…',
    ],
    reflection: [
      'A moment from today worth remembering is…',
      'One lesson I learned recently is…',
      'Something I handled better than before…',
      'If I could replay one conversation, I would say…',
      'When did I feel calm today and why?',
      'What surprised me about myself this week?',
      'What energized me vs. drained me?',
      'If today were a chapter title, it would be…',
      'How did I move 1% closer to who I want to be?',
      'A belief I’m questioning lately is…',
      'I’m noticing a pattern that…',
      'What I want to remember from today is…',
    ],
    gratitude: [
      'Three small things I’m grateful for are…',
      'A person who made my day easier and how…',
      'Something ordinary that felt special today…',
      'A comfort I appreciate lately is…',
      'I’m thankful my body allowed me to…',
      'A peaceful moment I noticed was…',
      'I appreciate myself for…',
      'Someone I want to thank (even silently) is…',
      'A resource or tool that helped me is…',
      'A challenge that taught me something is…',
      'One part of my routine I’m grateful for…',
      'An act of kindness I saw or did…',
    ],
    anxiety: [
      'What’s worrying me? What’s in my control vs. not?',
      'If a friend felt this way, I would tell them…',
      'One tiny action I can take to feel safer is…',
      'What evidence supports my fear? What evidence doesn’t?',
      'What would be “good enough” right now?',
      'A place or person that helps me regulate is…',
      'If I postponed this worry for an hour, what would I do now?',
      'What does my body need (water, breath, rest, movement)?',
      'What is the kindest next step I can take?',
      'If the worst didn’t happen, what might happen instead?',
      'One thought I can reframe as…',
      'Three breaths in, four out — after that I will…',
    ],
    goals: [
      'One tiny goal for this week and the first step is…',
      'What blocked my progress? One possible fix is…',
      'If everything goes well, in one month I will…',
      'A task I can break into 5‑minute parts is…',
      'What matters most vs. what’s just noise?',
      'What can I delegate, delete, or delay?',
      'A habit I’ll try for 7 days is…',
      'What does “done, not perfect” look like?',
      'One metric of progress I’ll track is…',
      'If motivation is low, the minimum I’ll do is…',
      'What I can finish today in 20 minutes is…',
      'A reward I’ll give myself after a step is…',
    ],
    relationships: [
      'A meaningful conversation I had and what I learned…',
      'A small gesture I can do for someone I care about…',
      'A boundary I want to keep and how I’ll communicate it…',
      'How can I ask for what I need clearly and kindly?',
      'Someone I miss and what I’d say to them…',
      'A repair I want to make (apology, check‑in, thanks)…',
      'What makes me feel respected and how can I express it?',
      'One way to bring more play or warmth into a relationship…',
      'A conversation I’m avoiding and one first sentence…',
      'A value I want more of in my connections is…',
      'How can I listen 10% better this week?',
      'What support do I need to ask for?',
    ],
  };

  const generateContextualSuggestions = (category: typeof selectedCategory) => {
    // Prefer category-specific; mix with generic; ensure 3 items
    const base = CATEGORY_SUGGESTIONS[category] || CATEGORY_SUGGESTIONS.general;
    const pool = [...base, ...CATEGORY_SUGGESTIONS.general, ...BASE_EN_SUGGESTIONS];
    const shuffled = [...pool].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, 3);
  };

  const refreshInlineSuggestions = (cat?: typeof selectedCategory) => {
    const catToUse = cat || inferCategoryFromHistory();
    setSelectedCategory(catToUse);
    const suggestions = generateContextualSuggestions(catToUse);
    setInlineSuggestions(suggestions);
    setShowInlineSuggestions(true);
    AsyncStorage.setItem('lastAISuggestions', JSON.stringify({ cat: catToUse, suggestions })).catch(() => {});
  };

  const handleAISuggestions = async () => {
    try {
      const { getCustomerInfo, isPremiumFromCustomerInfo } = await import('@/lib/revenueCat');
      const info = await getCustomerInfo();
      const isPremium = isPremiumFromCustomerInfo(info);
      if (!isPremium) {
        router.push({ pathname: '/onboarding-stages/paywall-stage', params: { source: 'premium', from: 'journal' } });
        return;
      }
    } catch {
      router.push({ pathname: '/onboarding-stages/paywall-stage', params: { source: 'premium', from: 'journal' } });
      return;
    }
    // Open modal with contextual suggestions
    refreshInlineSuggestions();
    setCurrentSuggestions(inlineSuggestions);
    setShowSuggestionsModal(true);
  };

  const handleSuggestionTap = (text: string) => {
    // Append to current text with spacing
    const needsNewline = journalText && !journalText.endsWith('\n');
    setJournalText(prev => (prev ? `${prev}${needsNewline ? '\n' : ''}${text}` : text));
  };

  const handleSuggestionLongPress = (text: string) => {
    // Replace current text
    setJournalText(text);
  };

  const saveGuestJournal = async (text: string) => {
    const newEntry = {
      text,
      date: new Date().toISOString()
    };
    const existing = await AsyncStorage.getItem('guestJournalEntries');
    const entries = existing ? JSON.parse(existing) : [];
    entries.push(newEntry);
    await AsyncStorage.setItem('guestJournalEntries', JSON.stringify(entries));
    setJournalHistory(entries);
  };

  const saveJournal = async (silent?: boolean) => {
    console.log('saveJournal called');
    if (!journalText.trim()) {
      console.log('No text to save');
      return;
    }
    // setIsLoading(true); // Disable blocking loader
    const isGuest = await AsyncStorage.getItem('isGuest');
    if (isGuest === 'true') {
      await saveGuestJournal(journalText);
      setJournalText('');
      if (!silent) {
        await showInterstitialAd();
        Alert.alert('Success', 'Journal entry saved locally');
      }
      // setIsLoading(false);
      return;
    }
    try {
      if (!auth || !db) {
        console.log('❌ Firebase not initialized - auth:', !!auth, 'db:', !!db);
        // Fallback to guest mode
        await saveGuestJournal(journalText);
        setJournalText('');
        if (!silent) {
          await showInterstitialAd();
          Alert.alert('Success', 'Journal entry saved locally');
        }
        return;
      }
      
      const user = auth.currentUser;
      if (!user) {
        console.log('❌ No user logged in - falling back to guest mode');
        await saveGuestJournal(journalText);
        setJournalText('');
        if (!silent) {
          await showInterstitialAd();
          Alert.alert('Success', 'Journal entry saved locally');
        }
        return;
      }
      const journalRef = collection(db, 'users', user.uid, 'journal');
      if (currentEditingEntry) {
        console.log('Updating existing entry');
        const newEntry = {
          id: Date.now().toString(),
          content: journalText
        };
        
        await saveJournalEntry(newEntry);
        
        setJournalHistory(prevHistory => 
          prevHistory.map(entry => 
            entry.date === currentEditingEntry.date 
              ? { ...entry, text: journalText } 
              : entry
          )
        );
        console.log('Entry updated successfully');
      } else {
        console.log('Adding new entry');
        const newEntry = {
          id: Date.now().toString(),
          content: journalText
        };
        
        await saveJournalEntry(newEntry);
        
        const entryForHistory = {
          text: journalText,
          date: new Date().toISOString()
        };
        setJournalHistory(prev => [...prev, entryForHistory]);
        console.log('New entry saved successfully to user document');
      }
      setJournalText('');
      setCurrentEditingEntry(null);
      if (!silent) {
        await showInterstitialAd();
        Alert.alert('Success', 'Journal entry saved successfully');
      }
      await loadJournalEntries();
      // setIsLoading(false);
    } catch (error) {
      console.error('Error saving journal:', error);
      if (!silent) Alert.alert('Error', 'Failed to save journal entry');
      // setIsLoading(false);
    }
  };

  const deleteEntry = async (index: number) => {
    try {
      // setIsLoading(true); // no blocking overlay
      setDeleteConfirm({ show: false, entryIndex: -1 });
      const isGuest = await AsyncStorage.getItem('isGuest');
      if (isGuest === 'true') {
        const existing = await AsyncStorage.getItem('guestJournalEntries');
        let entries = existing ? JSON.parse(existing) : [];
        entries = entries.filter((_: any, i: number) => i !== index);
        await AsyncStorage.setItem('guestJournalEntries', JSON.stringify(entries));
        setJournalEntries(entries);
        setJournalHistory(entries);
        // setIsLoading(false);
        Alert.alert('Success', 'Entry deleted');
        return;
      }
      // Authenticated: remove from user document journalEntries array
      if (!auth || !db) {
        console.log('❌ Firebase not initialized - cannot delete entry');
        return;
      }
      
      const user = auth.currentUser;
      if (!user) {
        console.log('❌ No user logged in - cannot delete entry');
        return;
      }
      const userRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userRef);
      if (userDoc.exists()) {
        const data: any = userDoc.data();
        const entries: Array<{ id: string; content: string }> = data.journalEntries || [];
        if (index >= 0 && index < entries.length) {
          entries.splice(index, 1);
          await updateDoc(userRef, { journalEntries: entries });
          setJournalEntries(prev => prev.filter((_, i) => i !== index));
          setJournalHistory(prev => prev.filter((_, i) => i !== index));
          Alert.alert('Success', 'Entry deleted');
        }
      }
    } catch (error) {
      console.error('Error deleting entry:', error);
      Alert.alert('Error', 'Failed to delete journal entry');
    } finally {
      // setIsLoading(false);
    }
  };

  const handleTextChange = (text: string) => {
    setJournalText(text);
  };

  const clearHistory = async () => {
    try {
      if (!auth || !db) {
        console.log('❌ Firebase not initialized - cannot clear history');
        return;
      }
      
      const user = auth.currentUser;
      if (!user) {
        console.log('❌ No user logged in - cannot clear history');
        return;
      }
      
      const journalRef = collection(db, 'users', user.uid, 'journal');
      const querySnapshot = await getDocs(journalRef);
      
      querySnapshot.docs.forEach(async (document) => {
        await deleteDoc(doc(db!, 'users', user.uid, 'journal', document.id));
      });

      setJournalEntries([]);
    } catch (error) {
      console.error('Error clearing history:', error);
    }
  };

  const viewJournalEntry = (entry: { text: string; date: string }) => {
    setJournalText(entry.text);
    setCurrentEditingEntry(entry);
    setShowHistory(false);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  const dismissKeyboard = () => {
    Keyboard.dismiss();
  };

  return (
    <SafeAreaView style={styles.container}>
      <TouchableWithoutFeedback onPress={dismissKeyboard}>
        <ScrollView 
          style={[
            styles.scrollView,
            Platform.OS === 'android' && isKeyboardVisible && { marginBottom: 0 }
          ]}
        >
          <View style={styles.header}>
            <Text style={styles.title}>{t('personalJournal')}</Text>
          </View>

          <View style={[styles.section, styles.centeredSection]}>
            <TouchableOpacity 
              style={styles.historyButton} 
              onPress={() => setShowHistory(true)}
            >
              <View style={styles.historyContent}>
                <View style={styles.threeLines}>
                  <View style={styles.line}></View>
                  <View style={styles.line}></View>
                  <View style={styles.line}></View>
                </View>
              </View>
            </TouchableOpacity>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('shareThoughts')}</Text>
            {promptText && (
              <Text style={styles.promptText}>{promptText}</Text>
            )}
            <View
              style={styles.notebookWrapper}
              onLayout={(e) => setPageHeight(e.nativeEvent.layout.height)}
            >
              {/* Page shading for depth */}
              <LinearGradient
                colors={["rgba(0,0,0,0.06)", "transparent"]}
                style={styles.leftShadow}
                pointerEvents="none"
              />
              <LinearGradient
                colors={["transparent", "rgba(0,0,0,0.05)"]}
                style={styles.rightShadow}
                pointerEvents="none"
              />
              {/* Left margin line */}
              <View style={[styles.marginLine, { left: LEFT_MARGIN }]} />
              {/* Ruled lines */}
              <View style={styles.linesLayer} pointerEvents="none">
                {Array.from({ length: Math.ceil(Math.max(pageHeight - HEADER_HEIGHT, 0) / LINE_HEIGHT) }).map((_, i) => (
                  <View key={i} style={[styles.ruleLine, { top: HEADER_HEIGHT + BASELINE_SHIFT + i * LINE_HEIGHT - 4 }]} />
                ))}
              </View>
              {/* Spiral binding holes */}
              <View style={styles.ringsColumn} pointerEvents="none">
                {Array.from({ length: 8 }).map((_, i) => (
                  <View key={i} style={[styles.hole, { top: 16 + i * 48 }]} />
                ))}
              </View>
              {/* Spine accent */}
              <View style={styles.spine} pointerEvents="none" />
              {/* The actual input */}
              <TextInput
                style={[
                  styles.notebookInput,
                  {
                    lineHeight: LINE_HEIGHT,
                    fontSize: FONT_SIZE,
                    paddingTop: HEADER_HEIGHT,
                    paddingBottom: LINE_HEIGHT,
                    paddingLeft: LEFT_MARGIN + 10,
                    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
                    includeFontPadding: false
                  }
                ]}
                placeholder={String(t('writeHere'))}
                placeholderTextColor="#64748b"
                multiline
                value={journalText}
                onChangeText={handleTextChange}
                onFocus={() => setIsKeyboardVisible(true)}
                onBlur={() => setIsKeyboardVisible(false)}
              />
            </View>
            {showInlineSuggestions && (
              <View style={styles.suggestionsInline}>
                {/* We disable inline render for now; modal will show suggestions */}
              </View>
            )}
            <TouchableOpacity 
              style={styles.aiSuggestButton}
              onPress={handleAISuggestions}
            >
              <Ionicons name="sparkles-outline" size={24} color="#60A5FA" />
              <Text style={styles.aiSuggestText}>{t('getAiSuggestions')}</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity 
            style={styles.saveButton}
            onPress={() => saveJournal()}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="white" size="small" />
            ) : (
              <Text style={styles.saveButtonText}>{t('save')}</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </TouchableWithoutFeedback>

      <Modal
        visible={showHistory}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowHistory(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{(userName ? `${userName} Journal` : (t('journalHistory') as string) || 'Journal')}</Text>
              <TouchableOpacity 
                onPress={() => setShowHistory(false)}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color="#334155" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.entriesList}>
              {journalHistory.length === 0 ? (
                <Text style={styles.emptyHistoryText}>{t('noJournalEntries')}</Text>
              ) : (
                journalHistory.map((entry, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.entryItem}
                    onPress={() => viewJournalEntry(entry)}
                  >
                    <View style={styles.entryHeader}>
                      <Text style={styles.entryText} numberOfLines={2}>{entry.text}</Text>
                      <TouchableOpacity 
                        onPress={(e) => {
                          e.stopPropagation();
                          setShowHistory(false);
                          setTimeout(() => {
                            setDeleteConfirm({ show: true, entryIndex: index });
                          }, 100);
                        }}
                        style={styles.deleteButton}
                      >
                        <Ionicons name="trash-outline" size={20} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                    <Text style={styles.entryDate}>
                      {formatDate(entry.date)}
                    </Text>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={deleteConfirm.show}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setDeleteConfirm({ show: false, entryIndex: -1 })}
      >
        <Pressable 
          style={styles.modalOverlay}
          onPress={() => setDeleteConfirm({ show: false, entryIndex: -1 })}
        >
          <Pressable 
            style={styles.confirmModal}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={styles.confirmTitle}>{t('deleteEntry')}</Text>
            <Text style={styles.confirmText}>{t('deleteEntryConfirm')}</Text>
            <View style={styles.confirmButtons}>
              <TouchableOpacity 
                style={[styles.confirmButton, styles.cancelButton]}
                onPress={() => setDeleteConfirm({ show: false, entryIndex: -1 })}
              >
                <Text style={styles.confirmButtonText}>{t('no')}</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.confirmButton, styles.deleteConfirmButton]}
                onPress={() => deleteEntry(deleteConfirm.entryIndex)}
              >
                <Text style={[styles.confirmButtonText, styles.deleteButtonText]}>{t('yes')}</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {showSuggestionsModal && (
        <Modal
          visible={showSuggestionsModal}
          transparent={true}
          animationType="fade"
        >
          <View style={styles.modalOverlay}>
            <View style={styles.suggestionsModalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{t('aiSuggestionsTitle')}</Text>
                <TouchableOpacity 
                  onPress={() => setShowSuggestionsModal(false)}
                  style={styles.closeButton}
                >
                  <Ionicons name="close" size={24} color="#334155" />
                </TouchableOpacity>
              </View>

              {/* Categories row */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 6 }}>
                {(['general','reflection','gratitude','anxiety','goals','relationships'] as const).map(cat => (
                  <TouchableOpacity key={cat} onPress={() => { refreshInlineSuggestions(cat); setCurrentSuggestions(inlineSuggestions); }} style={[styles.categoryChip, selectedCategory === cat && styles.categoryChipActive]}>
                    <Text style={[styles.categoryChipText, selectedCategory === cat && styles.categoryChipTextActive]} allowFontScaling={false}>
                      {cat === 'reflection' ? 'Reflection' : cat === 'gratitude' ? (language==='he' ? 'הכרת תודה' : 'Gratitude') : cat === 'anxiety' ? (language==='he' ? 'חרדה' : 'Anxiety') : cat === 'goals' ? (language==='he' ? 'מטרות' : 'Goals') : cat === 'relationships' ? (language==='he' ? 'יחסים' : 'Relationships') : (language==='he' ? 'כללי' : 'General')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Suggestions list */}
              <ScrollView style={styles.suggestionsList}>
                {inlineSuggestions.map((s, i) => (
                  <TouchableOpacity 
                    key={`${s}-${i}`} 
                    style={styles.suggestionItem}
                    onPress={() => {
                      handleSuggestionTap(s);
                      setShowSuggestionsModal(false);
                    }}
                    onLongPress={() => {
                      handleSuggestionLongPress(s);
                      setShowSuggestionsModal(false);
                    }}
                  >
                    <Text style={styles.suggestionText}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <TouchableOpacity 
                style={styles.refreshButton}
                onPress={() => { refreshInlineSuggestions(selectedCategory); setCurrentSuggestions(inlineSuggestions); }}
              >
                <Text style={styles.refreshButtonText}>{t('refresh')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      <Modal
        visible={showEntryModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowEntryModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{formatDate(selectedEntry?.date || '')}</Text>
              <TouchableOpacity 
                style={styles.closeButton}
                onPress={() => setShowEntryModal(false)}
              >
                <Ionicons name="close" size={24} color="#1e293b" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.entryContent}>
              <Text style={styles.entryText}>{selectedEntry?.text}</Text>
            </ScrollView>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scrollView: {
    flex: 1,
    padding: screenWidth * 0.04,
    paddingTop: 0,
    marginTop: -screenHeight * 0,
    marginBottom: screenHeight * 0.02,
  },
  header: {
    alignItems: 'center',
    marginTop: 0,
    marginBottom: screenHeight * 0.005,
  },
  title: {
    fontSize: screenWidth * 0.068,
    fontWeight: '700',
    color: '#0f172a',
    letterSpacing: 0.3,
  },
  promptText: {
    color: '#60A5FA',
    fontSize: 14,
    marginBottom: 2,
    fontStyle: 'italic',
  },
  section: {
    marginBottom: screenHeight * 0.02,
    marginTop: -screenHeight * 0.01,
  },
  sectionTitle: {
    fontSize: screenWidth * 0.045,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: screenHeight * 0.02,
    marginTop: screenHeight * 0.01,
    letterSpacing: 0.2,
  },
  emotionsContainer: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  emotionButton: {
    alignItems: 'center',
    padding: 12,
    marginRight: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    minWidth: 80,
  },
  selectedEmotion: {
    backgroundColor: '#bfdbfe',
  },
  emotionEmoji: {
    fontSize: 24,
    marginBottom: 4,
  },
  emotionText: {
    fontSize: 14,
    color: '#334155',
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: screenWidth * 0.03,
    padding: screenWidth * 0.04,
    height: screenHeight * 0.42,
    fontSize: screenWidth * 0.04,
    color: '#000000',
    textAlign: 'left',
    writingDirection: 'ltr',
    borderWidth: 2,
    borderColor: '#60A5FA',
    shadowColor: '#60A5FA',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  aiSuggestButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: screenHeight * 0.02,
    padding: -screenWidth * 0.02,
  },
  aiSuggestText: {
    marginLeft: screenWidth * 0.02,
    color: '#60A5FA',
    fontSize: screenWidth * 0.045,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  triggersContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: -4,
    paddingBottom: 8,
  },
  triggerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 8,
    borderRadius: 12,
    marginBottom: 6,
    width: '32%',
  },
  selectedTrigger: {
    backgroundColor: '#bfdbfe',
  },
  triggerIcon: {
    fontSize: 18,
    marginRight: 4,
  },
  triggerText: {
    fontSize: 12,
    color: '#334155',
    flex: 1,
  },
  saveButton: {
    backgroundColor: '#60A5FA',
    padding: screenHeight * 0.02,
    borderRadius: screenWidth * 0.03,
    alignItems: 'center',
    marginTop: screenHeight * 0.0,
    marginBottom: screenHeight * 0.06,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: screenWidth * 0.04,
    fontWeight: '600',
  },
  centeredSection: {
    alignItems: 'center',
  },
  centeredTitle: {
    textAlign: 'center',
    fontSize: 16,
    marginBottom: 14,
    marginTop: 6,
  },
  analyticsButton: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#60A5FA',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 8,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  historyButton: {
    paddingVertical: screenHeight * 0.01,
    paddingHorizontal: screenWidth * 0.03,
    backgroundColor: '#fff',
    borderRadius: screenWidth * 0.02,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    alignSelf: 'flex-end',
    marginRight: screenWidth * 0.04,
    position: 'absolute',
    top: screenHeight * 0.015,
    right: 0,
    zIndex: 1,
  },
  historyContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  threeLines: {
    gap: 4,
    width: 24,
    alignItems: 'center',
  },
  line: {
    width: 20,
    height: 2,
    backgroundColor: '#334155',
    borderRadius: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: screenWidth * 0.04,
    width: '100%',
    maxHeight: '80%',
    padding: screenWidth * 0.05,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: screenWidth * 0.05,
    fontWeight: '600',
    color: '#334155',
  },
  closeButton: {
    padding: 4,
  },
  entriesList: {
    maxHeight: '100%',
  },
  entryItem: {
    backgroundColor: '#f8fafc',
    padding: screenWidth * 0.04,
    borderRadius: screenWidth * 0.03,
    marginBottom: screenHeight * 0.015,
  },
  entryText: {
    fontSize: screenWidth * 0.04,
    color: '#334155',
    marginBottom: screenHeight * 0.01,
  },
  entryDate: {
    fontSize: screenWidth * 0.035,
    color: '#64748b',
  },
  entryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  deleteButton: {
    padding: 4,
  },
  confirmModal: {
    backgroundColor: '#fff',
    borderRadius: screenWidth * 0.04,
    padding: screenWidth * 0.05,
    width: '80%',
    alignItems: 'center',
  },
  confirmTitle: {
    fontSize: screenWidth * 0.045,
    fontWeight: '600',
    color: '#334155',
    marginBottom: screenHeight * 0.015,
  },
  confirmText: {
    fontSize: screenWidth * 0.04,
    color: '#64748b',
    marginBottom: screenHeight * 0.025,
    textAlign: 'center',
  },
  confirmButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  confirmButton: {
    paddingVertical: screenHeight * 0.01,
    paddingHorizontal: screenWidth * 0.06,
    borderRadius: screenWidth * 0.02,
    minWidth: screenWidth * 0.25,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#e2e8f0',
  },
  deleteConfirmButton: {
    backgroundColor: '#EF4444',
  },
  confirmButtonText: {
    fontSize: screenWidth * 0.04,
    fontWeight: '500',
    color: '#334155',
  },
  deleteButtonText: {
    color: '#fff',
  },
  chatContainer: {
    flex: 1,
    position: 'relative',
    paddingLeft: 40,
  },
  linesContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 0,
  },
  messages: {
    flex: 1,
    zIndex: 1,
    backgroundColor: 'transparent',
  },
  suggestionsModalContent: {
    backgroundColor: '#fff',
    borderRadius: screenWidth * 0.04,
    width: '90%',
    maxHeight: '80%',
    padding: screenWidth * 0.05,
  },
  suggestionsList: {
    marginVertical: 16,
  },
  suggestionItem: {
    padding: screenWidth * 0.04,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  suggestionText: {
    fontSize: screenWidth * 0.04,
    color: '#334155',
  },
  refreshButton: {
    backgroundColor: '#60A5FA',
    padding: screenHeight * 0.015,
    borderRadius: screenWidth * 0.02,
    alignItems: 'center',
    marginTop: screenHeight * 0.02,
  },
  refreshButtonText: {
    color: '#fff',
    fontSize: screenWidth * 0.04,
    fontWeight: '600',
  },
  emptyHistoryText: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 16,
  },
  entryContent: {
    padding: 16,
  },
  loadingOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 10,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#334155',
    marginTop: 10,
  },
  suggestionsInline: {
    marginTop: 10,
    gap: 8,
  },
  categoryChip: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#fff',
    marginRight: 4,
  },
  categoryChipActive: {
    borderColor: '#60A5FA',
    backgroundColor: '#eff6ff',
  },
  categoryChipText: {
    fontSize: 12,
    color: '#334155',
    fontWeight: '600',
  },
  categoryChipTextActive: {
    color: '#1d4ed8',
  },
  suggestionChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
  },
  suggestionChip: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  suggestionChipText: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '500',
    maxWidth: screenWidth * 0.6,
  },
  refreshChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#60A5FA',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#F8FAFF',
  },
  refreshChipText: {
    color: '#60A5FA',
    fontSize: 13,
    fontWeight: '700',
  },
  notebookWrapper: {
    position: 'relative',
    backgroundColor: '#fff',
    borderRadius: screenWidth * 0.03,
    padding: screenWidth * 0.04,
    borderWidth: 2,
    borderColor: '#60A5FA',
    shadowColor: '#60A5FA',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
    minHeight: screenHeight * 0.42, // Ensure minimum height for the notebook
    overflow: 'hidden',
  },
  leftShadow: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 12,
    borderTopLeftRadius: screenWidth * 0.03,
    borderBottomLeftRadius: screenWidth * 0.03,
  },
  rightShadow: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 12,
    borderTopRightRadius: screenWidth * 0.03,
    borderBottomRightRadius: screenWidth * 0.03,
  },
  marginLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: '#e2e8f0',
    zIndex: 1,
  },
  linesLayer: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    right: 0,
    zIndex: 0,
  },
  ruleLine: {
    position: 'absolute',
    left: 0,
    width: '100%',
    height: 1,
    backgroundColor: '#e2e8f0',
  },
  ringsColumn: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 20,
    zIndex: 2,
  },
  hole: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#111827',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 1.5,
    elevation: 2,
  },
  spine: {
    position: 'absolute',
    left: -2,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: '#cbd5e1',
    borderRadius: 2,
    zIndex: 1,
  },
  notebookInput: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    padding: 0,
    margin: 0,
    fontSize: screenWidth * 0.043,
    color: '#000000',
    textAlign: 'left',
    writingDirection: 'ltr',
    textAlignVertical: 'top',
    zIndex: 2,
  },
}); 
