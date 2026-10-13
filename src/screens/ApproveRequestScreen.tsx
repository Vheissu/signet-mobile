/**
 * Approval screen for dApp and deep-link requests.
 *
 * Shows who is asking, what will be signed and with which key, then signs
 * or broadcasts on approval. One request at a time, oldest first; the
 * screen closes itself when the queue is empty.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ChevronDown, Globe, KeyRound, Link2, ShieldAlert } from 'lucide-react-native';
import { PageContainer } from '../components/layout/PageContainer';
import { Button } from '../components/ui/Button';
import { Avatar } from '../components/ui/Avatar';
import { colors } from '../theme';
import { useStore } from '../store';
import { useAccounts } from '../hooks/useAccounts';
import { describeRequest } from '../core/dapp/requests';
import { executeRequest, failure, MissingKeyError } from '../core/dapp/execute';
import type { KeyRole } from '../core/types';

const ApproveRequestScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const pendingRequests = useStore((s) => s.pendingRequests);
  const resolveRequest = useStore((s) => s.resolveRequest);
  const rejectAllRequests = useStore((s) => s.rejectAllRequests);
  const accounts = useStore((s) => s.accounts);
  const activeAccountName = useStore((s) => s.activeAccountName);
  const refreshAccountData = useStore((s) => s.refreshAccountData);
  const addToast = useStore((s) => s.addToast);
  const { getDecryptedKeyForAccount } = useAccounts();

  const approval = pendingRequests[0];
  const request = approval?.request;
  const description = useMemo(() => (request ? describeRequest(request) : null), [request]);

  const [chosenAccount, setChosenAccount] = useState('');
  const [showPicker, setShowPicker] = useState(false);
  const [isWorking, setIsWorking] = useState(false);
  const [error, setError] = useState('');

  // The requester's choice wins when that account is in the wallet. A
  // transfer without `enforce` (Keychain semantics) lets the user pick.
  const requestedUser = description?.username || null;
  const requestedInWallet = !!requestedUser && accounts.some((a) => a.username === requestedUser);
  const canSwitchAccount =
    !requestedUser || (!requestedInWallet && request?.type === 'TRANSFER' && !request.payload?.enforce);
  const username = requestedInWallet ? requestedUser! : chosenAccount;
  const account = accounts.find((a) => a.username === username);
  const hasKey = !!account && !!description && !!account.keys[description.keyRole];
  const accountMissing = !!requestedUser && !requestedInWallet && !canSwitchAccount;

  useEffect(() => {
    setError('');
    setShowPicker(false);
    setChosenAccount(activeAccountName || accounts[0]?.username || '');
  }, [request?.id, activeAccountName, accounts]);

  // Close once nothing is left to approve.
  useEffect(() => {
    if (pendingRequests.length === 0 && navigation.canGoBack()) {
      navigation.goBack();
    }
  }, [pendingRequests.length, navigation]);

  const getKey = useCallback(
    (user: string, role: KeyRole) => getDecryptedKeyForAccount(user, role),
    [getDecryptedKeyForAccount]
  );

  const handleReject = useCallback(async () => {
    if (!request) return;
    setIsWorking(true);
    await resolveRequest(request.id, failure(request, 'user_cancel', 'User rejected the request'));
    setIsWorking(false);
  }, [request, resolveRequest]);

  const handleApprove = useCallback(async () => {
    if (!request || !description || !username) return;
    setIsWorking(true);
    setError('');
    try {
      const response = await executeRequest(request, username, getKey);
      await resolveRequest(request.id, response);
      addToast({ type: 'success', message: `${description.title} approved` });
      if (username === activeAccountName) {
        refreshAccountData().catch(() => {});
      }
    } catch (err: any) {
      if (err instanceof MissingKeyError) {
        setError(`Add the ${err.role} key for @${err.username} in Settings to approve this.`);
      } else {
        const message = err?.message || 'The operation failed';
        setError(message);
        // A chain rejection is final for this request; tell the requester.
        await resolveRequest(request.id, failure(request, 'error', message));
      }
    } finally {
      setIsWorking(false);
    }
  }, [request, description, username, getKey, resolveRequest, addToast, activeAccountName, refreshAccountData]);

  if (!approval || !request || !description) {
    return <PageContainer title="Approve request" scrollable={false}><View /></PageContainer>;
  }

  const originLabel =
    approval.origin.kind === 'browser' ? approval.origin.host : approval.origin.protocol.label;
  const OriginIcon = approval.origin.kind === 'browser' ? Globe : Link2;

  return (
    <PageContainer title="Approve request" scrollable={false} noPadding>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Who is asking */}
        <View style={styles.originRow}>
          <View style={styles.originIcon}>
            <OriginIcon size={18} color={colors.textSecondary} />
          </View>
          <View style={styles.originText}>
            <Text style={styles.caption}>
              {approval.origin.kind === 'browser' ? 'Request from' : 'Opened by'}
            </Text>
            <Text style={styles.originLabel} numberOfLines={1}>
              {originLabel}
            </Text>
          </View>
          {pendingRequests.length > 1 && (
            <Text style={styles.queueCount}>1 of {pendingRequests.length}</Text>
          )}
        </View>

        {/* What */}
        <Text style={styles.title}>{description.title}</Text>
        <Text style={styles.summary}>{description.summary}</Text>

        {/* Who signs */}
        <View style={styles.card}>
          {accountMissing ? (
            <View style={styles.accountRow}>
              <View style={styles.accountText}>
                <Text style={styles.accountName}>@{requestedUser}</Text>
                <Text style={styles.errorText}>This account is not in Signet.</Text>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              disabled={!canSwitchAccount || accounts.length < 2}
              onPress={() => setShowPicker((v) => !v)}
              activeOpacity={0.7}
              style={styles.accountRow}
            >
              {username ? <Avatar username={username} size="sm" /> : null}
              <View style={styles.accountText}>
                <Text style={styles.caption}>Account</Text>
                <Text style={styles.accountName}>@{username || 'Select an account'}</Text>
              </View>
              {canSwitchAccount && accounts.length > 1 && (
                <ChevronDown size={16} color={colors.textTertiary} />
              )}
            </TouchableOpacity>
          )}

          {showPicker && (
            <View style={styles.picker}>
              {accounts.map((a) => (
                <TouchableOpacity
                  key={a.username}
                  onPress={() => {
                    setChosenAccount(a.username);
                    setShowPicker(false);
                  }}
                  style={styles.pickerRow}
                  activeOpacity={0.7}
                >
                  <Avatar username={a.username} size="sm" />
                  <Text
                    style={[
                      styles.pickerName,
                      a.username === username && { color: colors.textPrimary },
                    ]}
                  >
                    @{a.username}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <View style={styles.keyRow}>
            <KeyRound size={13} color={hasKey ? colors.success : colors.warning} />
            <Text style={styles.keyText}>
              Signs with the <Text style={styles.keyRole}>{description.keyRole}</Text> key
            </Text>
            {!hasKey && username && !accountMissing && (
              <Text style={styles.keyMissing}>not stored</Text>
            )}
          </View>
        </View>

        {/* Details */}
        {description.fields.length > 0 && (
          <View style={styles.card}>
            {description.fields.map((field, index) => (
              <View
                key={field.label}
                style={[styles.fieldRow, index > 0 && styles.fieldRowBorder]}
              >
                <Text style={styles.caption}>{field.label}</Text>
                {field.code ? (
                  <ScrollView style={styles.codeBox} nestedScrollEnabled>
                    <Text style={styles.code} selectable>
                      {field.value}
                    </Text>
                  </ScrollView>
                ) : (
                  <Text style={styles.fieldValue} selectable>
                    {field.value}
                  </Text>
                )}
              </View>
            ))}
          </View>
        )}

        {description.isSensitive && (
          <View style={styles.warning}>
            <ShieldAlert size={16} color={colors.error} />
            <Text style={styles.warningText}>
              This operation can move funds or change who controls your account. Only approve it
              if you trust <Text style={styles.warningStrong}>{originLabel}</Text>.
            </Text>
          </View>
        )}

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </ScrollView>

      <View style={styles.actions}>
        <View style={styles.actionRow}>
          <Button
            variant="secondary"
            size="lg"
            onPress={handleReject}
            disabled={isWorking}
            style={styles.actionButton}
          >
            Reject
          </Button>
          <Button
            variant="primary"
            size="lg"
            onPress={handleApprove}
            loading={isWorking}
            disabled={!username || accountMissing || !hasKey}
            style={styles.actionButton}
          >
            Approve
          </Button>
        </View>
        {pendingRequests.length > 1 && (
          <TouchableOpacity
            onPress={() => rejectAllRequests()}
            disabled={isWorking}
            style={styles.rejectAll}
          >
            <Text style={styles.rejectAllText}>Reject all {pendingRequests.length} requests</Text>
          </TouchableOpacity>
        )}
      </View>
    </PageContainer>
  );
};

const styles = StyleSheet.create({
  scroll: {
    padding: 20,
    gap: 14,
  },
  originRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  originIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  originText: {
    flex: 1,
  },
  originLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  queueCount: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textTertiary,
  },
  caption: {
    fontSize: 11,
    color: colors.textTertiary,
    marginBottom: 2,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.textPrimary,
    marginTop: 4,
  },
  summary: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    marginTop: -8,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  accountText: {
    flex: 1,
  },
  accountName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  picker: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  pickerName: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  keyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  keyText: {
    flex: 1,
    fontSize: 12,
    color: colors.textSecondary,
  },
  keyRole: {
    fontWeight: '700',
    color: colors.textPrimary,
  },
  keyMissing: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.warning,
  },
  fieldRow: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  fieldRowBorder: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  fieldValue: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  codeBox: {
    maxHeight: 180,
    backgroundColor: colors.bg,
    borderRadius: 8,
    padding: 10,
    marginTop: 4,
  },
  code: {
    fontFamily: 'Menlo',
    fontSize: 11,
    lineHeight: 16,
    color: colors.textPrimary,
  },
  warning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(239,71,111,0.25)',
    backgroundColor: 'rgba(239,71,111,0.08)',
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSecondary,
  },
  warningStrong: {
    fontWeight: '700',
    color: colors.textPrimary,
  },
  errorText: {
    fontSize: 13,
    color: colors.error,
    marginTop: 2,
  },
  actions: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 28,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 8,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
  },
  rejectAll: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  rejectAllText: {
    fontSize: 12,
    color: colors.textTertiary,
  },
});

export default ApproveRequestScreen;
