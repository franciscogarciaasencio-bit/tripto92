const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
// Expo SQLite's web worker loads WASM. Native SQLite and its adapter are unchanged.
if (!config.resolver.assetExts.includes('wasm')) config.resolver.assetExts.push('wasm');
// Lossless Brown Noise avoids a codec boundary click in the ambient loop.
if (!config.resolver.assetExts.includes('flac')) config.resolver.assetExts.push('flac');
module.exports = config;
