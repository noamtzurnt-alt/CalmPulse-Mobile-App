import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

interface ControlsProps {
  isPaused: boolean;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
}

export const Controls = ({ 
  isPaused, 
  onPause, 
  onResume, 
  onStop 
}: ControlsProps) => (
  <View style={styles.container}>
    <TouchableOpacity 
      style={styles.button}
      activeOpacity={0.8}
      onPress={async () => {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        isPaused ? onResume() : onPause();
      }}
    >
      <Ionicons 
        name={isPaused ? "play" : "pause"} 
        size={28}
        color="#334155"
        style={styles.buttonIcon}
      />
    </TouchableOpacity>

    <TouchableOpacity 
      style={styles.button}
      activeOpacity={0.8}
      onPress={async () => {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onStop();
      }}
    >
      <Ionicons 
        name="stop" 
        size={28} 
        color="#334155"
        style={styles.buttonIcon}
      />
    </TouchableOpacity>
  </View>
);

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 100,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 40,
  },
  button: {
    width: 80,
    height: 80,
    backgroundColor: 'white',
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  buttonIcon: {
    fontSize: 32,
  },
}); 
