import React from 'react';
import SplashScreenWithAd from './SplashScreenWithAd';

/**
 * Example usage of SplashScreenWithAd component
 * 
 * This component demonstrates how to integrate the SplashScreenWithAd
 * into your app's navigation flow.
 */
export default function SplashScreenWithAdExample() {
  const handleAdComplete = () => {
    console.log('✅ App Open Ad completed successfully');
    // You can add any additional logic here
    // For example: analytics tracking, user engagement metrics, etc.
  };

  const handleTimeout = () => {
    console.log('⏰ Splash timeout reached - proceeding to app');
    // This callback is called when the 5-second timeout is reached
    // Useful for analytics or debugging
  };

  return (
    <SplashScreenWithAd 
      onAdComplete={handleAdComplete}
      onTimeout={handleTimeout}
    />
  );
}

/**
 * Alternative integration example for Expo Router
 * 
 * If you're using Expo Router, you can create a splash route like this:
 * 
 * File: app/splash.tsx
 * 
 * import SplashScreenWithAd from '@/components/SplashScreenWithAd';
 * 
 * export default function SplashRoute() {
 *   return <SplashScreenWithAd />;
 * }
 * 
 * Then in your app/_layout.tsx:
 * 
 * import { Stack } from 'expo-router';
 * 
 * export default function RootLayout() {
 *   return (
 *     <Stack>
 *       <Stack.Screen 
 *         name="splash" 
 *         options={{ 
 *           headerShown: false,
 *           gestureEnabled: false,
 *           animation: 'none'
 *         }} 
 *       />
 *       <Stack.Screen 
 *         name="(tabs)" 
 *         options={{ 
 *           headerShown: false,
 *           gestureEnabled: false 
 *         }} 
 *       />
 *     </Stack>
 *   );
 * }
 */ 