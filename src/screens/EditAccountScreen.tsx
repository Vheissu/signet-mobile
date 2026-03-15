import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import {
  ChevronLeft,
  Key,
  Plus,
  Trash2,
  CheckCircle,
  XCircle,
  Shield,
  Zap,
  Edit3,
  Lock,
  AlertTriangle,
  Info,
} from 'lucide-react-native';
import { colors } from '../theme';
import { useStore } from '../store';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { Avatar } from '../components/ui/Avatar';
import { Modal } from '../components/ui/Modal';
import { getAccount } from '../core/hive/client';
import { validatePrivateKey, identifyKeyRole } from '../core/crypto/hive-keys';
import type { KeyRole } from '../core/types';

interface KeyStatus {
  role: KeyRole;
  imported: boolean;
}

const KEY_ROLES: { role: KeyRole; icon: React.ReactNode; label: string; color: string; description: string }[] = [
  {
    role: 'posting',
    icon: <Edit3 size={18} color={colors.success} />,
    label: 'Posting',
    color: colors.success,
    description: 'Social actions: voting, commenting, following, reblogging. This is the most commonly used key.',
  },
  {
    role: 'active',
    icon: <Zap size={18} color={colors.warning} />,
    label: 'Active',
    color: colors.warning,
    description: 'Financial actions: transfers, power up/down, conversions, savings, and market operations.',
  },
  {
    role: 'memo',
    icon: <Lock size={18} color={colors.info} />,
    label: 'Memo',
    color: colors.info,
    description: 'Encrypt and decrypt private transfer memos. Only needed for private messaging via memos.',
  },
  {
    role: 'owner',
    icon: <Shield size={18} color={colors.error} />,
    label: 'Owner',
    color: colors.error,
    description: 'Master key that can change all other keys. Store securely and only import when needed.',
  },
];

const EditAccountScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<any>();
  const username = route.params?.username ?? '';

  const accounts = useStore((s) => s.accounts);
  const updateAccountKeys = useStore((s) => s.updateAccountKeys);
  const removeAccount = useStore((s) => s.removeAccount);
  const addToast = useStore((s) => s.addToast);

  // Derive key statuses from the store's actual account data
  const [keyStatuses, setKeyStatuses] = useState<KeyStatus[]>([]);

  useEffect(() => {
    const account = accounts.find((a) => a.username === username);
    if (account) {
      const roles: KeyRole[] = ['posting', 'active', 'memo', 'owner'];
      setKeyStatuses(
        roles.map((role) => ({
          role,
          imported: !!account.keys[role],
        })),
      );
    } else {
      setKeyStatuses([
        { role: 'posting', imported: false },
        { role: 'active', imported: false },
        { role: 'memo', imported: false },
        { role: 'owner', imported: false },
      ]);
    }
  }, [accounts, username]);

  const [showAddKeyModal, setShowAddKeyModal] = useState(false);
  const [selectedRole, setSelectedRole] = useState<KeyRole>('posting');
  const [newKey, setNewKey] = useState('');
  const [addingKey, setAddingKey] = useState(false);

  const handleAddKey = useCallback(
    (role: KeyRole) => {
      setSelectedRole(role);
      setNewKey('');
      setShowAddKeyModal(true);
    },
    [],
  );

  const handleSubmitKey = useCallback(async () => {
    if (!newKey.trim()) {
      Alert.alert('Error', 'Please enter a private key.');
      return;
    }

    const wif = newKey.trim();

    // Validate the key format
    if (!validatePrivateKey(wif)) {
      Alert.alert('Error', 'Invalid private key. Please enter a valid WIF key starting with 5.');
      return;
    }

    setAddingKey(true);
    try {
      // Fetch the on-chain account to verify key role
      const accountData = await getAccount(username);
      if (!accountData) {
        Alert.alert('Error', `Account @${username} not found on the blockchain.`);
        return;
      }

      // Identify which role this key matches
      const detectedRole = identifyKeyRole(wif, accountData);
      if (!detectedRole) {
        Alert.alert(
          'Key Mismatch',
          `This private key does not match any role for @${username}. Make sure you are entering the correct key.`,
        );
        return;
      }

      if (detectedRole !== selectedRole) {
        Alert.alert(
          'Role Mismatch',
          `This key is the ${detectedRole} key, not the ${selectedRole} key. It will be imported as the ${detectedRole} key.`,
        );
      }

      // Save the key via the store (it will encrypt and persist)
      await updateAccountKeys(username, { [detectedRole]: wif });

      setShowAddKeyModal(false);
      setNewKey('');
      addToast({ type: 'success', message: `${detectedRole} key imported successfully.` });
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to import key.');
    } finally {
      setAddingKey(false);
    }
  }, [newKey, selectedRole, username, updateAccountKeys, addToast]);

  const handleRemoveKey = useCallback(
    (role: KeyRole) => {
      Alert.alert(
        'Remove Key',
        `Are you sure you want to remove the ${role} key for @${username}? You will need to re-import it to use ${role} actions.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: async () => {
              try {
                // Rebuild keys without the removed role
                const account = accounts.find((a) => a.username === username);
                if (!account) return;

                const updatedKeys: Record<string, string | undefined> = { ...account.keys };
                delete updatedKeys[role];

                // We need to persist the account with the key removed.
                // updateAccountKeys merges, so we use removeAccount + addAccount pattern.
                // Actually, since updateAccountKeys merges, we'll set the role to empty string
                // and the store treats falsy as not having the key.
                // The cleanest approach: directly update the store accounts.
                await updateAccountKeys(username, { [role]: undefined as any });

                addToast({ type: 'info', message: `${role} key removed.` });
              } catch (e: any) {
                addToast({ type: 'error', message: e.message || 'Failed to remove key.' });
              }
            },
          },
        ],
      );
    },
    [username, accounts, updateAccountKeys, addToast],
  );

  const handleRemoveAccount = useCallback(() => {
    Alert.alert(
      'Remove Account',
      `Are you sure you want to remove @${username}? All keys for this account will be permanently deleted.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove Account',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeAccount(username);
              addToast({ type: 'info', message: `@${username} removed.` });
              navigation.goBack();
            } catch (e: any) {
              addToast({ type: 'error', message: e.message || 'Failed to remove account.' });
            }
          },
        },
      ],
    );
  }, [username, removeAccount, addToast, navigation]);

  const getRoleConfig = (role: KeyRole) =>
    KEY_ROLES.find((kr) => kr.role === role)!;

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
        <Text style={styles.headerTitle}>Edit Account</Text>
        <View style={styles.headerRight} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Account Header */}
          <View style={styles.accountHeader}>
            <Avatar username={username} size="lg" />
            <View style={styles.accountInfo}>
              <Text style={styles.accountName}>@{username}</Text>
              <Text style={styles.accountKeyCount}>
                {keyStatuses.filter((ks) => ks.imported).length} of 4 keys
                imported
              </Text>
            </View>
          </View>

          {/* Key Status List */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>KEY STATUS</Text>
            <View style={styles.keyList}>
              {keyStatuses.map((ks) => {
                const config = getRoleConfig(ks.role);
                return (
                  <Card
                    key={ks.role}
                    variant="default"
                    padding="md"
                    style={styles.keyCard}
                  >
                    <View style={styles.keyRow}>
                      <View
                        style={[
                          styles.keyIcon,
                          {
                            backgroundColor: ks.imported
                              ? `${config.color}15`
                              : colors.surfaceOverlay,
                          },
                        ]}
                      >
                        {config.icon}
                      </View>
                      <View style={styles.keyInfo}>
                        <View style={styles.keyNameRow}>
                          <Text style={styles.keyLabel}>{config.label}</Text>
                          {ks.imported ? (
                            <Badge variant="success">Imported</Badge>
                          ) : (
                            <Badge variant="default">Not Set</Badge>
                          )}
                        </View>
                        <Text style={styles.keyDesc} numberOfLines={1}>
                          {config.description}
                        </Text>
                      </View>
                      {ks.imported ? (
                        <TouchableOpacity
                          onPress={() => handleRemoveKey(ks.role)}
                          style={styles.removeKeyButton}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Trash2 size={16} color={colors.error} />
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity
                          onPress={() => handleAddKey(ks.role)}
                          style={styles.addKeyButton}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Plus size={16} color={colors.hive} />
                        </TouchableOpacity>
                      )}
                    </View>
                  </Card>
                );
              })}
            </View>
          </View>

          {/* Key Role Explanations */}
          <Card variant="default" padding="md" style={styles.explanationCard}>
            <View style={styles.explanationHeader}>
              <Info size={16} color={colors.info} />
              <Text style={styles.explanationTitle}>Key Role Explanations</Text>
            </View>
            {KEY_ROLES.map((kr) => (
              <View key={kr.role} style={styles.explanationRow}>
                {kr.icon}
                <View style={styles.explanationInfo}>
                  <Text style={styles.explanationRole}>{kr.label}</Text>
                  <Text style={styles.explanationDesc}>{kr.description}</Text>
                </View>
              </View>
            ))}
          </Card>

          {/* Danger Zone */}
          <View style={styles.section}>
            <View style={styles.dangerHeader}>
              <AlertTriangle size={16} color={colors.error} />
              <Text style={styles.dangerTitle}>Danger Zone</Text>
            </View>
            <Button
              variant="danger"
              size="lg"
              fullWidth
              onPress={handleRemoveAccount}
              icon={<Trash2 size={16} color={colors.error} />}
            >
              Remove Account
            </Button>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Add Key Modal */}
      <Modal
        visible={showAddKeyModal}
        onClose={() => {
          setShowAddKeyModal(false);
          setNewKey('');
        }}
        title={`Import ${selectedRole.charAt(0).toUpperCase() + selectedRole.slice(1)} Key`}
      >
        <View style={styles.modalContent}>
          <View style={styles.modalAccountRow}>
            <Avatar username={username} size="sm" />
            <Text style={styles.modalAccountName}>@{username}</Text>
          </View>

          <View style={styles.modalSpacer} />

          <Input
            label={`${selectedRole.charAt(0).toUpperCase() + selectedRole.slice(1)} Private Key`}
            placeholder="5K..."
            value={newKey}
            onChangeText={setNewKey}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            leftIcon={<Key size={18} color={colors.textTertiary} />}
          />

          <Text style={styles.modalHint}>
            Enter the private {selectedRole} key (WIF format starting with 5).
          </Text>

          <View style={styles.modalSpacer} />

          <Button
            variant="primary"
            size="lg"
            fullWidth
            loading={addingKey}
            onPress={handleSubmitKey}
            disabled={!newKey.trim()}
            icon={<Key size={16} color="#FFFFFF" />}
          >
            Import Key
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
    gap: 20,
  },
  // Account Header
  accountHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 8,
  },
  accountInfo: {
    flex: 1,
    gap: 4,
  },
  accountName: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  accountKeyCount: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  // Sections
  section: {
    gap: 10,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    paddingLeft: 4,
  },
  // Key List
  keyList: {
    gap: 8,
  },
  keyCard: {},
  keyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  keyIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyInfo: {
    flex: 1,
    gap: 4,
  },
  keyNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  keyLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  keyDesc: {
    fontSize: 12,
    color: colors.textTertiary,
  },
  removeKeyButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(239,71,111,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addKeyButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(227,19,55,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Explanation Card
  explanationCard: {
    gap: 12,
  },
  explanationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  explanationTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  explanationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  explanationInfo: {
    flex: 1,
    gap: 2,
  },
  explanationRole: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  explanationDesc: {
    fontSize: 12,
    color: colors.textTertiary,
    lineHeight: 16,
  },
  // Danger Zone
  dangerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 4,
  },
  dangerTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.error,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  // Modal
  modalContent: {
    gap: 4,
  },
  modalAccountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: colors.surfaceOverlay,
    borderRadius: 10,
  },
  modalAccountName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  modalSpacer: {
    height: 12,
  },
  modalHint: {
    fontSize: 12,
    color: colors.textTertiary,
    marginTop: 6,
  },
});

export default EditAccountScreen;
