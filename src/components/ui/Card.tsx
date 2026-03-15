import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { colors } from '../../theme';

type CardVariant = 'default' | 'elevated' | 'gradient' | 'outline';
type CardPadding = 'none' | 'sm' | 'md' | 'lg';

interface CardProps {
  variant?: CardVariant;
  padding?: CardPadding;
  children: React.ReactNode;
  style?: ViewStyle;
}

const paddingValues: Record<CardPadding, number> = {
  none: 0,
  sm: 14,
  md: 16,
  lg: 20,
};

const variantStyles: Record<CardVariant, ViewStyle> = {
  default: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  elevated: {
    backgroundColor: colors.surfaceElevated,
  },
  gradient: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderAccent,
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.border,
  },
};

export const Card: React.FC<CardProps> = ({
  variant = 'default',
  padding = 'md',
  children,
  style,
}) => {
  return (
    <View
      style={[
        styles.base,
        variantStyles[variant],
        { padding: paddingValues[padding] },
        style,
      ]}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  base: {
    borderRadius: 18,
    overflow: 'hidden',
  },
});

export default Card;
