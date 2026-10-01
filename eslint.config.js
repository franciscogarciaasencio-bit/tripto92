// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
  },
  {
    // The starter's web hook intentionally updates hydration state after mount.
    files: ["src/hooks/use-color-scheme.web.ts"],
    rules: {
      "react-hooks/set-state-in-effect": "off",
    },
  }
]);
