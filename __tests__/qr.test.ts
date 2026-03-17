import {
  buildTransferUri,
  buildHivesignerUrl,
  buildReceiveUri,
  parseTransferUri,
  generateReceiveQRValue,
} from '../src/core/qr';

describe('buildTransferUri', () => {
  it('builds basic transfer URI', () => {
    const uri = buildTransferUri({ to: 'alice' });
    expect(uri).toContain('hive://transfer');
    expect(uri).toContain('to=alice');
  });

  it('includes amount and currency', () => {
    const uri = buildTransferUri({
      to: 'alice',
      amount: '10.000',
      currency: 'HIVE',
    });
    expect(uri).toContain('to=alice');
    expect(uri).toContain('amount=10.000');
    expect(uri).toContain('currency=HIVE');
  });

  it('includes memo', () => {
    const uri = buildTransferUri({
      to: 'alice',
      memo: 'test payment',
    });
    expect(uri).toContain('memo=test');
  });

  it('URL-encodes special characters in memo', () => {
    const uri = buildTransferUri({
      to: 'alice',
      memo: 'hello world & foo=bar',
    });
    // URLSearchParams will encode & and =
    expect(uri).not.toContain('&foo=bar');
  });
});

describe('buildHivesignerUrl', () => {
  it('builds Hivesigner URL', () => {
    const url = buildHivesignerUrl({ to: 'alice' });
    expect(url).toContain('https://hivesigner.com/sign/transfer');
    expect(url).toContain('to=alice');
  });

  it('combines amount and currency', () => {
    const url = buildHivesignerUrl({
      to: 'alice',
      amount: '10.000',
      currency: 'HIVE',
    });
    expect(url).toContain('amount=10.000+HIVE');
  });
});

describe('buildReceiveUri', () => {
  it('builds receive URI with username', () => {
    const uri = buildReceiveUri('alice');
    expect(uri).toBe('hive://transfer?to=alice');
  });
});

describe('parseTransferUri', () => {
  it('parses hive:// URI', () => {
    const result = parseTransferUri('hive://transfer?to=alice&amount=10.000&currency=HIVE');
    expect(result).not.toBeNull();
    expect(result!.to).toBe('alice');
    expect(result!.amount).toBe('10.000');
    expect(result!.currency).toBe('HIVE');
  });

  it('parses Hivesigner URL', () => {
    const result = parseTransferUri(
      'https://hivesigner.com/sign/transfer?to=bob&amount=5.000+HBD&memo=payment',
    );
    expect(result).not.toBeNull();
    expect(result!.to).toBe('bob');
    expect(result!.amount).toBe('5.000');
    expect(result!.currency).toBe('HBD');
    expect(result!.memo).toBe('payment');
  });

  it('parses plain username', () => {
    const result = parseTransferUri('alice');
    expect(result).not.toBeNull();
    expect(result!.to).toBe('alice');
    expect(result!.amount).toBeUndefined();
  });

  it('parses @username', () => {
    const result = parseTransferUri('@alice');
    expect(result).not.toBeNull();
    expect(result!.to).toBe('alice');
  });

  it('returns null for empty string', () => {
    expect(parseTransferUri('')).toBeNull();
  });

  it('returns null for invalid URI without username', () => {
    expect(parseTransferUri('hive://transfer')).toBeNull();
  });

  it('returns null for random garbage', () => {
    expect(parseTransferUri('!@#$%^&*()')).toBeNull();
  });

  it('round-trips hive:// URIs', () => {
    const original = { to: 'alice', amount: '10.000', currency: 'HIVE', memo: 'test' };
    const uri = buildTransferUri(original);
    const parsed = parseTransferUri(uri);
    expect(parsed).not.toBeNull();
    expect(parsed!.to).toBe(original.to);
    expect(parsed!.amount).toBe(original.amount);
    expect(parsed!.currency).toBe(original.currency);
    expect(parsed!.memo).toBe(original.memo);
  });
});

describe('generateReceiveQRValue', () => {
  it('generates a hive:// URI', () => {
    const value = generateReceiveQRValue('alice');
    expect(value).toContain('hive://');
    expect(value).toContain('alice');
  });
});
