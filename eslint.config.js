// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    // server/ is a separate Vercel project (plain Node, not Expo).
    ignores: ['dist/*', 'server/**'],
  },
]);
