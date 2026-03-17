import {
  parseAmount,
  formatAmount,
  vestsToHP,
  hpToVests,
  formatNumber,
  formatUsd,
  hasPendingRewards,
} from '../src/core/hive/operations';

describe('parseAmount', () => {
  it('parses standard HIVE amount', () => {
    const result = parseAmount('10.000 HIVE');
    expect(result.amount).toBe(10);
    expect(result.currency).toBe('HIVE');
  });

  it('parses HBD amount', () => {
    const result = parseAmount('5.500 HBD');
    expect(result.amount).toBe(5.5);
    expect(result.currency).toBe('HBD');
  });

  it('parses VESTS amount', () => {
    const result = parseAmount('1234567.890000 VESTS');
    expect(result.amount).toBeCloseTo(1234567.89);
    expect(result.currency).toBe('VESTS');
  });

  it('defaults currency to HIVE when missing', () => {
    const result = parseAmount('10.000');
    expect(result.amount).toBe(10);
    expect(result.currency).toBe('HIVE');
  });

  it('handles zero amounts', () => {
    const result = parseAmount('0.000 HIVE');
    expect(result.amount).toBe(0);
  });

  it('handles amounts with extra whitespace', () => {
    const result = parseAmount('  10.000 HIVE  ');
    expect(result.amount).toBe(10);
    expect(result.currency).toBe('HIVE');
  });
});

describe('formatAmount', () => {
  it('formats with default precision', () => {
    expect(formatAmount(10, 'HIVE')).toBe('10.000 HIVE');
  });

  it('formats with custom precision', () => {
    expect(formatAmount(10.123456, 'VESTS', 6)).toBe('10.123456 VESTS');
  });

  it('formats zero', () => {
    expect(formatAmount(0, 'HBD')).toBe('0.000 HBD');
  });

  it('formats large numbers', () => {
    expect(formatAmount(1234567.89, 'HIVE')).toBe('1234567.890 HIVE');
  });
});

describe('vestsToHP / hpToVests', () => {
  const mockGlobalProps = {
    total_vesting_fund_hive: '100000000.000 HIVE',
    total_vesting_shares: '200000000000.000000 VESTS',
  } as any;

  it('converts VESTS to HP', () => {
    const hp = vestsToHP(2000000, mockGlobalProps);
    // 2000000 * 100000000 / 200000000000 = 1000
    expect(hp).toBeCloseTo(1000);
  });

  it('converts HP to VESTS', () => {
    const vests = hpToVests(1000, mockGlobalProps);
    // 1000 * 200000000000 / 100000000 = 2000000
    expect(vests).toBeCloseTo(2000000);
  });

  it('round-trips correctly', () => {
    const hp = 500;
    const vests = hpToVests(hp, mockGlobalProps);
    const backToHp = vestsToHP(vests, mockGlobalProps);
    expect(backToHp).toBeCloseTo(hp);
  });

  it('handles zero vesting fund', () => {
    const zeroProps = {
      total_vesting_fund_hive: '0.000 HIVE',
      total_vesting_shares: '200000000000.000000 VESTS',
    } as any;
    expect(vestsToHP(1000, zeroProps)).toBe(0);
    expect(hpToVests(1000, zeroProps)).toBe(0);
  });

  it('handles zero vesting shares', () => {
    const zeroProps = {
      total_vesting_fund_hive: '100000000.000 HIVE',
      total_vesting_shares: '0.000000 VESTS',
    } as any;
    expect(vestsToHP(1000, zeroProps)).toBe(0);
  });
});

describe('hasPendingRewards', () => {
  it('returns true when HIVE rewards pending', () => {
    expect(hasPendingRewards({
      reward_hive_balance: '1.000 HIVE',
      reward_hbd_balance: '0.000 HBD',
      reward_vesting_balance: '0.000000 VESTS',
    })).toBe(true);
  });

  it('returns true when HBD rewards pending', () => {
    expect(hasPendingRewards({
      reward_hive_balance: '0.000 HIVE',
      reward_hbd_balance: '0.500 HBD',
      reward_vesting_balance: '0.000000 VESTS',
    })).toBe(true);
  });

  it('returns true when VESTS rewards pending', () => {
    expect(hasPendingRewards({
      reward_hive_balance: '0.000 HIVE',
      reward_hbd_balance: '0.000 HBD',
      reward_vesting_balance: '100.000000 VESTS',
    })).toBe(true);
  });

  it('returns false when no rewards', () => {
    expect(hasPendingRewards({
      reward_hive_balance: '0.000 HIVE',
      reward_hbd_balance: '0.000 HBD',
      reward_vesting_balance: '0.000000 VESTS',
    })).toBe(false);
  });

  it('handles missing fields gracefully', () => {
    expect(hasPendingRewards({})).toBe(false);
  });
});

describe('formatNumber', () => {
  it('formats with default 2 decimals', () => {
    expect(formatNumber(1234.5)).toBe('1,234.50');
  });

  it('formats with custom decimals', () => {
    expect(formatNumber(1234.56789, 3)).toBe('1,234.568');
  });

  it('formats zero', () => {
    expect(formatNumber(0)).toBe('0.00');
  });
});

describe('formatUsd', () => {
  it('formats USD value', () => {
    expect(formatUsd(1234.56)).toBe('$1,234.56');
  });

  it('formats zero', () => {
    expect(formatUsd(0)).toBe('$0.00');
  });
});
