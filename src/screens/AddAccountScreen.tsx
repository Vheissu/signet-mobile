import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
  AtSign,
  Key,
  CheckCircle,
  AlertCircle,
  Upload,
  ArrowRight,
  Shield,
  Zap,
  Edit3,
  Lock,
  AlertTriangle,
} from 'lucide-react-native';
import { colors } from '../theme';
import { ScreenHeader } from '../components/layout/ScreenHeader';
import { useStore } from '../store';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { Spinner } from '../components/ui/Spinner';
import { getAccount } from '../core/hive/client';
import { validatePrivateKey, identifyKeyRole, deriveKeysFromPassword } from '../core/crypto/hive-keys';
import type { KeyRole, StoredAccount } from '../core/types';
import { logger } from '../core/logger';

type Step = 'username' | 'keys';

const KEY_ROLE_INFO: Record<KeyRole, { icon: React.ReactNode; description: string; color: string }> = {
  posting: {
    icon: <Edit3 size={16} color={colors.success} />,
    description: 'Vote, comment, follow',
    color: colors.success,
  },
  active: {
    icon: <Zap size={16} color={colors.warning} />,
    description: 'Transfer, power up/down, delegate',
    color: colors.warning,
  },
  memo: {
    icon: <Lock size={16} color={colors.info} />,
    description: 'Encrypt/decrypt memos',
    color: colors.info,
  },
  owner: {
    icon: <Shield size={16} color={colors.error} />,
    description: 'Master key - change other keys',
    color: colors.error,
  },
};

const AddAccountScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const addAccount = useStore((s) => s.addAccount);
  const addToast = useStore((s) => s.addToast);
  const accounts = useStore((s) => s.accounts);

  const [step, setStep] = useState<Step>('username');
  const [username, setUsername] = useState('');
  const [accountData, setAccountData] = useState<any>(null);
  const [error, setError] = useState('');
  const [isValidating, setIsValidating] = useState(false);

  // Key inputs
  const [keys, setKeys] = useState({ posting: '', active: '', memo: '' });
  const [detectedRoles, setDetectedRoles] = useState<Record<string, KeyRole | null>>({});
  const [isAdding, setIsAdding] = useState(false);

  const canGoBack = accounts.length > 0;

  const handleUsernameChange = useCallback((text: string) => {
    const cleaned = text.replace('@', '').toLowerCase().trim();
    setUsername(cleaned);
    setError('');
  }, []);

  const handleUsernameSubmit = useCallback(async () => {
    if (!username.trim()) {
      setError('Please enter a username');
      return;
    }

    setIsValidating(true);
    setError('');

    try {
      const cleanUsername = username.trim().toLowerCase();
      const account = await getAccount(cleanUsername);

      if (!account) {
        setError('Account not found on the Hive blockchain');
        setIsValidating(false);
        return;
      }

      setAccountData(account);
      setUsername(cleanUsername);
      setStep('keys');
    } catch (err: any) {
      setError(err.message || 'Failed to lookup account');
    }

    setIsValidating(false);
  }, [username]);

  const handleKeyChange = useCallback((field: string, value: string) => {
    setKeys((prev) => ({ ...prev, [field]: value }));

    if (value && accountData) {
      try {
        if (validatePrivateKey(value)) {
          const role = identifyKeyRole(value, accountData);
          setDetectedRoles((prev) => ({ ...prev, [field]: role }));
        } else {
          setDetectedRoles((prev) => ({ ...prev, [field]: null }));
        }
      } catch {
        setDetectedRoles((prev) => ({ ...prev, [field]: null }));
      }
    } else {
      setDetectedRoles((prev) => ({ ...prev, [field]: null }));
    }
  }, [accountData]);

  const handleAddAccount = useCallback(async () => {
    setError('');
    setIsAdding(true);

    try {
      const accountKeys: StoredAccount['keys'] = {};
      let hasValidKey = false;

      // First pass: try each input as a direct WIF private key
      for (const [field, wif] of Object.entries(keys)) {
        if (!wif || !wif.trim()) continue;
        const trimmed = wif.trim();

        try {
          if (validatePrivateKey(trimmed)) {
            const role = identifyKeyRole(trimmed, accountData);
            if (role) {
              accountKeys[role] = trimmed;
              hasValidKey = true;
            }
          }
        } catch {
          // Key is not a valid WIF - will try master password derivation below
        }
      }

      // Second pass: try each input as a master password (derives all 4 key roles)
      if (!hasValidKey) {
        for (const [field, pw] of Object.entries(keys)) {
          if (!pw || !pw.trim()) continue;
          const trimmed = pw.trim();

          try {
            const derived = deriveKeysFromPassword(username, trimmed);
            for (const kp of derived) {
              try {
                const role = identifyKeyRole(kp.private, accountData);
                if (role && !accountKeys[role]) {
                  accountKeys[role] = kp.private;
                  hasValidKey = true;
                }
              } catch (e) {
                // Derived key didn't match this role, continue
              }
            }
          } catch {
            // Master password derivation failed for this input
          }
        }
      }

      if (!hasValidKey) {
        setError('No valid keys found. Enter a private key (starts with 5) or your master password.');
        setIsAdding(false);
        return;
      }

      await addAccount({ username, keys: accountKeys });
      addToast({ type: 'success', message: `@${username} added successfully` });
      navigation.goBack();
    } catch (err: any) {
      logger.error('[AddAccount] Error adding account:', err);
      setError(err.message || 'Failed to add account');
    }

    setIsAdding(false);
  }, [keys, username, accountData, addAccount, addToast]);

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Add Account"
        hideBack={!canGoBack && step !== 'keys'}
        onBack={() => {
          if (step === 'keys') setStep('username');
          else navigation.goBack();
        }}
      />

      {/* Progress */}
      <View style={styles.progressRow}>
        <View style={[styles.progressDot, styles.progressDotActive]} />
        <View style={[styles.progressLine, step === 'keys' && styles.progressLineActive]} />
        <View style={[styles.progressDot, step === 'keys' && styles.progressDotActive]} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {step === 'username' ? (
            <>
              {/* Step 1: Username Entry */}
              <View style={styles.stepHeader}>
                <View style={styles.iconBox}>
                  <AtSign size={24} color={colors.hive} />
                </View>
                <Text style={styles.stepTitle}>Enter Your Hive Username</Text>
                <Text style={styles.stepDescription}>
                  We'll verify it exists on the blockchain
                </Text>
              </View>

              <Input
                label="Hive Username"
                placeholder="username"
                value={username}
                onChangeText={handleUsernameChange}
                autoCapitalize="none"
                autoCorrect={false}
                error={error || undefined}
                leftIcon={<AtSign size={16} color={colors.textTertiary} />}
                rightElement={
                  isValidating ? (
                    <Spinner size="sm" />
                  ) : undefined
                }
              />

              <View style={{ height: 16 }} />

              <Button
                variant="primary"
                size="lg"
                fullWidth
                onPress={handleUsernameSubmit}
                loading={isValidating}
                disabled={!username.trim()}
                icon={<ArrowRight size={18} color="#FFFFFF" />}
              >
                Continue
              </Button>

              {/* Divider */}
              <View style={styles.orDivider}>
                <View style={styles.orLine} />
                <Text style={styles.orText}>or</Text>
                <View style={styles.orLine} />
              </View>

              <Button
                variant="secondary"
                size="lg"
                fullWidth
                onPress={() => navigation.navigate('ImportKeys')}
                icon={<Upload size={16} color={colors.textPrimary} />}
              >
                Import from Password Manager
              </Button>
            </>
          ) : (
            <>
              {/* Step 2: Key Import */}
              <View style={styles.stepHeader}>
                <View style={styles.iconBox}>
                  <Key size={24} color={colors.hive} />
                </View>
                <Text style={styles.stepTitle}>Import Your Keys</Text>
                <Text style={styles.stepDescription}>
                  Enter private keys or your master password for @{username}
                </Text>
              </View>

              {/* Username confirmed badge */}
              <Card variant="gradient" padding="sm">
                <View style={styles.verifiedRow}>
                  <CheckCircle size={16} color={colors.success} />
                  <Text style={styles.verifiedText}>@{username}</Text>
                  <Badge variant="success">Verified</Badge>
                </View>
              </Card>

              {/* Key inputs */}
              {(['posting', 'active', 'memo'] as const).map((role) => (
                <View key={role} style={{ marginTop: 12 }}>
                  <Input
                    label={`${role.charAt(0).toUpperCase() + role.slice(1)} Key`}
                    secureTextEntry
                    value={keys[role]}
                    onChangeText={(text: string) => handleKeyChange(role, text)}
                    placeholder={`Enter ${role} private key (optional)`}
                    leftIcon={<Key size={14} color={colors.textTertiary} />}
                    rightElement={
                      detectedRoles[role] ? (
                        <Badge variant="success">{detectedRoles[role]}</Badge>
                      ) : keys[role] && keys[role].length > 10 ? (
                        <Badge variant="error">Invalid</Badge>
                      ) : undefined
                    }
                  />
                </View>
              ))}

              {/* Info card */}
              <Card variant="outline" padding="sm" style={{ marginTop: 16 }}>
                <View style={styles.infoRow}>
                  <AlertTriangle size={14} color={colors.warning} />
                  <Text style={styles.infoText}>
                    Keys are encrypted with AES-256 and never leave your device. You can also enter your <Text style={{ fontWeight: '700', color: colors.textPrimary }}>master password</Text> in any field to auto-derive all keys.
                  </Text>
                </View>
              </Card>

              {error ? (
                <Text style={styles.errorText}>{error}</Text>
              ) : null}

              <View style={styles.buttonRow}>
                <Button
                  variant="secondary"
                  size="lg"
                  onPress={() => setStep('username')}
                  style={{ flex: 1 }}
                >
                  Back
                </Button>
                <Button
                  variant="primary"
                  size="lg"
                  onPress={handleAddAccount}
                  loading={isAdding}
                  disabled={!Object.values(keys).some((k) => k)}
                  style={{ flex: 1 }}
                >
                  Add Account
                </Button>
              </View>

              {accounts.length > 0 && (
                <TouchableOpacity
                  onPress={() => navigation.goBack()}
                  style={{ alignSelf: 'center', padding: 12 }}
                >
                  <Text style={{ fontSize: 13, color: colors.textTertiary }}>
                    Skip for now
                  </Text>
                </TouchableOpacity>
              )}
            </>
          )}

          {/* Key roles info */}
          <Card variant="default" padding="md" style={{ marginTop: 20 }}>
            <Text style={styles.rolesTitle}>Key Roles</Text>
            {(Object.keys(KEY_ROLE_INFO) as KeyRole[]).map((role) => (
              <View key={role} style={styles.roleRow}>
                {KEY_ROLE_INFO[role].icon}
                <View style={{ flex: 1, gap: 1 }}>
                  <Text style={styles.roleName}>
                    {role.charAt(0).toUpperCase() + role.slice(1)}
                  </Text>
                  <Text style={styles.roleDesc}>
                    {KEY_ROLE_INFO[role].description}
                  </Text>
                </View>
              </View>
            ))}
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 60,
  },
  progressDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.surfaceOverlay,
  },
  progressDotActive: {
    backgroundColor: colors.hive,
  },
  progressLine: {
    flex: 1,
    height: 2,
    backgroundColor: colors.surfaceOverlay,
  },
  progressLineActive: {
    backgroundColor: colors.hive,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  stepHeader: {
    alignItems: 'center',
    marginBottom: 24,
    gap: 8,
  },
  iconBox: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: 'rgba(227,19,55,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  stepTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  stepDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  orDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 16,
  },
  orLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  orText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textTertiary,
  },
  verifiedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 4,
  },
  verifiedText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  infoRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    paddingHorizontal: 4,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  errorText: {
    fontSize: 13,
    color: colors.error,
    textAlign: 'center',
    marginTop: 12,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  rolesTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  roleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
  },
  roleName: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  roleDesc: {
    fontSize: 12,
    color: colors.textTertiary,
  },
});

export default AddAccountScreen;
