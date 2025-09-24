import React, { useState } from 'react';
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
import { router } from 'expo-router';
import { OnboardingImages } from '@/constants/Images';
import { googleLoginOnly, auth, appleLoginOnly } from '@/lib/firebase';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { transferTempPremiumToUser, migrateGuestDataToUser } from '@/lib/premiumUtils';
import { transferTempOnboardingToUser } from '@/lib/userDataUtils';
import { statusCodes } from '@react-native-google-signin/google-signin';
import { identifyWithFirebase } from '@/lib/revenueCat';

interface OnLoginStageProps {
  onBack?: () => void;
  onComplete?: () => void;
}

export default function OnLoginStage({ onBack, onComplete }: OnLoginStageProps) {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loginMethod, setLoginMethod] = useState<'email' | 'google' | 'apple' | null>(null);

  const handleEmailLogin = async () => {
    
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);
    setLoginMethod('email');

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      console.log('✅ Email login successful:', userCredential.user.email);
      try { await identifyWithFirebase(userCredential.user.uid); } catch {}
      
      // Transfer temporary premium purchase to user account if exists
      await transferTempPremiumToUser(userCredential.user.uid, email);
      
      // Transfer temporary onboarding data to user account if exists
      await transferTempOnboardingToUser(userCredential.user.uid);
      
      // Migrate guest data to user account if exists
      await migrateGuestDataToUser(userCredential.user.uid);
      
      Alert.alert(
        'Success!',
        'Logged in successfully.',
        [
          {
            text: 'Continue',
            onPress: () => onComplete && onComplete()
          }
        ]
      );
    } catch (error: any) {
      console.error('❌ Email login error:', error);
      let errorMessage = 'Failed to log in. Please try again.';
      
      if (error.code === 'auth/user-not-found') {
        errorMessage = 'No account found with this email address.';
      } else if (error.code === 'auth/wrong-password') {
        errorMessage = 'Incorrect password. Please try again.';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Please enter a valid email address.';
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Too many failed attempts. Please try again later.';
      }
      
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setLoginMethod('google');

    try {
      const userCredential = await googleLoginOnly();
      console.log('✅ Google login successful:', userCredential.user.email);
      try { await identifyWithFirebase(userCredential.user.uid); } catch {}
      
      // Transfer temporary premium purchase to user account if exists
      await transferTempPremiumToUser(userCredential.user.uid, userCredential.user.email || '');
      
      // Transfer temporary onboarding data to user account if exists
      await transferTempOnboardingToUser(userCredential.user.uid);
      
      // Migrate guest data to user account if exists
      await migrateGuestDataToUser(userCredential.user.uid);
      
      Alert.alert(
        'Success!',
        'Logged in with Google successfully.',
        [
          {
            text: 'Continue',
            onPress: () => onComplete && onComplete()
          }
        ]
      );
    } catch (error: any) {
      console.error('❌ Google login error:', error);
      
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
        setLoading(false);
        return;
      }
      
      let errorMessage = 'Failed to log in with Google. Please try again.';
      
      if (code === 'PLAY_SERVICES_NOT_AVAILABLE') {
        errorMessage = 'Google Play Services not available.';
      } else if (code === 'auth/user-not-found') {
        errorMessage = 'No account found for this Google email. Please sign up first.';
      } else if (code === 'auth/account-exists-with-different-credential') {
        errorMessage = 'Account exists with a different sign-in method. Please use your original method.';
      }
      
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleAppleLogin = async () => {
    setLoading(true);
    setLoginMethod('apple');

    try {
      const userCredential = await appleLoginOnly();
      console.log('✅ Apple login successful:', userCredential.user.email);
      try { await identifyWithFirebase(userCredential.user.uid); } catch {}

      await transferTempPremiumToUser(userCredential.user.uid, userCredential.user.email || '');
      await transferTempOnboardingToUser(userCredential.user.uid);
      await migrateGuestDataToUser(userCredential.user.uid);

      Alert.alert(
        'Success!',
        'Logged in with Apple successfully.',
        [
          {
            text: 'Continue',
            onPress: () => onComplete && onComplete()
          }
        ]
      );
    } catch (error: any) {
      console.error('❌ Apple login error:', error);
      const code = error?.code;
      const message: string | undefined = error?.message;
      const isCancelled = code === 'ERR_CANCELED' || (typeof message === 'string' && message.toLowerCase().includes('cancel'));
      if (isCancelled) {
        console.log('🚫 Apple sign-in was cancelled by user');
        setLoading(false);
        return;
      }
      let errorMessage = 'Failed to log in with Apple. Please try again.';
      if (code === 'auth/user-not-found') {
        errorMessage = 'No account found for this Apple ID. Please sign up first.';
      } else if (code === 'auth/account-exists-with-different-credential') {
        errorMessage = 'Account exists with a different sign-in method. Please use your original method.';
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

  const handleForgotPassword = async () => {
    console.log('🔄 handleForgotPassword called');
    
    if (!email) {
      console.log('❌ No email provided');
      Alert.alert('Error', 'Please enter your email address first');
      return;
    }

    console.log('🔄 Attempting to send password reset email to:', email);

    try {
      console.log('🔄 Calling sendPasswordResetEmail...');
      await sendPasswordResetEmail(auth, email);
      console.log('✅ Password reset email sent successfully');
      
      console.log('🔄 Showing success alert...');
      Alert.alert(
        'Password Reset Email Sent',
        'Please check your inbox and your spam folder for the reset link.',
        [
          {
            text: 'OK',
            onPress: () => {
              console.log('✅ User clicked OK on success alert');
            }
          }
        ]
      );
      console.log('✅ Success alert shown');
    } catch (error: any) {
      console.error('❌ Password reset error:', error);
      console.error('❌ Error code:', error.code);
      console.error('❌ Error message:', error.message);
      
      let errorMessage = 'Failed to send password reset email. Please try again.';
      
      if (error.code === 'auth/user-not-found') {
        errorMessage = 'No account found with this email address.';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Please enter a valid email address.';
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Too many requests. Please try again later.';
      } else if (error.code === 'auth/operation-not-allowed') {
        errorMessage = 'Password reset is not enabled. Please contact support.';
      }
      
      console.log('🔄 Showing error alert...');
      Alert.alert('Error', errorMessage);
      console.log('✅ Error alert shown');
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#60A5FA" />
        <Text allowFontScaling={false} style={styles.loadingText}>
          {loginMethod === 'google' ? 'Signing in with Google...' : loginMethod === 'apple' ? 'Signing in with Apple...' : 'Signing in...'}
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
            <Pressable
              style={styles.backButton}
              onPress={() => {
                if (onBack) {
                  onBack();
                } else {
                  try {
                    router.replace('/onboarding');
                  } catch (e) {
                    // no-op
                  }
                }
              }}
            >
              <Ionicons name="arrow-back" size={24} color="#64748b" />
            </Pressable>
            
            
            <View style={styles.logoContainer}>
              <Image
                source={OnboardingImages.pulseLogo}
                style={styles.logo}
                resizeMode="cover"
              />
            </View>
            
            <Text allowFontScaling={false} style={styles.title}>Welcome Back</Text>
            <Text allowFontScaling={false} style={styles.subtitle}>
              Sign in to continue your journey with CalmPulse
            </Text>
          </View>

          {/* Login Form */}
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

            {/* Email Login Button */}
            <Pressable style={styles.emailLoginButton} onPress={handleEmailLogin}>
              <Ionicons name="mail" size={20} color="white" style={styles.buttonIcon} />
              <Text allowFontScaling={false} numberOfLines={1} style={styles.emailLoginText}>Sign in with Email</Text>
            </Pressable>

            {/* Forgot Password */}
            <View style={styles.forgotPasswordContainer}>
              <Pressable style={styles.forgotPasswordButton} onPress={handleForgotPassword}>
                <Text allowFontScaling={false} maxFontSizeMultiplier={1} numberOfLines={1} style={styles.forgotPasswordText}>Forgot Password?</Text>
              </Pressable>
            </View>

            {/* Divider */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text allowFontScaling={false} style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Google Login Button */}
            <Pressable style={styles.googleLoginButton} onPress={handleGoogleLogin}>
              <View style={styles.googleIconContainer}>
                <Ionicons name="logo-google" size={24} color="#EA4335" />
              </View>
              <Text allowFontScaling={false} numberOfLines={1} style={styles.googleLoginText}>Continue with Google</Text>
            </Pressable>

            {/* Apple Login Button (iOS only) */}
            {Platform.OS === 'ios' && (
              <Pressable style={[styles.googleLoginButton, { marginTop: 8 }]} onPress={handleAppleLogin}>
                <View style={styles.googleIconContainer}>
                  <Ionicons name="logo-apple" size={24} color="#000000" />
                </View>
                <Text allowFontScaling={false} numberOfLines={1} style={styles.googleLoginText}>Continue with Apple</Text>
              </Pressable>
            )}
          </View>

        </ScrollView>

        {/* Footer pinned below content */}
        <View style={styles.footer}>
          <Text allowFontScaling={false} maxFontSizeMultiplier={1} style={styles.footerText}>
            By signing in, you agree to our{' '}
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
    marginBottom: 40,
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
  emailLoginButton: {
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
  emailLoginText: {
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
  googleLoginButton: {
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
  googleLoginText: {
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
  forgotPasswordContainer: {
    alignItems: 'center',
    marginBottom: 8,
  },
  forgotPasswordButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  forgotPasswordText: {
    fontSize: 14,
    color: '#60A5FA',
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
});
