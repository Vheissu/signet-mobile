import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Animated,
  ViewStyle,
} from 'react-native';
import { ArrowLeft } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../theme';

interface PageContainerProps {
  title?: string;
  showBack?: boolean;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
  scrollable?: boolean;
  style?: ViewStyle;
  contentContainerStyle?: ViewStyle;
  noPadding?: boolean;
}

export const PageContainer: React.FC<PageContainerProps> = ({
  title,
  showBack = false,
  headerRight,
  children,
  scrollable = true,
  style,
  contentContainerStyle,
  noPadding = false,
}) => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  const showHeader = title || showBack || headerRight;

  const ContentWrapper = scrollable ? ScrollView : View;
  const contentProps = scrollable
    ? {
        showsVerticalScrollIndicator: false,
        contentContainerStyle: [
          styles.scrollContent,
          noPadding ? undefined : styles.contentPadding,
          contentContainerStyle,
        ],
        keyboardShouldPersistTaps: 'handled' as const,
      }
    : {
        style: [
          styles.viewContent,
          noPadding ? undefined : styles.contentPadding,
          contentContainerStyle,
        ],
      };

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }, style]}>
      {showHeader && (
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <View style={styles.headerLeft}>
            {showBack && (
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => navigation.goBack()}
                activeOpacity={0.7}
              >
                <ArrowLeft size={22} color={colors.textPrimary} />
              </TouchableOpacity>
            )}
            {title && (
              <Text style={styles.title} numberOfLines={1}>
                {title}
              </Text>
            )}
          </View>
          {headerRight && (
            <View style={styles.headerRight}>{headerRight}</View>
          )}
        </View>
      )}

      <ContentWrapper {...contentProps}>{children}</ContentWrapper>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: colors.bg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceElevated,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  viewContent: {
    flex: 1,
  },
  contentPadding: {
    padding: 16,
  },
});

export default PageContainer;
