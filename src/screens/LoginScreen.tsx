import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  Platform,
  Alert,
  Dimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Polygon, Defs, RadialGradient, Stop } from 'react-native-svg';
import { Fingerprint } from 'lucide-react-native';
import { colors } from '../theme';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useStore } from '../store';
import {
  isBiometricAvailable,
  isBiometricEnrolled,
  getBiometricType,
  authenticateWithBiometric,
} from '../core/biometric';

const LOCKOUT_STORAGE_KEY = 'signet_login_lockout';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const SignetLogo: React.FC = () => {
  const size = 80;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 3;

  const points = Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 3) * i - Math.PI / 2;
    return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`;
  }).join(' ');

  return (
    <View style={styles.logoContainer}>
      <View style={styles.logoGlow} />
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Defs>
          <RadialGradient id="hexGrad" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={colors.hiveLight} />
            <Stop offset="100%" stopColor={colors.hiveDark} />
          </RadialGradient>
        </Defs>
        <Polygon
          points={points}
          fill="url(#hexGrad)"
          stroke={colors.hiveLight}
          strokeWidth={1.5}
        />
      </Svg>
      <Text style={styles.logoLetter}>S</Text>
    </View>
  );
};

const MAX_ATTEMPTS = 5;
const LOCKOUT_BASE_MS = 5_000; // 5 seconds, doubles each time

export const LoginScreen: React.FC = () => {
  const unlock = useStore((s) => s.unlock);

  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState<string>('Biometrics');
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState(0);

  // Load persisted lockout state and check biometrics on mount
  useEffect(() => {
    const init = async () => {
      // Restore persisted lockout state
      try {
        const raw = await AsyncStorage.getItem(LOCKOUT_STORAGE_KEY);
        if (raw) {
          const { attempts, until } = JSON.parse(raw);
          setFailedAttempts(attempts ?? 0);
          setLockoutUntil(until ?? 0);
        }
      } catch {
        // No persisted state, start fresh
      }

      // Check biometric availability
      try {
        const available = await isBiometricAvailable();
        const enrolled = await isBiometricEnrolled();
        const ready = available && enrolled;
        setBiometricAvailable(ready);

        if (ready) {
          const type = await getBiometricType();
          setBiometricType(type);
        }
      } catch {
        setBiometricAvailable(false);
      }
    };

    init();
  }, []);

  // Auto-trigger biometric on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      if (biometricAvailable) {
        handleBiometricAuth();
      }
    }, 500);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [biometricAvailable]);

  const handleBiometricAuth = useCallback(async () => {
    try {
      setError('');
      const storedPassword = await authenticateWithBiometric();

      if (storedPassword) {
        await unlock(storedPassword);
        // Navigation auto-switches via the navigator when isLocked changes
      }
    } catch (err: any) {
      setError(err?.message || 'Biometric authentication failed');
    }
  }, [unlock]);

  const persistLockout = useCallback(async (attempts: number, until: number) => {
    try {
      await AsyncStorage.setItem(
        LOCKOUT_STORAGE_KEY,
        JSON.stringify({ attempts, until }),
      );
    } catch {
      // Best-effort persistence
    }
  }, []);

  const handlePasswordUnlock = async () => {
    if (!password.trim()) {
      setError('Please enter your password');
      return;
    }

    // Brute force protection: exponential backoff (persisted across restarts)
    const now = Date.now();
    if (now < lockoutUntil) {
      const secondsLeft = Math.ceil((lockoutUntil - now) / 1000);
      setError(`Too many failed attempts. Try again in ${secondsLeft}s`);
      return;
    }

    setLoading(true);
    setError('');

    try {
      await unlock(password);
      // Clear persisted lockout on success
      setFailedAttempts(0);
      setLockoutUntil(0);
      await AsyncStorage.removeItem(LOCKOUT_STORAGE_KEY);
      // Navigation auto-switches via the navigator when isLocked changes
    } catch (err: any) {
      const attempts = failedAttempts + 1;
      setFailedAttempts(attempts);

      if (attempts >= MAX_ATTEMPTS) {
        const backoffMs = LOCKOUT_BASE_MS * Math.pow(2, attempts - MAX_ATTEMPTS);
        const capped = Math.min(backoffMs, 300_000); // max 5 minutes
        const until = Date.now() + capped;
        setLockoutUntil(until);
        await persistLockout(attempts, until);
        setError(`Too many failed attempts. Locked for ${Math.ceil(capped / 1000)}s`);
      } else {
        await persistLockout(attempts, 0);
        setError(err?.message || 'Invalid password. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bg} />

      <View style={styles.content}>
        {/* Logo */}
        <View style={styles.heroSection}>
          <SignetLogo />
          <Text style={styles.heading}>Welcome Back</Text>
          <Text style={styles.subheading}>
            Unlock your wallet to continue
          </Text>
        </View>

        {/* Biometric Button */}
        {biometricAvailable && (
          <View style={styles.biometricSection}>
            <Button
              variant="secondary"
              size="lg"
              fullWidth
              icon={<Fingerprint size={20} color={colors.hive} />}
              onPress={handleBiometricAuth}
            >
              Unlock with {biometricType}
            </Button>

            {/* Divider */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or enter password</Text>
              <View style={styles.dividerLine} />
            </View>
          </View>
        )}

        {/* Password Input */}
        <View style={styles.passwordSection}>
          <Input
            placeholder="Enter your password"
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              if (error) setError('');
            }}
            secureTextEntry
            autoCapitalize="none"
            returnKeyType="done"
            onSubmitEditing={handlePasswordUnlock}
          />

          {/* Error Message */}
          {error ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <Button
            variant="primary"
            size="lg"
            fullWidth
            loading={loading}
            disabled={!password.trim()}
            onPress={handlePasswordUnlock}
            style={styles.unlockButton}
          >
            Unlock
          </Button>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoContainer: {
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  logoGlow: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(227,19,55,0.12)',
    ...Platform.select({
      ios: {
        shadowColor: colors.hive,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 30,
      },
      android: {
        elevation: 16,
      },
    }),
  },
  logoLetter: {
    position: 'absolute',
    fontSize: 30,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  heading: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  subheading: {
    fontSize: 15,
    color: colors.textSecondary,
  },
  biometricSection: {
    width: '100%',
    marginBottom: 8,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    fontSize: 12,
    color: colors.textTertiary,
    marginHorizontal: 14,
  },
  passwordSection: {
    width: '100%',
  },
  errorContainer: {
    backgroundColor: 'rgba(239,71,111,0.08)',
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
  },
  errorText: {
    fontSize: 13,
    color: colors.error,
    textAlign: 'center',
  },
  unlockButton: {
    marginTop: 20,
  },
});

export default LoginScreen;
