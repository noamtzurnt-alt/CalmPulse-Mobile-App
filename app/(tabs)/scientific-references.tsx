import React from 'react';
import { StyleSheet, View, Text, ScrollView, SafeAreaView, TouchableOpacity, Linking } from 'react-native';
import { useLanguage } from '@/lib/LanguageContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AdBanner from '@/components/AdBanner';

export default function ScientificReferencesScreen() {
  const { t, language } = useLanguage();
  const insets = useSafeAreaInsets();

  const references = [
    {
      title: t('breathingTitle'),
      description: t('breathingDescription'),
      sources: [
        {
          name: t('nationalLibrary'),
          link: 'https://pubmed.ncbi.nlm.nih.gov/36480101/'
        }
      ]
    },
    {
      title: t('vibrationTitle'),
      description: t('vibrationDescription'),
      sources: [
        {
          name: t('nationalLibrary'),
          link: 'https://pubmed.ncbi.nlm.nih.gov/36052109/'
        }
      ]
    },
    {
      title: t('musicTitle'),
      description: t('musicDescription'),
      sources: [
        {
          name: t('nationalLibrary'),
          link: 'https://pubmed.ncbi.nlm.nih.gov/34365216/'
        }
      ]
    },
    {
      title: t('gamesTitle'),
      description: t('gamesDescription'),
      sources: [
        {
          name: t('apa'),
          link: 'https://www.apa.org/news/press/releases/2013/11/video-games'
        }
      ]
    },
    {
      title: t('journalTitle'),
      description: t('journalDescription'),
      sources: [
        {
          name: t('rochesterMedical'),
          link: 'https://www.urmc.rochester.edu/encyclopedia/content.aspx?ContentID=4552&ContentTypeID=1'
        }
      ]
    },
    {
      title: t('pulseAITitle'),
      description: t('pulseAIDescription'),
      sources: [
        {
          name: t('jmirPublications'),
          link: 'https://www.jmir.org/2023/1/e46781/?utm_source=chatgpt.com'
        }
      ]
    }
  ];

  const handleSourcePress = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch (error) {
      console.error('Error opening URL:', error);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={{ paddingBottom: 160 + insets.bottom }}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('scientificReferences')}</Text>
        </View>

        <View style={styles.introContainer}>
          <Text style={styles.introText}>
            {t('scientificReferencesIntro')}
          </Text>
        </View>

        <View style={styles.content}>
          {references.map((ref, index) => (
            <View key={index} style={styles.referenceItem}>
              <Text style={styles.referenceTitle}>{ref.title}</Text>
              <Text style={styles.referenceDescription}>{ref.description}</Text>
              <View style={styles.sourcesContainer}>
                <Text style={styles.sourcesTitle}>{t('sources')}:</Text>
                {ref.sources.map((source, sourceIndex) => (
                  <TouchableOpacity 
                    key={sourceIndex} 
                    style={styles.sourceItem}
                    onPress={() => handleSourcePress(source.link)}
                  >
                    <Text style={styles.sourceName}>{source.name}:</Text>
                    <Text style={styles.sourceLink}>{source.link}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ))}
        </View>

        <View style={styles.disclaimerContainer}>
          <Text style={styles.disclaimerTitle}>{t('importantNotice')}:</Text>
          <Text style={styles.disclaimerText}>
            {t('scientificReferencesDisclaimer')}
          </Text>
        </View>

        {/* Bottom spacer to allow extra scroll beyond tab bar */}
        <View style={{ height: insets.bottom + 56 }} />
      </ScrollView>
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: insets.bottom + 56, alignItems: 'center', zIndex: 1000 }}>
        <AdBanner />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  introContainer: {
    padding: 16,
    backgroundColor: '#f1f5f9',
    marginBottom: 16,
  },
  introText: {
    fontSize: 16,
    color: '#475569',
    lineHeight: 24,
  },
  content: {
    padding: 16,
  },
  referenceItem: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  referenceTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 8,
  },
  referenceDescription: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
    marginBottom: 12,
  },
  sourcesContainer: {
    marginTop: 8,
  },
  sourcesTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 4,
  },
  sourceItem: {
    marginBottom: 4,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  sourceName: {
    fontSize: 14,
    color: '#475569',
    fontWeight: '500',
  },
  sourceLink: {
    fontSize: 14,
    color: '#3b82f6',
    marginLeft: 4,
    textDecorationLine: 'underline',
    flexShrink: 1,
  },
  disclaimerContainer: {
    padding: 16,
    backgroundColor: '#fef3c7',
    margin: 16,
    borderRadius: 8,
  },
  disclaimerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#92400e',
    marginBottom: 8,
  },
  disclaimerText: {
    fontSize: 14,
    color: '#92400e',
    lineHeight: 20,
  },
}); 