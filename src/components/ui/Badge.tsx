import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { colors } from '../../theme';

type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'hive';

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  style?: ViewStyle;
}

const variantStyles: Record<BadgeVariant, { container: ViewStyle; text: TextStyle }> = {
  default: {
    container: {
      backgroundColor: 'rgba(169,155,191,0.1)',
    },
    text: {
      color: colors.textSecondary,
    },
  },
  success: {
    container: {
      backgroundColor: 'rgba(92,234,160,0.1)',
    },
    text: {
      color: colors.success,
    },
  },
  warning: {
    container: {
      backgroundColor: 'rgba(255,209,102,0.1)',
    },
    text: {
      color: colors.warning,
    },
  },
  error: {
    container: {
      backgroundColor: 'rgba(239,71,111,0.1)',
    },
    text: {
      color: colors.error,
    },
  },
  hive: {
    container: {
      backgroundColor: 'rgba(227,19,55,0.1)',
    },
    text: {
      color: colors.hive,
    },
  },
};

export const Badge: React.FC<BadgeProps> = ({
  variant = 'default',
  children,
  style,
}) => {
  return (
    <View style={[styles.container, variantStyles[variant].container, style]}>
      <Text style={[styles.text, variantStyles[variant].text]}>{children}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  text: {
    fontSize: 10,
    fontWeight: '700',
  },
});

export default Badge;
