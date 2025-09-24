import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { OpaqueColorValue, StyleProp, TextStyle } from 'react-native';
import { IconSymbolName } from './IconSymbol';

// iOS specific mapping
const IOS_MAPPING: Record<IconSymbolName, any> = {
  'house.fill': 'home',
  'paperplane.fill': 'paper-plane',
  'chevron.left.forwardslash.chevron.right': 'code',
  'chevron.right': 'chevron-forward',
};

export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
}) {
  return (
    <Ionicons
      name={IOS_MAPPING[name]}
      size={size}
      color={color}
      style={style}
    />
  );
}
