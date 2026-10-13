import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
  Users,
  FileText,
  ThumbsUp,
  ThumbsDown,
  ExternalLink,
  Shield,
} from 'lucide-react-native';
import { colors } from '../theme';
import { ScreenHeader } from '../components/layout/ScreenHeader';
import { useStore } from '../store';
import { useAccounts } from '../hooks/useAccounts';
import {
  getWitnessesByVote,
  listProposals,
  listProposalVotes,
  broadcastWitnessVote,
  broadcastProposalVote,
  broadcastSetProxy,
  getAccount,
} from '../core/hive/client';
import { Input } from '../components/ui/Input';
import { isValidHiveUsername, sanitizeUsername } from '../core/validation';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import type { WitnessInfo, ProposalInfo } from '../core/types';
import { logger } from '../core/logger';

type GovernanceTab = 'witnesses' | 'proposals';

const GovernanceScreen: React.FC = () => {
  const navigation = useNavigation();
  const addToast = useStore((s) => s.addToast);
  const activeAccountData = useStore((s) => s.activeAccountData);
  const { getDecryptedKey, activeAccountName } = useAccounts();
  const refreshAccountData = useStore((s) => s.refreshAccountData);

  const [activeTab, setActiveTab] = useState<GovernanceTab>('witnesses');
  const currentProxy: string = activeAccountData?.proxy || '';
  const [proxyInput, setProxyInput] = useState('');
  const [proxyWorking, setProxyWorking] = useState(false);
  const [witnesses, setWitnesses] = useState<WitnessInfo[]>([]);
  const [proposals, setProposals] = useState<ProposalInfo[]>([]);
  const [votingId, setVotingId] = useState<string | null>(null);
  const [loadingWitnesses, setLoadingWitnesses] = useState(true);
  const [loadingProposals, setLoadingProposals] = useState(true);

  // Fetch real witnesses from chain
  const fetchWitnesses = useCallback(async () => {
    setLoadingWitnesses(true);
    try {
      const raw: any[] = await getWitnessesByVote('', 50);
      const userVotes: Set<string> = new Set(activeAccountData?.witness_votes || []);

      const mapped: WitnessInfo[] = raw.map((w: any) => ({
        owner: w.owner,
        votes: w.votes,
        url: w.url || `https://hive.blog/@${w.owner}`,
        running_version: w.running_version || '0.0.0',
        is_active: w.signing_key !== 'STM1111111111111111111111111111111114T1Anm',
        voted: userVotes.has(w.owner),
      }));

      setWitnesses(mapped);
    } catch (e: any) {
      logger.error('[GovernanceScreen] fetchWitnesses error:', e);
      addToast({ type: 'error', message: 'Failed to load witnesses.' });
    } finally {
      setLoadingWitnesses(false);
    }
  }, [activeAccountData, addToast]);

  // Fetch real proposals from chain
  const fetchProposals = useCallback(async () => {
    setLoadingProposals(true);
    try {
      const raw: any[] = await listProposals();
      let votedIds = new Set<number>();
      if (activeAccountName) {
        votedIds = await listProposalVotes(activeAccountName);
      }

      const mapped: ProposalInfo[] = raw.map((p: any) => ({
        id: p.id ?? p.proposal_id,
        creator: p.creator,
        receiver: p.receiver,
        subject: p.subject,
        total_votes: p.total_votes || '0',
        status: p.status || 'active',
        start_date: p.start_date ? p.start_date.split('T')[0] : '',
        end_date: p.end_date ? p.end_date.split('T')[0] : '',
        daily_pay: p.daily_pay || '0.000 HBD',
        voted: votedIds.has(p.id ?? p.proposal_id),
      }));

      setProposals(mapped);
    } catch (e: any) {
      logger.error('[GovernanceScreen] fetchProposals error:', e);
      addToast({ type: 'error', message: 'Failed to load proposals.' });
    } finally {
      setLoadingProposals(false);
    }
  }, [activeAccountName, addToast]);

  // Load data on mount
  useEffect(() => {
    fetchWitnesses();
    fetchProposals();
  }, [fetchWitnesses, fetchProposals]);

  const votesUsed = witnesses.filter((w) => w.voted).length;

  const handleWitnessVote = useCallback(
    async (witness: WitnessInfo) => {
      if (!activeAccountName) {
        Alert.alert('Error', 'No active account.');
        return;
      }

      setVotingId(witness.owner);
      try {
        // Witness votes are an active-authority operation on Hive.
        const activeKey = await getDecryptedKey('active');
        if (!activeKey) {
          Alert.alert('Active key needed', 'Witness votes are signed with your active key. Add it in Settings to vote.');
          return;
        }

        const approve = !witness.voted;
        await broadcastWitnessVote(activeAccountName, witness.owner, approve, activeKey);

        addToast({
          type: 'success',
          message: approve
            ? `Voted for witness @${witness.owner}`
            : `Unvoted witness @${witness.owner}`,
        });

        // Reload witnesses to reflect updated state
        await refreshAccountData();
        await fetchWitnesses();
      } catch (e: any) {
        const msg = e.message || 'Vote failed';
        addToast({ type: 'error', message: msg });
        Alert.alert('Error', msg);
      } finally {
        setVotingId(null);
      }
    },
    [activeAccountName, getDecryptedKey, addToast, fetchWitnesses, refreshAccountData],
  );

  const handleProposalVote = useCallback(
    async (proposal: ProposalInfo) => {
      if (!activeAccountName) {
        Alert.alert('Error', 'No active account.');
        return;
      }

      setVotingId(`proposal-${proposal.id}`);
      try {
        // Proposal votes are an active-authority operation on Hive.
        const activeKey = await getDecryptedKey('active');
        if (!activeKey) {
          Alert.alert('Active key needed', 'Proposal votes are signed with your active key. Add it in Settings to vote.');
          return;
        }

        const approve = !proposal.voted;
        await broadcastProposalVote(activeAccountName, [proposal.id], approve, activeKey);

        addToast({
          type: 'success',
          message: approve
            ? `Voted for proposal #${proposal.id}`
            : `Unvoted proposal #${proposal.id}`,
        });

        // Reload proposals to reflect updated state
        await fetchProposals();
      } catch (e: any) {
        const msg = e.message || 'Vote failed';
        addToast({ type: 'error', message: msg });
        Alert.alert('Error', msg);
      } finally {
        setVotingId(null);
      }
    },
    [activeAccountName, getDecryptedKey, addToast, fetchProposals],
  );

  const handleSetProxy = useCallback(
    async (proxy: string) => {
      if (!activeAccountName) return;
      const clean = sanitizeUsername(proxy);
      if (clean && !isValidHiveUsername(clean)) {
        Alert.alert('Invalid account', 'Enter a valid Hive username.');
        return;
      }
      setProxyWorking(true);
      try {
        const activeKey = await getDecryptedKey('active');
        if (!activeKey) {
          Alert.alert('Active key needed', 'Changing your voting proxy is signed with your active key.');
          return;
        }
        if (clean) {
          const exists = await getAccount(clean);
          if (!exists) {
            Alert.alert('Not found', `@${clean} does not exist on Hive.`);
            return;
          }
        }
        await broadcastSetProxy(activeAccountName, clean, activeKey);
        addToast({
          type: 'success',
          message: clean ? `@${clean} now votes on your behalf` : 'Voting proxy removed',
        });
        setProxyInput('');
        await refreshAccountData();
        await fetchWitnesses();
      } catch (e: any) {
        addToast({ type: 'error', message: e.message || 'Failed to update proxy' });
      } finally {
        setProxyWorking(false);
      }
    },
    [activeAccountName, getDecryptedKey, addToast, refreshAccountData, fetchWitnesses],
  );

  const formatVotes = (votes: string | number) => {
    const num = parseInt(String(votes).replace(/,/g, ''), 10);
    if (isNaN(num)) return votes;
    if (num >= 1e12) return `${(num / 1e12).toFixed(1)}T`;
    if (num >= 1e9) return `${(num / 1e9).toFixed(1)}B`;
    if (num >= 1e6) return `${(num / 1e6).toFixed(1)}M`;
    return votes;
  };

  const renderWitness = ({ item, index }: { item: WitnessInfo; index: number }) => (
    <Card variant="default" padding="md" style={styles.witnessCard}>
      <View style={styles.witnessRow}>
        <View style={styles.witnessRank}>
          <Text style={styles.rankNumber}>{index + 1}</Text>
        </View>
        <View style={styles.witnessInfo}>
          <View style={styles.witnessNameRow}>
            <Text style={styles.witnessName}>@{item.owner}</Text>
            {item.is_active && (
              <Badge variant="success">Active</Badge>
            )}
          </View>
          <Text style={styles.witnessVotes}>
            {formatVotes(item.votes)} votes
          </Text>
          <Text style={styles.witnessVersion}>v{item.running_version}</Text>
        </View>
        <View style={styles.witnessActions}>
          <TouchableOpacity
            onPress={() => Linking.openURL(item.url)}
            style={styles.linkButton}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <ExternalLink size={16} color={colors.textTertiary} />
          </TouchableOpacity>
          <Button
            variant={item.voted ? 'danger' : 'primary'}
            size="sm"
            loading={votingId === item.owner}
            disabled={!!currentProxy}
            onPress={() => handleWitnessVote(item)}
            icon={
              item.voted ? (
                <ThumbsDown size={14} color={colors.error} />
              ) : (
                <ThumbsUp size={14} color="#FFFFFF" />
              )
            }
          >
            {item.voted ? 'Unvote' : 'Vote'}
          </Button>
        </View>
      </View>
    </Card>
  );

  const renderProposal = ({ item }: { item: ProposalInfo }) => (
    <Card variant="default" padding="md" style={styles.proposalCard}>
      <View style={styles.proposalHeader}>
        <View style={styles.proposalIdBadge}>
          <Text style={styles.proposalIdText}>#{item.id}</Text>
        </View>
        <Badge variant={item.status === 'active' ? 'success' : 'default'}>
          {item.status.toUpperCase()}
        </Badge>
      </View>
      <Text style={styles.proposalTitle} numberOfLines={2}>
        {item.subject}
      </Text>
      <View style={styles.proposalMeta}>
        <Text style={styles.proposalCreator}>by @{item.creator}</Text>
        <Text style={styles.proposalPay}>{item.daily_pay}/day</Text>
      </View>
      <View style={styles.proposalDates}>
        <Text style={styles.proposalDate}>
          {item.start_date} - {item.end_date}
        </Text>
      </View>
      <View style={styles.proposalVotesRow}>
        <Text style={styles.proposalVotes}>
          {formatVotes(item.total_votes)} votes
        </Text>
        <Button
          variant={item.voted ? 'danger' : 'primary'}
          size="sm"
          loading={votingId === `proposal-${item.id}`}
          onPress={() => handleProposalVote(item)}
          icon={
            item.voted ? (
              <ThumbsDown size={14} color={colors.error} />
            ) : (
              <ThumbsUp size={14} color="#FFFFFF" />
            )
          }
        >
          {item.voted ? 'Unvote' : 'Vote'}
        </Button>
      </View>
    </Card>
  );

  const renderEmptyList = () => {
    const isLoading = activeTab === 'witnesses' ? loadingWitnesses : loadingProposals;
    if (isLoading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.hive} />
          <Text style={styles.loadingText}>
            Loading {activeTab === 'witnesses' ? 'witnesses' : 'proposals'}...
          </Text>
        </View>
      );
    }
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>
          No {activeTab === 'witnesses' ? 'witnesses' : 'proposals'} found.
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <ScreenHeader title="Governance" />

      {/* Tab Switcher */}
      <View style={styles.tabWrapper}>
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[
              styles.tab,
              activeTab === 'witnesses' && styles.tabActive,
            ]}
            onPress={() => setActiveTab('witnesses')}
          >
            <Users
              size={16}
              color={
                activeTab === 'witnesses'
                  ? colors.textPrimary
                  : colors.textTertiary
              }
            />
            <Text
              style={[
                styles.tabText,
                activeTab === 'witnesses' && styles.tabTextActive,
              ]}
            >
              Witnesses
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.tab,
              activeTab === 'proposals' && styles.tabActive,
            ]}
            onPress={() => setActiveTab('proposals')}
          >
            <FileText
              size={16}
              color={
                activeTab === 'proposals'
                  ? colors.textPrimary
                  : colors.textTertiary
              }
            />
            <Text
              style={[
                styles.tabText,
                activeTab === 'proposals' && styles.tabTextActive,
              ]}
            >
              Proposals
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Witness vote count + proxy */}
      {activeTab === 'witnesses' && (
        <View>
          <View style={styles.voteCountRow}>
            <Shield size={14} color={colors.textTertiary} />
            <Text style={styles.voteCountText}>
              {currentProxy
                ? `@${currentProxy} votes on your behalf`
                : `Witness votes used: ${votesUsed}/30`}
            </Text>
          </View>
          <View style={styles.proxyCard}>
            <Text style={styles.proxyTitle}>Voting proxy</Text>
            <Text style={styles.proxyText}>
              {currentProxy
                ? 'Your witness and proposal votes follow your proxy. Remove it to vote yourself.'
                : 'Let another account cast witness and proposal votes for you.'}
            </Text>
            {currentProxy ? (
              <Button
                variant="danger"
                size="sm"
                loading={proxyWorking}
                onPress={() => handleSetProxy('')}
                style={styles.proxyButton}
              >
                Remove @{currentProxy}
              </Button>
            ) : (
              <View style={styles.proxyRow}>
                <Input
                  placeholder="username"
                  value={proxyInput}
                  onChangeText={setProxyInput}
                  autoCapitalize="none"
                  autoCorrect={false}
                  containerStyle={styles.proxyInput}
                />
                <Button
                  variant="secondary"
                  size="md"
                  loading={proxyWorking}
                  disabled={!proxyInput.trim()}
                  onPress={() => handleSetProxy(proxyInput)}
                >
                  Set
                </Button>
              </View>
            )}
          </View>
        </View>
      )}

      {/* Lists */}
      {activeTab === 'witnesses' ? (
        <FlatList
          data={witnesses}
          keyExtractor={(item) => item.owner}
          renderItem={renderWitness}
          ListEmptyComponent={renderEmptyList}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <FlatList
          data={proposals}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderProposal}
          ListEmptyComponent={renderEmptyList}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  tabWrapper: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 11,
    gap: 6,
  },
  tabActive: {
    backgroundColor: colors.surfaceElevated,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textTertiary,
  },
  tabTextActive: {
    color: colors.textPrimary,
  },
  voteCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 4,
  },
  voteCountText: {
    fontSize: 12,
    color: colors.textTertiary,
  },
  listContent: {
    padding: 16,
    gap: 10,
    paddingBottom: 40,
  },
  proxyCard: {
    marginHorizontal: 16,
    marginTop: 8,
    padding: 14,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  proxyTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  proxyText: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.textSecondary,
  },
  proxyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  proxyInput: {
    flex: 1,
  },
  proxyButton: {
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: colors.textTertiary,
  },
  // Witness card
  witnessCard: {},
  witnessRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  witnessRank: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: colors.surfaceOverlay,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankNumber: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  witnessInfo: {
    flex: 1,
    gap: 2,
  },
  witnessNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  witnessName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  witnessVotes: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  witnessVersion: {
    fontSize: 11,
    color: colors.textTertiary,
  },
  witnessActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  linkButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.surfaceOverlay,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Proposal card
  proposalCard: {
    gap: 8,
  },
  proposalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  proposalIdBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: colors.surfaceOverlay,
    borderRadius: 6,
  },
  proposalIdText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  proposalTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
    lineHeight: 20,
  },
  proposalMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  proposalCreator: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  proposalPay: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.coral,
  },
  proposalDates: {
    flexDirection: 'row',
  },
  proposalDate: {
    fontSize: 11,
    color: colors.textTertiary,
  },
  proposalVotesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  proposalVotes: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
});

export default GovernanceScreen;
