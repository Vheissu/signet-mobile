/**
 * Shared screen header.
 *
 * Pads for the status bar using the real safe-area inset instead of a
 * fixed 56px, so it sits correctly on every iPhone, on Android with a
 * translucent status bar, and in landscape.
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import { colors } from '../../theme';

interface ScreenHeaderProps {
  title: string;
  /** Hide the back button (root screens). */
  hideBack?: boolean;
  /** Called instead of navigation.goBack() when provided. */
  onBack?: () => void;
  /** Optional element on the right; kept the same width as the back button. */
  right?: React.ReactNode;
  /** Draw without the bottom border, for screens that put tabs directly under it. */
  flush?: boolean;
}

export const ScreenHeader: React.FC<ScreenHeaderProps> = ({
  title,
  hideBack = false,
  onBack,
  right,
  flush = false,
}) => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  const handleBack = () => {
    if (onBack) {
      onBack();
      return;
    }
    if (navigation.canGoBack()) navigation.goBack();
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }, flush && styles.flush]}>
      {hideBack ? (
        <View style={styles.slot} />
      ) : (
        <TouchableOpacity
          onPress={handleBack}
          style={[styles.slot, styles.backButton]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <ArrowLeft size={20} color={colors.textPrimary} />
        </TouchableOpacity>
      )}
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
      <View style={styles.slot}>{right}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: colors.bg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  flush: {
    borderBottomWidth: 0,
  },
  slot: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButton: {
    borderRadius: 12,
    backgroundColor: colors.surfaceElevated,
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
  },
});

export default ScreenHeader;
