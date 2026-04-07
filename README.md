# Signet Mobile

Signet Mobile is an Expo-based Hive wallet for iOS and Android. It focuses on secure local key storage, fast account access, QR-based send and receive flows, governance tooling, Hive Engine token support, and mobile-native security features such as biometric unlock and screen-capture protection.

## Features

- Secure wallet onboarding with local encrypted storage
- Password unlock with optional biometric unlock
- Auto-lock and session restore
- Multi-account management
- Import keys from manual entry or password-manager exports
- Send and receive flows with QR code scanning and QR generation
- Hive wallet dashboard with balances, rewards, resource credits, and price data
- Hive Engine token browsing and token detail screens
- Governance, staking, savings, and delegation flows
- Configurable Hive RPC nodes
- Local notification monitoring and offline status banner
- Screenshot and screen-recording protection while the wallet is unlocked

## Stack

- Expo
- React Native
- TypeScript
- React Navigation
- Zustand
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

- Hive key handling and blockchain operations
- RPC selection and node health
- Secure storage behavior
- CSV import parsing
- QR parsing and generation helpers
- Notification monitoring
- Validation and store behavior

Run the full suite with:

```bash
npm test
```

## Project Structure

```text
.
├── App.tsx
├── app.json
├── android/
├── ios/
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

- `src/core/`: Hive client logic, key handling, QR helpers, security, storage, notifications
- `src/screens/`: Wallet, auth, settings, governance, token, and transfer screens
- `src/store/`: Zustand app state and persistence flow
- `__tests__/`: Jest coverage for the core logic layer

## Security Notes

- Wallet data is stored locally using encrypted payloads and secure device storage
- Biometric unlock is optional and gated through device authentication APIs
- Screen capture protection is enabled while the wallet is unlocked
- Device security checks run during app startup
- Custom RPC endpoints must use HTTPS

## Import Support

The key import flow currently supports CSV-style exports from:

- 1Password
- LastPass
- Bitwarden
- Custom CSV files

## Notes for Development

- This repository includes committed `ios/` and `android/` directories, so native development should use `npm run ios` and `npm run android` for the most accurate testing path.
- Features such as biometrics, secure storage, camera-based QR scanning, and screenshot protection should be tested on a simulator or device rather than relying only on the web target.
