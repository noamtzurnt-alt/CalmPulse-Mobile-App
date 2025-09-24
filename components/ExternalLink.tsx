import { Link } from 'expo-router';
import { openBrowserAsync } from 'expo-web-browser';
import { type ComponentProps } from 'react';
import { Platform, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type Props = Omit<ComponentProps<typeof Link>, 'href'> & { 
  href: string;
  showIcon?: boolean;
};

export function ExternalLink({ href, showIcon = false, children, ...rest }: Props) {
  const handlePress = async (event: any) => {
    if (Platform.OS !== 'web') {
      event.preventDefault();
      await openBrowserAsync(href);
    }
  };

  return (
    <Link
      target="_blank"
      {...rest}
      href={href as any}
      onPress={handlePress}
      style={[
        { flexDirection: 'row', alignItems: 'center' },
        rest.style
      ]}
    >
      {children}
      {showIcon && (
        <Ionicons 
          name="open-outline" 
          size={16} 
          color="#7c9cb4" 
          style={{ marginLeft: 4 }} 
        />
      )}
    </Link>
  );
}
