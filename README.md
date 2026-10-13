# Signet Mobile

Signet Mobile is an Expo-based Hive wallet for iOS and Android. Keys are encrypted on the device and never leave it: Hive apps run inside Signet's browser and sign through it, and other native apps can request signatures over a deep link. It also covers the everyday wallet work: transfers, power up and down, savings, delegation, governance, Hive Engine tokens, and a transaction history that reads from the chain.

## Features

- In-app dApp browser with a Hive Keychain compatible `window.hive_keychain`, so PeakD, Ecency, Splinterlands, Tribaldex and other Keychain-aware sites work without changes
- Every signing request, from the browser or a deep link, goes through one approval screen that shows the origin, the account, the key role and the full operation
- Deep-link signing for native apps: `signet://login` (signed challenge), `signet://sign`, and the `hive://sign/...` links from the hive-uri spec
- Keys encrypted with AES-256-GCM under a password derived with PBKDF2; biometric unlock; auto-lock on inactivity and when the app leaves the foreground
- Multi-account management, master-password import, key import from 1Password, LastPass, Bitwarden and generic CSV exports
- Send and receive with QR scanning, `hive://` payment links and Hivesigner links; encrypted memos can be read with the memo key
- Dashboard with balances, pending rewards, resource credits and real HIVE price history
- Hive Engine token balances, real 30-day market history, transfer, stake, unstake and delegate
- Governance: witness votes, DHF proposal votes and voting proxy, signed with the right (active) key
- Power up and down, HBD savings at the rate the chain currently pays, HP delegation, HIVE/HBD conversion estimated from the witness price feed
- Paged account history covering transfers, rewards, savings interest, power-down payments, recurrent transfers and conversions
- Configurable RPC nodes with latency testing, local notification monitoring, offline banner, screenshot protection while unlocked

## Stack

- Expo
- React Native
- TypeScript
- React Navigation
- Zustand
- react-native-webview for the dApp browser
- hive-uri for `hive://` link decoding
- Jest with `jest-expo`

## Getting Started

### Prerequisites

- Node.js and npm
- Xcode for iOS development
- Android Studio for Android development
- Expo development tooling installed through project dependencies

### Install

```bash
npm install
```

### Environment

Create a local `.env` file from `.env.example`:

```bash
cp .env.example .env
```

Optional variables:

- `EXPO_PUBLIC_COINGECKO_API_KEY`: CoinGecko Pro API key. Leave empty to use the free tier.

The CoinGecko key can also be updated later from the in-app settings screen.

### Run the App

Start the Expo dev server:

```bash
npm start
```

Run the native apps:

```bash
npm run ios
npm run android
```

Run the web build:

```bash
npm run web
```

## Available Scripts

- `npm start`: Start the Expo dev server
- `npm run ios`: Build and launch the iOS app locally
- `npm run android`: Build and launch the Android app locally
- `npm run web`: Start the web target
- `npm test`: Run the Jest test suite
- `npm run test:watch`: Run Jest in watch mode
- `npm run test:coverage`: Run Jest with coverage output

## Testing

The project includes tests for core wallet and platform logic, including:

- Hive key handling, message signing and memo encryption
- Request descriptions, authority inference and execution helpers for the approval flow
- The browser bridge script (runs the injected `window.hive_keychain` against a fake window)
- `signet://` and `hive://` deep-link parsing and callback building
- Price history parsing and caching
- RPC selection and node health
- Secure storage and store behaviour (including that the password is never persisted)
- CSV import parsing, QR helpers, notification monitoring, validation

Run the full suite with:

```bash
npm test
```

## Project Structure

```text
.
├── App.tsx
├── app.json
├── __tests__/
├── assets/
├── scripts/
└── src/
    ├── components/
    ├── core/
    ├── hooks/
    ├── navigation/
    ├── screens/
    ├── store/
    └── theme/
```

Key areas:

- `src/core/dapp/`: request descriptions, execution, and the script injected into the browser
- `src/core/protocol/`: `signet://` and `hive://` deep-link parsing and callbacks
- `src/core/`: Hive client, key handling, prices, QR helpers, security, storage, notifications
- `src/screens/`: wallet, browser, approval, auth, settings, governance, token and transfer screens
- `src/store/`: Zustand app state, settings and the approval queue
- `__tests__/`: Jest coverage for the core logic layer

## Security Notes

- Private keys are encrypted individually with AES-256-GCM. The key is derived from the wallet password with 600,000 rounds of PBKDF2-SHA256 using react-native-quick-crypto's native implementation.
- The wallet password is held in memory only while unlocked. It is never written to disk; biometric unlock stores a copy encrypted with a random key in the OS keychain, gated by Face ID, Touch ID or fingerprint.
- Keys never leave the app. Web pages and other apps receive signatures or broadcast results, and every request is shown and approved first.
- The wallet locks after the configured idle time and 15 seconds after the app goes to the background. System prompts such as Face ID or the camera permission dialog do not trigger a lock.
- Screenshots and screen recording are blocked while unlocked. A jailbreak/root check runs at startup and warns the user.
- Custom RPC endpoints must use HTTPS; deep-link callbacks over the web must be HTTPS as well.

## Import Support

The key import flow currently supports CSV-style exports from:

- 1Password
- LastPass
- Bitwarden
- Custom CSV files

## dApp Browser

The Apps tab is a WebView with `window.hive_keychain` injected before any page script runs. The bridge follows the Hive Keychain method signatures (including `requestVote`'s `(account, permlink, author, weight)` order) and fires `hive_keychain_installed`, so sites built for Keychain detect it and work unchanged. Responses use Keychain's `{ success, error, result, data, message, request_id, publicKey, username }` shape.

Supported methods: `requestHandshake`, `requestVerifyKey`, `requestEncodeMessage`, `requestSignBuffer`, `requestAddAccountAuthority`, `requestRemoveAccountAuthority`, `requestBroadcast`, `requestSignTx`, `requestSignedCall`, `requestPost`, `requestVote`, `requestCustomJson`, `requestTransfer`, `requestSendToken`, `requestDelegation`, `requestWitnessVote`, `requestProxy`, `requestPowerUp`, `requestPowerDown`, `requestUpdateProposalVote`, `requestRecurrentTransfer`, `requestConversion`.

## Signing for Other Apps (deep links)

Native apps can ask Signet to sign without ever seeing a key. The user approves each request on the same screen the browser uses. Two schemes are registered.

### `signet://login`

```text
signet://login?username=<hive-user>&callback=<urlencoded-callback>[&challenge=<text>][&request_id=<id>]
```

Signet signs the challenge with the account's posting key (generating one of the form `signet-login:<user>:<timestamp>:<nonce>` if none is supplied) and opens the callback with:

```text
status=success&username=<user>&challenge=<text>&signature=<hex>&public_key=<STM...>&request_id=<id>
```

Verify it by hashing the challenge with SHA-256, recovering the signer from the signature, and checking that `public_key` is in the account's `posting.key_auths` on chain. On rejection the callback receives `status=error&error=<code>&message=<text>`.

### `signet://sign`

```text
signet://sign?message=<text>&callback=<urlencoded-callback>[&username=<user>][&role=posting|active|memo][&request_id=<id>]
```

Returns `signature` and `public_key` for an arbitrary message. Owner-key signing is refused.

### `hive://sign/...` (hive-uri)

Signet implements the [hive-uri](https://www.npmjs.com/package/hive-uri) specification: `hive://sign/op/<base64u>`, `hive://sign/ops/<base64u>`, `hive://sign/tx/<base64u>`, `hive://sign/msg/<base64u>` and the `transfer` and `follow` aliases, with the `s` (signer), `a` (authority), `nb` (sign only) and `cb` (base64u callback) parameters. Callback templates `{{sig}}`, `{{id}}`, `{{block}}` and `{{txn}}` are filled in. The `__signer` placeholder is replaced with the account the user picks. Links without a callback are signed and broadcast with the result shown in the app.

Notes:

- `callback`, `redirect_uri` and `return_url` are accepted as aliases for `signet://` links
- web callbacks must be `https://`; `signet://` and `hive://` callbacks are refused
- requests that arrive while the wallet is locked wait for the unlock and are then shown in order

## Notes for Development

- The `ios/` and `android/` directories are generated by `expo prebuild` (they are ignored by git). `npm run ios` and `npm run android` run prebuild as needed.
- Biometrics, secure storage, the camera scanner, screenshot protection and the WebView bridge need a simulator or device; the web target does not exercise them.
- To try the browser bridge against a site you control, open it in the Apps tab and call `window.hive_keychain.requestSignBuffer('<account>', 'hello', 'Posting', console.log)` from its console.
