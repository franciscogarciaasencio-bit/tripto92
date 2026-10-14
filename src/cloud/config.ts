/** Public Supabase settings. Both values are designed to ship in apps; no secret belongs here. */
export interface CloudConfig {
  readonly url: string;
  readonly publishableKey: string;
}

/**
 * Cloud features stay hidden unless both public values are present and well formed.
 * Guest use never depends on them.
 */
export function parseCloudConfig(env: { readonly url?: string; readonly publishableKey?: string }): CloudConfig | null {
  const url = env.url?.trim().replace(/\/+$/, '');
  const publishableKey = env.publishableKey?.trim();
  if (!url || !publishableKey) return null;
  // Origin only: scheme://host[:port], no path, query, fragment or credentials.
  const match = /^(https?):\/\/([A-Za-z0-9.-]+)(:\d{1,5})?$/.exec(url);
  if (!match) return null;
  const [, protocol, host, port = ''] = match;
  const local = host === 'localhost' || host === '127.0.0.1';
  if (protocol !== 'https' && !local) return null;
  // Service-role/secret keys bypass row-level security and must never ship in an app.
  if (/^sb_secret_/.test(publishableKey) || /service_role/.test(decodeJwtRole(publishableKey) ?? '')) return null;
  return { url: `${protocol}://${host!.toLowerCase()}${port}`, publishableKey };
}

function decodeJwtRole(token: string): string | null {
  const payload = token.split('.')[1];
  if (!payload) return null;
  try {
    const role = (JSON.parse(base64UrlDecode(payload)) as { role?: unknown }).role;
    return typeof role === 'string' ? role : null;
  } catch { return null; }
}

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
/** ASCII base64url decoding for JWT claims, without platform globals. */
function base64UrlDecode(input: string): string {
  let bits = 0, value = 0, output = '';
  for (const character of input.replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')) {
    const index = ALPHABET.indexOf(character);
    if (index < 0) throw new Error('Invalid base64');
    value = (value << 6) | index; bits += 6;
    if (bits >= 8) { bits -= 8; output += String.fromCharCode((value >> bits) & 0xff); }
  }
  return output;
}
