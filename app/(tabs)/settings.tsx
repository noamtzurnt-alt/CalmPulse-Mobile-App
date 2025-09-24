import { TouchableOpacity, View, Text, StyleSheet, SafeAreaView, ScrollView, Switch, Pressable, Linking, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useContext } from 'react';
import { ChatContext } from './_layout';
import { auth } from '@/lib/firebase';
import { signOut } from 'firebase/auth';
// Premium removed
// import { identifyUser } from '@/lib/revenueCat';

import { useLanguage } from '@/lib/LanguageContext';

export default function SettingsScreen() {
  const router = useRouter();
  const { isMuted, setIsMuted } = useContext(ChatContext);
  const { t } = useLanguage();

  const handleLogout = async () => {
    try {
      if (!auth) {
        console.error('Auth is not initialized');
        return;
      }
      await signOut(auth);
      router.replace('/onboarding');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const handleLanguageChange = () => {
    console.log('Change language pressed');
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

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.header}>
          <Text style={styles.title}>Settings</Text>
        </View>

        <View style={styles.section}>
          {/* Premium */}
          <TouchableOpacity 
            style={styles.settingItem}
            onPress={() => router.push({ pathname: '/onboarding-stages/paywall-stage', params: { source: 'premium', from: 'settings' } })}
          >
            <View style={styles.settingContent}>
              <Ionicons name="star" size={24} color="#FCD34D" />
              <Text style={styles.settingText}>{t('premium')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#334155" />
          </TouchableOpacity>

          {/* Send Feedback */}
          <TouchableOpacity 
            style={styles.settingItem}
            onPress={handleSendFeedback}
          >
            <View style={styles.settingContent}>
              <Ionicons name="chatbubble-outline" size={24} color="#334155" />
              <Text style={styles.settingText}>{t('sendFeedback')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#334155" />
          </TouchableOpacity>

          {/* Terms of Service */}
          <TouchableOpacity 
            style={styles.settingItem}
            onPress={() => Linking.openURL('https://calmpulseapp.com/policies/terms-of-service')}
          >
            <View style={styles.settingContent}>
              <Ionicons name="document-text-outline" size={24} color="#334155" />
              <Text style={styles.settingText}>{t('termsOfService')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
          </TouchableOpacity>

          {/* Privacy Policy */}
          <TouchableOpacity 
            style={styles.settingItem}
            onPress={() => Linking.openURL('https://calmpulseapp.com/policies/privacy-policy')}
          >
            <View style={styles.settingContent}>
              <Ionicons name="shield-outline" size={24} color="#334155" />
              <Text style={styles.settingText}>{t('privacyPolicy')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
          </TouchableOpacity>

          {/* Mute Toggle */}
          <View style={styles.settingItem}>
            <View style={styles.settingContent}>
              <Ionicons 
                name={isMuted ? "volume-mute" : "volume-medium"} 
                size={24} 
                color="#334155" 
              />
              <Text style={styles.settingText}>{t('mute')}</Text>
            </View>
            <Switch
              value={isMuted}
              onValueChange={setIsMuted}
              trackColor={{ false: '#cbd5e1', true: '#60A5FA' }}
              thumbColor={isMuted ? '#ffffff' : '#ffffff'}
            />
          </View>

          {/* Daily Reminders */}
          <TouchableOpacity style={styles.settingItem}>
            <View style={styles.settingContent}>
              <Ionicons name="notifications-outline" size={24} color="#334155" />
              <Text style={styles.settingText}>{t('dailyReminders')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#334155" />
          </TouchableOpacity>
        </View>
      </ScrollView>
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
  },
  header: {
    padding: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  section: {
    backgroundColor: '#ffffff',
    position: 'relative',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomColor: '#e2e8f0',
    backgroundColor: '#ffffff',
  },
  settingContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  settingText: {
    fontSize: 16,
    color: '#334155',
  },
  userModal: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderTopWidth: 0,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  userEmail: {
    fontSize: 16,
    color: '#334155',
    marginBottom: 12,
    textAlign: 'center',
    fontWeight: '500',
  },
  logoutButton: {
    backgroundColor: '#ef4444',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  logoutText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
}); 
