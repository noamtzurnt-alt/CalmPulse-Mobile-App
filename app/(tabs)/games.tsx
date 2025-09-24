import * as React from 'react';
import { StyleSheet, View, Text, Pressable, TouchableOpacity, SafeAreaView, Modal, Dimensions, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Link, Stack } from 'expo-router';
import { useLanguage } from '@/lib/LanguageContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export default function GamesScreen() {
  const router = useRouter();
  const [isPressed, setIsPressed] = useState(false);
  const [isTimerPressed, setIsTimerPressed] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const { t, language } = useLanguage();
  const insets = useSafeAreaInsets();

  const handlePress = (game: 'color-match' | 'focus-timer' | 'puzzle-calm') => {
    if (game === 'color-match') {
      setIsPressed(true);
      router.push('/(games)/color-match');
      setTimeout(() => setIsPressed(false), 200);
    } else if (game === 'focus-timer') {
      setIsTimerPressed(true);
      router.push('/(games)/focus-timer');
      setTimeout(() => setIsTimerPressed(false), 200);
    } else {
      router.push('/(games)/puzzle-calm');
    }
  };

  return (
    <>
      <Stack
        screenOptions={{
          headerStyle: {
            backgroundColor: '#f8fafc',
          },
          headerShadowVisible: false,
          headerRight: () => (
            <TouchableOpacity 
              onPress={() => setShowSettings(true)}
              style={styles.settingsButton}
            >
              <Ionicons name="settings-outline" size={24} color="#1e293b" />
            </TouchableOpacity>
          ),
        }}
      />

      <Modal
        animationType="slide"
        transparent={true}
        visible={showSettings}
        onRequestClose={() => setShowSettings(false)}
      >
        <SafeAreaView style={styles.modalOverlay}>
          <TouchableOpacity 
            style={styles.dismissArea} 
            onPress={() => setShowSettings(false)}
            activeOpacity={1}
          />
          <View style={styles.modalContent}>
            <View style={styles.settingsSection}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Settings</Text>
                <TouchableOpacity 
                  onPress={() => setShowSettings(false)}
                  style={styles.closeButton}
                >
                  <Ionicons name="close" size={24} color="#1e293b" />
                </TouchableOpacity>
              </View>

              <View style={styles.userSection}>
                <Text style={styles.userSectionTitle}>Current User</Text>
                <Text style={styles.userInfo}>Not logged in</Text>
              </View>

              <TouchableOpacity style={styles.settingItem}>
                <Ionicons name="shield-checkmark-outline" size={24} color="#1e293b" />
                <Text style={styles.settingText}>Privacy Policy</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.settingItem}
                onPress={() => setIsMuted(!isMuted)}
              >
                <Ionicons 
                  name={isMuted ? "volume-mute" : "volume-medium"} 
                  size={24} 
                  color="#1e293b" 
                />
                <Text style={styles.settingText}>
                  {isMuted ? "Unmute" : "Mute"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </Modal>

      <ScrollView 
        style={styles.container}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(screenHeight * 0.16, 160) + insets.bottom }
        ]}
        showsVerticalScrollIndicator={true}
        bounces={true}
      >
        <Text style={styles.title}>{t('chooseGame')}</Text>
        <Text style={styles.subtitle} numberOfLines={1} allowFontScaling={false} maxFontSizeMultiplier={1}>
          {String((t('gamesSubtitle') as string) ?? (language === 'he' 
            ? 'תנו למחשבות הפסקה קלה עם משחקים קצרים ומהנים'
            : 'Refocus your mind with quick fun games'))}
        </Text>

        <View style={styles.grid}>
          <Pressable style={[styles.card]} onPress={() => handlePress('color-match')}>
            <View style={styles.iconContainer}>
              <Ionicons name="color-palette-outline" size={screenWidth * 0.06} color="#60A5FA" />
            </View>
            <Text style={styles.cardTitle}>{t('colorMatch')}</Text>
            <Text style={styles.cardDescription}>{t('colorMatchDesc')}</Text>
          </Pressable>

          <Pressable style={[styles.card]} onPress={() => handlePress('focus-timer')}>
            <View style={styles.iconContainer}>
              <Ionicons name="timer-outline" size={screenWidth * 0.06} color="#60A5FA" />
            </View>
            <Text style={styles.cardTitle}>{t('focusTimer')}</Text>
            <Text style={styles.cardDescription}>{t('focusTimerDesc')}</Text>
          </Pressable>

          <Pressable style={[styles.card]} onPress={() => handlePress('puzzle-calm')}>
            <View style={styles.iconContainer}>
              <Ionicons name="ellipse-outline" size={screenWidth * 0.06} color="#60A5FA" />
            </View>
            <Text style={styles.cardTitle}>{t('bubbleDash')}</Text>
            <Text style={styles.cardDescription}>{t('bubbleDashDesc')}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scrollContent: {
    padding: screenWidth * 0.05,
    alignItems: 'center',
    paddingTop: 0,
    paddingBottom: screenHeight * 0.05,
  },
  title: {
    fontSize: screenWidth * 0.08,
    fontWeight: '700',
    color: '#334155',
    marginBottom: screenHeight * 0.01,
    textAlign: 'center',
    marginTop: 0,
  },
  subtitle: {
    fontSize: screenWidth * 0.04,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: screenHeight * 0.005,
  },
  subtitleOld: {
    fontSize: screenWidth * 0.04,
    color: '#64748b',
    marginBottom: screenHeight * 0.02,
    lineHeight: screenHeight * 0.03,
    textAlign: 'center',
    maxWidth: '80%',
  },
  grid: {
    gap: screenHeight * 0.02,
    width: '100%',
    alignItems: 'center',
    paddingBottom: screenHeight * 0.05,
    marginTop: screenHeight * 0.005,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: screenWidth * 0.04,
    padding: screenWidth * 0.05,
    borderWidth: 2,
    borderColor: '#60A5FA',
    shadowColor: '#60A5FA',
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
    width: '100%',
    maxWidth: screenWidth * 0.9,
    marginBottom: screenHeight * 0.01,
  },
  iconContainer: {
    width: screenWidth * 0.1,
    height: screenWidth * 0.1,
    borderRadius: screenWidth * 0.05,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: screenHeight * 0.015,
  },
  cardTitle: {
    fontSize: screenWidth * 0.045,
    fontWeight: '600',
    color: '#334155',
    marginBottom: screenHeight * 0.01,
  },
  cardDescription: {
    fontSize: screenWidth * 0.035,
    color: '#64748b',
    lineHeight: screenHeight * 0.025,
  },
  settingsButton: {
    padding: screenWidth * 0.02,
    marginRight: screenWidth * 0.04,
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
    borderTopLeftRadius: screenWidth * 0.05,
    borderTopRightRadius: screenWidth * 0.05,
    padding: screenWidth * 0.05,
    width: '100%',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: screenHeight * 0.12,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: screenHeight * 0.025,
  },
  modalTitle: {
    fontSize: screenWidth * 0.05,
    fontWeight: '600',
    color: '#1e293b',
  },
  closeButton: {
    padding: screenWidth * 0.02,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: screenHeight * 0.015,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  settingText: {
    marginLeft: screenWidth * 0.03,
    fontSize: screenWidth * 0.04,
    color: '#1e293b',
  },
  userSection: {
    marginTop: screenHeight * 0.015,
    padding: screenWidth * 0.04,
    backgroundColor: '#f8fafc',
    borderRadius: screenWidth * 0.03,
  },
  userSectionTitle: {
    fontSize: screenWidth * 0.04,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: screenHeight * 0.01,
  },
  userInfo: {
    fontSize: screenWidth * 0.035,
    color: '#64748b',
  },
  dismissArea: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: screenHeight * 0.4,
  },
}); 
