import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Linking,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
  AppWindow,
  ExternalLink,
  KeyRound,
  ShieldAlert,
  UserRound,
} from 'lucide-react-native';
import { PageContainer } from '../components/layout/PageContainer';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { colors } from '../theme';
import { useStore } from '../store';
import { useAccounts } from '../hooks/useAccounts';
import {
  buildProtocolCallbackUrl,
  getProtocolRequesterLabel,
} from '../core/protocol';

const ProtocolLoginScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const protocolRequest = useStore((s) => s.protocolRequest);
  const clearProtocolRequest = useStore((s) => s.clearProtocolRequest);
  const addToast = useStore((s) => s.addToast);
  const isLocked = useStore((s) => s.isLocked);
  const accounts = useStore((s) => s.accounts);
  const { getDecryptedKeyForAccount } = useAccounts();

  const [submitting, setSubmitting] = useState(false);

  const requestedAccount = useMemo(
    () => accounts.find((account) => account.username === protocolRequest?.username),
    [accounts, protocolRequest?.username],
  );

  const requesterLabel = useMemo(
    () => (protocolRequest ? getProtocolRequesterLabel(protocolRequest.callback) : ''),
    [protocolRequest],
  );

  const blockingError = useMemo(() => {
    if (!protocolRequest) {
      return 'This login request is no longer available.';
    }
    if (isLocked) {
      return 'Unlock Signet before reviewing this login request.';
    }
    if (!requestedAccount) {
      return `@${protocolRequest.username} is not stored in this wallet.`;
    }
    if (!requestedAccount.keys.posting) {
      return `@${protocolRequest.username} does not have a stored posting key.`;
    }

    return null;
  }, [isLocked, protocolRequest, requestedAccount]);

  const closeScreen = useCallback(() => {
    clearProtocolRequest();
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    navigation.navigate('Main');
  }, [clearProtocolRequest, navigation]);

  useEffect(() => {
    if (!protocolRequest) {
      closeScreen();
    }
  }, [closeScreen, protocolRequest]);

  const openCallback = useCallback(
    async (payload: Parameters<typeof buildProtocolCallbackUrl>[1]) => {
      if (!protocolRequest) {
        return;
      }

      const callbackUrl = buildProtocolCallbackUrl(protocolRequest.callback, payload);
      await Linking.openURL(callbackUrl);
    },
    [protocolRequest],
  );

  const handleReject = useCallback(async () => {
    if (!protocolRequest) {
      closeScreen();
      return;
    }

    setSubmitting(true);

    try {
      await openCallback({
        status: 'error',
        username: protocolRequest.username,
        request_id: protocolRequest.requestId,
        error: blockingError ? 'request_unavailable' : 'user_rejected',
        message: blockingError || 'The login request was rejected.',
      });
      closeScreen();
    } catch {
      addToast({
        type: 'error',
        message: 'Unable to return to the requesting app.',
      });
    } finally {
      setSubmitting(false);
    }
  }, [addToast, blockingError, closeScreen, openCallback, protocolRequest]);

  const handleApprove = useCallback(async () => {
    if (!protocolRequest || !requestedAccount || blockingError) {
      return;
    }

    setSubmitting(true);

    try {
      const postingKey = await getDecryptedKeyForAccount(
        requestedAccount.username,
        'posting',
      );

      if (!postingKey) {
        addToast({
          type: 'error',
          message: 'Unable to decrypt the posting key for this account.',
        });
        return;
      }

      await openCallback({
        status: 'success',
        username: requestedAccount.username,
        posting_key: postingKey,
        request_id: protocolRequest.requestId,
      });

      addToast({
        type: 'success',
        message: `Shared @${requestedAccount.username} with ${requesterLabel}.`,
      });
      closeScreen();
    } catch {
      addToast({
        type: 'error',
        message: 'Unable to return the login response to the requesting app.',
      });
    } finally {
      setSubmitting(false);
    }
  }, [
    addToast,
    blockingError,
    closeScreen,
    getDecryptedKeyForAccount,
    openCallback,
    protocolRequest?.requestId,
    requestedAccount,
    requesterLabel,
  ]);

  if (!protocolRequest) {
    return null;
  }

  return (
    <PageContainer title="External Login" scrollable={false}>
      <View style={styles.container}>
        <Card variant="default" padding="lg" style={styles.heroCard}>
          <View style={styles.heroIcon}>
            <AppWindow size={28} color={colors.hive} />
          </View>
          <Text style={styles.title}>External app login request</Text>
          <Text style={styles.subtitle}>
            Signet can hand a stored posting key to another Hive app through a local callback.
            Approve only if you trust the requesting app.
          </Text>
        </Card>

        <Card variant="default" padding="lg">
          <View style={styles.row}>
            <ExternalLink size={18} color={colors.textSecondary} />
            <Text style={styles.label}>Requesting app</Text>
          </View>
          <Text style={styles.value}>{requesterLabel}</Text>
          <Text style={styles.detail}>{protocolRequest.callback}</Text>

          <View style={styles.separator} />

          <View style={styles.row}>
            <UserRound size={18} color={colors.textSecondary} />
            <Text style={styles.label}>Hive account</Text>
          </View>
          <Text style={styles.value}>@{protocolRequest.username}</Text>

          <View style={styles.badges}>
            <Badge variant="default">Login</Badge>
            <Badge variant="warning">Posting Key</Badge>
            {protocolRequest.requestId ? (
              <Badge variant="default">Request ID: {protocolRequest.requestId}</Badge>
            ) : null}
          </View>
        </Card>

        <Card variant="default" padding="lg" style={styles.warningCard}>
          <View style={styles.row}>
            <ShieldAlert size={18} color={colors.warning} />
            <Text style={styles.warningTitle}>Security note</Text>
          </View>
          <Text style={styles.warningText}>
            This sends the decrypted posting key out of Signet. The requesting app can post,
            vote, comment, and act with posting authority until you rotate that key.
          </Text>
        </Card>

        {blockingError ? (
          <Card variant="default" padding="lg" style={styles.errorCard}>
            <View style={styles.row}>
              <KeyRound size={18} color={colors.error} />
              <Text style={styles.errorTitle}>Request cannot be completed</Text>
            </View>
            <Text style={styles.errorText}>{blockingError}</Text>
          </Card>
        ) : null}

        <View style={styles.actions}>
          <Button
            variant="secondary"
            size="lg"
            fullWidth
            disabled={submitting}
            onPress={handleReject}
          >
            Reject
          </Button>
          <Button
            variant="primary"
            size="lg"
            fullWidth
            loading={submitting}
            disabled={!!blockingError}
            onPress={handleApprove}
          >
            Share Posting Key
          </Button>
        </View>
      </View>
    </PageContainer>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    gap: 16,
  },
  heroCard: {
    alignItems: 'center',
  },
  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(227, 19, 55, 0.12)',
    marginBottom: 14,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  value: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    marginTop: 10,
  },
  detail: {
    color: colors.textTertiary,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
  },
  separator: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 16,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  warningCard: {
    borderWidth: 1,
    borderColor: 'rgba(255, 209, 102, 0.18)',
    backgroundColor: 'rgba(255, 209, 102, 0.06)',
  },
  warningTitle: {
    color: colors.warning,
    fontSize: 14,
    fontWeight: '700',
  },
  warningText: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 10,
  },
  errorCard: {
    borderWidth: 1,
    borderColor: 'rgba(239, 71, 111, 0.24)',
    backgroundColor: 'rgba(239, 71, 111, 0.06)',
  },
  errorTitle: {
    color: colors.error,
    fontSize: 14,
    fontWeight: '700',
  },
  errorText: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 10,
  },
  actions: {
    marginTop: 'auto',
    gap: 12,
  },
});

export default ProtocolLoginScreen;
