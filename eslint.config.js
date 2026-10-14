// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/**", ".expo/**"],
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/data/database/database.ts"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [{ group: ["expo-sqlite", "expo-sqlite/*"], message: "Use the repository API; only the database adapter imports Expo SQLite." }],
      }],
    },
  },
  {
    // Domain rules must stay portable and cannot depend on UI, storage or device APIs.
    files: ["src/domain/**/*.ts"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [{ group: ["react", "react/*", "react-dom", "react-dom/*", "react-native", "react-native-*", "expo", "expo-*", "@expo/*", "@/data", "@/data/*", "@/application/*", "@/ui/*", "**/data/**", "**/application/**", "**/ui/**", "**/audio/**"], message: "Keep the domain independent of presentation, persistence and device services." }],
      }],
    },
  }
]);
