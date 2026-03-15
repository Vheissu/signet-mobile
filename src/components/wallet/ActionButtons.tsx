import React, { useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import {
  Send,
  Download,
  Layers,
  PiggyBank,
  Users,
  ArrowLeftRight,
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../../theme';

interface ActionItem {
  key: string;
  label: string;
  icon: React.FC<{ size: number; color: string }>;
  color: string;
  bgColor: string;
  screen: string;
}

const actions: ActionItem[] = [
  {
    key: 'send',
    label: 'Send',
    icon: Send,
    color: colors.hive,
    bgColor: 'rgba(227,19,55,0.12)',
    screen: 'Send',
  },
  {
    key: 'receive',
    label: 'Receive',
    icon: Download,
    color: colors.success,
    bgColor: 'rgba(92,234,160,0.12)',
    screen: 'Receive',
  },
  {
    key: 'stake',
    label: 'Stake',
    icon: Layers,
    color: colors.coral,
    bgColor: 'rgba(244,132,95,0.12)',
    screen: 'Stake',
  },
  {
    key: 'savings',
    label: 'Savings',
    icon: PiggyBank,
    color: colors.info,
    bgColor: 'rgba(99,179,237,0.12)',
    screen: 'Savings',
  },
  {
    key: 'delegate',
    label: 'Delegate',
    icon: Users,
    color: colors.warning,
    bgColor: 'rgba(255,209,102,0.12)',
    screen: 'Delegate',
  },
  {
    key: 'swap',
    label: 'Swap',
    icon: ArrowLeftRight,
    color: colors.coralLight,
    bgColor: 'rgba(247,160,132,0.12)',
    screen: 'Swap',
  },
];

export const ActionButtons: React.FC = () => {
  const navigation = useNavigation<any>();

  const handlePress = useCallback(
    (screen: string) => {
      navigation.navigate(screen);
    },
    [navigation],
  );

  return (
    <View style={styles.container}>
      {actions.map((action) => {
        const Icon = action.icon;
        return (
          <TouchableOpacity
            key={action.key}
            style={styles.button}
            onPress={() => handlePress(action.screen)}
            activeOpacity={0.7}
          >
            <View
              style={[
                styles.iconContainer,
                { backgroundColor: action.bgColor },
              ]}
            >
              <Icon size={22} color={action.color} />
            </View>
            <Text style={styles.label}>{action.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
  },
  button: {
    width: '30%',
    alignItems: 'center',
    gap: 8,
  },
  iconContainer: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
});

export default ActionButtons;
