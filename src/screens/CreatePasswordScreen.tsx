import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ArrowLeft, ShieldCheck, Info } from 'lucide-react-native';
import { colors } from '../theme';
import { useStore } from '../store';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';

type StrengthLevel = 0 | 1 | 2 | 3 | 4 | 5;

interface StrengthInfo {
  level: StrengthLevel;
  label: string;
  color: string;
}

const getPasswordStrength = (password: string): StrengthInfo => {
  if (!password) return { level: 0, label: '', color: colors.textTertiary };

  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;

  const levels: Record<number, StrengthInfo> = {
    0: { level: 0, label: '', color: colors.textTertiary },
    1: { level: 1, label: 'Very Weak', color: colors.error },
    2: { level: 2, label: 'Weak', color: '#FF6B6B' },
    3: { level: 3, label: 'Fair', color: colors.warning },
    4: { level: 4, label: 'Strong', color: '#7BED9F' },
    5: { level: 5, label: 'Very Strong', color: colors.success },
  };

  return levels[score] || levels[0];
};

const StrengthBar: React.FC<{ strength: StrengthInfo }> = ({ strength }) => (
  <View style={styles.strengthContainer}>
    <View style={styles.strengthBars}>
      {[1, 2, 3, 4, 5].map((i) => (
        <View
          key={i}
          style={[
            styles.strengthBar,
            {
              backgroundColor:
                i <= strength.level
                  ? strength.color
                  : 'rgba(255,255,255,0.06)',
            },
          ]}
        />
      ))}
    </View>
    {strength.label ? (
      <Text style={[styles.strengthLabel, { color: strength.color }]}>
        {strength.label}
      </Text>
    ) : null}
  </View>
);

export const CreatePasswordScreen: React.FC = () => {
  const navigation = useNavigation<any>();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const strength = useMemo(() => getPasswordStrength(password), [password]);

  const passwordError = useMemo(() => {
    if (!password) return '';
    if (password.length < 12) return 'Password must be at least 12 characters';
    if (/^(.)\1+$/.test(password)) return 'Password cannot be all the same character';
    return '';
  }, [password]);

  const confirmError = useMemo(() => {
    if (!confirmPassword) return '';
    if (confirmPassword !== password) return 'Passwords do not match';
    return '';
  }, [password, confirmPassword]);

  const isValid =
    password.length >= 12 &&
    confirmPassword === password &&
    !passwordError &&
    !confirmError;

  const createWallet = useStore((s) => s.createWallet);

  const handleCreate = async () => {
    if (!isValid) return;

    setLoading(true);
    setError('');

    try {
      await createWallet(password);
    } catch (err: any) {
      setError(err?.message || 'Failed to create wallet');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bg} />

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <ArrowLeft size={22} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Create Password</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Icon */}
          <View style={styles.iconSection}>
            <View style={styles.iconContainer}>
              <ShieldCheck size={36} color={colors.hive} />
            </View>
            <Text style={styles.title}>Secure Your Wallet</Text>
            <Text style={styles.subtitle}>
              This password encrypts your keys locally. Choose something strong
              and memorable -- there is no recovery option.
            </Text>
          </View>

          {/* Password Input */}
          <View style={styles.form}>
            <Input
              label="Password"
              placeholder="Enter a strong password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              error={passwordError || undefined}
            />

            {/* Strength Meter */}
            {password.length > 0 && <StrengthBar strength={strength} />}

            {/* Confirm Password */}
            <Input
              label="Confirm Password"
              placeholder="Re-enter your password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              autoCapitalize="none"
              error={confirmError || undefined}
              containerStyle={styles.confirmInput}
            />

            {/* Info Box */}
            <View style={styles.infoBox}>
              <Info size={16} color={colors.info} style={styles.infoIcon} />
              <Text style={styles.infoText}>
                Your password is used to derive an AES-256 encryption key via
                PBKDF2. All private keys are encrypted and stored only on this
                device. We never transmit or store your password.
              </Text>
            </View>

            {/* Error */}
            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            {/* Create Button */}
            <Button
              variant="primary"
              size="lg"
              fullWidth
              loading={loading}
              disabled={!isValid}
              onPress={handleCreate}
              style={styles.createButton}
            >
              Create Wallet
            </Button>
          </View>
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
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    paddingTop: Platform.OS === 'ios' ? 56 : 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  headerSpacer: {
    width: 36,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 40,
  },
  iconSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: 'rgba(227,19,55,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(227,19,55,0.2)',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 300,
  },
  form: {
    gap: 4,
  },
  strengthContainer: {
    marginTop: 8,
    marginBottom: 12,
  },
  strengthBars: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 6,
  },
  strengthBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  strengthLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  confirmInput: {
    marginTop: 12,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: 'rgba(99,179,237,0.08)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(99,179,237,0.15)',
    padding: 14,
    marginTop: 20,
    gap: 10,
  },
  infoIcon: {
    marginTop: 1,
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
  createButton: {
    marginTop: 28,
  },
});

export default CreatePasswordScreen;
