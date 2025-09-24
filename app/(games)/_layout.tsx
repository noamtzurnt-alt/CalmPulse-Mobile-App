import React from 'react';
import { Stack } from 'expo-router';
import { useState, useEffect } from 'react';
import { 
  View, 
  Modal, 
  Text, 
  TouchableOpacity, 
  SafeAreaView,
  StyleSheet 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLanguage } from '@/lib/LanguageContext';
import { checkPremiumStatus } from '@/lib/premiumUtils';
import type { Message } from '../../lib/types';
import { translations } from '../../lib/translations';
import { doc, getDoc } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { useFocusEffect } from '@react-navigation/native';
export default function GamesLayout() {
  const router = useRouter();
  const { t } = useLanguage();
  const [showSettings, setShowSettings] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    const syncPremium = async () => {
      try {
        console.log('Games layout checking premium status');
        await checkPremiumStatus(true);
      } catch (error) {
        console.error('Error checking premium in games layout:', error);
      }
    };
    
    syncPremium();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      (async () => {
        try {
          console.log('Games layout focus: refreshing premium');
          await checkPremiumStatus(true);
        } catch {}
      })();
      return () => {};
    }, [])
  );

  return (
    <Stack>
      <Stack.Screen
        name="color-match"
        options={{
          title: String(t('colorMatchTitle')),
          headerStyle: {
            backgroundColor: '#f8fafc',
          },
          headerTintColor: '#334155',
          headerLeft: () => null,
          headerBackVisible: false,
          headerTitleAlign: 'center',
        }}
      />

      <Stack.Screen
        name="focus-timer"
        options={{
          title: String(t('focusTimerTitle')),
          headerStyle: {
            backgroundColor: '#f8fafc',
          },
          headerTintColor: '#334155',
          headerLeft: () => null,
          headerBackVisible: false,
          headerTitleAlign: 'center',
        }}
      />

      <Stack.Screen
        name="puzzle-calm"
        options={{
          title: String(t('bubbleDashTitle')),
          headerStyle: {
            backgroundColor: '#f8fafc',
          },
          headerTintColor: '#334155',
          headerLeft: () => null,
          headerBackVisible: false,
          headerTitleAlign: 'center',
        }}
      />
      <Stack.Screen 
        name="videos" 
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen 
        name="media-preview" 
        options={{
          headerShown: false,
        }}
      />
    </Stack>
  );
}

const styles = StyleSheet.create({
  settingsButton: {
    padding: 8,
    marginRight: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-start',
  },
  modalContent: {
    backgroundColor: 'transparent',
    padding: 0,
    minHeight: '100%',
    justifyContent: 'flex-end',
  },
  settingsSection: {
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
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1e293b',
  },
  closeButton: {
    padding: 8,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  settingText: {
    marginLeft: 12,
    fontSize: 16,
    color: '#1e293b',
  },
  userSection: {
    marginTop: 10,
    padding: 16,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
  },
  userSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 8,
  },
  userInfo: {
    fontSize: 14,
    color: '#64748b',
  },
  dismissArea: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 300,
  },
});
