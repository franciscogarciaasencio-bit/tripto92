const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
// Expo SQLite's web worker loads WASM. Native SQLite and its adapter are unchanged.
if (!config.resolver.assetExts.includes('wasm')) config.resolver.assetExts.push('wasm');
module.exports = config;
