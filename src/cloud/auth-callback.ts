export type AuthCallback =
  | { readonly kind: 'code'; readonly code: string }
  | { readonly kind: 'error'; readonly message: string }
  | { readonly kind: 'none' };

/**
 * Read the OAuth redirect (PKCE). Parameters may arrive in the query or the fragment.
 * Tokens in the URL (implicit flow) are deliberately not accepted.
 */
export function parseAuthCallback(url: string): AuthCallback {
  const params = new Map<string, string>();
  const [beforeHash, fragment = ''] = url.split('#', 2);
  const query = beforeHash!.includes('?') ? beforeHash!.slice(beforeHash!.indexOf('?') + 1) : '';
  for (const source of [query, fragment]) {
    for (const pair of source.split('&')) {
      if (!pair) continue;
      const [rawKey, rawValue = ''] = pair.split('=', 2);
      try { params.set(decodeURIComponent(rawKey!.replace(/\+/g, ' ')), decodeURIComponent(rawValue.replace(/\+/g, ' '))); }
      catch { return { kind: 'error', message: 'The sign-in response could not be read' }; }
    }
  }
  const error = params.get('error_description') ?? params.get('error');
  if (error) return { kind: 'error', message: error };
  const code = params.get('code');
  return code ? { kind: 'code', code } : { kind: 'none' };
}
