import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc, collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { Message } from './types';

// סוגי המידע שנאסוף עבור PULSE
interface UserContext {
  journalEntries: Array<{
    text: string;
    date: string;
    emotions?: string[];
  }>;
  chatHistory: Message[];
  breathingUsage: {count: number, lastUsed: string};
  musicPreferences: {
    songId?: number;
    isCustomMp3?: boolean;
    genre?: string;
    lastPlayed?: string;
  };
  mediaPreferences: {
    photos?: number;
    videos?: number;
    lastViewed?: string;
  };
  gamesUsage: {
    colorMatch?: {plays: number, highScore: number};
    focusTimer?: {plays: number, highScore: number};
    bubbleDash?: {plays: number, highScore: number};
    lastPlayed?: string;
  };
}

interface PulseAIContextType {
  userContext: UserContext;
  refreshUserContext: () => Promise<void>;
  formatContextForAI: () => string;
}

const defaultContext: UserContext = {
  journalEntries: [],
  chatHistory: [],
  breathingUsage: {count: 0, lastUsed: ''},
  musicPreferences: {},
  mediaPreferences: {},
  gamesUsage: {}
};

const PulseAIContext = createContext<PulseAIContextType>({
  userContext: defaultContext,
  refreshUserContext: async () => {},
  formatContextForAI: () => ''
});

export function PulseAIProvider({ children }: { children: React.ReactNode }) {
  const [userContext, setUserContext] = useState<UserContext>(defaultContext);

  // טעינת הקונטקסט בעת טעינת האפליקציה
  useEffect(() => {
    refreshUserContext();
  }, []);

  // פונקציה לרענון הקונטקסט של המשתמש
  const refreshUserContext = async () => {
    try {
      if (!auth) {
        console.log('Firebase auth not initialized');
        return;
      }
      
      const user = auth.currentUser;
      if (!user?.email) return;
      
      if (!db) {
        console.log('Firestore not initialized');
        return;
      }
      
      // טעינת היסטוריית השיחות מ-Firebase
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);
      
      let chatHistory: Message[] = [];
      
      if (userDoc.exists()) {
        const chats = userDoc.data().pulseAiChat || [];
        // מיזוג כל השיחות לרשימה אחת
        chats.forEach((chat: any) => {
          if (chat.messages && Array.isArray(chat.messages)) {
            chatHistory = [...chatHistory, ...chat.messages];
          }
        });
      }
      
      // עדכון הקונטקסט עם היסטוריית השיחות
      setUserContext(prevContext => ({
        ...prevContext,
        chatHistory
      }));
      
      // 1. טעינת רשומות היומן
      const journalEntries = await loadJournalEntries();
      
      // 2. טעינת נתוני שימוש בתרגילי נשימה
      const breathingUsage = await loadBreathingUsage();
      
      // 3. טעינת העדפות מוזיקה
      const musicPreferences = await loadMusicPreferences();
      
      // 4. טעינת העדפות מדיה
      const mediaPreferences = await loadMediaPreferences();
      
      // 5. טעינת נתוני משחקים
      const gamesUsage = await loadGamesUsage();
      
      // עדכון הקונטקסט
      setUserContext({
        journalEntries,
        chatHistory,
        breathingUsage,
        musicPreferences,
        mediaPreferences,
        gamesUsage
      });
    } catch (error) {
      console.error('Error refreshing user context:', error);
    }
  };

  // פונקציות עזר לטעינת נתונים
  const loadJournalEntries = async () => {
    try {
      if (!auth) {
        console.log('Firebase auth not initialized');
        return [];
      }
      
      const user = auth.currentUser;
      if (!user?.email) return [];

      console.log('Loading journal entries for user:', user.email);
      
      if (!db) {
        console.log('Firestore not initialized');
        return [];
      }
      
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);
      
      if (userDoc.exists()) {
        // בדיקה אם יש רשומות יומן
        if (userDoc.data().journalEntries) {
          const entries = userDoc.data().journalEntries;
          console.log('Found journal entries:', entries.length);
          
          // הדפסת הרשומות לצורך דיבוג
          console.log('Journal entries raw data:', JSON.stringify(entries).substring(0, 200));
          
          return entries.map((entry: any) => {
            // בדיקה מה הפורמט של הרשומה
            console.log('Entry format:', Object.keys(entry));
            
            return {
              text: entry.text || entry.content || entry.entry || '',
              date: entry.date || entry.timestamp || new Date().toISOString(),
              emotions: entry.emotions || []
            };
          });
        }
      }
      
      console.log('No journal entries found');
      return [];
    } catch (error) {
      console.error('Error loading journal entries:', error);
      return [];
    }
  };

  const loadBreathingUsage = async () => {
    try {
      const breathingCount = await AsyncStorage.getItem('breathingExerciseCount');
      const lastUsed = await AsyncStorage.getItem('lastBreathingExercise');
      
      return {
        count: breathingCount ? parseInt(breathingCount) : 0,
        lastUsed: lastUsed || ''
      };
    } catch (error) {
      console.error('Error loading breathing usage:', error);
      return { count: 0, lastUsed: '' };
    }
  };

  const loadMusicPreferences = async () => {
    try {
      if (!auth) {
        console.log('Firebase auth not initialized');
        return {};
      }
      
      const user = auth.currentUser;
      if (!user?.email) return {};

      if (!db) {
        console.log('Firestore not initialized');
        return {};
      }
      
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);
      
      if (userDoc.exists() && userDoc.data().music) {
        return userDoc.data().music;
      }
      
      return {};
    } catch (error) {
      console.error('Error loading music preferences:', error);
      return {};
    }
  };

  const loadMediaPreferences = async () => {
    try {
      if (!auth) {
        console.log('Firebase auth not initialized');
        return {};
      }
      
      const user = auth.currentUser;
      if (!user?.email) return {};

      if (!db) {
        console.log('Firestore not initialized');
        return {};
      }
      
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);
      
      const mediaPrefs: any = {};
      
      if (userDoc.exists()) {
        if (userDoc.data().photos && userDoc.data().photos.items) {
          mediaPrefs.photos = userDoc.data().photos.items.length;
        }
        
        if (userDoc.data().videos && userDoc.data().videos.items) {
          mediaPrefs.videos = userDoc.data().videos.items.length;
        }
        
        if (userDoc.data().lastMediaViewed) {
          mediaPrefs.lastViewed = userDoc.data().lastMediaViewed;
        }
      }
      
      return mediaPrefs;
    } catch (error) {
      console.error('Error loading media preferences:', error);
      return {};
    }
  };

  const loadGamesUsage = async () => {
    try {
      const colorMatchHighScore = await AsyncStorage.getItem('colorMatchHighScore');
      const colorMatchPlays = await AsyncStorage.getItem('colorMatchPlays');
      const focusTimerHighScore = await AsyncStorage.getItem('focusTimerHighScore');
      const focusTimerPlays = await AsyncStorage.getItem('focusTimerPlays');
      const bubbleDashHighScore = await AsyncStorage.getItem('bubbleDashHighScore');
      const bubbleDashPlays = await AsyncStorage.getItem('bubbleDashPlays');
      const lastGamePlayed = await AsyncStorage.getItem('lastGamePlayed');
      
      return {
        colorMatch: {
          highScore: colorMatchHighScore ? parseInt(colorMatchHighScore) : 0,
          plays: colorMatchPlays ? parseInt(colorMatchPlays) : 0
        },
        focusTimer: {
          highScore: focusTimerHighScore ? parseInt(focusTimerHighScore) : 0,
          plays: focusTimerPlays ? parseInt(focusTimerPlays) : 0
        },
        bubbleDash: {
          highScore: bubbleDashHighScore ? parseInt(bubbleDashHighScore) : 0,
          plays: bubbleDashPlays ? parseInt(bubbleDashPlays) : 0
        },
        lastPlayed: lastGamePlayed || ''
      };
    } catch (error) {
      console.error('Error loading games usage:', error);
      return {};
    }
  };

  // פונקציה לפורמט הקונטקסט עבור ה-AI
  const formatContextForAI = () => {
    let context = '';
    
    // הוספת מידע מהיומן בצורה בולטת יותר
    if (userContext.journalEntries && userContext.journalEntries.length > 0) {
      context += "## CRITICAL INFORMATION - USER'S JOURNAL ENTRIES ##\n";
      // מיון הרשומות לפי תאריך (החדשות ביותר קודם)
      const sortedEntries = [...userContext.journalEntries].sort((a, b) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      
      // הוספת עד 10 רשומות אחרונות
      const recentEntries = sortedEntries.slice(0, 10);
      recentEntries.forEach((entry, index) => {
        const date = new Date(entry.date).toLocaleDateString();
        context += `\n===== JOURNAL ENTRY ${index + 1} (${date}) =====\n`;
        context += `CONTENT: ${entry.text}\n`;
        if (entry.emotions && entry.emotions.length > 0) {
          context += `EMOTIONS: ${entry.emotions.join(', ')}\n`;
        }
        context += "=====\n";
      });
      
      context += "\nDIRECTION: When the user asks about their journal or what they wrote, you MUST directly reference the specific content above. Do not be vague.\n";
    }
    
    return context;
  };

  // פונקציית עזר לניתוח נושאים נפוצים בשיחות
  const analyzeTopics = (messages: Message[]) => {
    const topics: Record<string, number> = {
      'anxiety': 0,
      'stress': 0,
      'depression': 0,
      'sleep': 0,
      'relaxation': 0,
      'breathing': 0,
      'meditation': 0,
      'music': 0,
      'games': 0,
      'emotions': 0
    };
    
    // מילות מפתח לכל נושא
    const keywordMap: Record<string, string[]> = {
      'anxiety': ['anxiety', 'anxious', 'worry', 'panic', 'חרדה', 'דאגה', 'פאניקה'],
      'stress': ['stress', 'stressed', 'pressure', 'לחץ', 'מתח'],
      'depression': ['depression', 'depressed', 'sad', 'down', 'דיכאון', 'עצוב'],
      'sleep': ['sleep', 'insomnia', 'tired', 'שינה', 'נדודי שינה', 'עייף'],
      'relaxation': ['relax', 'calm', 'peace', 'רגיעה', 'רוגע', 'שלווה'],
      'breathing': ['breath', 'breathing', 'נשימה', 'נשימות'],
      'meditation': ['meditation', 'meditate', 'מדיטציה'],
      'music': ['music', 'song', 'מוזיקה', 'שיר'],
      'games': ['game', 'play', 'משחק', 'לשחק'],
      'emotions': ['feel', 'feeling', 'emotion', 'מרגיש', 'רגש', 'תחושה']
    };
    
    // בדיקת כל הודעה
    messages.forEach(message => {
      const content = message.content.toLowerCase();
      
      // בדיקת כל נושא
      Object.entries(keywordMap).forEach(([topic, keywords]) => {
        keywords.forEach(keyword => {
          if (content.includes(keyword.toLowerCase())) {
            topics[topic]++;
          }
        });
      });
    });
    
    // מיון הנושאים לפי מספר האזכורים
    return Object.fromEntries(
      Object.entries(topics)
        .filter(([_, count]) => count > 0)
        .sort(([_, countA], [__, countB]) => countB - countA)
    );
  };

  return (
    <PulseAIContext.Provider value={{ 
      userContext, 
      refreshUserContext,
      formatContextForAI
    }}>
      {children}
    </PulseAIContext.Provider>
  );
}

export function usePulseAI() {
  return useContext(PulseAIContext);
} 
