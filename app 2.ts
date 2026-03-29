import 'dotenv/config';
import { ExpoConfig, ConfigContext } from '@expo/config';
const withAndroidConfig = require('./plugins/with-android-config');

export default ({ config }: ConfigContext): ExpoConfig => {
  let finalConfig: ExpoConfig = {
    name: "CalmPulse",
    slug: "finaltest",
    version: "3.0.0",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: "calmpulse",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,

    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.noamtzur.calmpulse",
      buildNumber: "16",
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
        NSCameraUsageDescription: "We use your camera to let you take photos and videos for creating personalized calming content within the CalmPulse app.",
        NSPhotoLibraryUsageDescription: "We use your photo library to let you select photos and videos for creating personalized calming videos and experiences within the CalmPulse app. For example, you can choose your own photos to create a relaxing slideshow.",
        NSPhotoLibraryAddUsageDescription: "We save your selected calming photos and videos to your library if you choose to export them from the app.",
        SKAdNetworkItems: [
          {
            SKAdNetworkIdentifier: "cstr6suwn9.skadnetwork"
          }
        ],
        GADApplicationIdentifier: "ca-app-pub-9135457753563605~6789823913",
        GIDClientID: "652258881378-f0hbfslfev8icb8fgo79qqf9nlhrk26l.apps.googleusercontent.com",
        CFBundleURLTypes: [
          {
            CFBundleURLName: "GoogleSignIn",
            CFBundleURLSchemes: [
              "com.googleusercontent.apps.652258881378-f0hbfslfev8icb8fgo79qqf9nlhrk26l"
            ]
          }
        ]
      },
      googleServicesFile: "./app/GoogleService-Info.plist",
      icon: {
        dark: "./assets/icons/dark.png",
        light: "./assets/icons/light.png",
        tinted: "./assets/icons/tinted.png"
      }
    },

    android: {
      googleServicesFile: "./app/google-services.json",
      adaptiveIcon: {
        foregroundImage: "./assets/icons/adaptive-icon.png",
        monochromeImage: "./assets/icons/adaptive-icon.png",
        backgroundColor: "#ffffff"
      },
      package: "com.noam_tzur21.finaltest",
      versionCode: 46,
      permissions: [
        "INTERNET",
        "VIBRATE",
        "com.google.android.gms.permission.AD_ID"
      ]
    },

    plugins: [
      ["react-native-google-mobile-ads", {
        iosAppId: "ca-app-pub-9135457753563605~6789823913",
        androidAppId: "ca-app-pub-9135457753563605~6456418475",
        delayAppMeasurementInit: true
      }],
      ["expo-splash-screen", {
        image: "./assets/icons/splash-icon-dark.png",
        imageWidth: 200,
        imageHeight: 200,
        resizeMode: "contain",
        backgroundColor: "#ffffff",
        dark: {
          image: "./assets/icons/splash-icon-light.png",
          backgroundColor: "#000000"
        }
      }],
      ["@react-native-google-signin/google-signin", {
        iosUrlScheme: "com.googleusercontent.apps.652258881378-f0hbfslfev8icb8fgo79qqf9nlhrk26l"
      }],
      "expo-apple-authentication"
    ],

    owner: "noam_tzur22",

    extra: {
      eas: {
        projectId: "090f4921-c1de-4cea-ad17-6a7712885646"
      },
      FIREBASE_API_KEY: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
      FIREBASE_AUTH_DOMAIN: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
      FIREBASE_PROJECT_ID: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
      FIREBASE_STORAGE_BUCKET: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
      FIREBASE_MESSAGING_SENDER_ID: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      FIREBASE_APP_ID: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
      REVENUECAT_API_KEY_IOS: process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_IOS,
      REVENUECAT_API_KEY_ANDROID: process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID,
      GOOGLE_CLIENT_ID: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID,
      GOOGLE_IOS_CLIENT_ID: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
      GOOGLE_ANDROID_CLIENT_ID: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
      PULSE_API_URL: process.env.EXPO_PUBLIC_PULSE_API_URL,
      // Store URLs for forced update
      APP_STORE_URL: "https://apps.apple.com/app/id6743389519",
      PLAY_STORE_URL: "https://play.google.com/store/apps/details?id=com.noam_tzur21.finaltest",
      MIXPANEL_TOKEN: process.env.EXPO_PUBLIC_MIXPANEL_TOKEN,
      EXPO_PUBLIC_MIXPANEL_EU: process.env.EXPO_PUBLIC_MIXPANEL_EU
    }
  };

  // 🧠 מפעיל את הפלאגין על הקונפיג
  finalConfig = withAndroidConfig(finalConfig);

  return finalConfig;
};
