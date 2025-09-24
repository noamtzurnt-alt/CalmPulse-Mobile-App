import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { translations, TranslationKey } from './translations';

type TranslationFunction = (key: TranslationKey) => string | string[];

interface LanguageContextType {
  language: string;
  setLanguage: (lang: string) => void;
  t: TranslationFunction;
}

const LanguageContext = createContext<LanguageContextType>({
  language: 'en',
  setLanguage: () => {},
  t: () => '',
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState('en');

  useEffect(() => {
    // Load saved language preference
    AsyncStorage.getItem('language').then((savedLanguage) => {
      if (savedLanguage) {
        setLanguageState(savedLanguage);
      }
    });
  }, []);

  const setLanguage = async (lang: string) => {
    await AsyncStorage.setItem('language', lang);
    setLanguageState(lang);
  };

  const t = (key: TranslationKey): string => {
    const lang = language as keyof typeof translations;
    const translatedText = translations[lang][key] as string;
    return translatedText;    
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
} 
