import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  KeyboardAvoidingView,
  Dimensions,
} from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { RootStackParamList } from '../navigation';
import {
  AtSign,
  Users,
  QrCode,
  ChevronDown,
  AlertTriangle,
  FileText,
  X,
} from 'lucide-react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { colors } from '../theme';
import { ScreenHeader } from '../components/layout/ScreenHeader';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';
import { Avatar } from '../components/ui/Avatar';
import { Modal } from '../components/ui/Modal';
import { useStore } from '../store';
import { useAccounts } from '../hooks/useAccounts';
import { useHive } from '../hooks/useHive';
import { broadcastTransfer, getAccount } from '../core/hive/client';
import { getContacts, recordTransaction } from '../core/contacts';
import { parseTransferUri } from '../core/qr';
import { useFormDraft } from '../hooks/useFormDraft';
import { isValidHiveUsername, validateAmount, validateMemo, sanitizeUsername, MAX_MEMO_LENGTH } from '../core/validation';
import type { Contact } from '../core/contacts';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type Currency = 'HIVE' | 'HBD';

interface RecentContact {
  username: string;
}

// ---------- Sub-components ----------

const RecentContactsList: React.FC<{
  contacts: RecentContact[];
  onSelect: (username: string) => void;
}> = ({ contacts, onSelect }) => {
  if (contacts.length === 0) return null;

  return (
    <View style={styles.recentSection}>
      <Text style={styles.recentLabel}>Recent</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.recentScroll}
      >
        {contacts.map((contact) => (
          <TouchableOpacity
            key={contact.username}
            style={styles.recentItem}
            onPress={() => onSelect(contact.username)}
            activeOpacity={0.7}
          >
            <Avatar username={contact.username} size="sm" />
            <Text style={styles.recentUsername} numberOfLines={1}>
              @{contact.username}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

const CurrencyPicker: React.FC<{
  selected: Currency;
  onSelect: (c: Currency) => void;
}> = ({ selected, onSelect }) => (
  <View style={styles.currencyPicker}>
    {(['HIVE', 'HBD'] as Currency[]).map((currency) => (
      <TouchableOpacity
        key={currency}
        style={[
          styles.currencyOption,
          selected === currency && styles.currencyOptionActive,
        ]}
        onPress={() => onSelect(currency)}
        activeOpacity={0.7}
      >
        <Text
          style={[
            styles.currencyText,
            selected === currency && styles.currencyTextActive,
          ]}
        >
          {currency}
        </Text>
      </TouchableOpacity>
    ))}
  </View>
);

const ConfirmCard: React.FC<{
  recipient: string;
  amount: string;
  currency: Currency;
  memo: string;
  onCancel: () => void;
  onConfirm: () => void;
  loading: boolean;
}> = ({ recipient, amount, currency, memo, onCancel, onConfirm, loading }) => (
  <Card variant="gradient" padding="lg" style={styles.confirmCard}>
    <Text style={styles.confirmTitle}>Confirm Transfer</Text>

    <View style={styles.confirmRow}>
      <Text style={styles.confirmLabel}>To</Text>
      <View style={styles.confirmValueRow}>
        <Avatar username={recipient} size="sm" />
        <Text style={styles.confirmValue}>@{recipient}</Text>
      </View>
    </View>

    <View style={styles.confirmDivider} />

    <View style={styles.confirmRow}>
      <Text style={styles.confirmLabel}>Amount</Text>
      <Text style={styles.confirmValueHighlight}>
        {amount} {currency}
      </Text>
    </View>

    <View style={styles.confirmDivider} />

    <View style={styles.confirmRow}>
      <Text style={styles.confirmLabel}>Memo</Text>
      <Text style={styles.confirmValue} numberOfLines={2}>
        {memo || 'None'}
      </Text>
    </View>

    {/* Warning */}
    <View style={styles.confirmWarning}>
      <AlertTriangle size={16} color={colors.warning} />
      <Text style={styles.confirmWarningText}>
        This action is irreversible. Please verify all details before
        confirming.
      </Text>
    </View>

    {/* Buttons */}
    <View style={styles.confirmButtons}>
      <Button variant="ghost" size="lg" onPress={onCancel} style={styles.confirmBtn}>
        Cancel
      </Button>
      <Button
        variant="primary"
        size="lg"
        loading={loading}
        onPress={onConfirm}
        style={styles.confirmBtn}
      >
        Confirm
      </Button>
    </View>
  </Card>
);

// ---------- QR Scanner ----------

const QRScannerModal: React.FC<{
  visible: boolean;
  onClose: () => void;
  onScan: (data: string) => void;
}> = ({ visible, onClose, onScan }) => {
  const [permission, requestPermission] = useCameraPermissions();

  const handleBarCodeScanned = ({ data }: { data: string }) => {
    onScan(data);
    onClose();
  };

  return (
    <Modal visible={visible} onClose={onClose} title="Scan QR Code">
      <View style={styles.scannerContainer}>
        {permission?.granted ? (
          <CameraView
            style={styles.camera}
            barcodeScannerSettings={{
              barcodeTypes: ['qr'],
            }}
            onBarcodeScanned={handleBarCodeScanned}
          />
        ) : (
          <View style={styles.permissionBox}>
            <QrCode size={40} color={colors.textTertiary} />
            <Text style={styles.permissionText}>
              Camera permission is required to scan QR codes
            </Text>
            <Button
              variant="primary"
              size="md"
              onPress={requestPermission}
            >
              Grant Permission
            </Button>
          </View>
        )}
      </View>
    </Modal>
  );
};

// ---------- Main Screen ----------

export const SendScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RootStackParamList, 'Send'>>();
  const addToast = useStore((s) => s.addToast);
  const { activeAccountName, getDecryptedKey, hasKey } = useAccounts();
  const { balances, formatNumber } = useHive();

  // Form draft persistence
  const { values: draft, setValues: setDraft, clearDraft } = useFormDraft('send', {
    recipient: '',
    amount: '',
    currency: 'HIVE' as Currency,
    memo: '',
  });

  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<Currency>('HIVE');
  const [memo, setMemo] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [sending, setSending] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [recipientError, setRecipientError] = useState('');
  const [recentContacts, setRecentContacts] = useState<RecentContact[]>([]);
  const [draftApplied, setDraftApplied] = useState(false);

  // Apply draft values on mount (only once)
  useEffect(() => {
    if (draftApplied) return;
    if (draft.recipient || draft.amount || draft.memo) {
      setRecipient(draft.recipient);
      setAmount(draft.amount);
      setCurrency(draft.currency);
      setMemo(draft.memo);
    }
    setDraftApplied(true);
  }, [draft, draftApplied]);

  // Save form state to draft on changes
  useEffect(() => {
    if (!draftApplied) return;
    setDraft({ recipient, amount, currency, memo });
  }, [recipient, amount, currency, memo, draftApplied, setDraft]);

  // Read route params (from Contacts screen or deep links)
  useEffect(() => {
    const to = route.params?.to;
    const token = route.params?.token;
    if (to) {
      setRecipient(to.replace(/^@/, '').toLowerCase());
      setRecipientError('');
    }
    if (token === 'HIVE' || token === 'HBD') {
      setCurrency(token);
    }
  }, [route.params?.to, route.params?.token]);

  // Load recent contacts on mount
  useEffect(() => {
    getContacts().then((contacts) => {
      setRecentContacts(
        contacts.slice(0, 8).map((c) => ({ username: c.username })),
      );
    });
  }, []);

  const availableBalance = useMemo(() => {
    return currency === 'HIVE' ? balances.hive : balances.hbd;
  }, [currency, balances]);

  const isValid = useMemo(() => {
    if (!recipient.trim()) return false;
    const num = parseFloat(amount);
    if (isNaN(num) || num <= 0) return false;
    if (recipientError) return false;
    return true;
  }, [recipient, amount, recipientError]);

  const handleSelectContact = (username: string) => {
    setRecipient(username);
    setRecipientError('');
  };

  const handleRecipientBlur = async () => {
    const name = sanitizeUsername(recipient);
    if (!name) {
      setRecipientError('');
      return;
    }
    if (!isValidHiveUsername(name)) {
      setRecipientError('Invalid username format (3-16 chars, lowercase, alphanumeric)');
      return;
    }
    try {
      const account = await getAccount(name);
      if (!account) {
        setRecipientError('Account not found on the Hive blockchain');
      } else {
        setRecipientError('');
        setRecipient(name);
      }
    } catch {
      setRecipientError('Unable to verify account');
    }
  };

  const handleQRScan = (data: string) => {
    const parsed = parseTransferUri(data);
    if (parsed) {
      // Validate parsed QR values before applying
      const cleanTo = sanitizeUsername(parsed.to);
      if (!cleanTo || !isValidHiveUsername(cleanTo)) {
        addToast({ type: 'error', message: 'Invalid recipient in QR code' });
        return;
      }
      setRecipient(cleanTo);
      setRecipientError('');

      if (parsed.amount) {
        const amt = parseFloat(parsed.amount);
        if (!isNaN(amt) && isFinite(amt) && amt > 0 && amt < 1e12) {
          setAmount(parsed.amount);
        }
      }
      if (parsed.currency === 'HIVE' || parsed.currency === 'HBD') {
        setCurrency(parsed.currency);
      }
      if (parsed.memo) {
        setMemo(parsed.memo.slice(0, MAX_MEMO_LENGTH));
      }
    } else {
      // Fall back to treating the whole string as a username
      const clean = sanitizeUsername(data);
      if (clean && isValidHiveUsername(clean)) {
        setRecipient(clean);
        setRecipientError('');
      }
    }
  };

  const handleReviewTransfer = () => {
    if (!isValid) return;
    setShowConfirm(true);
  };

  const handleConfirmTransfer = async () => {
    if (submitted || sending) return; // Prevent double-submit

    if (!activeAccountName) {
      addToast({ type: 'error', message: 'No active account' });
      return;
    }

    if (!hasKey('active')) {
      addToast({ type: 'error', message: 'Active key is required for transfers. Please import your active key.' });
      return;
    }

    // Validate amount bounds
    const amountCheck = validateAmount(amount, availableBalance);
    if (!amountCheck.valid) {
      addToast({ type: 'error', message: amountCheck.error });
      return;
    }

    // Validate memo length
    const memoCheck = validateMemo(memo);
    if (!memoCheck.valid) {
      addToast({ type: 'error', message: memoCheck.error });
      return;
    }

    setSending(true);
    try {
      const activeKey = await getDecryptedKey('active');
      if (!activeKey) {
        addToast({ type: 'error', message: 'Failed to decrypt active key. Please unlock your wallet.' });
        return;
      }

      // Format amount string: "10.000 HIVE" or "10.000 HBD"
      const num = amountCheck.amount;
      const amountStr = `${num.toFixed(3)} ${currency}`;

      await broadcastTransfer(
        activeAccountName,
        recipient.trim().toLowerCase(),
        amountStr,
        memo,
        activeKey,
      );

      // Record this transaction for contacts
      await recordTransaction(recipient.trim().toLowerCase());

      // Clear the saved draft after successful transfer
      clearDraft();

      setSubmitted(true);
      addToast({
        type: 'success',
        message: `Sent ${amountStr} to @${recipient}`,
      });

      navigation.goBack();
    } catch (err: any) {
      addToast({
        type: 'error',
        message: err?.message || 'Transfer failed',
      });
    } finally {
      setSending(false);
      setShowConfirm(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScreenHeader title="Send" />

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {!showConfirm ? (
            <>
              {/* Recipient */}
              <Input
                label="Recipient"
                placeholder="Enter username"
                value={recipient}
                onChangeText={(text) => {
                  setRecipient(text);
                  setRecipientError('');
                }}
                onBlur={handleRecipientBlur}
                autoCapitalize="none"
                autoCorrect={false}
                leftIcon={<AtSign size={18} color={colors.textTertiary} />}
                rightElement={
                  <View style={styles.recipientActions}>
                    <TouchableOpacity
                      onPress={() => navigation.navigate('Contacts')}
                      style={styles.recipientBtn}
                      activeOpacity={0.7}
                    >
                      <Users size={18} color={colors.textSecondary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => setShowScanner(true)}
                      style={styles.recipientBtn}
                      activeOpacity={0.7}
                    >
                      <QrCode size={18} color={colors.textSecondary} />
                    </TouchableOpacity>
                  </View>
                }
              />
              {recipientError ? (
                <Text style={styles.errorText}>{recipientError}</Text>
              ) : null}

              {/* Recent Contacts */}
              <RecentContactsList
                contacts={recentContacts}
                onSelect={handleSelectContact}
              />

              {/* Amount */}
              <View style={styles.amountSection}>
                <Input
                  label="Amount"
                  placeholder="0.000"
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="decimal-pad"
                />
                <View style={styles.balanceRow}>
                  <Text style={styles.balanceText}>
                    Available: {formatNumber(availableBalance)} {currency}
                  </Text>
                  <TouchableOpacity
                    onPress={() => setAmount(availableBalance.toFixed(3))}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.maxButton}>MAX</Text>
                  </TouchableOpacity>
                </View>
                <CurrencyPicker selected={currency} onSelect={setCurrency} />
              </View>

              {/* Memo */}
              <Input
                label={`Memo (optional, ${memo.length}/${MAX_MEMO_LENGTH})`}
                placeholder="Add a memo..."
                value={memo}
                onChangeText={(text) => setMemo(text.slice(0, MAX_MEMO_LENGTH))}
                maxLength={MAX_MEMO_LENGTH}
                leftIcon={<FileText size={18} color={colors.textTertiary} />}
                containerStyle={styles.memoInput}
              />

              {/* Review Button */}
              <Button
                variant="primary"
                size="lg"
                fullWidth
                disabled={!isValid}
                onPress={handleReviewTransfer}
                style={styles.reviewButton}
              >
                Review Transfer
              </Button>
            </>
          ) : (
            <ConfirmCard
              recipient={recipient}
              amount={amount}
              currency={currency}
              memo={memo}
              onCancel={() => setShowConfirm(false)}
              onConfirm={handleConfirmTransfer}
              loading={sending}
            />
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* QR Scanner Modal */}
      <QRScannerModal
        visible={showScanner}
        onClose={() => setShowScanner(false)}
        onScan={handleQRScan}
      />
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 40,
  },

  // Recipient actions
  recipientActions: {
    flexDirection: 'row',
    gap: 4,
  },
  recipientBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Error text
  errorText: {
    fontSize: 12,
    color: colors.error,
    marginTop: 4,
    marginLeft: 4,
  },

  // Recent contacts
  recentSection: {
    marginTop: 16,
    marginBottom: 8,
  },
  recentLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 10,
  },
  recentScroll: {
    gap: 12,
  },
  recentItem: {
    alignItems: 'center',
    gap: 6,
    width: 64,
  },
  recentUsername: {
    fontSize: 10,
    color: colors.textSecondary,
    textAlign: 'center',
  },

  // Amount
  amountSection: {
    marginTop: 20,
    gap: 12,
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  balanceText: {
    fontSize: 12,
    color: colors.textTertiary,
  },
  maxButton: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.hive,
  },
  currencyPicker: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceElevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  currencyOption: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
  },
  currencyOptionActive: {
    backgroundColor: 'rgba(227,19,55,0.15)',
  },
  currencyText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textTertiary,
  },
  currencyTextActive: {
    color: colors.hive,
  },

  // Memo
  memoInput: {
    marginTop: 20,
  },

  // Review
  reviewButton: {
    marginTop: 32,
  },

  // Confirm Card
  confirmCard: {
    marginTop: 8,
  },
  confirmTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 20,
  },
  confirmRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  confirmLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  confirmValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  confirmValue: {
    fontSize: 14,
    color: colors.textPrimary,
    maxWidth: 180,
  },
  confirmValueHighlight: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.hive,
  },
  confirmDivider: {
    height: 1,
    backgroundColor: colors.border,
  },
  confirmWarning: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,209,102,0.08)',
    borderRadius: 12,
    padding: 14,
    marginTop: 20,
    gap: 10,
    alignItems: 'flex-start',
  },
  confirmWarningText: {
    flex: 1,
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  confirmButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  confirmBtn: {
    flex: 1,
  },

  // Scanner
  scannerContainer: {
    height: 300,
    borderRadius: 16,
    overflow: 'hidden',
  },
  camera: {
    flex: 1,
  },
  permissionBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceElevated,
    gap: 16,
    padding: 20,
  },
  permissionText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default SendScreen;
