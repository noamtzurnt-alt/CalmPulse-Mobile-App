import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
  Platform,
  Linking,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

interface UpdateScreenProps {
  onUpdate: () => void;
}

export default function UpdateScreen({ onUpdate }: UpdateScreenProps) {
  const handleUpdate = () => {
    // This will be handled by the Alert in updateUtils.ts
    onUpdate();
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Ionicons name="cloud-download-outline" size={80} color="#60A5FA" />
        </View>
        
        <Text style={styles.title}>Update Required</Text>
        <Text style={styles.subtitle}>נדרש עדכון</Text>
        
        <Text style={styles.message}>
          A new version of CalmPulse is available with important improvements and bug fixes.
        </Text>
        <Text style={styles.messageHe}>
          גרסה חדשה של CalmPulse זמינה עם שיפורים חשובים ותיקוני באגים.
        </Text>
        
        <TouchableOpacity style={styles.updateButton} onPress={handleUpdate}>
          <Ionicons name="arrow-up-circle" size={24} color="white" />
          <Text style={styles.updateButtonText}>Update Now</Text>
        </TouchableOpacity>
        
        <Text style={styles.versionInfo}>
          Current Version: {Platform.OS === 'ios' ? '2.0.0 (10)' : '2.0.0 (40)'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  iconContainer: {
    marginBottom: 30,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 30,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 10,
  },
  messageHe: {
    fontSize: 16,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 40,
  },
  updateButton: {
    backgroundColor: '#60A5FA',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 12,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  updateButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 8,
  },
  versionInfo: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
  },
}); 