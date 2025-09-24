# SplashScreenWithAd Component

## Overview
A React Native component that implements App Open Ads in compliance with AdMob policies. The component displays a splash screen with a fade-in animation and shows an App Open Ad when conditions are met.

**✅ Both iOS and Android Ad Unit IDs are now configured and ready to use!**

## Features
- ✅ AdMob policy-compliant App Open Ads
- ✅ Smooth fade-in animation
- ✅ 5-second timeout fallback
- ✅ Premium user detection
- ✅ Onboarding completion check
- ✅ Daily limit (once per day)
- ✅ Recent app close protection (5 minutes)
- ✅ Automatic navigation to home screen

## Usage

### Basic Usage
```tsx
import SplashScreenWithAd from '@/components/SplashScreenWithAd';

export default function App() {
  return (
    <SplashScreenWithAd 
      onAdComplete={() => console.log('Ad completed')}
      onTimeout={() => console.log('Timeout reached')}
    />
  );
}
```

### Integration with Expo Router
Replace your current splash screen in `app/_layout.tsx`:

```tsx
import SplashScreenWithAd from '@/components/SplashScreenWithAd';

export default function RootLayout() {
  return (
    <Stack>
      <Stack.Screen 
        name="splash" 
        component={SplashScreenWithAd} 
        options={{ headerShown: false }}
      />
      {/* Other screens */}
    </Stack>
  );
}
```

## Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `onAdComplete` | `() => void` | No | Callback when ad is completed |
| `onTimeout` | `() => void` | No | Callback when 5-second timeout is reached |

## AdMob Policy Compliance

### ✅ What the component does correctly:
- Shows ads only when app starts or resumes from background
- Displays ads on top of a loading screen (not empty screen)
- Provides smooth user experience with loading animation
- Automatically proceeds after timeout
- Does not force user interaction
- **🚫 NEVER shows ads to premium users** (triple-checked)
- Limits ads to once per day
- Prevents ads on recent app closes

### 🔒 Premium User Protection:
The component includes **triple protection** to ensure premium users never see ads:

1. **Initial Check**: Before any ad logic, checks premium status
2. **Pre-Load Check**: Before loading the ad, double-checks premium status  
3. **Pre-Show Check**: Before showing the ad, final premium status verification

If any check fails or premium status changes, the ad is immediately cancelled.

### ⚠️ Important Notes:
1. **Ad Unit IDs**: Both iOS and Android Ad Unit IDs are now configured:
   - **iOS**: `ca-app-pub-9135457753563605/9893348994`
   - **Android**: `ca-app-pub-9135457753563605/2668136109`

2. **Onboarding Flag**: The component checks for `hasCompletedOnboarding` in AsyncStorage. Set this flag when user completes onboarding:
   ```tsx
   await AsyncStorage.setItem('hasCompletedOnboarding', 'true');
   ```

## Configuration

### Ad Unit IDs
The component automatically uses the correct Ad Unit ID based on platform:

```tsx
const APP_OPEN_AD_UNIT_ID = __DEV__
  ? TestIds.APP_OPEN
  : Platform.OS === 'ios'
    ? 'ca-app-pub-9135457753563605/9893348994' // iOS App Open Ad Unit ID
    : 'ca-app-pub-9135457753563605/1234567890'; // Android App Open Ad Unit ID (replace when you get it)
```

**Current Ad Unit IDs:**
- **iOS**: `ca-app-pub-9135457753563605/9893348994` ✅
- **Android**: `ca-app-pub-9135457753563605/2668136109` ✅

### Customization
You can customize:
- Background color in `styles.container.backgroundColor`
- Text content in the render method
- Animation duration in `startFadeAnimation()`
- Timeout duration (currently 5000ms)

## Dependencies
- `react-native-google-mobile-ads`
- `@react-native-async-storage/async-storage`
- `expo-router`
- `expo-status-bar`

## Testing
- In development mode, uses test ad IDs
- In production, uses your actual AdMob ad unit IDs
- Check console logs for debugging information

### Console Logs to Watch:
- `🔍 Checking if App Open Ad should be shown...` - Initial check started
- `🚫 Premium user detected - App Open Ad will NEVER be shown` - Premium user detected
- `✅ User is not premium - continuing with other checks...` - Non-premium user
- `📱 Loading App Open Ad...` - Ad loading started
- `🎬 Showing App Open Ad...` - Ad being displayed
- `✅ All conditions met - App Open Ad will be shown` - All checks passed

## Troubleshooting
1. **Ad not showing**: Check if user is premium or conditions not met
2. **Navigation issues**: Ensure expo-router is properly configured
3. **Timeout issues**: Check if timeout callback is working
4. **Ad loading errors**: Check AdMob configuration and ad unit ID 