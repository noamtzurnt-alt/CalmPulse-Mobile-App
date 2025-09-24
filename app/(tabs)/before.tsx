import React, { useState } from 'react';
import { StyleSheet, View, Text, Pressable, Image, Modal, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLanguage } from '@/lib/LanguageContext';
import { Colors } from '@/constants/Colors';
import { checkPremiumStatus } from '@/lib/premiumUtils';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AdBanner from '@/components/AdBanner';

export default function BeforeScreen() {
  const router = useRouter();
  const [leftArrowRotation, setLeftArrowRotation] = useState(180);
  const [rightArrowRotation, setRightArrowRotation] = useState(180);
  const [showBreathingAlert, setShowBreathingAlert] = useState(false);
  const { t, language } = useLanguage();
  const insets = useSafeAreaInsets();

  const handleAnalyticsPress = async () => {
    const hasPremium = await checkPremiumStatus(true);
    
    if (hasPremium) {
      // אם יש למשתמש פרימיום, ננתב אותו למסך האנליטיקס
    } else {
      // אם אין למשתמש פרימיום, ננתב אותו למסך הפרימיום
      router.push({ pathname: '/onboarding-stages/paywall-stage', params: { source: 'premium', from: 'before' } });
    }
  };

  const handleBreathingPress = () => {
    setShowBreathingAlert(true);
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <Text style={styles.headerText}>{t('chooseWayToCalm')}</Text>
        <Ionicons name="heart" size={24} color="#60A5FA" style={styles.heartIcon} />
      </View>

      {/* Grid 2x3 */}
      <View style={styles.grid}>
        <View style={styles.row}>
          <Pressable style={({ pressed }) => [styles.gridButton, pressed && styles.gridButtonPressed]} onPress={handleBreathingPress}>
          <View style={styles.buttonContent}>
              <Ionicons name="leaf-outline" size={28} color="#60A5FA" />
            <Text style={styles.buttonText}>{t('breathing')}</Text>
          </View>
        </Pressable>

          <Pressable style={({ pressed }) => [styles.gridButton, pressed && styles.gridButtonPressed]} onPress={async () => { try { await AsyncStorage.setItem('videoBackIntent', 'true'); } catch {}; router.push('/(tabs)/CalmVideo'); }}>
            <View style={styles.buttonContent}>
              <Ionicons name="videocam-outline" size={28} color="#60A5FA" />
              <Text style={styles.buttonText}>{t('video')}</Text>
            </View>
          </Pressable>
        </View>

        <View style={styles.row}>
          <Pressable style={({ pressed }) => [styles.gridButton, pressed && styles.gridButtonPressed]} onPress={async () => { try { await AsyncStorage.setItem('pulseBackIntent', 'true'); } catch {}; router.push('/(tabs)/pulse'); }}>
            <View style={styles.buttonContent}>
              <Image 
                source={require('../../assets/images/pulse_resized_140x140.png')}
                style={[styles.pulseIconImage, { tintColor: '#60A5FA' }]}
                resizeMode="contain"
              />
              <Text style={styles.buttonText}>{t('pulseAI') || 'Pulse AI'}</Text>
            </View>
        </Pressable>

          <Pressable style={({ pressed }) => [styles.gridButton, pressed && styles.gridButtonPressed]} onPress={async () => { try { await AsyncStorage.setItem('journalBackIntent', 'true'); } catch {}; router.push('/(tabs)/journal'); }}>
            <View style={styles.buttonContent}>
              <Ionicons name="book-outline" size={28} color="#60A5FA" />
              <Text style={styles.buttonText}>{t('journal') || 'Journal'}</Text>
            </View>
        </Pressable>
      </View>

        <View style={styles.row}>
          <Pressable style={({ pressed }) => [styles.gridButton, pressed && styles.gridButtonPressed]} onPress={async () => { try { await AsyncStorage.setItem('gamesBackIntent', 'true'); } catch {}; router.push('/(tabs)/games'); }}>
            <View style={styles.buttonContent}>
              <Ionicons name="game-controller-outline" size={28} color="#60A5FA" />
              <Text style={styles.buttonText}>{t('games') || 'Games'}</Text>
            </View>
          </Pressable>

          <Pressable style={({ pressed }) => [styles.gridButton, pressed && styles.gridButtonPressed]} onPress={async () => { try { await AsyncStorage.setItem('musicBackIntent', 'true'); await AsyncStorage.setItem('musicFrom', 'before'); await AsyncStorage.setItem('musicHeaderBackIntent', 'true'); } catch {}; router.push('/(tabs)/musicnew'); }}>
          <View style={styles.buttonContent}>
              <Ionicons name="musical-notes-outline" size={28} color="#60A5FA" />
              <Text style={styles.buttonText}>{t('music') || 'Music'}</Text>
          </View>
        </Pressable>
        </View>
      </View>

      {/* Custom Breathing Alert Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={showBreathingAlert}
        onRequestClose={() => setShowBreathingAlert(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.customAlertContainer}>
            <Text style={styles.customAlertTitle}>
              ✨ Calming Breath Tip ✨
            </Text>
            {(() => {
              const msg = (t('breathingAlertMessage') as string) || '';
              const lines = msg.split('\n');
              const firstHeadingIndex = lines.findIndex(l => l.trim().endsWith(':'));
              const beforeFirst = lines.slice(0, Math.max(0, firstHeadingIndex));
              const afterFirst = firstHeadingIndex >= 0 ? lines.slice(firstHeadingIndex + 1) : [];

              return (
                <>
                  {/* Render the first heading only (unchanged position) */}
                  {firstHeadingIndex >= 0 && (
                    <Text style={styles.customAlertSubheading}>
                      {lines[firstHeadingIndex]}
                    </Text>
                  )}
                  {/* Move all other lines up slightly as a group */}
                  <View style={styles.customAlertRaisedGroup}>
                    {beforeFirst.map((line, idx) => (
                      <Text key={`b-${idx}`} style={styles.customAlertBody}>
                        {line}
                      </Text>
                    ))}
                    {afterFirst.map((line, idx) => {
                      const isHeading = line.trim().endsWith(':');
                      return (
                        <Text key={`a-${idx}`} style={isHeading ? styles.customAlertSubheading : styles.customAlertBody}>
                          {line}
            </Text>
                      );
                    })}
                  </View>
                </>
              );
            })()}
            
            <TouchableOpacity 
              style={styles.customAlertButton}
              onPress={async () => {
                setShowBreathingAlert(false);
                try { await AsyncStorage.setItem('breathingHeaderBackIntent', 'true'); } catch {}
                router.push('/(tabs)/breathing');
              }}
            >
              <Text style={styles.customAlertButtonText}>
                🌬️ Continue to Breathing
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Sticky Banner Ad */}
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: insets.bottom + 56, alignItems: 'center', zIndex: 1000 }}>
        <AdBanner />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  grid: {
    marginTop: 60,
    paddingHorizontal: 16,
    gap: 22,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    },
  gridButton: {
    backgroundColor: '#F0F8FF',
    borderRadius: 14,
    height: 60,
    flex: 1,
    marginHorizontal: 4,
    borderWidth: 2,
    borderColor: '#60A5FA',
    shadowColor: '#60A5FA',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.22,
    shadowRadius: 8,
    elevation: 5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridButtonPressed: {
    transform: [{ scale: 0.98 }],
  },
  headerContainer: {
    alignItems: 'center',
    marginTop: 50,
  },
  headerText: {
    fontSize: 22,
    fontWeight: '600',
    color: '#334155',
    textAlign: 'center',
    marginHorizontal: 20,
    lineHeight: 30,
  },
  heartIcon: {
    marginTop: 10,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    width: '100%',
    paddingRight: 10,
  },
  buttonText: {
    color: '#111827',
    fontSize: 17,
    fontWeight: '600',
    marginLeft: 0,
  },
  pulseIconImage: {
    width: 24,
    height: 24,
    tintColor: 'white',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  customAlertContainer: {
    backgroundColor: '#60A5FA',
    borderRadius: 20,
    padding: 25,
    margin: 20,
    borderWidth: 3,
    borderColor: '#3B82F6',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    paddingBottom: 45,
  },
  customAlertTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 15,
  },
  customAlertMessage: {
    fontSize: 16,
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 25,
  },
  customAlertSubheading: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginTop: 2,
  },
  customAlertRaisedGroup: {
    marginTop: -8,
  },
  customAlertBody: {
    fontSize: 16,
    fontWeight: '400',
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 24,
  },
  customAlertButton: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    marginTop: 28,
  },
  customAlertButtonText: {
    color: '#60A5FA',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
}); 
