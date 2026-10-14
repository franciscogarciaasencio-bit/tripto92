/** Minimal key/value backend, implemented by expo-secure-store in the app and by a Map in tests. */
export interface SecureBackend {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
}

const CHUNK = 1800; // Below the 2048-byte guidance for a single secure-store value.
const safeKey = (key: string) => key.replace(/[^A-Za-z0-9._-]/g, '_');

/**
 * Storage for the auth session (tokens) in the platform keychain/keystore. Large values are split
 * into chunks; the chunk count is written last, so a crash mid-write leaves the previous value
 * readable or nothing, never a truncated token.
 */
export function createChunkedSecureStorage(backend: SecureBackend) {
  // Keystore values restored onto another device (Android Auto Backup) cannot be decrypted.
  // Treat unreadable values as absent: the person simply signs in again.
  const read = async (key: string) => { try { return await backend.getItemAsync(key); } catch { return null; } };
  async function count(key: string) {
    const raw = await read(`${key}.n`);
    const n = raw === null ? 0 : Number(raw);
    return Number.isSafeInteger(n) && n >= 0 && n <= 64 ? n : 0;
  }
  return {
    async getItem(name: string): Promise<string | null> {
      const key = safeKey(name);
      const n = await count(key);
      if (n === 0) return null;
      const parts: string[] = [];
      for (let i = 0; i < n; i++) {
        const part = await read(`${key}.${i}`);
        if (part === null) return null;
        parts.push(part);
      }
      return parts.join('');
    },
    async setItem(name: string, value: string): Promise<void> {
      const key = safeKey(name);
      const previous = await count(key);
      const parts = Math.max(1, Math.ceil(value.length / CHUNK));
      if (parts > 64) throw new Error('Secure value is too large');
      await backend.deleteItemAsync(`${key}.n`);
      for (let i = 0; i < parts; i++) await backend.setItemAsync(`${key}.${i}`, value.slice(i * CHUNK, (i + 1) * CHUNK));
      for (let i = parts; i < previous; i++) await backend.deleteItemAsync(`${key}.${i}`);
      await backend.setItemAsync(`${key}.n`, String(parts));
    },
    async removeItem(name: string): Promise<void> {
      const key = safeKey(name);
      const n = await count(key);
      await backend.deleteItemAsync(`${key}.n`);
      for (let i = 0; i < Math.max(n, 1); i++) await backend.deleteItemAsync(`${key}.${i}`);
    },
  };
}
