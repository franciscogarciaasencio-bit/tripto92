import config from './app.json';
import theme from './src/ui/theme.json';

/** The native splash/root and rendered surfaces use the same source token. */
export default {
  ...config.expo, backgroundColor: theme.background,
  android: { ...config.expo.android, adaptiveIcon: { ...config.expo.android.adaptiveIcon, backgroundColor: theme.background } },
  plugins: config.expo.plugins.map((plugin) => Array.isArray(plugin) && plugin[0] === 'expo-splash-screen'
    ? [plugin[0], { backgroundColor: theme.background }] : plugin),
};
