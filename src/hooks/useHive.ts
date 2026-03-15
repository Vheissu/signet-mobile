/**
 * useHive Hook
 *
 * Provides computed balances, pending rewards, resources,
 * and formatting utilities derived from the Zustand store.
 * Ported from the browser extension with the same useMemo calculations.
 */

import { useMemo, useCallback } from 'react';
import { useStore } from '../store';

// -------------------------------------------------------------------
// Types
// -------------------------------------------------------------------
export interface HiveBalances {
  hive: number;
  hbd: number;
  hp: number;
  savingsHive: number;
  savingsHbd: number;
  hiveUsd: number;
  hbdUsd: number;
  hpUsd: number;
  savingsHiveUsd: number;
  savingsHbdUsd: number;
  totalUsd: number;
}

export interface PendingRewards {
  hive: number;
  hbd: number;
  hp: number;
  hiveUsd: number;
  hbdUsd: number;
  hpUsd: number;
  totalUsd: number;
}

export interface HiveResources {
  votingPower: number;
  resourceCredits: number;
  votingMana: number;
  votingManaMax: number;
  rcMana: number;
  rcManaMax: number;
}

// -------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------
function parseAsset(asset: string | undefined | null): number {
  if (!asset) return 0;
  return parseFloat(asset.split(' ')[0]) || 0;
}

function vestsToHP(
  vests: number,
  totalVestingShares: number,
  totalVestingFundHive: number,
): number {
  if (totalVestingShares === 0) return 0;
  return (vests / totalVestingShares) * totalVestingFundHive;
}

// -------------------------------------------------------------------
// Hook
// -------------------------------------------------------------------
export function useHive() {
  const activeAccountData = useStore((s) => s.activeAccountData);
  const globalProperties = useStore((s) => s.globalProperties);
  const hivePriceUsd = useStore((s) => s.hivePriceUsd);
  const hbdPriceUsd = useStore((s) => s.hbdPriceUsd);
  const resources = useStore((s) => s.resources);
  const refreshAccountDataAction = useStore((s) => s.refreshAccountData);

  // -----------------------------------------------------------------
  // Balances
  // -----------------------------------------------------------------
  const balances = useMemo<HiveBalances>(() => {
    const acct = activeAccountData;
    const gp = globalProperties;

    if (!acct || !gp) {
      return {
        hive: 0,
        hbd: 0,
        hp: 0,
        savingsHive: 0,
        savingsHbd: 0,
        hiveUsd: 0,
        hbdUsd: 0,
        hpUsd: 0,
        savingsHiveUsd: 0,
        savingsHbdUsd: 0,
        totalUsd: 0,
      };
    }

    const totalVestingShares = parseAsset(gp.total_vesting_shares);
    const totalVestingFundHive = parseAsset(gp.total_vesting_fund_hive);

    const hive = parseAsset(acct.balance);
    const hbd = parseAsset(acct.hbd_balance);

    const ownVests = parseAsset(acct.vesting_shares);
    const delegatedVests = parseAsset(acct.delegated_vesting_shares);
    const receivedVests = parseAsset(acct.received_vesting_shares);
    const effectiveVests = ownVests - delegatedVests + receivedVests;
    const hp = vestsToHP(effectiveVests, totalVestingShares, totalVestingFundHive);

    const savingsHive = parseAsset(acct.savings_balance);
    const savingsHbd = parseAsset(acct.savings_hbd_balance);

    const hiveUsd = hive * hivePriceUsd;
    const hbdUsd = hbd * hbdPriceUsd;
    const hpUsd = hp * hivePriceUsd;
    const savingsHiveUsd = savingsHive * hivePriceUsd;
    const savingsHbdUsd = savingsHbd * hbdPriceUsd;
    const totalUsd = hiveUsd + hbdUsd + hpUsd + savingsHiveUsd + savingsHbdUsd;

    return {
      hive,
      hbd,
      hp,
      savingsHive,
      savingsHbd,
      hiveUsd,
      hbdUsd,
      hpUsd,
      savingsHiveUsd,
      savingsHbdUsd,
      totalUsd,
    };
  }, [activeAccountData, globalProperties, hivePriceUsd, hbdPriceUsd]);

  // -----------------------------------------------------------------
  // Pending Rewards
  // -----------------------------------------------------------------
  const rewards = useMemo<PendingRewards>(() => {
    const acct = activeAccountData;
    const gp = globalProperties;

    if (!acct || !gp) {
      return {
        hive: 0,
        hbd: 0,
        hp: 0,
        hiveUsd: 0,
        hbdUsd: 0,
        hpUsd: 0,
        totalUsd: 0,
      };
    }

    const totalVestingShares = parseAsset(gp.total_vesting_shares);
    const totalVestingFundHive = parseAsset(gp.total_vesting_fund_hive);

    const hive = parseAsset(acct.reward_hive_balance);
    const hbd = parseAsset(acct.reward_hbd_balance);
    const rewardVests = parseAsset(acct.reward_vesting_balance);
    const hp = vestsToHP(rewardVests, totalVestingShares, totalVestingFundHive);

    const hiveUsd = hive * hivePriceUsd;
    const hbdUsd = hbd * hbdPriceUsd;
    const hpUsd = hp * hivePriceUsd;
    const totalUsd = hiveUsd + hbdUsd + hpUsd;

    return { hive, hbd, hp, hiveUsd, hbdUsd, hpUsd, totalUsd };
  }, [activeAccountData, globalProperties, hivePriceUsd, hbdPriceUsd]);

  // -----------------------------------------------------------------
  // Resources
  // -----------------------------------------------------------------
  const accountResources = useMemo<HiveResources>(() => {
    if (!resources) {
      return {
        votingPower: 0,
        resourceCredits: 0,
        votingMana: 0,
        votingManaMax: 0,
        rcMana: 0,
        rcManaMax: 0,
      };
    }
    return {
      votingPower: resources.votingPower,
      resourceCredits: resources.resourceCredits,
      votingMana: resources.votingMana,
      votingManaMax: resources.votingManaMax,
      rcMana: resources.rcMana,
      rcManaMax: resources.rcManaMax,
    };
  }, [resources]);

  // -----------------------------------------------------------------
  // Formatting Utilities
  // -----------------------------------------------------------------
  const formatNumber = useCallback(
    (value: number, decimals: number = 3): string => {
      return value.toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });
    },
    [],
  );

  const formatUsd = useCallback((value: number): string => {
    return value.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }, []);

  const refreshAccountData = useCallback(() => {
    return refreshAccountDataAction();
  }, [refreshAccountDataAction]);

  return {
    balances,
    rewards,
    resources: accountResources,
    formatNumber,
    formatUsd,
    refreshAccountData,
    hivePriceUsd,
    hbdPriceUsd,
    globalProperties,
  };
}

export default useHive;
