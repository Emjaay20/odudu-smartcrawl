// Odudu's access tokens are JWTs. The app reads `exp` only to show it; the API
// that receives the token is the one that verifies it. A token that is not a
// JWT, or has no usable `exp`, gives no time rather than an error.
export function expiryOf(accessToken: string): Date | undefined {
  try {
    const payload = accessToken.split('.')[1] ?? '';
    const claims: unknown = JSON.parse(atob(payload.replace(/-/gu, '+').replace(/_/gu, '/')));
    if (typeof claims !== 'object' || claims === null || !('exp' in claims)) return undefined;
    const seconds = typeof claims.exp === 'number' ? claims.exp : Number.NaN;
    const date = new Date(seconds * 1000);
    return seconds > 0 && !Number.isNaN(date.getTime()) ? date : undefined;
  } catch {
    return undefined;
  }
}
