import React, { useState } from 'react';
import { View, Text, Image, StyleSheet, ViewStyle, ImageStyle } from 'react-native';
import { colors } from '../../theme';

type AvatarSize = 'sm' | 'md' | 'lg';

interface AvatarProps {
  username: string;
  size?: AvatarSize;
  style?: ViewStyle;
}

const sizeValues: Record<AvatarSize, number> = {
  sm: 28,
  md: 36,
  lg: 48,
};

const fontSizeValues: Record<AvatarSize, number> = {
  sm: 11,
  md: 14,
  lg: 18,
};

export const Avatar: React.FC<AvatarProps> = ({
  username,
  size = 'md',
  style,
}) => {
  const [hasError, setHasError] = useState(false);
  const dimension = sizeValues[size];
  const uri = `https://images.hive.blog/u/${username}/avatar/small`;

  const containerStyle: ViewStyle = {
    width: dimension,
    height: dimension,
    borderRadius: dimension / 2,
  };

  if (hasError || !username) {
    return (
      <View style={[styles.fallback, containerStyle, style]}>
        <Text style={[styles.initial, { fontSize: fontSizeValues[size] }]}>
          {username ? username.charAt(0).toUpperCase() : '?'}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.wrapper, containerStyle, style]}>
      <Image
        source={{ uri }}
        style={[styles.image, containerStyle as ImageStyle]}
        onError={() => setHasError(true)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    borderWidth: 1.5,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  } as ImageStyle,
  fallback: {
    backgroundColor: colors.hive,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  initial: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});

export default Avatar;
