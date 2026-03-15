import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View, ViewStyle } from 'react-native';
import { colors } from '../../theme';

type SpinnerSize = 'sm' | 'md' | 'lg';

interface SpinnerProps {
  size?: SpinnerSize;
  color?: string;
  style?: ViewStyle;
}

const sizeValues: Record<SpinnerSize, number> = {
  sm: 16,
  md: 32,
  lg: 48,
};

const borderWidthValues: Record<SpinnerSize, number> = {
  sm: 2,
  md: 3,
  lg: 4,
};

export const Spinner: React.FC<SpinnerProps> = ({
  size = 'md',
  color = colors.hive,
  style,
}) => {
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const dimension = sizeValues[size];
  const borderW = borderWidthValues[size];

  useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 800,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    animation.start();

    return () => animation.stop();
  }, [rotateAnim]);

  const rotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={[styles.container, { width: dimension, height: dimension }, style]}>
      <Animated.View
        style={[
          styles.spinner,
          {
            width: dimension,
            height: dimension,
            borderRadius: dimension / 2,
            borderWidth: borderW,
            borderColor: 'rgba(227,19,55,0.2)',
            borderTopColor: color,
            transform: [{ rotate }],
          },
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  spinner: {
    // dynamic styles applied inline
  },
});

export default Spinner;
