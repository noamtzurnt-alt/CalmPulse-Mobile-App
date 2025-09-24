require('dotenv').config();
const { initializeApp } = require('firebase/app');
const { getFirestore, doc, setDoc } = require('firebase/firestore');

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Update configuration
const updateConfig = {
  forceUpdate: true,
  minVersion: "2.1.0", // Minimum version required
  minBuildNumber: "11", // Minimum build number for iOS
  minVersionCode: 41, // Minimum version code for Android
  updateMessage: "A new version of CalmPulse is available with important improvements and bug fixes. Please update to continue using the app.",
  updateMessageHe: "גרסה חדשה של CalmPulse זמינה עם שיפורים חשובים ותיקוני באגים. אנא עדכן כדי להמשיך להשתמש באפליקציה.",
  storeUrl: "https://apps.apple.com/il/app/calmpulse/id6743389519", // Replace with your actual App Store URL
  storeUrlAndroid: "https://play.google.com/store/apps/details?id=com.noam_tzur21.finaltest&hl=en" // Replace with your actual Play Store URL
};

async function setupForcedUpdate() {
  try {
    console.log('🔄 Setting up forced update configuration...');
    
    // Check if all required environment variables are set
    const requiredEnvVars = [
      'EXPO_PUBLIC_FIREBASE_API_KEY',
      'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN',
      'EXPO_PUBLIC_FIREBASE_PROJECT_ID',
      'EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET',
      'EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
      'EXPO_PUBLIC_FIREBASE_APP_ID'
    ];
    
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    if (missingVars.length > 0) {
      console.error('❌ Missing required environment variables:', missingVars);
      console.error('Please make sure your .env file contains all Firebase configuration variables.');
      return;
    }
    
    console.log('✅ All environment variables are set');
    
    // Set the update configuration in Firebase
    await setDoc(doc(db, 'appConfig', 'updates'), updateConfig);
    
    console.log('✅ Forced update configuration set successfully!');
    console.log('📱 Update config:', updateConfig);
    console.log('');
    console.log('📋 What this means:');
    console.log('- Users with version < 2.1.0 will be forced to update');
    console.log('- iOS users with build number < 11 will be forced to update');
    console.log('- Android users with version code < 41 will be forced to update');
    console.log('- Users will see an Alert dialog that cannot be dismissed');
    console.log('- Clicking "Update Now" will open the respective app store');
    console.log('');
    console.log('⚠️  IMPORTANT: Make sure to update the store URLs with your actual app store links!');
    
  } catch (error) {
    console.error('❌ Error setting up forced update:', error);
  }
}

// Run the setup
setupForcedUpdate(); 