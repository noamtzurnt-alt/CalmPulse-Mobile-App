import AsyncStorage from '@react-native-async-storage/async-storage';
import { VibrationType } from '../app/(tabs)/haptics';

export const loadHapticsSettings = async () => {
  try {
    const settings = await AsyncStorage.getItem('haptics_settings');
    return settings ? JSON.parse(settings) : null;
  } catch (error) {
    console.error('Error loading haptics settings:', error);
    return null;
  }
};

export const saveHapticsSettings = async (settings: any) => {
  try {
    await AsyncStorage.setItem('haptics_settings', JSON.stringify(settings));
  } catch (error) {
    console.error('Error saving haptics settings:', error);
  }
}; 