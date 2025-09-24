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

// Disable update configuration
const updateConfig = {
  forceUpdate: false,
  minVersion: "2.0.0", // Set to current version to disable forced update
  minBuildNumber: "10", // Set to current build number
  minVersionCode: 40, // Set to current version code
  updateMessage: "A new version of CalmPulse is available with important improvements and bug fixes. Please update to continue using the app.",
  updateMessageHe: "גרסה חדשה של CalmPulse זמינה עם שיפורים חשובים ותיקוני באגים. אנא עדכן כדי להמשיך להשתמש באפליקציה.",
  storeUrl: "https://apps.apple.com/app/calmpulse/id1234567890",
  storeUrlAndroid: "https://play.google.com/store/apps/details?id=com.noam_tzur21.finaltest"
};

async function disableForcedUpdate() {
  try {
    console.log('🔄 Disabling forced update configuration...');
    
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
    
    console.log('✅ Forced update disabled successfully!');
    console.log('📱 Update config:', updateConfig);
    console.log('');
    console.log('📋 What this means:');
    console.log('- Users will no longer be forced to update');
    console.log('- All current versions will be allowed to use the app');
    console.log('- You can re-enable forced updates by running setup-forced-update.js');
    
  } catch (error) {
    console.error('❌ Error disabling forced update:', error);
  }
}

// Run the setup
disableForcedUpdate(); 