import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
  ChevronLeft,
  Upload,
  FileText,
  CheckSquare,
  Square,
  ArrowRight,
  ArrowLeft,
  Download,
  CheckCircle,
  Key,
  Shield,
} from 'lucide-react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { colors } from '../theme';
import { useStore } from '../store';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Avatar } from '../components/ui/Avatar';
import { Spinner } from '../components/ui/Spinner';
import { parsePasswordManagerCSV, isWifKey, getFormatName } from '../core/import/csv-parser';
import type { DetectedHiveAccount } from '../core/import/csv-parser';
import { getAccount } from '../core/hive/client';
import { validatePrivateKey, identifyKeyRole, deriveKeysFromPassword } from '../core/crypto/hive-keys';
import { logger } from '../core/logger';

type Step = 1 | 2 | 3;

interface ParsedAccount {
  username: string;
  keys: {
    posting?: string;
    active?: string;
    memo?: string;
    owner?: string;
  };
  selected: boolean;
  source: string;
}

const SUPPORTED_MANAGERS = [
  { name: '1Password', format: 'CSV' },
  { name: 'LastPass', format: 'CSV' },
  { name: 'Bitwarden', format: 'CSV' },
  { name: 'Custom CSV', format: 'CSV' },
];

const ImportKeysScreen: React.FC = () => {
  const navigation = useNavigation();
  const addAccount = useStore((s) => s.addAccount);
  const addToast = useStore((s) => s.addToast);

  const [step, setStep] = useState<Step>(1);
  const [fileName, setFileName] = useState<string | null>(null);
  const [detectedFormat, setDetectedFormat] = useState<string | null>(null);
  const [parsedAccounts, setParsedAccounts] = useState<ParsedAccount[]>([]);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importComplete, setImportComplete] = useState(false);
  const [importResults, setImportResults] = useState<{ success: number; failed: number }>({
    success: 0,
    failed: 0,
  });

  const handlePickFile = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/comma-separated-values', 'application/json', '*/*'],
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const file = result.assets?.[0];
      if (!file) return;

      setFileName(file.name);

      // Read the file content
      const content = await FileSystem.readAsStringAsync(file.uri, {
        encoding: 'utf8' as any,
      });

      // Parse with the CSV parser
      const detected = parsePasswordManagerCSV(content);

      if (detected.length === 0) {
        Alert.alert(
          'No Accounts Found',
          'No Hive-related accounts were detected in this file. Make sure the file contains Hive keys or credentials.',
        );
        return;
      }

      // Set format name from first entry
      if (detected[0]) {
        setDetectedFormat(getFormatName(detected[0].source));
      }

      // Map to our ParsedAccount format
      const accounts: ParsedAccount[] = detected.map((d) => ({
        username: d.username,
        keys: {
          posting: d.keys.posting,
          active: d.keys.active,
          memo: d.keys.memo,
          owner: d.keys.owner,
          // If there's a master password, we'll derive keys during import
          ...(d.keys.master ? { _master: d.keys.master } : {}),
        } as any,
        selected: true,
        source: d.source,
      }));

      setParsedAccounts(accounts);
      setStep(2);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to read file.');
    }
  }, []);

  const toggleAccount = useCallback((username: string) => {
    setParsedAccounts((prev) =>
      prev.map((a) =>
        a.username === username ? { ...a, selected: !a.selected } : a,
      ),
    );
  }, []);

  const toggleAll = useCallback(() => {
    const allSelected = parsedAccounts.every((a) => a.selected);
    setParsedAccounts((prev) =>
      prev.map((a) => ({ ...a, selected: !allSelected })),
    );
  }, [parsedAccounts]);

  const selectedCount = parsedAccounts.filter((a) => a.selected).length;

  const handleImport = useCallback(async () => {
    const selected = parsedAccounts.filter((a) => a.selected);
    if (selected.length === 0) {
      Alert.alert('Error', 'Please select at least one account to import.');
      return;
    }

    setStep(3);
    setImporting(true);
    setImportProgress(0);

    let successCount = 0;
    let failCount = 0;

    try {
      for (let i = 0; i < selected.length; i++) {
        const parsed = selected[i];
        try {
          // Verify account exists on chain
          const accountData = await getAccount(parsed.username);
          if (!accountData) {
            addToast({
              type: 'warning',
              message: `@${parsed.username} not found on chain, skipping.`,
            });
            failCount++;
            setImportProgress(((i + 1) / selected.length) * 100);
            continue;
          }

          const validatedKeys: Record<string, string> = {};

          // Check for master password and derive keys
          const masterKey = (parsed.keys as any)._master;
          if (masterKey) {
            const derived = deriveKeysFromPassword(parsed.username, masterKey);
            for (const kp of derived) {
              // Verify the derived key matches the on-chain public key
              const role = identifyKeyRole(kp.private, accountData);
              if (role) {
                validatedKeys[role] = kp.private;
              }
            }
          }

          // Validate individual WIF keys
          for (const [role, wif] of Object.entries(parsed.keys)) {
            if (role === '_master' || !wif) continue;
            if (isWifKey(wif) && validatePrivateKey(wif)) {
              const detectedRole = identifyKeyRole(wif, accountData);
              if (detectedRole) {
                validatedKeys[detectedRole] = wif;
              }
            }
          }

          if (Object.keys(validatedKeys).length === 0) {
            addToast({
              type: 'warning',
              message: `No valid keys matched for @${parsed.username}.`,
            });
            failCount++;
            setImportProgress(((i + 1) / selected.length) * 100);
            continue;
          }

          // Add the account to the store
          await addAccount({
            username: parsed.username,
            keys: validatedKeys,
          });

          successCount++;
        } catch (err: any) {
          logger.error(`[ImportKeys] Error importing ${parsed.username}:`, err);
          failCount++;
        }

        setImportProgress(((i + 1) / selected.length) * 100);
      }

      setImportResults({ success: successCount, failed: failCount });
      setImportComplete(true);

      if (successCount > 0) {
        addToast({
          type: 'success',
          message: `Successfully imported ${successCount} account${successCount !== 1 ? 's' : ''}.`,
        });
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Import failed.');
      setStep(2);
    } finally {
      setImporting(false);
    }
  }, [parsedAccounts, addAccount, addToast]);

  const getKeyCount = (account: ParsedAccount) => {
    return Object.entries(account.keys).filter(
      ([key, val]) => key !== '_master' && Boolean(val),
    ).length;
  };

  const renderAccount = ({ item }: { item: ParsedAccount }) => (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => toggleAccount(item.username)}
    >
      <Card variant="default" padding="md" style={styles.accountCard}>
        <View style={styles.accountRow}>
          <TouchableOpacity
            onPress={() => toggleAccount(item.username)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            {item.selected ? (
              <CheckSquare size={22} color={colors.hive} />
            ) : (
              <Square size={22} color={colors.textTertiary} />
            )}
          </TouchableOpacity>
          <Avatar username={item.username} size="sm" />
          <View style={styles.accountInfo}>
            <Text style={styles.accountName}>@{item.username}</Text>
            <View style={styles.keysRow}>
              {item.keys.posting && <Badge variant="success">Posting</Badge>}
              {item.keys.active && <Badge variant="warning">Active</Badge>}
              {item.keys.memo && <Badge variant="default">Memo</Badge>}
              {item.keys.owner && <Badge variant="error">Owner</Badge>}
              {(item.keys as any)._master && <Badge variant="default">Master</Badge>}
            </View>
          </View>
          <Text style={styles.keyCount}>
            {getKeyCount(item)} key{getKeyCount(item) !== 1 ? 's' : ''}
          </Text>
        </View>
      </Card>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            if (step === 2) setStep(1);
            else if (step === 3 && importComplete) navigation.goBack();
            else navigation.goBack();
          }}
          style={styles.backButton}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <ChevronLeft size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Import Keys</Text>
        <View style={styles.headerRight} />
      </View>

      {/* Progress */}
      <View style={styles.progressRow}>
        <View style={[styles.progressDot, step >= 1 && styles.progressDotActive]} />
        <View style={[styles.progressLine, step >= 2 && styles.progressLineActive]} />
        <View style={[styles.progressDot, step >= 2 && styles.progressDotActive]} />
        <View style={[styles.progressLine, step >= 3 && styles.progressLineActive]} />
        <View style={[styles.progressDot, step >= 3 && styles.progressDotActive]} />
      </View>

      {step === 1 && (
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Step 1: File Upload */}
          <View style={styles.stepHeader}>
            <Text style={styles.stepNumber}>Step 1</Text>
            <Text style={styles.stepTitle}>Upload Keys File</Text>
            <Text style={styles.stepDescription}>
              Select a CSV file exported from your password manager or
              another Hive wallet.
            </Text>
          </View>

          {/* Supported Managers */}
          <Card variant="default" padding="md" style={styles.managersCard}>
            <Text style={styles.managersTitle}>Supported Formats</Text>
            {SUPPORTED_MANAGERS.map((mgr) => (
              <View key={mgr.name} style={styles.managerRow}>
                <Shield size={14} color={colors.textTertiary} />
                <Text style={styles.managerName}>{mgr.name}</Text>
                <Badge variant="default">{mgr.format}</Badge>
              </View>
            ))}
          </Card>

          {/* File Picker */}
          <TouchableOpacity
            style={styles.filePickerButton}
            onPress={handlePickFile}
            activeOpacity={0.7}
          >
            <View style={styles.filePickerContent}>
              <View style={styles.filePickerIconWrapper}>
                <Upload size={28} color={colors.hive} />
              </View>
              <Text style={styles.filePickerTitle}>
                {fileName ? fileName : 'Tap to Select File'}
              </Text>
              <Text style={styles.filePickerHint}>
                {detectedFormat
                  ? `Detected format: ${detectedFormat}`
                  : 'Supports CSV exports from password managers'}
              </Text>
            </View>
          </TouchableOpacity>

          {/* Security Note */}
          <Card variant="default" padding="sm" style={styles.securityCard}>
            <View style={styles.securityRow}>
              <Key size={14} color={colors.success} />
              <Text style={styles.securityText}>
                Your keys are encrypted locally and never leave this device.
                The imported file is not stored.
              </Text>
            </View>
          </Card>
        </ScrollView>
      )}

      {step === 2 && (
        <>
          {/* Step 2: Account Selection */}
          <View style={styles.step2Header}>
            <View style={styles.stepHeader}>
              <Text style={styles.stepNumber}>Step 2</Text>
              <Text style={styles.stepTitle}>Select Accounts</Text>
              <Text style={styles.stepDescription}>
                Found {parsedAccounts.length} account{parsedAccounts.length !== 1 ? 's' : ''} in the file.
                {detectedFormat ? ` Detected format: ${detectedFormat}.` : ''} Select
                which ones to import.
              </Text>
            </View>

            {/* Select All */}
            <View style={styles.selectAllRow}>
              <TouchableOpacity
                style={styles.selectAllButton}
                onPress={toggleAll}
              >
                {parsedAccounts.every((a) => a.selected) ? (
                  <CheckSquare size={18} color={colors.hive} />
                ) : (
                  <Square size={18} color={colors.textTertiary} />
                )}
                <Text style={styles.selectAllText}>Select All</Text>
              </TouchableOpacity>
              <Text style={styles.selectedCount}>
                {selectedCount} selected
              </Text>
            </View>
          </View>

          <FlatList
            data={parsedAccounts}
            keyExtractor={(item) => item.username}
            renderItem={renderAccount}
            contentContainerStyle={styles.accountList}
            showsVerticalScrollIndicator={false}
          />

          {/* Import Button */}
          <View style={styles.bottomBar}>
            <Button
              variant="ghost"
              size="md"
              onPress={() => setStep(1)}
              icon={<ArrowLeft size={16} color={colors.textSecondary} />}
            >
              Back
            </Button>
            <Button
              variant="primary"
              size="lg"
              onPress={handleImport}
              disabled={selectedCount === 0}
              icon={<Download size={16} color="#FFFFFF" />}
              style={styles.importButton}
            >
              Import {selectedCount} Account{selectedCount !== 1 ? 's' : ''}
            </Button>
          </View>
        </>
      )}

      {step === 3 && (
        <View style={styles.step3Container}>
          {!importComplete ? (
            <>
              <Spinner size="lg" />
              <Text style={styles.importingTitle}>Importing Accounts...</Text>
              <Text style={styles.importingDesc}>
                Verifying keys on chain and encrypting securely
              </Text>

              {/* Progress Bar */}
              <View style={styles.progressBarContainer}>
                <View
                  style={[
                    styles.progressBarFill,
                    { width: `${importProgress}%` },
                  ]}
                />
              </View>
              <Text style={styles.progressPercent}>
                {Math.round(importProgress)}%
              </Text>
            </>
          ) : (
            <>
              <View style={styles.successIcon}>
                <CheckCircle size={56} color={colors.success} />
              </View>
              <Text style={styles.successTitle}>Import Complete!</Text>
              <Text style={styles.successDesc}>
                Successfully imported {importResults.success} account
                {importResults.success !== 1 ? 's' : ''} with their keys.
                {importResults.failed > 0
                  ? ` ${importResults.failed} account${importResults.failed !== 1 ? 's' : ''} could not be imported.`
                  : ''}
              </Text>

              <View style={styles.successActions}>
                <Button
                  variant="primary"
                  size="lg"
                  fullWidth
                  onPress={() => navigation.goBack()}
                >
                  Done
                </Button>
              </View>
            </>
          )}
        </View>
      )}
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
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 40,
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
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },
  stepHeader: {
    gap: 6,
  },
  stepNumber: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.hive,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  stepTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  stepDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  // Supported Managers
  managersCard: {
    gap: 10,
  },
  managersTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  managerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  managerName: {
    fontSize: 13,
    color: colors.textSecondary,
    flex: 1,
  },
  // File Picker
  filePickerButton: {
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: 18,
    overflow: 'hidden',
  },
  filePickerContent: {
    alignItems: 'center',
    paddingVertical: 36,
    gap: 10,
  },
  filePickerIconWrapper: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: 'rgba(227,19,55,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  filePickerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  filePickerHint: {
    fontSize: 13,
    color: colors.textTertiary,
  },
  securityCard: {},
  securityRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  securityText: {
    fontSize: 12,
    color: colors.success,
    flex: 1,
    lineHeight: 16,
  },
  // Step 2
  step2Header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 12,
  },
  selectAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  selectAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  selectAllText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  selectedCount: {
    fontSize: 13,
    color: colors.textTertiary,
  },
  accountList: {
    padding: 16,
    gap: 8,
    paddingBottom: 100,
  },
  accountCard: {},
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  accountInfo: {
    flex: 1,
    gap: 6,
  },
  accountName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  keysRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  keyCount: {
    fontSize: 12,
    color: colors.textTertiary,
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
  },
  importButton: {
    flex: 1,
    marginLeft: 12,
  },
  // Step 3
  step3Container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 12,
  },
  importingTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: 8,
  },
  importingDesc: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  progressBarContainer: {
    width: '100%',
    height: 6,
    backgroundColor: colors.surfaceOverlay,
    borderRadius: 3,
    marginTop: 16,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.hive,
    borderRadius: 3,
  },
  progressPercent: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  successIcon: {
    marginBottom: 8,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.success,
  },
  successDesc: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  successActions: {
    width: '100%',
    marginTop: 24,
  },
});

export default ImportKeysScreen;
