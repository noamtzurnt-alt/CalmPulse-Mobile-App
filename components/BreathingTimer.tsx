import React from 'react';
import { Text, StyleSheet } from 'react-native';

interface TimerProps {
  seconds: number;
}

export const Timer = React.memo(({ seconds }: TimerProps) => {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Text style={styles.timer}>{formatTime(seconds)}</Text>
  );
});

const styles = StyleSheet.create({
  timer: {
    fontSize: 48,
    fontWeight: '700',
    color: '#334155',
    textAlign: 'center',
    marginBottom: 40,
  },
}); 
