import React, { forwardRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  TextInputProps,
  ViewStyle,
} from 'react-native';
import { Eye, EyeOff } from 'lucide-react-native';
import { colors } from '../../theme';

interface InputProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: React.ReactNode;
  rightElement?: React.ReactNode;
  containerStyle?: ViewStyle;
}

export const Input = forwardRef<TextInput, InputProps>(
  (
    {
      label,
      error,
      hint,
      leftIcon,
      rightElement,
      secureTextEntry,
      containerStyle,
      onFocus,
      onBlur,
      ...textInputProps
    },
    ref,
  ) => {
    const [isFocused, setIsFocused] = useState(false);
    const [isPasswordVisible, setIsPasswordVisible] = useState(false);

    const isPassword = secureTextEntry !== undefined;

    const handleFocus = (e: any) => {
      setIsFocused(true);
      onFocus?.(e);
    };

    const handleBlur = (e: any) => {
      setIsFocused(false);
      onBlur?.(e);
    };

    const getBorderColor = () => {
      if (error) return 'rgba(239,71,111,0.5)';
      if (isFocused) return 'rgba(227,19,55,0.5)';
      return colors.border;
    };

    return (
      <View style={[styles.container, containerStyle]}>
        {label && <Text style={styles.label}>{label}</Text>}

        <View style={[styles.inputWrapper, { borderColor: getBorderColor() }]}>
          {leftIcon && <View style={styles.leftIcon}>{leftIcon}</View>}

          <TextInput
            ref={ref}
            placeholderTextColor={colors.textTertiary}
            secureTextEntry={isPassword && !isPasswordVisible}
            style={[
              styles.input,
              leftIcon ? styles.inputWithLeftIcon : null,
              (isPassword || rightElement) ? styles.inputWithRightElement : null,
            ]}
            onFocus={handleFocus}
            onBlur={handleBlur}
            {...textInputProps}
          />

          {rightElement && (
            <View style={styles.rightAction}>{rightElement}</View>
          )}

          {isPassword && (
            <TouchableOpacity
              onPress={() => setIsPasswordVisible(!isPasswordVisible)}
              style={styles.eyeButton}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              {isPasswordVisible ? (
                <EyeOff size={18} color={colors.textTertiary} />
              ) : (
                <Eye size={18} color={colors.textTertiary} />
              )}
            </TouchableOpacity>
          )}
        </View>

        {error && <Text style={styles.error}>{error}</Text>}
        {!error && hint && <Text style={styles.hint}>{hint}</Text>}
      </View>
    );
  },
);

Input.displayName = 'Input';

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderRadius: 14,
    overflow: 'hidden',
  },
  input: {
    flex: 1,
    height: '100%',
    paddingHorizontal: 14,
    fontSize: 14,
    color: colors.textPrimary,
  },
  inputWithLeftIcon: {
    paddingLeft: 0,
  },
  inputWithRightElement: {
    paddingRight: 0,
  },
  leftIcon: {
    paddingLeft: 14,
    paddingRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rightAction: {
    paddingRight: 4,
    paddingLeft: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  eyeButton: {
    paddingRight: 14,
    paddingLeft: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  error: {
    fontSize: 12,
    color: colors.error,
    marginTop: 6,
  },
  hint: {
    fontSize: 12,
    color: colors.textTertiary,
    marginTop: 6,
  },
});

export default Input;
