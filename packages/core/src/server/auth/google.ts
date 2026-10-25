import type { GoogleProfile } from 'better-auth/social-providers';

const GOOGLE_ISSUERS = new Set(['https://accounts.google.com', 'accounts.google.com']);

type TokenSet = { idToken?: string | undefined };

/** Payload of a JWT, without signature verification (see below for why that is acceptable here). */
export function decodeJwtPayload(jwt: string): Record<string, unknown> {
  const part = jwt.split('.')[1];
  if (!part) throw new Error('malformed JWT');
  return JSON.parse(Buffer.from(part, 'base64url').toString('utf8')) as Record<string, unknown>;
}

/**
 * User info for the authorization-code flow. Better Auth decodes the ID token returned by Google's
 * token endpoint without checking claims (the TLS response is trusted, OIDC Core §3.1.3.7). We also
 * check issuer, audience and expiry, so a token minted for another client is never accepted.
 */
export function verifiedGoogleUserInfo(clientId: string, now: () => number = Date.now) {
  return async (token: TokenSet) => {
    if (!token.idToken) return null;
    let claims: Record<string, unknown>;
    try {
      claims = decodeJwtPayload(token.idToken);
    } catch {
      return null;
    }
    const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (!GOOGLE_ISSUERS.has(String(claims.iss)) || !aud.includes(clientId)) return null;
    if (typeof claims.exp !== 'number' || claims.exp * 1000 < now()) return null;
    if (typeof claims.sub !== 'string' || typeof claims.email !== 'string') return null;
    return {
      user: {
        name: typeof claims.name === 'string' ? claims.name : '',
        email: claims.email,
        image: typeof claims.picture === 'string' ? claims.picture : undefined,
        emailVerified: claims.email_verified === true,
      },
      // Validated above: iss, aud, exp, sub and email. Better Auth reads `sub` as the account id.
      data: claims as unknown as GoogleProfile,
    };
  };
}
