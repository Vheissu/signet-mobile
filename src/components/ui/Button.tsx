import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  TextStyle,
  View,
} from 'react-native';
import { colors } from '../../theme';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  children: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  style?: ViewStyle;
}

const variantStyles: Record<ButtonVariant, { container: ViewStyle; text: TextStyle }> = {
  primary: {
    container: {
      backgroundColor: colors.hive,
    },
    text: {
      color: '#FFFFFF',
    },
  },
  secondary: {
    container: {
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.border,
    },
    text: {
      color: colors.textPrimary,
    },
  },
  ghost: {
    container: {
      backgroundColor: 'transparent',
    },
    text: {
      color: colors.textSecondary,
    },
  },
  danger: {
    container: {
      backgroundColor: 'rgba(239,71,111,0.1)',
      borderWidth: 1,
      borderColor: 'rgba(239,71,111,0.3)',
    },
    text: {
      color: colors.error,
    },
  },
};

const sizeStyles: Record<ButtonSize, { container: ViewStyle; text: TextStyle }> = {
  sm: {
    container: {
      height: 32,
      paddingHorizontal: 12,
      borderRadius: 8,
    },
    text: {
      fontSize: 12,
    },
  },
  md: {
    container: {
      height: 40,
      paddingHorizontal: 16,
      borderRadius: 10,
    },
    text: {
      fontSize: 14,
    },
  },
  lg: {
    container: {
      height: 48,
      paddingHorizontal: 20,
      borderRadius: 12,
    },
    text: {
      fontSize: 16,
    },
  },
};

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  loading = false,
  icon,
  children,
  onPress,
  disabled = false,
  style,
}) => {
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.7}
      style={[
        styles.base,
        variantStyles[variant].container,
        sizeStyles[size].container,
        fullWidth && styles.fullWidth,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' ? '#FFFFFF' : colors.textSecondary}
        />
      ) : (
        <View style={styles.content}>
          {icon && <View style={styles.iconWrapper}>{icon}</View>}
          <Text
            style={[
              styles.text,
              variantStyles[variant].text,
              sizeStyles[size].text,
            ]}
          >
            {children}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullWidth: {
    width: '100%',
  },
  disabled: {
    opacity: 0.5,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconWrapper: {
    marginRight: 2,
  },
  text: {
    fontWeight: '600',
  },
});

export default Button;
