import { doc, setDoc, getDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db, auth } from './firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Types for user data
export interface OnboardingData {
  name: string;
  gender: "man" | "woman" | "non-binary" | "prefer_not_to_say";
  feeling_now: string;
  feeling_strongest_when: string;
  struggling_with: string;
  desired_feeling: string;
}

export interface UserData {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  isPremium: boolean;
  createdAt: Date;
  providers?: 'google' | 'email' | 'apple';
  onboarding?: OnboardingData;
  // User experience data (not for analytics, just for user experience)
  pulseAIConversations?: {
    id: string;
    title: string;
    messages: any[];
    timestamp: Date;
  }[];
      journalEntries?: {
      id: string;
      content: string;
    }[];
  userVideos?: {
    id: string;
    uri: string;
    thumbnail?: string;
    timestamp: Date;
  }[];
  userPhotos?: {
    id: string;
    uri: string;
    timestamp: Date;
  }[];
}

// Create or update user document
export const createOrUpdateUser = async (userData: Partial<UserData>, provider: 'google' | 'email' | 'apple' = 'email') => {
  try {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('No authenticated user');
    }

    const userRef = doc(db, 'users', user.uid);
    const userDoc = await getDoc(userRef);

    if (userDoc.exists()) {
      // Update existing user
      await updateDoc(userRef, {
        ...userData,
        providers: provider,
      });
      console.log('✅ User updated successfully');
    } else {
      // Create new user
      await setDoc(userRef, {
        createdAt: new Date(),
        uid: user.uid,
        providers: provider,
        email: user.email || '',
        displayName: user.displayName || '',
        isPremium: false,
        photoURL: user.photoURL || '',
        ...userData,
      });
      console.log('✅ New user created successfully');
    }

    return true;
  } catch (error) {
    console.error('❌ Error creating/updating user:', error);
    throw error;
  }
};

// Save onboarding data
export const saveOnboardingData = async (onboardingData: OnboardingData) => {
  try {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('No authenticated user');
    }

    const userRef = doc(db, 'users', user.uid);
    const userDoc = await getDoc(userRef);
    
    if (userDoc.exists()) {
      // Update existing user
      await updateDoc(userRef, {
        onboarding: {
          ...onboardingData,
        },
      });
    } else {
      // Create new user document
      await setDoc(userRef, {
        createdAt: new Date(),
        uid: user.uid,
        providers: 'email', // Default for this function
        email: user.email || '',
        displayName: user.displayName || '',
        isPremium: false,
        photoURL: user.photoURL || '',
        onboarding: {
          ...onboardingData,
        },
      });
    }

    console.log('✅ Onboarding data saved successfully');
    return true;
  } catch (error) {
    console.error('❌ Error saving onboarding data:', error);
    throw error;
  }
};

// Transfer temporary onboarding data to user
export const transferTempOnboardingToUser = async (userId: string, provider: 'google' | 'email' | 'apple' = 'email') => {
  try {
    console.log('🔍 transferTempOnboardingToUser called with:', { userId, provider });
    console.log('🔍 Current auth user:', {
      uid: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      displayName: auth.currentUser?.displayName,
      photoURL: auth.currentUser?.photoURL,
    });
    
    const tempOnboardingData = await AsyncStorage.getItem('tempOnboardingData');
    if (!tempOnboardingData) {
      console.log('⚠️ No temporary onboarding data found');
      return true;
    }

    const onboardingData = JSON.parse(tempOnboardingData);
    console.log('🔍 Onboarding data:', onboardingData);
    
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (userDoc.exists()) {
      // Update existing user
      await updateDoc(userRef, {
        onboarding: {
          ...onboardingData,
        },
        providers: provider,
      });
    } else {
      // Create new user document
      const userData = {
        createdAt: new Date(),
        uid: userId,
        providers: provider,
        email: auth.currentUser?.email || '',
        displayName: auth.currentUser?.displayName || '',
        isPremium: false,
        photoURL: auth.currentUser?.photoURL || '',
        onboarding: {
          ...onboardingData,
        },
      };
      
      console.log('🔍 Creating user document with data:', userData);
      await setDoc(userRef, userData);
      console.log('✅ User document created successfully');
    }

    // Clear temporary data
    await AsyncStorage.removeItem('tempOnboardingData');
    console.log('✅ Temporary onboarding data transferred to user');
    return true;
  } catch (error) {
    console.error('❌ Error transferring temporary onboarding data:', error);
    return false;
  }
};

// Save Pulse AI conversation
export const savePulseAIConversation = async (conversation: {
  id: string;
  title: string;
  messages: any[];
}) => {
  try {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('No authenticated user');
    }

    const userRef = doc(db, 'users', user.uid);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      throw new Error('User document not found');
    }

    const userData = userDoc.data() as UserData;
    const conversations = userData.pulseAIConversations || [];
    
    // Add new conversation
    conversations.push({
      ...conversation,
      timestamp: new Date(),
    });

    // Keep only last 50 conversations
    const recentConversations = conversations.slice(-50);

    await updateDoc(userRef, {
      pulseAIConversations: recentConversations,
    });

    console.log('✅ Pulse AI conversation saved');
    return true;
  } catch (error) {
    console.error('❌ Error saving Pulse AI conversation:', error);
    throw error;
  }
};

// Save journal entry
export const saveJournalEntry = async (entry: {
  id: string;
  content: string;
}) => {
  try {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('No authenticated user');
    }

    const userRef = doc(db, 'users', user.uid);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      throw new Error('User document not found');
    }

    const userData = userDoc.data() as UserData;
    const entries = userData.journalEntries || [];
    
    // Add new entry
    entries.push({
      id: entry.id,
      content: entry.content,
    });

    // Keep only last 100 entries
    const recentEntries = entries.slice(-100);

    await updateDoc(userRef, {
      journalEntries: recentEntries,
    });

    console.log('✅ Journal entry saved');
    return true;
  } catch (error) {
    console.error('❌ Error saving journal entry:', error);
    throw error;
  }
};

// Save user video
export const saveUserVideo = async (video: {
  id: string;
  uri: string;
  thumbnail?: string;
}) => {
  try {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('No authenticated user');
    }

    const userRef = doc(db, 'users', user.uid);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      throw new Error('User document not found');
    }

    const userData = userDoc.data() as UserData;
    const videos = userData.userVideos || [];
    
    // Add new video
    videos.push({
      ...video,
      timestamp: new Date(),
    });

    // Keep only last 50 videos
    const recentVideos = videos.slice(-50);

    await updateDoc(userRef, {
      userVideos: recentVideos,
    });

    console.log('✅ User video saved');
    return true;
  } catch (error) {
    console.error('❌ Error saving user video:', error);
    throw error;
  }
};

// Save user photo
export const saveUserPhoto = async (photo: {
  id: string;
  uri: string;
}) => {
  try {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('No authenticated user');
    }

    const userRef = doc(db, 'users', user.uid);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      throw new Error('User document not found');
    }

    const userData = userDoc.data() as UserData;
    const photos = userData.userPhotos || [];
    
    // Add new photo
    photos.push({
      ...photo,
      timestamp: new Date(),
    });

    // Keep only last 100 photos
    const recentPhotos = photos.slice(-100);

    await updateDoc(userRef, {
      userPhotos: recentPhotos,
    });

    console.log('✅ User photo saved');
    return true;
  } catch (error) {
    console.error('❌ Error saving user photo:', error);
    throw error;
  }
};

// Get user data
export const getUserData = async (): Promise<UserData | null> => {
  try {
    const user = auth.currentUser;
    if (!user) {
      return null;
    }

    const userRef = doc(db, 'users', user.uid);
    const userDoc = await getDoc(userRef);
    
    if (userDoc.exists()) {
      return userDoc.data() as UserData;
    }
    
    return null;
  } catch (error) {
    console.error('❌ Error getting user data:', error);
    throw error;
  }
};

// Query users by onboarding data (for analytics)
export const queryUsersByOnboarding = async (field: keyof OnboardingData, value: any) => {
  try {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where(`onboarding.${field}`, '==', value));
    const querySnapshot = await getDocs(q);
    
    const users: UserData[] = [];
    querySnapshot.forEach((doc) => {
      users.push(doc.data() as UserData);
    });
    
    return users;
  } catch (error) {
    console.error('❌ Error querying users:', error);
    throw error;
  }
};

// Get users by gender
export const getUsersByGender = async (gender: OnboardingData['gender']) => {
  return queryUsersByOnboarding('gender', gender);
};

// Get users by feeling
export const getUsersByFeeling = async (feeling: string) => {
  return queryUsersByOnboarding('feeling_now', feeling);
}; 