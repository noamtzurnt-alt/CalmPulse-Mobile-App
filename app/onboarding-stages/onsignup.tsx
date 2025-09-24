import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  Text,
  TextInput,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { OnboardingImages } from '@/constants/Images';
import { googleSignIn, auth, appleSignIn } from '@/lib/firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, getAdditionalUserInfo, signOut } from 'firebase/auth';
import { transferTempPremiumToUser, migrateGuestDataToUser } from '@/lib/premiumUtils';
import { transferTempOnboardingToUser } from '@/lib/userDataUtils';
import { statusCodes } from '@react-native-google-signin/google-signin';
import { identifyWithFirebase } from '@/lib/revenueCat';
import Purchases from 'react-native-purchases';
import { PREMIUM_ENTITLEMENT_ID } from '@/lib/premiumUtils';

interface OnSignupStageProps {
  onBack?: () => void;
  onComplete?: () => void;
  onLogin?: () => void;
}

export default function OnSignupStage({ onBack, onComplete, onLogin }: OnSignupStageProps) {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [signupMethod, setSignupMethod] = useState<'email' | 'google' | 'apple' | null>(null);

  useEffect(() => {
  }, []);

  // Google Sign-In is configured in firebase.ts

  const handleEmailSignup = async () => {
    // no attempt event per spec
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    setSignupMethod('email');

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      console.log('✅ Email signup successful:', userCredential.user.email);
      try { await identifyWithFirebase(userCredential.user.uid); } catch {}
      
      // Post-signup: check if the store account already has an active subscription
      try {
        await Purchases.invalidateCustomerInfoCache();
        await Purchases.syncPurchases();
        const info = await Purchases.getCustomerInfo();
        const entitlement: any = info?.entitlements?.active?.[PREMIUM_ENTITLEMENT_ID];
        const expiration = entitlement?.expirationDate ? new Date(entitlement.expirationDate) : null;
        const isActiveAndNotExpired = !!entitlement && (!expiration || expiration > new Date());
        const originalId = info?.originalAppUserId;
        if (isActiveAndNotExpired && originalId && originalId !== userCredential.user.uid) {
          Alert.alert(
            'Subscription Already Active',
            'Your App Store/Play account already has an active premium subscription linked to a different user. Please tap Restore instead of purchasing again.',
            [{ text: 'OK' }]
          );
        }
      } catch {}

      // Transfer temporary premium purchase to new user account
      await transferTempPremiumToUser(userCredential.user.uid, email);
      
      // Transfer temporary onboarding data to new user account
      await transferTempOnboardingToUser(userCredential.user.uid, 'email');
      
      // Migrate guest data to new user account
      await migrateGuestDataToUser(userCredential.user.uid);
      
      Alert.alert(
        'Success!',
        'Account created successfully.',
        [
          {
            text: 'Continue',
            onPress: () => { onComplete && onComplete(); }
          }
        ]
      );
    } catch (error: any) {
      console.error('❌ Email signup error:', error);
      let errorMessage = 'Failed to create account. Please try again.';
      
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'An account with this email already exists.';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Please enter a valid email address.';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'Password is too weak. Please choose a stronger password.';
      }
      
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignup = async () => {
    setLoading(true);
    setSignupMethod('google');

    try {
      const userCredential = await googleSignIn();
      console.log('✅ Google signup successful:', userCredential.user.email);
      try { await identifyWithFirebase(userCredential.user.uid); } catch {}
      
      const info = getAdditionalUserInfo(userCredential);
      if (!info?.isNewUser) {
        try { await signOut(auth); } catch {}
        Alert.alert('Account exists', 'An account with this Google email already exists. Please log in instead.');
        return;
      }
      
      // Transfer temporary premium purchase to new user account
      await transferTempPremiumToUser(userCredential.user.uid, userCredential.user.email || '');
      
      // Transfer temporary onboarding data to new user account
      await transferTempOnboardingToUser(userCredential.user.uid, 'google');
      
      // Migrate guest data to new user account
      await migrateGuestDataToUser(userCredential.user.uid);
      
      Alert.alert(
        'Success!',
        'Signed up with Google successfully.',
        [
          {
            text: 'Continue',
            onPress: () => { onComplete && onComplete(); }
          }
        ]
      );
    } catch (error: any) {
      console.error('❌ Google signup error:', error);
      
      // Treat user cancel as a silent no-op
      const code = error?.code;
      const message: string | undefined = error?.message;
      const isCancelled =
        code === statusCodes?.SIGN_IN_CANCELLED ||
        code === 'SIGN_IN_CANCELLED' ||
        code === 12501 ||
        code === '12501' ||
        code === 'auth/cancelled-popup-request' ||
        code === 'auth/popup-closed-by-user' ||
        (typeof message === 'string' && message.toLowerCase().includes('cancel'));

      if (isCancelled) {
        console.log('🚫 Google sign-in was cancelled by user');
        setSignupMethod(null);
        setLoading(false);
        return;
      }
      
      let errorMessage = 'Failed to sign up with Google. Please try again.';
      
      if (code === 'auth/account-exists-with-different-credential' || code === 'auth/credential-already-in-use') {
        errorMessage = 'An account with this Google email already exists. Please log in instead.';
      } else if (code === 'PLAY_SERVICES_NOT_AVAILABLE') {
        errorMessage = 'Google Play Services not available.';
      }
      
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleAppleSignup = async () => {
    setLoading(true);
    setSignupMethod('apple');

    try {
      const userCredential = await appleSignIn();
      console.log('✅ Apple signup successful:', userCredential.user.email);
      try { await identifyWithFirebase(userCredential.user.uid); } catch {}

      const info = getAdditionalUserInfo(userCredential);
      if (!info?.isNewUser) {
        try { await signOut(auth); } catch {}
        Alert.alert('Account exists', 'An account with this Apple ID already exists. Please log in instead.');
        return;
      }

      await transferTempPremiumToUser(userCredential.user.uid, userCredential.user.email || '');
      await transferTempOnboardingToUser(userCredential.user.uid, 'apple');
      await migrateGuestDataToUser(userCredential.user.uid);

      Alert.alert(
        'Success!',
        'Signed up with Apple successfully.',
        [
          {
            text: 'Continue',
            onPress: () => { onComplete && onComplete(); }
          }
        ]
      );
    } catch (error: any) {
      console.error('❌ Apple signup error:', error);
      const code = error?.code;
      const message: string | undefined = error?.message;
      const isCancelled = code === 'ERR_CANCELED' || (typeof message === 'string' && message.toLowerCase().includes('cancel'));
      if (isCancelled) {
        console.log('🚫 Apple sign-in was cancelled by user');
        setLoading(false);
        return;
      }
      let errorMessage = 'Failed to sign up with Apple. Please try again.';
      if (code === 'auth/account-exists-with-different-credential' || code === 'auth/credential-already-in-use') {
        errorMessage = 'An account with this Apple ID already exists. Please log in instead.';
      }
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleTermsPress = () => {
    Linking.openURL('https://calmpulseapp.com/policies/terms-of-service');
  };

  const handlePrivacyPress = () => {
    Linking.openURL('https://calmpulseapp.com/policies/privacy-policy');
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#60A5FA" />
        <Text allowFontScaling={false} style={styles.loadingText}>
          {signupMethod === 'google' ? 'Signing up with Google...' : signupMethod === 'apple' ? 'Signing up with Apple...' : 'Creating your account...'}
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}> 
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            
            
            <View style={styles.logoContainer}>
              <Image
                source={OnboardingImages.pulseLogo}
                style={styles.logo}
                resizeMode="cover"
              />
            </View>
            
            <Text allowFontScaling={false} maxFontSizeMultiplier={1} style={styles.title}>Create Your Account</Text>
            <Text allowFontScaling={false} maxFontSizeMultiplier={1} style={styles.subtitle}>
            </Text>
          </View>

          {/* Signup Form */}
          <View style={styles.formContainer}>
            {/* Email Input */}
            <View style={styles.inputContainer}>
              <Ionicons name="mail" size={20} color="#64748b" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Email address"
                placeholderTextColor="#94a3b8"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                allowFontScaling={false}
                maxFontSizeMultiplier={1}
              />
            </View>

            {/* Password Input */}
            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed" size={20} color="#64748b" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor="#94a3b8"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                allowFontScaling={false}
                maxFontSizeMultiplier={1}
              />
              <Pressable
                style={styles.eyeButton}
                onPress={() => setShowPassword(!showPassword)}
              >
                <Ionicons 
                  name={showPassword ? "eye-off" : "eye"} 
                  size={20} 
                  color="#64748b" 
                />
              </Pressable>
            </View>

            {/* Confirm Password Input */}
            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed" size={20} color="#64748b" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Confirm password"
                placeholderTextColor="#94a3b8"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirmPassword}
                autoCapitalize="none"
                allowFontScaling={false}
                maxFontSizeMultiplier={1}
              />
              <Pressable
                style={styles.eyeButton}
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                <Ionicons 
                  name={showConfirmPassword ? "eye-off" : "eye"} 
                  size={20} 
                  color="#64748b" 
                />
              </Pressable>
            </View>

            {/* Email Signup Button */}
            <Pressable style={styles.emailSignupButton} onPress={handleEmailSignup}>
              <Ionicons name="mail" size={20} color="white" style={styles.buttonIcon} />
              <Text allowFontScaling={false} maxFontSizeMultiplier={1} numberOfLines={1} style={styles.emailSignupText}>Sign up with Email</Text>
            </Pressable>

            {/* Divider */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text allowFontScaling={false} maxFontSizeMultiplier={1} style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Google Signup Button */}
            <Pressable style={styles.googleSignupButton} onPress={handleGoogleSignup}>
              <View style={styles.googleIconContainer}>
                <Ionicons name="logo-google" size={24} color="#EA4335" />
              </View>
              <Text allowFontScaling={false} maxFontSizeMultiplier={1} numberOfLines={1} style={styles.googleSignupText}>Continue with Google</Text>
            </Pressable>

            {/* Apple Signup Button (iOS only) */}
            {Platform.OS === 'ios' && (
              <Pressable style={[styles.googleSignupButton, { marginTop: 8 }]} onPress={handleAppleSignup}>
                <View style={styles.googleIconContainer}>
                  <Ionicons name="logo-apple" size={24} color="#000000" />
                </View>
                <Text allowFontScaling={false} maxFontSizeMultiplier={1} numberOfLines={1} style={styles.googleSignupText}>Continue with Apple</Text>
              </Pressable>
            )}

            {/* Login Link */}
            <Pressable style={styles.loginLink} onPress={() => onLogin && onLogin()}>
              <Text allowFontScaling={false} maxFontSizeMultiplier={1} style={styles.loginLinkText}>Already have an account? Sign in</Text>
            </Pressable>
          </View>

        </ScrollView>
        {/* Footer pinned below content */}
        <View style={styles.footer}>
          <Text allowFontScaling={false} maxFontSizeMultiplier={1} style={styles.footerText}>
            By signing up, you agree to our{' '}
            <Text allowFontScaling={false} maxFontSizeMultiplier={1} style={styles.linkText} onPress={handleTermsPress}>Terms of Service</Text>
            {' '}and{' '}
            <Text allowFontScaling={false} maxFontSizeMultiplier={1} style={styles.linkText} onPress={handlePrivacyPress}>Privacy Policy</Text>
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#64748b',
    fontWeight: '500',
  },
  header: {
    alignItems: 'center',
    marginBottom: 0,
  },
  backButton: {
    position: 'absolute',
    top: 0,
    left: 0,
    padding: 8,
  },
  logoContainer: {
    marginBottom: 24,
  },
  logo: {
    width: 80,
    height: 80,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1e293b',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  formContainer: {
    flex: 1,
    marginBottom: 24,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#1e293b',
  },
  eyeButton: {
    padding: 4,
  },
  emailSignupButton: {
    backgroundColor: '#60A5FA',
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#60A5FA',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  emailSignupText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e2e8f0',
  },
  dividerText: {
    marginHorizontal: 16,
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },
  googleSignupButton: {
    backgroundColor: 'white',
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  googleSignupText: {
    color: '#1e293b',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  googleIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  buttonIcon: {
    marginRight: 8,
  },
  footer: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 16,
  },
  footerText: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
  },
  linkText: {
    color: '#60A5FA',
    fontWeight: '600',
  },
  loginLink: {
    alignItems: 'center',
    marginTop: 12,
  },
  loginLinkText: {
    fontSize: 14,
    color: '#64748b',
    textDecorationLine: 'underline',
    fontWeight: '600',
  },
});
