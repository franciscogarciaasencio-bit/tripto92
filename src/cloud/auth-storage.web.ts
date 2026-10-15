/** Browser-only persistence. Never selected by the native bundler. */
export const authStorage = {
  async getItem(key: string): Promise<string | null> {
    return typeof window === 'undefined' ? null : window.localStorage.getItem(key);
  },
  async setItem(key: string, value: string): Promise<void> {
    window.localStorage.setItem(key, value);
  },
  async removeItem(key: string): Promise<void> {
    window.localStorage.removeItem(key);
  },
};
