import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
  Copy,
  Link,
  Smartphone,
  Monitor,
  Check,
} from 'lucide-react-native';
import QRCode from 'react-native-qrcode-svg';
import * as Clipboard from 'expo-clipboard';
import { colors } from '../theme';
import { ScreenHeader } from '../components/layout/ScreenHeader';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Avatar } from '../components/ui/Avatar';
import { Card } from '../components/ui/Card';
import { useStore } from '../store';
import {
  buildTransferUri,
  buildHivesignerUrl,
  generateReceiveQRValue,
} from '../core/qr';

type QRMode = 'mobile' | 'signet';

export const ReceiveScreen: React.FC = () => {
  const navigation = useNavigation<any>();

  const activeAccountName = useStore((s) => s.activeAccountName);
  const username = activeAccountName || '';

  const [qrMode, setQRMode] = useState<QRMode>('mobile');
  const [requestAmount, setRequestAmount] = useState('');
  const [requestCurrency, setRequestCurrency] = useState<'HIVE' | 'HBD'>(
    'HIVE',
  );
  const [copiedUsername, setCopiedUsername] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const qrValue = useMemo(() => {
    if (!username) return '';

    if (qrMode === 'mobile') {
      // Hivesigner-style deep link
      if (requestAmount) {
        return buildHivesignerUrl({
          to: username,
          amount: requestAmount,
          currency: requestCurrency,
        });
      }
      return buildHivesignerUrl({ to: username });
    } else {
      // Signet native hive:// URI
      if (requestAmount) {
        return buildTransferUri({
          to: username,
          amount: requestAmount,
          currency: requestCurrency,
        });
      }
      return generateReceiveQRValue(username);
    }
  }, [qrMode, username, requestAmount, requestCurrency]);

  const paymentLink = useMemo(() => {
    if (!username) return '';
    if (requestAmount) {
      return buildHivesignerUrl({
        to: username,
        amount: requestAmount,
        currency: requestCurrency,
      });
    }
    return buildHivesignerUrl({ to: username });
  }, [username, requestAmount, requestCurrency]);

  const handleCopyUsername = async () => {
    await Clipboard.setStringAsync(`@${username}`);
    setCopiedUsername(true);
    setTimeout(() => setCopiedUsername(false), 2000);
    // Auto-clear clipboard after 30 seconds for security
    setTimeout(() => Clipboard.setStringAsync(''), 30_000);
  };

  const handleCopyLink = async () => {
    await Clipboard.setStringAsync(paymentLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
    // Auto-clear clipboard after 30 seconds for security
    setTimeout(() => Clipboard.setStringAsync(''), 30_000);
  };

  return (
    <View style={styles.container}>
      <ScreenHeader title="Receive" />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Avatar + Username */}
        <View style={styles.profileSection}>
          <Avatar username={username} size="lg" style={styles.avatar} />
          <Text style={styles.usernameText}>@{username}</Text>
        </View>

        {/* QR Mode Toggle */}
        <View style={styles.modeToggle}>
          <TouchableOpacity
            style={[
              styles.modeOption,
              qrMode === 'mobile' && styles.modeOptionActive,
            ]}
            onPress={() => setQRMode('mobile')}
            activeOpacity={0.7}
          >
            <Smartphone
              size={16}
              color={qrMode === 'mobile' ? colors.hive : colors.textTertiary}
            />
            <Text
              style={[
                styles.modeText,
                qrMode === 'mobile' && styles.modeTextActive,
              ]}
            >
              Hivesigner link
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.modeOption,
              qrMode === 'signet' && styles.modeOptionActive,
            ]}
            onPress={() => setQRMode('signet')}
            activeOpacity={0.7}
          >
            <Monitor
              size={16}
              color={qrMode === 'signet' ? colors.hive : colors.textTertiary}
            />
            <Text
              style={[
                styles.modeText,
                qrMode === 'signet' && styles.modeTextActive,
              ]}
            >
              hive:// link
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.modeDescription}>
          {qrMode === 'mobile'
            ? 'Opens Hivesigner in a browser; works with any wallet that supports it'
            : 'Scan with Signet or any wallet that understands hive:// payment links'}
        </Text>

        {/* QR Code */}
        <Card variant="default" padding="lg" style={styles.qrCard}>
          <View style={styles.qrContainer}>
            {qrValue ? (
              <QRCode
                value={qrValue}
                size={200}
                backgroundColor="transparent"
                color={colors.textPrimary}
              />
            ) : (
              <Text style={styles.noAccountText}>No active account</Text>
            )}
          </View>
        </Card>

        {/* Request Amount */}
        <View style={styles.requestSection}>
          <Text style={styles.sectionLabel}>Request Amount (Optional)</Text>

          <View style={styles.requestRow}>
            <Input
              placeholder="0.000"
              value={requestAmount}
              onChangeText={setRequestAmount}
              keyboardType="decimal-pad"
              containerStyle={styles.requestInput}
            />
            <View style={styles.requestCurrency}>
              <TouchableOpacity
                style={[
                  styles.currencyChip,
                  requestCurrency === 'HIVE' && styles.currencyChipActive,
                ]}
                onPress={() => setRequestCurrency('HIVE')}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.currencyChipText,
                    requestCurrency === 'HIVE' &&
                      styles.currencyChipTextActive,
                  ]}
                >
                  HIVE
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.currencyChip,
                  requestCurrency === 'HBD' && styles.currencyChipActive,
                ]}
                onPress={() => setRequestCurrency('HBD')}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.currencyChipText,
                    requestCurrency === 'HBD' &&
                      styles.currencyChipTextActive,
                  ]}
                >
                  HBD
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Copy Buttons */}
        <View style={styles.copyActions}>
          <Button
            variant="secondary"
            size="lg"
            fullWidth
            icon={
              copiedUsername ? (
                <Check size={18} color={colors.success} />
              ) : (
                <Copy size={18} color={colors.textSecondary} />
              )
            }
            onPress={handleCopyUsername}
          >
            {copiedUsername ? 'Copied!' : `Copy @${username}`}
          </Button>

          <Button
            variant="secondary"
            size="lg"
            fullWidth
            icon={
              copiedLink ? (
                <Check size={18} color={colors.success} />
              ) : (
                <Link size={18} color={colors.textSecondary} />
              )
            }
            onPress={handleCopyLink}
          >
            {copiedLink ? 'Copied!' : 'Copy Payment Link'}
          </Button>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 40,
    alignItems: 'center',
  },

  // Profile
  profileSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatar: {
    marginBottom: 10,
  },
  usernameText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },

  // Mode Toggle
  modeToggle: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceElevated,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    marginBottom: 10,
    alignSelf: 'stretch',
  },
  modeOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  modeOptionActive: {
    backgroundColor: 'rgba(227,19,55,0.12)',
  },
  modeText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textTertiary,
  },
  modeTextActive: {
    color: colors.hive,
  },
  modeDescription: {
    fontSize: 12,
    color: colors.textTertiary,
    textAlign: 'center',
    marginBottom: 20,
  },

  // QR Code
  qrCard: {
    marginBottom: 24,
    alignSelf: 'center',
  },
  qrContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  noAccountText: {
    fontSize: 14,
    color: colors.textTertiary,
    paddingVertical: 80,
  },

  // Request Section
  requestSection: {
    alignSelf: 'stretch',
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 10,
  },
  requestRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  requestInput: {
    flex: 1,
  },
  requestCurrency: {
    flexDirection: 'row',
    gap: 6,
    paddingTop: 2,
  },
  currencyChip: {
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 14,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  currencyChipActive: {
    backgroundColor: 'rgba(227,19,55,0.12)',
    borderColor: 'rgba(227,19,55,0.3)',
  },
  currencyChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textTertiary,
  },
  currencyChipTextActive: {
    color: colors.hive,
  },

  // Copy actions
  copyActions: {
    alignSelf: 'stretch',
    gap: 12,
  },
});

export default ReceiveScreen;
