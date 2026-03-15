/**
 * OfflineBanner
 *
 * Shows a persistent banner at the top of the screen when
 * the device has no network connectivity.
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { WifiOff } from 'lucide-react-native';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { colors } from '../../theme';

export const OfflineBanner: React.FC = () => {
  const { isConnected } = useNetworkStatus();
  const slideAnim = useRef(new Animated.Value(-50)).current;

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: isConnected ? -50 : 0,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [isConnected, slideAnim]);

  // Always render for the animation, but hidden when connected
  return (
    <Animated.View
      style={[styles.container, { transform: [{ translateY: slideAnim }] }]}
      pointerEvents={isConnected ? 'none' : 'auto'}
    >
      <View style={styles.content}>
        <WifiOff size={14} color={colors.bg} />
        <Text style={styles.text}>No internet connection</Text>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 999,
    backgroundColor: colors.warning,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 16,
  },
  text: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.bg,
  },
});

export default OfflineBanner;
