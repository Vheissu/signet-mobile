/**
 * Hive blockchain operation utilities.
 * Helper functions for parsing and formatting Hive amounts and properties.
 */

import type { DynamicGlobalProperties } from '@hiveio/dhive';

/**
 * Parse a Hive amount string like "1.234 HIVE" into { amount, currency }.
 */
export function parseAmount(amountStr: string): { amount: number; currency: string } {
  const parts = amountStr.trim().split(' ');
  return {
    amount: parseFloat(parts[0]),
    currency: parts[1] || 'HIVE',
  };
}

/**
 * Format a number as a Hive amount string.
 */
export function formatAmount(amount: number, currency: string, precision: number = 3): string {
  return `${amount.toFixed(precision)} ${currency}`;
}

/**
 * Convert VESTS to Hive Power using global properties.
 */
export function vestsToHP(
  vests: number,
  globalProps: DynamicGlobalProperties
): number {
  const totalVestingFund = parseAmount(globalProps.total_vesting_fund_hive as any).amount;
  const totalVestingShares = parseAmount(globalProps.total_vesting_shares as any).amount;

  if (totalVestingShares === 0) return 0;
  return (vests * totalVestingFund) / totalVestingShares;
}

/**
 * Convert Hive Power to VESTS.
 */
export function hpToVests(
  hp: number,
  globalProps: DynamicGlobalProperties
): number {
  const totalVestingFund = parseAmount(globalProps.total_vesting_fund_hive as any).amount;
  const totalVestingShares = parseAmount(globalProps.total_vesting_shares as any).amount;

  if (totalVestingFund === 0) return 0;
  return (hp * totalVestingShares) / totalVestingFund;
}

/**
 * Calculate voting power percentage from account data.
 */
export function calculateVotingPower(account: any): number {
  const lastVoteTime = new Date(account.last_vote_time + 'Z').getTime();
  const now = Date.now();
  const secondsSinceVote = (now - lastVoteTime) / 1000;

  let votingPower = account.voting_power || 0;
  votingPower += (10000 * secondsSinceVote) / (5 * 24 * 3600);
  votingPower = Math.min(votingPower, 10000);

  return votingPower / 100;
}

/**
 * Calculate resource credits percentage from RC data.
 */
export function calculateRC(rcAccount: any): number {
  if (!rcAccount?.rc_manabar) return 0;

  const maxMana = Number(rcAccount.max_rc);
  const currentMana = Number(rcAccount.rc_manabar.current_mana);
  const lastUpdate = Number(rcAccount.rc_manabar.last_update_time);

  const now = Math.floor(Date.now() / 1000);
  const elapsed = now - lastUpdate;
  const regenerated = (maxMana * elapsed) / (5 * 24 * 3600);

  const mana = Math.min(currentMana + regenerated, maxMana);
  if (maxMana === 0) return 0;

  return (mana / maxMana) * 100;
}

/**
 * Get estimated account value in USD.
 */
export function calculateAccountValue(
  account: any,
  globalProps: DynamicGlobalProperties,
  hivePrice: number,
  hbdPrice: number
): number {
  const hiveBalance = parseAmount(account.balance).amount;
  const hbdBalance = parseAmount(account.hbd_balance).amount;
  const savingsHive = parseAmount(account.savings_balance).amount;
  const savingsHbd = parseAmount(account.savings_hbd_balance).amount;
  const vestingShares = parseAmount(account.vesting_shares).amount;
  const hp = vestsToHP(vestingShares, globalProps);

  const totalHive = hiveBalance + savingsHive + hp;
  const totalHbd = hbdBalance + savingsHbd;

  return totalHive * hivePrice + totalHbd * hbdPrice;
}

/**
 * Format a number with thousands separators and decimals.
 */
export function formatNumber(num: number, decimals: number = 2): string {
  return num.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Format a USD value.
 */
export function formatUsd(value: number): string {
  return `$${formatNumber(value)}`;
}

/**
 * Get time ago string from a timestamp.
 */
export function timeAgo(timestamp: string): string {
  const now = Date.now();
  const then = new Date(timestamp + 'Z').getTime();
  const seconds = Math.floor((now - then) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return new Date(then).toLocaleDateString();
}

/**
 * Check if account has pending rewards to claim.
 */
export function hasPendingRewards(account: any): boolean {
  const rewardHive = parseAmount(account.reward_hive_balance || '0 HIVE').amount;
  const rewardHbd = parseAmount(account.reward_hbd_balance || '0 HBD').amount;
  const rewardVests = parseAmount(account.reward_vesting_balance || '0.000000 VESTS').amount;
  return rewardHive > 0 || rewardHbd > 0 || rewardVests > 0;
}
