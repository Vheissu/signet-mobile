import {
  isWifKey,
  parsePasswordManagerCSV,
  getFormatName,
} from '../src/core/import/csv-parser';

describe('isWifKey', () => {
  it('recognizes valid WIF keys starting with 5H', () => {
    // 51 chars, starts with 5H, valid base58
    const key = '5HueCGU8rMjxEXxiPuD5BDku4MkFqeZyd4dZ1jvhTVqvbTLvyTJ';
    expect(isWifKey(key)).toBe(true);
  });

  it('recognizes valid WIF keys starting with 5J', () => {
    const key = '5JamTPvZyQsHf8c2pbN92F1gUY3sJkpg4jE1EBYrRBiwnEFNabC';
    expect(isWifKey(key)).toBe(true);
  });

  it('recognizes valid WIF keys starting with 5K', () => {
    const key = '5KYZdUEo39z3FPrtuX2QbbwGnNP5zTd7yyr2SC1j299sBCnWjss';
    expect(isWifKey(key)).toBe(true);
  });

  it('rejects keys that are too short', () => {
    expect(isWifKey('5HueCGU8rMjxEXxiPuD5BDku4MkFqeZ')).toBe(false);
  });

  it('rejects keys that are too long', () => {
    expect(isWifKey('5HueCGU8rMjxEXxiPuD5BDku4MkFqeZyd4dZ1jvhTVqvbTLvyTJxxx')).toBe(false);
  });

  it('rejects keys not starting with 5H/J/K', () => {
    expect(isWifKey('5AueCGU8rMjxEXxiPuD5BDku4MkFqeZyd4dZ1jvhTVqvbTLvyTJ')).toBe(false);
    expect(isWifKey('6HueCGU8rMjxEXxiPuD5BDku4MkFqeZyd4dZ1jvhTVqvbTLvyTJ')).toBe(false);
  });

  it('rejects empty strings', () => {
    expect(isWifKey('')).toBe(false);
  });

  it('rejects random strings', () => {
    expect(isWifKey('hello world')).toBe(false);
  });

  it('handles whitespace trimming', () => {
    const key = '  5HueCGU8rMjxEXxiPuD5BDku4MkFqeZyd4dZ1jvhTVqvbTLvyTJ  ';
    expect(isWifKey(key)).toBe(true);
  });
});

describe('parsePasswordManagerCSV', () => {
  it('returns empty array for empty CSV', () => {
    expect(parsePasswordManagerCSV('')).toEqual([]);
  });

  it('returns empty array for CSV without Hive data', () => {
    const csv = `title,username,password,url
Gmail,user@gmail.com,secret123,https://gmail.com
Twitter,myuser,pass456,https://twitter.com`;
    expect(parsePasswordManagerCSV(csv)).toEqual([]);
  });

  it('detects Hive-related entries by title', () => {
    const csv = `title,username,password,notes
Hive Wallet,alice,somepassword,posting key: 5JamTPvZyQsHf8c2pbN92F1gUY3sJkpg4jE1EBYrRBiwnEFNabC`;
    const result = parsePasswordManagerCSV(csv);
    expect(result.length).toBe(1);
    expect(result[0].username).toBe('alice');
    expect(result[0].keys.posting).toBeDefined();
  });

  it('detects WIF key in password field', () => {
    const csv = `title,username,password,notes
Peakd,bob,5KYZdUEo39z3FPrtuX2QbbwGnNP5zTd7yyr2SC1j299sBCnWjss,`;
    const result = parsePasswordManagerCSV(csv);
    expect(result.length).toBe(1);
    expect(result[0].username).toBe('bob');
  });

  it('handles 1Password format', () => {
    const csv = `title,url,username,password,notes
Hive Blog,https://hive.blog,alice,password123,Active Key: 5JamTPvZyQsHf8c2pbN92F1gUY3sJkpg4jE1EBYrRBiwnEFNabC`;
    const result = parsePasswordManagerCSV(csv);
    expect(result.length).toBe(1);
    expect(result[0].source).toBe('onepassword');
    expect(result[0].keys.active).toBeDefined();
  });

  it('handles LastPass format', () => {
    const csv = `url,username,password,extra,name,grouping,fav
https://peakd.com,alice,5HueCGU8rMjxEXxiPuD5BDku4MkFqeZyd4dZ1jvhTVqvbTLvyTJ,,Hive Keys,crypto,0`;
    const result = parsePasswordManagerCSV(csv);
    expect(result.length).toBe(1);
    expect(result[0].source).toBe('lastpass');
  });

  it('handles Bitwarden format', () => {
    const csv = `folder,favorite,type,name,notes,fields,reprompt,login_uri,login_username,login_password,login_totp
crypto,,1,Hive Wallet,,posting: 5JamTPvZyQsHf8c2pbN92F1gUY3sJkpg4jE1EBYrRBiwnEFNabC,,https://hive.blog,alice,password,`;
    const result = parsePasswordManagerCSV(csv);
    expect(result.length).toBe(1);
    expect(result[0].source).toBe('bitwarden');
    expect(result[0].username).toBe('alice');
  });

  it('cleans @ from usernames', () => {
    const csv = `title,username,password,notes
Hive,@alice,5KYZdUEo39z3FPrtuX2QbbwGnNP5zTd7yyr2SC1j299sBCnWjss,`;
    const result = parsePasswordManagerCSV(csv);
    expect(result[0].username).toBe('alice');
  });

  it('detects multiple key roles from notes', () => {
    const csv = `title,username,password,notes
Hive Wallet,alice,password123,"posting key: 5JamTPvZyQsHf8c2pbN92F1gUY3sJkpg4jE1EBYrRBiwnEFNabC
active key: 5KYZdUEo39z3FPrtuX2QbbwGnNP5zTd7yyr2SC1j299sBCnWjss"`;
    const result = parsePasswordManagerCSV(csv);
    expect(result.length).toBe(1);
    expect(result[0].keys.posting).toBeDefined();
    expect(result[0].keys.active).toBeDefined();
  });
});

describe('getFormatName', () => {
  it('returns 1Password', () => {
    expect(getFormatName('onepassword')).toBe('1Password');
  });

  it('returns LastPass', () => {
    expect(getFormatName('lastpass')).toBe('LastPass');
  });

  it('returns Bitwarden', () => {
    expect(getFormatName('bitwarden')).toBe('Bitwarden');
  });

  it('returns CSV for unknown', () => {
    expect(getFormatName('generic')).toBe('CSV');
    expect(getFormatName('unknown')).toBe('CSV');
  });
});
