// Polyfills MUST run before any module that uses crypto-js or Buffer.
// We use require() here because ES import statements are hoisted,
// which would defeat the purpose of running polyfills first.

const { Buffer } = require('buffer');
const ExpoCrypto = require('expo-crypto');

// Buffer polyfill for @hiveio/dhive
(global as any).Buffer = Buffer;

// crypto.getRandomValues polyfill for crypto-js
if (!(global as any).crypto) {
  (global as any).crypto = {};
}
(global as any).crypto.getRandomValues = (array: Uint8Array) => {
  const bytes = ExpoCrypto.getRandomBytes(array.length);
  array.set(bytes);
  return array;
};

// Now it's safe to load the app
const { registerRootComponent } = require('expo');
const { default: App } = require('./App');

registerRootComponent(App);
