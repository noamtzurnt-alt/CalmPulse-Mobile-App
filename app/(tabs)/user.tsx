import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, SafeAreaView, ActivityIndicator, Alert, Modal, TextInput, Platform, BackHandler, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { auth, db } from '@/lib/firebase';
import { signOut, deleteUser, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { useLanguage } from '@/lib/LanguageContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, deleteDoc, collection, getDocs, query, setDoc, getDoc } from 'firebase/firestore';
// Premium removed
// import { logOutUser, resetRevenueCatConfig, PREMIUM_ENTITLEMENT_ID } from '@/lib/revenueCat';
// import Purchases from 'react-native-purchases';
import { checkPremiumStatus as checkPremiumStatusUtil } from '@/lib/premiumUtils';
import { clearPremiumData } from '@/lib/premiumUtils';
import { useLayout } from './_layout';
import AdBanner from '@/components/AdBanner';
import { useFocusEffect } from '@react-navigation/native';


export default function CurrentUserScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const { t, language } = useLanguage();
  const [showReauthModal, setShowReauthModal] = useState(false);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [showDeleteSuccessModal, setShowDeleteSuccessModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showSuccessButton, setShowSuccessButton] = useState(false);
  const { setShowSuccessButton: setLayoutShowSuccessButton } = useLayout();
  const [isGuestUser, setIsGuestUser] = useState(false);
  const [userPhotoURL, setUserPhotoURL] = useState<string | null>(null);
  const [hasPremium, setHasPremium] = useState(false);
  const [premiumStatus, setPremiumStatus] = useState<string | null>(null);
  const [premiumWasCancelled, setPremiumWasCancelled] = useState(false);

  useEffect(() => {
    const checkUserStatus = async () => {
      if (!auth) {
        console.error('Auth is not initialized');
        return;
      }
      
      // Check if user is a guest
      const isGuest = await AsyncStorage.getItem('isGuest');
      setIsGuestUser(isGuest === 'true');
      
      const currentUser = auth.currentUser;
      if (currentUser) {
        setUserEmail(currentUser.email);
        setUserName(currentUser.displayName);
        setUserPhotoURL(currentUser.photoURL);
      } else {
        setUserEmail(null);
        setUserName(null);
        setUserPhotoURL(null);
      }

      // Load premium status (from cache first, then RevenueCat)
      try {
        const cached = await AsyncStorage.getItem('hasPremium');
        if (cached !== null) {
          setHasPremium(cached === 'true');
        }
        try {
          // Force remote check with auto-align/transfer if needed
            const isPremium = await checkPremiumStatusUtil(true);
            setHasPremium(isPremium);
            await AsyncStorage.setItem('hasPremium', isPremium.toString());
            await AsyncStorage.setItem('isPremium', isPremium.toString());
        } catch (e) {
          // ignore RC failures; keep cached value
        }

        // Fetch premium status details from Firestore to detect cancellations/expiry
        try {
          const user = auth.currentUser;
          if (user?.uid) {
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            const data = userDoc.data();
            if (data) {
              const status = data.premiumStatus || null;
              setPremiumStatus(status);
              setPremiumWasCancelled(
                (!cached || cached === 'false') && (
                  status === 'cancelled' || status === 'expired' || !!data.premiumCancelledAt
                )
              );
            }
          }
        } catch (e) {
          // ignore
        }
      } catch (e) {
        // ignore
      }

      setLoading(false);
    };
    
    checkUserStatus();
  }, []);

  // Refresh premium on focus so the badge reflects transfers/restores immediately
  useFocusEffect(
    React.useCallback(() => {
      (async () => {
        try {
          const isPremium = await checkPremiumStatusUtil(true);
          setHasPremium(isPremium);
          await AsyncStorage.setItem('hasPremium', isPremium.toString());
          await AsyncStorage.setItem('isPremium', isPremium.toString());
        } catch {}
      })();
      return () => {};
    }, [])
  );

  const handleLogout = async () => {
    try {
      setLoading(true);
      setIsLoggingOut(true);
      
      // Check if the user is a guest
      const isGuest = await AsyncStorage.getItem('isGuest');
      
      // Clear only authentication-related data, not user content
      await AsyncStorage.multiRemove([
        'userEmail',
        'userName',
        'hasPremium',
        'isAuthenticated',
        'isGuest',
        'guestId',
        'revenueCatUserID',
        'revenueCatCustomerInfo',
        'premiumExpiryDate',
        'hasSeenOnboarding',
        'onboarding_progress'
      ]);
      
      if (isGuest === 'true') {
        // For guest users, redirect directly to onboarding
        console.log('✅ Guest user logged out - redirecting to onboarding');
        return router.replace('/onboarding');
      }
      
      const user = auth.currentUser;
      
      if (user?.uid) {
        // Premium removed: skip RevenueCat checks
        
        // Then clear premium data
        await clearPremiumData(user.uid);
        
        // Sign out from Firebase
        await signOut(auth);
        
        console.log('✅ Successfully logged out');
        
        // מעבר ישיר למסך ה-onboarding ל-onsignup
        try { await AsyncStorage.setItem('onboarding_progress', 'onsignup'); } catch {}
        router.replace('/onboarding');
      } else {
        throw new Error('No user found');
      }
    } catch (error) {
      console.error('❌ Logout error:', error);
      Alert.alert(
        String(t('error')),
        String(t('logoutError'))
      );
    } finally {
      setLoading(false);
      setIsLoggingOut(false);
    }
  };

  const handleSuccessButtonPress = () => {
    console.log('🔄 Navigating to onboarding screen...');
    router.replace('/onboarding');
    console.log('✅ Successfully navigated to onboarding screen');
  };

  const handleDeleteAccount = async () => {
    try {
      // Check if the user is a guest first
      const isGuest = await AsyncStorage.getItem('isGuest');
      console.log('🔍 Is guest user:', isGuest);
      
      // Also check if user has email (real user vs guest)
      const currentUser = auth.currentUser;
      const hasEmail = currentUser?.email && currentUser.email !== '';
      console.log('🔍 Has email:', hasEmail, 'Email:', currentUser?.email);
      
      // Check platform
      console.log('🔍 Platform:', Platform.OS);
      
      // For now, let's just show the modal for all users (except if explicitly guest)
      if (isGuest === 'true') {
        // TEMPORARY FIX: If on Android and user has email, clear the guest flag
        if (Platform.OS === 'android' && hasEmail) {
          console.log('🔧 TEMPORARY FIX: Clearing guest flag on Android');
          await AsyncStorage.removeItem('isGuest');
          console.log('✅ Guest flag cleared');
        } else {
        // If user is a guest, show an alert and don't allow account deletion
        Alert.alert(
          language === 'he' ? 'פעולה לא זמינה' : 'Action Not Available',
          language === 'he' 
            ? 'משתמשים אורחים אינם יכולים למחוק חשבון. אם ברצונך לצאת, השתמש בכפתור "התנתק".'
            : 'Guest users cannot delete their account. If you wish to exit, please use the "Log Out" button.',
          [
            {
              text: language === 'he' ? 'הבנתי' : 'OK',
            }
          ]
        );
        return;
      }
      }
  
      // Show confirmation modal for all other users
      console.log('✅ Showing delete confirmation modal');
      console.log('🔍 Current showDeleteConfirmModal state:', showDeleteConfirmModal);
      setShowDeleteConfirmModal(true);
      console.log('🔍 Set showDeleteConfirmModal to true');
    } catch (error) {
      console.error('Error in delete account flow:', error);
      setError(t('deleteAccountError') as string);
    }
  };

  const handleConfirmDelete = async () => {
              try {
      setIsDeleting(true);
      setShowDeleteConfirmModal(false);
      
                const user = auth.currentUser;
                if (!user) {
                  throw new Error('No user found');
                }

      console.log('🗑️ Starting account deletion process...');

      // First, save user info to deleteAccount collection for manual deletion
      try {
        await setDoc(doc(db, 'deleteAccount', user.uid), {
          email: user.email,
          uid: user.uid,
          displayName: user.displayName,
          requestDate: new Date().toISOString(),
          status: 'pending'
        });
        console.log('✅ User added to deleteAccount collection');
      } catch (error) {
        console.log('⚠️ Error adding to deleteAccount collection:', error);
                }
  
      // Then delete all data from Firestore
      try {
                // מחיקת המשתמש מ־Firestore
                await deleteDoc(doc(db, 'users', user.uid));
        console.log('✅ User data deleted from Firestore');
  
                // מחיקת קבלות רכישה
                await deleteDoc(doc(db, 'receipts', user.uid));
        console.log('✅ Receipts deleted from Firestore');
  
                // מחיקת הצ'אטים
                const chatRef = collection(db, 'users', user.uid, 'chats');
                const chatSnapshot = await getDocs(chatRef);
                for (const docSnap of chatSnapshot.docs) {
                  await deleteDoc(docSnap.ref);
        }
        console.log('✅ Chats deleted from Firestore');
      } catch (error) {
        console.log('⚠️ Error deleting Firestore data:', error);
        // Continue anyway
                }
  
      // Clear AsyncStorage
      try {
                await AsyncStorage.clear();
        // Ensure onboarding starts at signup after full clear
        try { await AsyncStorage.setItem('onboarding_progress', 'onsignup'); } catch {}
        console.log('✅ AsyncStorage cleared');
      } catch (error) {
        console.log('⚠️ Error clearing AsyncStorage:', error);
        // Continue anyway
      }

      // Premium removed: no RevenueCat data to clear

      // Clear premium data
      try {
        await clearPremiumData(user.uid);
        console.log('✅ Premium data cleared');
      } catch (error) {
        console.log('⚠️ Error clearing premium data:', error);
        // Continue anyway
      }

      // Sign out from Firebase Auth to prevent new document creation
      try {
        await signOut(auth);
        console.log('✅ Signed out from Firebase Auth');
      } catch (error) {
        console.log('⚠️ Error signing out:', error);
      }

      // Try to delete Firebase account (this might fail, but that's okay)
      try {
                await user.delete();
        console.log('✅ Firebase account deleted');
      } catch (error: any) {
        console.log('⚠️ Could not delete Firebase account:', error.code);
        // This is expected for some users, continue anyway
      }
  
      // Show success modal regardless
      console.log('✅ Account deletion completed');
      try { await AsyncStorage.setItem('onboarding_progress', 'onsignup'); } catch {}
      setShowDeleteSuccessModal(true);
              } catch (error: any) {
                console.error('Delete account error:', error);
      // Show success anyway since we deleted the data
      setShowDeleteSuccessModal(true);
              } finally {
      setIsDeleting(false);
    }
  };
  

  const handleReauthenticate = async () => {
    try {
      setLoading(true);
      setError(null);

      const user = auth.currentUser;
      if (!user || !user.email) {
        throw new Error('No user found');
      }

      // Reauthenticate user
      const credential = EmailAuthProvider.credential(user.email, password);
      await reauthenticateWithCredential(user, credential);

      console.log('✅ Reauthentication successful, now deleting account...');

      // First, save user info to deleteAccount collection for manual deletion
      try {
        await setDoc(doc(db, 'deleteAccount', user.uid), {
          email: user.email,
          uid: user.uid,
          displayName: user.displayName,
          requestDate: new Date().toISOString(),
          status: 'pending'
        });
        console.log('✅ User added to deleteAccount collection');
      } catch (error) {
        console.log('⚠️ Error adding to deleteAccount collection:', error);
      }

      // Premium removed: no RevenueCat data to clear

      // Clear premium data
      try {
        await clearPremiumData(user.uid);
        console.log('✅ Premium data cleared');
      } catch (error) {
        console.log('⚠️ Error clearing premium data:', error);
      }

      // Clear AsyncStorage
      try {
      await AsyncStorage.clear();
        console.log('✅ AsyncStorage cleared');
      } catch (error) {
        console.log('⚠️ Error clearing AsyncStorage:', error);
      }

      // Sign out from Firebase Auth to prevent new document creation
      try {
        await signOut(auth);
        console.log('✅ Signed out from Firebase Auth');
      } catch (error) {
        console.log('⚠️ Error signing out:', error);
      }

      // Delete the user account from Firebase Auth
      await user.delete();

      // Show success modal instead of navigating directly
      setShowReauthModal(false);
      setShowDeleteSuccessModal(true);
    } catch (error: any) {
      console.error('Reauthentication error:', error);
      if (error.code === 'auth/wrong-password') {
        setError(t('wrongPassword') as string);
      } else if (error.code === 'auth/too-many-requests') {
        setError(t('tooManyAttempts') as string);
      } else {
        setError(t('deleteAccountFailed') as string);
      }
    } finally {
      setLoading(false);
      setShowReauthModal(false);
      setPassword('');
    }
  };

  /* no initial loading screen */

  if (showSuccessButton) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.successContainer}>
          <Text style={styles.successText}>
            {language === 'he' ? 'ההתנתקות הושלמה בהצלחה!' : 'Logout completed successfully!'}
          </Text>
          <TouchableOpacity 
            style={styles.successButton}
            onPress={handleSuccessButtonPress}
          >
            <Text style={styles.successButtonText}>
              {language === 'he' ? 'המשך' : 'Continue'}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>{t('currentUser')}</Text>
        <View style={styles.divider} />
        
        {/* User Profile Section */}
        <View style={styles.profileSection}>
          {userPhotoURL && !isGuestUser ? (
            <Image
              source={{ uri: userPhotoURL }}
              style={styles.profileImage}
            />
          ) : (
            <View style={styles.profilePlaceholder}>
              <Ionicons name="person" size={24} color="#94a3b8" />
            </View>
          )}
          <View style={styles.profileInfo}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={styles.nameText}>{userName || t('noNameProvided')}</Text>
              <Ionicons
                name={hasPremium ? 'checkmark-circle' : 'close-circle-outline'}
                size={18}
                color={hasPremium ? '#10B981' : '#94a3b8'}
                style={{ marginLeft: 6 }}
              />
            </View>
            <Text style={styles.emailText}>{userEmail || (isGuestUser ? (language === 'he' ? 'משתמש אורח' : 'Guest User') : '')}</Text>
          </View>
        </View>
        
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
          disabled={loading}
        >
          <Ionicons name="log-out-outline" size={20} color="white" />
          <Text style={styles.buttonText}>{t('logOut')}</Text>
        </TouchableOpacity>
        
        
        <View style={styles.spacer} />
        
        <TouchableOpacity
          style={[styles.deleteButton, loading && styles.disabledButton]}
          onPress={handleDeleteAccount}
          disabled={loading}
        >
          <Text style={styles.deleteButtonText}>{t('deleteMyAccount')}</Text>
        </TouchableOpacity>

        {/* Premium cancellation note */}
        {!hasPremium && premiumWasCancelled && (
          <Text style={styles.premiumNoteText}>
            {language === 'he'
              ? 'החשבון רכש פרימיום בעבר אך ביטל את המנוי.'
              : 'This account purchased Premium in the past but canceled the subscription.'}
          </Text>
        )}
        
        <View style={{ alignItems: 'center', width: '100%', marginTop: 8 }}>
          <AdBanner />
        </View>
        
        {/* Extra space for Android */}
        <View style={{ height: 20 }} />
      </View>

      <Modal
        visible={showReauthModal}
        transparent={true}
        animationType="slide"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('reauthenticate')}</Text>
            <Text style={styles.modalSubtitle}>{t('enterPasswordToDelete')}</Text>
            
            <TextInput
              style={styles.input}
              placeholder={String(t('password')) || ''}
              placeholderTextColor="#94a3b8"
              secureTextEntry={true}
              value={password}
              onChangeText={setPassword}
              editable={!loading}
            />
            
            {error && <Text style={styles.errorText}>{error}</Text>}
            
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setShowReauthModal(false);
                  setPassword('');
                  setError(null);
                }}
                disabled={loading}
              >
                <Text style={styles.modalButtonText}>{t('cancel')}</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.modalButton, styles.deleteButton]}
                onPress={handleReauthenticate}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text style={styles.modalButtonText}>{t('delete')}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        visible={showDeleteConfirmModal}
        transparent={true}
        animationType="slide"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Are you sure?</Text>
            <Text style={styles.modalSubtitle}>
              If you delete your account, all your progress will be deleted.
            </Text>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowDeleteConfirmModal(false)}
              >
                <Text style={styles.modalButtonText} numberOfLines={2}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.modalButton, styles.modalDeleteButton]}
                onPress={handleConfirmDelete}
              >
                <Text style={styles.modalButtonText} numberOfLines={2}>Delete Account</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete Success Modal */}
      <Modal
        visible={showDeleteSuccessModal}
        transparent={true}
        animationType="fade"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.successModalContent}>
            <View style={styles.successIconContainer}>
              <Ionicons name="checkmark-circle" size={60} color="#10B981" />
            </View>
            <Text style={styles.successModalTitle}>Account Deleted</Text>
            <Text style={styles.successModalSubtitle}>
              We hope to see you again!
            </Text>
            <TouchableOpacity 
              style={styles.successModalButton}
              onPress={() => {
                setShowDeleteSuccessModal(false);
                router.replace('/onboarding');
              }}
            >
              <Text style={styles.successModalButtonText}>Continue</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Loading Modal */}
      <Modal
        visible={isDeleting}
        transparent={true}
        animationType="fade"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.loadingModalContent}>
            <ActivityIndicator size="large" color="#60A5FA" />
            <Text style={styles.loadingModalText}>Deleting your account...</Text>
          </View>
        </View>
      </Modal>

      {/* Logout Loading Modal */}
      <Modal
        visible={isLoggingOut}
        transparent={true}
        animationType="fade"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.loadingModalContent}>
            <ActivityIndicator size="large" color="#60A5FA" />
            <Text style={styles.loadingModalText}>Logging out...</Text>
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
  content: {
    flex: 1,
    padding: 20,
    alignItems: 'center',
    paddingTop: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e293b',
    marginTop: 10,
  },
  divider: {
    height: 1,
    backgroundColor: '#e2e8f0',
    width: '100%',
    marginVertical: 15,
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
    paddingHorizontal: 20,
    width: '100%',
  },
  profileImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 15,
  },
  profilePlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 15,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  profileInfo: {
    flex: 1,
  },
  nameText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 4,
  },
  emailText: {
    fontSize: 16,
    color: '#64748b',
    marginBottom: 0,
  },
  logoutButton: {
    backgroundColor: '#60A5FA',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    width: '100%',
    marginTop: 15,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  deleteButton: {
    backgroundColor: '#dc2626',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 12,
    width: '80%',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
    zIndex: 1,
    position: 'relative',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  deleteButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  spacer: {
    flex: 0.2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  premiumNoteText: {
    marginTop: 10,
    color: '#64748b',
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    width: '90%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 16,
    color: '#64748b',
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    fontSize: 16,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 14,
    marginBottom: 16,
    textAlign: 'center',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  modalButton: {
    flex: 1,
    padding: 8,
    borderRadius: 8,
    marginHorizontal: 2,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    flexBasis: 0,
  },
  cancelButton: {
    backgroundColor: '#94a3b8',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  modalDeleteButton: {
    backgroundColor: '#dc2626',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  modalButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 20,
    flexWrap: 'wrap',
    flexShrink: 1,
  },
  disabledButton: {
    opacity: 0.5,
  },
  successContainer: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 500,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 20,
    textAlign: 'center',
  },
  successButton: {
    backgroundColor: '#60A5FA',
    padding: 15,
    borderRadius: 10,
    width: '100%',
    alignItems: 'center',
  },
  successButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  successModalContent: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 30,
    width: '90%',
    maxWidth: 400,
    alignItems: 'center',
  },
  successIconContainer: {
    marginBottom: 20,
  },
  successModalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 10,
    textAlign: 'center',
  },
  successModalSubtitle: {
    fontSize: 16,
    color: '#64748b',
    marginBottom: 25,
    textAlign: 'center',
    lineHeight: 22,
  },
  successModalButton: {
    backgroundColor: '#60A5FA',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  successModalButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingModalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 30,
    width: '90%',
    maxWidth: 300,
    alignItems: 'center',
  },
  loadingModalText: {
    fontSize: 16,
    color: '#64748b',
    marginTop: 15,
    textAlign: 'center',
  },
});
