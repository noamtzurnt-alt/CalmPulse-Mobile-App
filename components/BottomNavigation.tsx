import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export function BottomNavigation() {
  const router = useRouter();

  return (
    <View style={styles.bottomNav}>
      <Pressable 
        style={styles.navItem}
        onPress={() => router.push('/(tabs)')}
      >
        <Ionicons name="home" size={24} color="#334155" />
        <Text style={styles.navText}>Home</Text>
      </Pressable>
      
      <Pressable 
        style={styles.navItem}
        onPress={() => router.push('/(tabs)/games')}
      >
        <Ionicons name="game-controller" size={24} color="#334155" />
        <Text style={styles.navText}>Games</Text>
      </Pressable>
      
      <Pressable 
        style={styles.navItem}
        onPress={() => router.push('/(tabs)/journal')}
      >
        <Ionicons name="journal" size={24} color="#334155" />
        <Text style={styles.navText}>Journal</Text>
      </Pressable>
      
      <Pressable 
        style={styles.navItem}
        onPress={() => router.push('/(tabs)/ai-tracker')}
      >
        <Ionicons name="analytics" size={24} color="#334155" />
        <Text style={styles.navText}>AI Tracker</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bottomNav: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: 'white',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  navItem: {
    alignItems: 'center',
  },
  navText: {
    fontSize: 12,
    color: '#334155',
    marginTop: 4,
  },
}); 
