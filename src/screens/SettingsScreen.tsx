import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Switch,
  Alert,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
  ChevronLeft,
  User,
  Shield,
  Globe,
  AlertTriangle,
  Clock,
  Lock,
  Fingerprint,
  Server,
  ChevronRight,
  Plus,
  Trash2,
  Check,
  Edit2,
  LogOut,
} from 'lucide-react-native';
import { colors } from '../theme';
import { useStore } from '../store';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { Badge } from '../components/ui/Badge';
import { Avatar } from '../components/ui/Avatar';
import { DEFAULT_SETTINGS } from '../core/types';
import {
  isBiometricAvailable,
  isBiometricEnrolled,
  enrollBiometric,
  removeBiometric,
} from '../core/biometric';

const SettingsScreen: React.FC = () => {
  const navigation = useNavigation<any>();

  // Store
  const settings = useStore((s) => s.settings);
  const accounts = useStore((s) => s.accounts);
  const activeAccountName = useStore((s) => s.activeAccountName);
  const password = useStore((s) => s.password);
  const lockWallet = useStore((s) => s.lock);
  const resetWallet = useStore((s) => s.resetWallet);
  const updateSettings = useStore((s) => s.updateSettings);
  const removeAccount = useStore((s) => s.removeAccount);
  const addToast = useStore((s) => s.addToast);

  // Settings state (initialized from store)
  const [autoLockMinutes, setAutoLockMinutes] = useState(
    settings.autoLockMinutes.toString(),
  );
  const [biometricEnabled, setBiometricEnabled] = useState(settings.biometricEnabled);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [activeRpc, setActiveRpc] = useState(settings.activeRpc);
  const [customRpc, setCustomRpc] = useState('');
  const [cgApiKey, setCgApiKey] = useState(settings.coingeckoApiKey || '');

  // Modal states
  const [showRpcModal, setShowRpcModal] = useState(false);
  const [showAccountsModal, setShowAccountsModal] = useState(false);
  const [showClearDataModal, setShowClearDataModal] = useState(false);

  const rpcNodes = settings.rpcNodes;

  // Check biometric availability on mount
  useEffect(() => {
    (async () => {
      const available = await isBiometricAvailable();
      setBiometricAvailable(available);
      if (available) {
        const enrolled = await isBiometricEnrolled();
        setBiometricEnabled(enrolled);
      }
    })();
  }, []);

  // Sync local state when store settings change
  useEffect(() => {
    setAutoLockMinutes(settings.autoLockMinutes.toString());
    setActiveRpc(settings.activeRpc);
  }, [settings.autoLockMinutes, settings.activeRpc]);

  const handleAutoLockSave = useCallback(async () => {
    const mins = parseInt(autoLockMinutes, 10);
    if (isNaN(mins) || mins < 1) {
      Alert.alert('Invalid', 'Please enter a number greater than 0.');
      return;
    }
    await updateSettings({ autoLockMinutes: mins });
    addToast({ type: 'success', message: `Auto-lock set to ${mins} minutes` });
  }, [autoLockMinutes, updateSettings, addToast]);

  const handleSaveCgApiKey = useCallback(async () => {
    await updateSettings({ coingeckoApiKey: cgApiKey.trim() });
    addToast({
      type: 'success',
      message: cgApiKey.trim()
        ? 'CoinGecko Pro API key saved'
        : 'Switched to CoinGecko free tier',
    });
  }, [cgApiKey, updateSettings, addToast]);

  const handleBiometricToggle = useCallback(
    async (value: boolean) => {
      if (!biometricAvailable) {
        Alert.alert(
          'Not Available',
          'Biometric authentication is not available on this device.',
        );
        return;
      }

      if (value) {
        // Enable biometric
        if (!password) {
          Alert.alert('Error', 'Wallet must be unlocked to enable biometric.');
          return;
        }
        const success = await enrollBiometric(password);
        if (success) {
          setBiometricEnabled(true);
          await updateSettings({ biometricEnabled: true });
          addToast({ type: 'success', message: 'Biometric unlock enabled' });
        } else {
          addToast({ type: 'error', message: 'Failed to enable biometric unlock' });
        }
      } else {
        // Disable biometric
        await removeBiometric();
        setBiometricEnabled(false);
        await updateSettings({ biometricEnabled: false });
        addToast({ type: 'info', message: 'Biometric unlock disabled' });
      }
    },
    [biometricAvailable, password, updateSettings, addToast],
  );

  const handleSelectRpc = useCallback(
    async (node: string): Promise<void> => {
      setActiveRpc(node);
      setShowRpcModal(false);
      await updateSettings({ activeRpc: node });
      addToast({ type: 'success', message: 'RPC node updated' });
    },
    [updateSettings, addToast],
  );

  const handleAddCustomRpc = useCallback(async () => {
    if (!customRpc.trim()) return;
    const trimmed = customRpc.trim();

    // Validate URL format and HTTPS
    try {
      const url = new URL(trimmed);
      if (url.protocol !== 'https:') {
        Alert.alert('Invalid', 'RPC URL must use HTTPS for security.');
        return;
      }
      if (!url.hostname || url.hostname.length < 4) {
        Alert.alert('Invalid', 'Please enter a valid RPC URL.');
        return;
      }
    } catch {
      Alert.alert('Invalid', 'Please enter a valid URL (e.g. https://api.example.com).');
      return;
    }

    // Check for duplicates
    if (rpcNodes.includes(trimmed)) {
      Alert.alert('Duplicate', 'This RPC node is already in your list.');
      return;
    }

    const updatedNodes = [...rpcNodes, trimmed];
    setActiveRpc(trimmed);
    setCustomRpc('');
    setShowRpcModal(false);
    await updateSettings({ rpcNodes: updatedNodes, activeRpc: trimmed });
    addToast({ type: 'success', message: 'Custom RPC node added and selected' });
  }, [customRpc, rpcNodes, updateSettings, addToast]);

  const handleRemoveAccount = useCallback(
    (username: string) => {
      Alert.alert(
        'Remove Account',
        `Are you sure you want to remove @${username}? This will delete all stored keys for this account.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: async () => {
              await removeAccount(username);
              addToast({ type: 'info', message: `@${username} removed` });
              // Close modal if no accounts left
              if (accounts.length <= 1) {
                setShowAccountsModal(false);
              }
            },
          },
        ],
      );
    },
    [removeAccount, addToast, accounts.length],
  );

  const [confirmPassword, setConfirmPassword] = useState('');

  const handleClearData = useCallback(() => {
    // Require password re-entry for this destructive operation
    if (!confirmPassword.trim()) {
      Alert.alert('Password Required', 'Please enter your wallet password to confirm.');
      return;
    }
    if (confirmPassword !== password) {
      Alert.alert('Incorrect Password', 'The password you entered does not match.');
      setConfirmPassword('');
      return;
    }

    Alert.alert(
      'Clear All Data',
      'This will permanently delete all accounts, keys, and settings. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear Everything',
          style: 'destructive',
          onPress: async () => {
            setShowClearDataModal(false);
            setConfirmPassword('');
            try {
              await resetWallet();
              addToast({ type: 'info', message: 'All data has been cleared' });
            } catch (e: any) {
              Alert.alert('Error', e.message || 'Failed to clear data');
            }
          },
        },
      ],
    );
  }, [resetWallet, addToast, password, confirmPassword]);

  const handleLockWallet = useCallback(() => {
    lockWallet();
  }, [lockWallet]);

  const SettingRow: React.FC<{
    icon: React.ReactNode;
    label: string;
    value?: string;
    onPress?: () => void;
    rightElement?: React.ReactNode;
    danger?: boolean;
  }> = ({ icon, label, value, onPress, rightElement, danger }) => (
    <TouchableOpacity
      style={styles.settingRow}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      disabled={!onPress}
    >
      <View style={styles.settingLeft}>
        {icon}
        <Text
          style={[
            styles.settingLabel,
            danger && { color: colors.error },
          ]}
        >
          {label}
        </Text>
      </View>
      {rightElement ??
        (value ? (
          <View style={styles.settingRight}>
            <Text style={styles.settingValue}>{value}</Text>
            {onPress && <ChevronRight size={16} color={colors.textTertiary} />}
          </View>
        ) : onPress ? (
          <ChevronRight size={16} color={colors.textTertiary} />
        ) : null)}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <ChevronLeft size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Account Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <User size={16} color={colors.textSecondary} />
            <Text style={styles.sectionTitle}>Account</Text>
          </View>
          <Card variant="default" padding="none">
            <SettingRow
              icon={<User size={18} color={colors.textSecondary} />}
              label="Manage Accounts"
              value={`${accounts.length} account${accounts.length !== 1 ? 's' : ''}`}
              onPress={() => setShowAccountsModal(true)}
            />
            <View style={styles.divider} />
            <SettingRow
              icon={<Plus size={18} color={colors.textSecondary} />}
              label="Add Account"
              onPress={() => navigation.navigate('AddAccount')}
            />
          </Card>
        </View>

        {/* Security Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Shield size={16} color={colors.textSecondary} />
            <Text style={styles.sectionTitle}>Security</Text>
          </View>
          <Card variant="default" padding="none">
            <View style={styles.settingRow}>
              <View style={styles.settingLeft}>
                <Clock size={18} color={colors.textSecondary} />
                <Text style={styles.settingLabel}>Auto-lock Timer</Text>
              </View>
              <View style={styles.autoLockInput}>
                <Input
                  placeholder="10"
                  value={autoLockMinutes}
                  onChangeText={setAutoLockMinutes}
                  keyboardType="number-pad"
                  containerStyle={styles.autoLockInputContainer}
                />
                <Text style={styles.minutesLabel}>min</Text>
                <TouchableOpacity
                  onPress={handleAutoLockSave}
                  style={styles.saveButton}
                >
                  <Check size={16} color={colors.success} />
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.divider} />
            <SettingRow
              icon={<Lock size={18} color={colors.textSecondary} />}
              label="Encryption"
              rightElement={
                <Badge variant="success">AES-256</Badge>
              }
            />
            <View style={styles.divider} />
            <SettingRow
              icon={<Fingerprint size={18} color={colors.textSecondary} />}
              label="Biometric Unlock"
              rightElement={
                <Switch
                  value={biometricEnabled}
                  onValueChange={handleBiometricToggle}
                  disabled={!biometricAvailable}
                  trackColor={{
                    false: colors.surfaceOverlay,
                    true: 'rgba(227,19,55,0.4)',
                  }}
                  thumbColor={biometricEnabled ? colors.hive : colors.textTertiary}
                  ios_backgroundColor={colors.surfaceOverlay}
                />
              }
            />
          </Card>
        </View>

        {/* Network Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Globe size={16} color={colors.textSecondary} />
            <Text style={styles.sectionTitle}>Network</Text>
          </View>
          <Card variant="default" padding="none">
            <SettingRow
              icon={<Server size={18} color={colors.textSecondary} />}
              label="RPC Node"
              value={activeRpc.replace('https://', '')}
              onPress={() => setShowRpcModal(true)}
            />
            <View style={styles.divider} />
            <View style={styles.settingRow}>
              <View style={styles.settingLeft}>
                <Globe size={18} color={colors.textSecondary} />
                <Text style={styles.settingLabel}>CoinGecko API Key</Text>
              </View>
            </View>
            <View style={styles.cgApiKeyRow}>
              <Input
                placeholder="Leave empty for free tier"
                value={cgApiKey}
                onChangeText={setCgApiKey}
                secureTextEntry
                containerStyle={styles.cgApiKeyInput}
              />
              <TouchableOpacity
                onPress={handleSaveCgApiKey}
                style={styles.saveButton}
              >
                <Check size={16} color={colors.success} />
              </TouchableOpacity>
            </View>
          </Card>
        </View>

        {/* Danger Zone */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <AlertTriangle size={16} color={colors.error} />
            <Text style={[styles.sectionTitle, { color: colors.error }]}>
              Danger Zone
            </Text>
          </View>
          <Card variant="default" padding="none">
            <SettingRow
              icon={<LogOut size={18} color={colors.error} />}
              label="Lock Wallet"
              danger
              onPress={handleLockWallet}
            />
            <View style={styles.divider} />
            <SettingRow
              icon={<Trash2 size={18} color={colors.error} />}
              label="Clear All Data"
              danger
              onPress={() => setShowClearDataModal(true)}
            />
          </Card>
        </View>

        {/* Version */}
        <Text style={styles.versionText}>Signet Mobile v{require('../../app.json').expo.version}</Text>
      </ScrollView>

      {/* RPC Node Modal */}
      <Modal
        visible={showRpcModal}
        onClose={() => setShowRpcModal(false)}
        title="RPC Node"
      >
        <View style={styles.modalContent}>
          {rpcNodes.map((node: string) => (
            <TouchableOpacity
              key={node}
              style={[
                styles.rpcNode,
                node === activeRpc && styles.rpcNodeActive,
              ]}
              onPress={() => handleSelectRpc(node)}
            >
              <View style={styles.rpcNodeLeft}>
                <Server size={16} color={node === activeRpc ? colors.hive : colors.textTertiary} />
                <Text
                  style={[
                    styles.rpcNodeText,
                    node === activeRpc && styles.rpcNodeTextActive,
                  ]}
                  numberOfLines={1}
                >
                  {node}
                </Text>
              </View>
              {node === activeRpc && (
                <Check size={16} color={colors.hive} />
              )}
            </TouchableOpacity>
          ))}

          <View style={styles.modalDivider} />

          <Text style={styles.customRpcLabel}>Custom RPC</Text>
          <Input
            placeholder="https://custom-rpc.example.com"
            value={customRpc}
            onChangeText={setCustomRpc}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <View style={styles.modalSpacer} />
          <Button
            variant="secondary"
            size="md"
            fullWidth
            onPress={handleAddCustomRpc}
            disabled={!customRpc.trim()}
            icon={<Plus size={16} color={colors.textPrimary} />}
          >
            Add Custom Node
          </Button>
        </View>
      </Modal>

      {/* Manage Accounts Modal */}
      <Modal
        visible={showAccountsModal}
        onClose={() => setShowAccountsModal(false)}
        title="Manage Accounts"
      >
        <View style={styles.modalContent}>
          {accounts.map((acct) => (
            <View key={acct.username} style={styles.accountRow}>
              <Avatar username={acct.username} size="md" />
              <View style={styles.accountInfo}>
                <Text style={styles.accountName}>
                  @{acct.username}
                  {acct.username === activeAccountName && (
                    <Text style={styles.activeLabel}> (active)</Text>
                  )}
                </Text>
                <Text style={styles.accountKeys}>
                  {Object.keys(acct.keys).length} key
                  {Object.keys(acct.keys).length !== 1 ? 's' : ''}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  setShowAccountsModal(false);
                  navigation.navigate('EditAccount', {
                    username: acct.username,
                  });
                }}
                style={styles.editButton}
              >
                <Edit2 size={16} color={colors.textSecondary} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleRemoveAccount(acct.username)}
                style={styles.deleteButton}
              >
                <Trash2 size={16} color={colors.error} />
              </TouchableOpacity>
            </View>
          ))}

          <View style={styles.modalSpacer} />

          <Button
            variant="primary"
            size="md"
            fullWidth
            onPress={() => {
              setShowAccountsModal(false);
              navigation.navigate('AddAccount');
            }}
            icon={<Plus size={16} color="#FFFFFF" />}
          >
            Add Account
          </Button>
        </View>
      </Modal>

      {/* Clear Data Modal */}
      <Modal
        visible={showClearDataModal}
        onClose={() => setShowClearDataModal(false)}
        title="Clear All Data"
      >
        <View style={styles.modalContent}>
          <View style={styles.warningBox}>
            <AlertTriangle size={24} color={colors.error} />
            <Text style={styles.warningTitle}>Warning</Text>
            <Text style={styles.warningText}>
              This will permanently delete all accounts, encrypted keys, and
              settings from this device. This action cannot be undone.
            </Text>
          </View>

          <View style={styles.modalSpacer} />

          <Input
            label="Enter wallet password to confirm"
            placeholder="Your wallet password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            autoCapitalize="none"
          />

          <View style={styles.modalSpacer} />

          <Button
            variant="danger"
            size="lg"
            fullWidth
            onPress={handleClearData}
            disabled={!confirmPassword.trim()}
          >
            Clear Everything
          </Button>

          <View style={styles.modalSmallSpacer} />

          <Button
            variant="ghost"
            size="md"
            fullWidth
            onPress={() => setShowClearDataModal(false)}
          >
            Cancel
          </Button>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 56 : 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  headerRight: {
    width: 36,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 24,
  },
  section: {
    gap: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 4,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  settingLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  settingRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  settingValue: {
    fontSize: 13,
    color: colors.textTertiary,
    maxWidth: 150,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: 16,
  },
  autoLockInput: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  autoLockInputContainer: {
    width: 60,
  },
  minutesLabel: {
    fontSize: 13,
    color: colors.textTertiary,
  },
  saveButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(92,234,160,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cgApiKeyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
  },
  cgApiKeyInput: {
    flex: 1,
  },
  versionText: {
    fontSize: 12,
    color: colors.textTertiary,
    textAlign: 'center',
    paddingTop: 8,
  },
  // Modal content
  modalContent: {
    gap: 8,
  },
  modalDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 8,
  },
  modalSpacer: {
    height: 12,
  },
  modalSmallSpacer: {
    height: 4,
  },
  customRpcLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 4,
  },
  rpcNode: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rpcNodeActive: {
    borderColor: 'rgba(227,19,55,0.3)',
    backgroundColor: 'rgba(227,19,55,0.06)',
  },
  rpcNodeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  rpcNodeText: {
    fontSize: 13,
    color: colors.textSecondary,
    flex: 1,
  },
  rpcNodeTextActive: {
    color: colors.textPrimary,
    fontWeight: '600',
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  accountInfo: {
    flex: 1,
    gap: 2,
  },
  accountName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  activeLabel: {
    fontSize: 12,
    fontWeight: '400',
    color: colors.success,
  },
  accountKeys: {
    fontSize: 12,
    color: colors.textTertiary,
  },
  editButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.surfaceOverlay,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(227,19,55,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  warningBox: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 16,
  },
  warningTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.error,
  },
  warningText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default SettingsScreen;
