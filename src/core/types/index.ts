// Key roles in the Hive blockchain
export type KeyRole = 'posting' | 'active' | 'memo' | 'owner';

// A stored account with encrypted keys
export interface StoredAccount {
  username: string;
  keys: {
    posting?: string; // encrypted WIF
    active?: string;  // encrypted WIF
    memo?: string;    // encrypted WIF
    owner?: string;   // encrypted WIF
  };
}

// Encrypted payload format (AES-256-GCM via Web Crypto API with PBKDF2)
export interface EncryptedPayload {
  ct: string;  // ciphertext + GCM auth tag (base64)
  iv: string;  // initialization vector (base64)
  s: string;   // salt (base64)
}

// App settings
export interface Settings {
  autoLockMinutes: number;
  rpcNodes: string[];
  activeRpc: string;
  biometricEnabled: boolean;
  coingeckoApiKey: string;
}

export const DEFAULT_SETTINGS: Settings = {
  autoLockMinutes: 10,
  rpcNodes: [
    'https://api.hive.blog',
    'https://api.deathwing.me',
    'https://anyx.io',
    'https://api.openhive.network',
    'https://rpc.ausbit.dev',
  ],
  activeRpc: 'https://api.hive.blog',
  biometricEnabled: false,
  coingeckoApiKey: '',
};

// Navigation
export type Page =
  | 'welcome'
  | 'createPassword'
  | 'addAccount'
  | 'login'
  | 'dashboard'
  | 'send'
  | 'receive'
  | 'staking'
  | 'governance'
  | 'history'
  | 'settings'
  | 'swap'
  | 'tokens'
  | 'delegation'
  | 'savings'
  | 'accountManager'
  | 'importKeys'
  | 'editAccount'
  | 'tokenDetail'
  | 'contacts';

export interface NavigationEntry {
  page: Page;
  params?: Record<string, any>;
}

// Token (Hive Engine)
export interface HiveEngineToken {
  symbol: string;
  name: string;
  balance: string;
  stake?: string;
  pendingUnstake?: string;
  delegationsIn?: string;
  delegationsOut?: string;
  usdValue?: number;
  icon?: string;
  precision: number;
}

// Transaction history item
export interface TransactionRecord {
  id: string;
  type: string;
  timestamp: string;
  from: string;
  to: string;
  amount: string;
  memo?: string;
  block: number;
}

// Resource credits
export interface AccountResources {
  votingPower: number;     // percentage 0-100
  votingMana: number;      // current mana
  votingManaMax: number;   // max mana
  resourceCredits: number; // percentage 0-100
  rcMana: number;
  rcManaMax: number;
}

// Delegation info
export interface DelegationInfo {
  delegatee: string;
  delegator: string;
  vesting_shares: string;
  min_delegation_time: string;
}

// Witness info
export interface WitnessInfo {
  owner: string;
  votes: string;
  url: string;
  running_version: string;
  is_active: boolean;
  voted: boolean;
}

// Proposal info
export interface ProposalInfo {
  id: number;
  creator: string;
  receiver: string;
  subject: string;
  total_votes: string;
  status: string;
  start_date: string;
  end_date: string;
  daily_pay: string;
  voted: boolean;
}

// ---------------------------------------------------------------------------
// dApp / deep-link requests
// ---------------------------------------------------------------------------

export type DAppRequestType =
  | 'SIGN_TRANSACTION'
  | 'SIGN_BUFFER'
  | 'BROADCAST'
  | 'TRANSFER'
  | 'VOTE'
  | 'POST'
  | 'CUSTOM_JSON'
  | 'DELEGATE'
  | 'POWER_UP'
  | 'POWER_DOWN'
  | 'DECODE_MEMO'
  | 'ENCODE_MEMO'
  | 'ADD_ACCOUNT_AUTHORITY'
  | 'REMOVE_ACCOUNT_AUTHORITY'
  | 'WITNESS_VOTE'
  | 'PROXY'
  | 'UPDATE_PROPOSAL_VOTE'
  | 'CONVERT'
  | 'RECURRENT_TRANSFER'
  | 'SEND_TOKEN'
  | 'SIGNED_CALL';

/** A signing/broadcast request from a dApp (in-app browser) or a deep link. */
export interface DAppRequest {
  id: string;
  type: DAppRequestType;
  payload: any;
  /** Where the request came from: a web origin or a deep-link label. */
  origin: string;
  timestamp: number;
}

/** Hive Keychain compatible response shape. */
export interface DAppResponse {
  success: boolean;
  error: string | null;
  result: any;
  data: any;
  message: string;
  request_id: string;
  publicKey?: string;
  username?: string;
}
