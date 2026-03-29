import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, SafeAreaView, Platform, Image, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getUserData } from '@/lib/userDataUtils';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface MyPlanStageProps {
  onComplete: () => void;
  onBack?: () => void;
}

export default function MyPlanStage({ onComplete }: MyPlanStageProps) {
  const [userName, setUserName] = useState<string>('');
  const [desiredFeeling, setDesiredFeeling] = useState<string>('');
  const [feelingNow, setFeelingNow] = useState<string>('');
  const [strongestWhen, setStrongestWhen] = useState<string>('');
  const [strugglingWith, setStrugglingWith] = useState<string>('');
  const [showAdvice, setShowAdvice] = useState<boolean>(false);
  const [summaryOpacity] = useState(new Animated.Value(1));
  const [adviceOpacity] = useState(new Animated.Value(0));

  useEffect(() => {
    const loadName = async () => {
      try {
        const data = await getUserData();
        const nameFromDb = data?.onboarding?.name?.trim();
        if (nameFromDb) {
          setUserName(nameFromDb);
        }
        // Personalization fields from saved onboarding answers
        const onb: any = (data as any)?.onboarding || {};
        if (onb) {
          if (typeof onb['desired_feeling'] === 'string') setDesiredFeeling(onb['desired_feeling']);
          if (typeof onb['feeling_now'] === 'string') setFeelingNow(onb['feeling_now']);
          if (typeof onb['feeling_strongest_when'] === 'string') setStrongestWhen(onb['feeling_strongest_when']);
          if (typeof onb['struggling_with'] === 'string') setStrugglingWith(onb['struggling_with']);
        }
        const temp = await AsyncStorage.getItem('tempOnboardingData');
        if (temp) {
          const parsed: any = JSON.parse(temp);
          if (parsed?.name) setUserName(String(parsed.name));
          if (parsed?.['desired_feeling']) setDesiredFeeling(String(parsed['desired_feeling']));
          if (parsed?.['feeling_now']) setFeelingNow(String(parsed['feeling_now']));
          if (parsed?.['feeling_strongest_when']) setStrongestWhen(String(parsed['feeling_strongest_when']));
          if (parsed?.['struggling_with']) setStrugglingWith(String(parsed['struggling_with']));
        }
      } catch {}
    };
    loadName();
  }, []);

  const displayTitle = userName ? `Your personalized plan is ready, ${userName}` : `Your personalized plan is ready`;

  const buildAdvice = () => {
    const items: { icon: keyof typeof Ionicons.glyphMap; title: string; desc: string }[] = [] as any;
    // 1) Breathing (concise)
    const breathTitle = 'Calm breath';
    const breathDesc = feelingNow
      ? `2 min 4‑7‑8 to ease ${String(feelingNow).toLowerCase()}.`
      : '2 min 4‑7‑8, twice a day.';
    items.push({ icon: 'leaf', title: breathTitle, desc: breathDesc });

    // 2) Journal (concise)
    const journalTitle = '1‑min journal';
    const journalDesc = strugglingWith
      ? `One prompt to help with ${String(strugglingWith).toLowerCase()}.`
      : 'One prompt after each breath.';
    items.push({ icon: 'book', title: journalTitle, desc: journalDesc });

    // 3) Timing (concise)
    const timeTitle = 'Best time';
    const timeDesc = strongestWhen
      ? `We’ll suggest sessions around ${String(strongestWhen).toLowerCase()}.`
      : 'We’ll suggest sessions when it’s hardest for you.';
    items.push({ icon: 'time', title: timeTitle, desc: timeDesc });

    // 4) Focus (concise)
    const focusTitle = '7‑day focus';
    const focusDesc = desiredFeeling
      ? `Aim for ${String(desiredFeeling).toLowerCase()}: 2 breaths + 1 note daily.`
      : '2 breaths + 1 note daily. Progress beats intensity.';
    items.push({ icon: 'sparkles', title: focusTitle, desc: focusDesc });

    // Always return exactly 4
    return items.slice(0, 4);
  };

  const adviceItems = buildAdvice();

  const revealAdvice = () => {
    Animated.timing(summaryOpacity, { toValue: 0, duration: 260, useNativeDriver: true }).start(() => {
      setShowAdvice(true);
      Animated.timing(adviceOpacity, { toValue: 1, duration: 260, useNativeDriver: true }).start();
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.inner}>
        <View style={styles.page}>
          <View style={styles.frame}>
            <View style={styles.headerSection}>
              <Image source={require('@/assets/images/pulse_resized_140x140.png')} style={styles.logo} resizeMode="contain" />
              <View style={styles.badge}><Text allowFontScaling={false} maxFontSizeMultiplier={1} style={styles.badgeText}>Personalized</Text></View>
              <View style={styles.heroCard}>
                {userName ? (
                  <Text allowFontScaling={false} maxFontSizeMultiplier={1} style={styles.title}>
                    Your personalized plan is ready, <Text allowFontScaling={false} maxFontSizeMultiplier={1} style={styles.nameHighlight}>{userName}</Text>
                  </Text>
                ) : (
                  <Text allowFontScaling={false} maxFontSizeMultiplier={1} style={styles.title}>Your personalized plan is ready</Text>
                )}
                <Text allowFontScaling={false} maxFontSizeMultiplier={1} style={styles.subtitle}>Built from your answers. A simple plan you’ll discover step by step.</Text>
              </View>
            </View>
            {/* SUMMARY BLOCK */}
            <Animated.View style={[styles.trustRow, { opacity: summaryOpacity, display: showAdvice ? 'none' : 'flex' }]}>
              <View style={styles.trustItem}>
                <Ionicons name="checkmark-circle" size={16} color="#10B981" style={styles.trustIcon} />
                <View style={styles.trustTexts}>
                  <Text allowFontScaling={false} maxFontSizeMultiplier={1} style={styles.trustText}>Goal: {desiredFeeling || 'calm'}</Text>
                  <Text allowFontScaling={false} maxFontSizeMultiplier={1} style={styles.trustSubText}>We start with steps toward {desiredFeeling || 'calm'}</Text>
                </View>
              </View>
              <View style={styles.trustItem}>
                <Ionicons name="checkmark-circle" size={16} color="#10B981" style={styles.trustIcon} />
                <View style={styles.trustTexts}>
                  <Text allowFontScaling={false} maxFontSizeMultiplier={1} style={styles.trustText}>Timing: {strongestWhen || 'hard moments'}</Text>
                  <Text allowFontScaling={false} maxFontSizeMultiplier={1} style={styles.trustSubText}>We’ll suggest sessions around those times</Text>
                </View>
              </View>
              <View style={styles.trustItem}>
                <Ionicons name="checkmark-circle" size={16} color="#10B981" style={styles.trustIcon} />
                <View style={styles.trustTexts}>
                  <Text allowFontScaling={false} maxFontSizeMultiplier={1} style={styles.trustText}>Breath for {feelingNow || 'now'}</Text>
                  <Text allowFontScaling={false} maxFontSizeMultiplier={1} style={styles.trustSubText}>Calming pace to ease {feelingNow || 'tension'}</Text>
                </View>
              </View>
              <View style={styles.trustItem}>
                <Ionicons name="checkmark-circle" size={16} color="#10B981" style={styles.trustIcon} />
                <View style={styles.trustTexts}>
                  <Text allowFontScaling={false} maxFontSizeMultiplier={1} style={styles.trustText}>Prompts for {strugglingWith || 'your challenge'}</Text>
                  <Text allowFontScaling={false} maxFontSizeMultiplier={1} style={styles.trustSubText}>Short notes to help with {strugglingWith || 'it'}</Text>
                </View>
              </View>
            </Animated.View>

            {/* ADVICE BLOCK */}
            <Animated.View style={[{ opacity: adviceOpacity }, showAdvice ? {} : { display: 'none' }]}>
              <View style={styles.adviceHeader}>
                <Ionicons name="sparkles" size={18} color="#3B82F6" />
                <Text allowFontScaling={false} maxFontSizeMultiplier={1} style={styles.adviceHeaderText}>Pulse advice for you</Text>
              </View>
              <View style={styles.cardsContainer}>
                {adviceItems.map((it, idx) => (
                  <View key={idx} style={styles.adviceCard}>
                    <View style={styles.cardIconWrap}><Ionicons name={it.icon} size={18} color="#3B82F6" /></View>
                    <View style={styles.cardTextWrap}>
                      <Text allowFontScaling={false} maxFontSizeMultiplier={1} style={styles.cardTitle}>{it.title}</Text>
                      <Text allowFontScaling={false} maxFontSizeMultiplier={1} style={styles.cardText}>{it.desc}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </Animated.View>

            {/* Buttons */}
            {showAdvice ? (
              <Animated.View style={[styles.buttonWrap, { opacity: adviceOpacity }] }>
                <Pressable
                  onPress={async () => {
                    try { await AsyncStorage.setItem('fire_onboarding_home', 'true'); } catch {}
                    // optional fade before leaving
                    Animated.timing(adviceOpacity, { toValue: 0, duration: 160, useNativeDriver: true }).start(() => {
                      onComplete();
                    });
                  }}
                  style={({ pressed }) => [
                    styles.primaryButton,
                    pressed && { transform: [{ scale: Platform.OS === 'ios' ? 0.98 : 0.99 }], opacity: 0.95 },
                  ]}
                >
                  <View style={styles.buttonContent}>
                    <Ionicons name="flame" size={18} color="#FFFFFF" style={styles.buttonIcon} />
                    <Text allowFontScaling={false} maxFontSizeMultiplier={1} style={styles.primaryButtonText}>Let's begin</Text>
                  </View>
                </Pressable>
              </Animated.View>
            ) : (
              <Animated.View style={[styles.buttonWrap, { opacity: summaryOpacity, marginTop: 28 }] }>
                <Pressable
                  onPress={revealAdvice}
                  style={({ pressed }) => [
                    styles.primaryButton,
                    pressed && { transform: [{ scale: Platform.OS === 'ios' ? 0.98 : 0.99 }], opacity: 0.95 },
                  ]}
                >
                  <View style={styles.buttonContent}>
                    <Ionicons name="bulb" size={18} color="#FFFFFF" style={styles.buttonIcon} />
                    <Text allowFontScaling={false} maxFontSizeMultiplier={1} style={styles.primaryButtonText}>See Pulse advice</Text>
                  </View>
                </Pressable>
              </Animated.View>
            )}
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 40,
    paddingTop: 56,
  },
  inner: { flex: 1, justifyContent: 'flex-start' },
  page: { width: '100%', maxWidth: 320, alignSelf: 'center' },
  frame: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
    paddingBottom: 44,
  },
  headerSection: {
    marginTop: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  logo: {
    width: 64,
    height: 64,
    marginBottom: 8,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#DBEAFE',
    marginBottom: 14,
  },
  badgeText: {
    color: '#3B82F6',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  heroCard: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
    alignItems: 'center',
    marginBottom: 2,
  },
  nameHighlight: {
    color: '#3B82F6',
    fontWeight: '900',
    fontSize: 26,
  },
  trustRow: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 8,
    marginBottom: 6,
  },
  trustItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderLeftColor: '#10B981',
    borderLeftWidth: 3,
    width: '100%',
    overflow: 'hidden',
  },
  trustIcon: {
    marginRight: 4,
  },
  trustTexts: {
    flexDirection: 'column',
    flex: 1,
    minWidth: 0,
  },
  trustText: {
    fontSize: 13,
    color: '#0f172a',
    fontWeight: '800',
    flexShrink: 1,
    flexGrow: 1,
    width: '100%',
  },
  trustSubText: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
    flexShrink: 1,
    flexGrow: 1,
    width: '100%',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1e293b',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 8,
  },
  section: {
    marginTop: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 8,
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginTop: 16,
    marginBottom: 4,
  },
  planRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  iconInline: {
    marginRight: 8,
  },
  planText: {
    fontSize: 13,
    color: '#334155',
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  stepIconCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  stepText: {
    fontSize: 13,
    color: '#334155',
    flex: 1,
  },

  focusRow: {
    flexDirection: 'row',
    gap: 8,
  },
  focusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  focusText: {
    fontSize: 12,
    color: '#334155',
    fontWeight: '700',
  },

  tipCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
  },
  tipText: {
    fontSize: 13,
    color: '#475569',
    flex: 1,
  },
  cardsContainer: {
    marginTop: 14,
    gap: 8,
    width: '100%',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    width: '100%',
  },
  cardIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  cardTextWrap: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1f2937',
    marginBottom: 1,
    flexShrink: 1,
    width: '100%',
  },
  cardText: {
    fontSize: 12,
    color: '#64748b',
    flexShrink: 1,
    width: '100%',
  },
  buttonWrap: {
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  primaryButton: {
    backgroundColor: '#60A5FA',
    borderRadius: 14,
    paddingVertical: Platform.OS === 'android' ? 14 : 16,
    paddingHorizontal: 28,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    shadowColor: '#60A5FA',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  buttonIcon: {
    marginRight: 6,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  adviceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
    marginBottom: 6,
  },
  adviceHeaderText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0f172a',
  },
  adviceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    width: '100%',
  },
}); 