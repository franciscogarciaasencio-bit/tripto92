import * as SecureStore from 'expo-secure-store';
import { createChunkedSecureStorage } from './secure-storage';

/** Native tokens stay in the platform keychain/keystore. */
export const authStorage = createChunkedSecureStorage({
  getItemAsync: (key) => SecureStore.getItemAsync(key),
  setItemAsync: (key, value) => SecureStore.setItemAsync(key, value, { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK }),
  deleteItemAsync: (key) => SecureStore.deleteItemAsync(key),
});
