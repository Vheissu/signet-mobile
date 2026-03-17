/**
 * Tests for Hive Engine payload builders.
 * These are pure functions that construct custom_json payloads.
 */

import {
  buildHEOperation,
  buildTransferPayload,
  buildStakePayload,
  buildUnstakePayload,
  buildDelegatePayload,
  buildUndelegatePayload,
  HE_ID,
} from '../src/core/hive-engine/api';

describe('HE_ID', () => {
  it('is the correct Hive Engine mainnet ID', () => {
    expect(HE_ID).toBe('ssc-mainnet-hive');
  });
});

describe('buildHEOperation', () => {
  it('builds a valid JSON payload', () => {
    const json = buildHEOperation('tokens', 'transfer', {
      symbol: 'BEE',
      to: 'alice',
      quantity: '10.000',
    });

    const parsed = JSON.parse(json);
    expect(parsed.contractName).toBe('tokens');
    expect(parsed.contractAction).toBe('transfer');
    expect(parsed.contractPayload.symbol).toBe('BEE');
    expect(parsed.contractPayload.to).toBe('alice');
    expect(parsed.contractPayload.quantity).toBe('10.000');
  });
});

describe('buildTransferPayload', () => {
  it('builds a transfer payload with memo', () => {
    const json = buildTransferPayload('BEE', 'alice', '10.000', 'test');
    const parsed = JSON.parse(json);

    expect(parsed.contractName).toBe('tokens');
    expect(parsed.contractAction).toBe('transfer');
    expect(parsed.contractPayload.symbol).toBe('BEE');
    expect(parsed.contractPayload.to).toBe('alice');
    expect(parsed.contractPayload.quantity).toBe('10.000');
    expect(parsed.contractPayload.memo).toBe('test');
  });

  it('defaults memo to empty string', () => {
    const json = buildTransferPayload('BEE', 'alice', '10.000');
    const parsed = JSON.parse(json);
    expect(parsed.contractPayload.memo).toBe('');
  });
});

describe('buildStakePayload', () => {
  it('builds a stake payload', () => {
    const json = buildStakePayload('BEE', 'alice', '100.000');
    const parsed = JSON.parse(json);

    expect(parsed.contractAction).toBe('stake');
    expect(parsed.contractPayload.to).toBe('alice');
    expect(parsed.contractPayload.symbol).toBe('BEE');
    expect(parsed.contractPayload.quantity).toBe('100.000');
  });
});

describe('buildUnstakePayload', () => {
  it('builds an unstake payload', () => {
    const json = buildUnstakePayload('BEE', '50.000');
    const parsed = JSON.parse(json);

    expect(parsed.contractAction).toBe('unstake');
    expect(parsed.contractPayload.symbol).toBe('BEE');
    expect(parsed.contractPayload.quantity).toBe('50.000');
  });
});

describe('buildDelegatePayload', () => {
  it('builds a delegate payload', () => {
    const json = buildDelegatePayload('BEE', 'bob', '25.000');
    const parsed = JSON.parse(json);

    expect(parsed.contractAction).toBe('delegate');
    expect(parsed.contractPayload.to).toBe('bob');
    expect(parsed.contractPayload.symbol).toBe('BEE');
    expect(parsed.contractPayload.quantity).toBe('25.000');
  });
});

describe('buildUndelegatePayload', () => {
  it('builds an undelegate payload', () => {
    const json = buildUndelegatePayload('BEE', 'bob', '25.000');
    const parsed = JSON.parse(json);

    expect(parsed.contractAction).toBe('undelegate');
    expect(parsed.contractPayload.from).toBe('bob');
    expect(parsed.contractPayload.symbol).toBe('BEE');
    expect(parsed.contractPayload.quantity).toBe('25.000');
  });
});
