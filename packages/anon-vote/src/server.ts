// Portado de queridometro@7c5c5bf:src/domain/voting/blind-signature.ts (parte do servidor).
// RFC 9474 blind RSA signatures (RSABSSA-SHA384-PSS-Randomized) on @cloudflare/blindrsa-ts + WebCrypto (Node).
// The server certifies "an eligible member who hasn't voted yet" without learning which one: a stored vote's
// voter_tag can't be traced back to a person even with full database access.
import { createHash, webcrypto } from 'node:crypto';

import { RSABSSA } from '@cloudflare/blindrsa-ts';

import { base64UrlToBytes, bytesToBase64Url } from './client';
import type { SigningKeyRepository, TokenIssuanceRepository } from './repositories';

const MODULUS_LENGTH = 2048;
const PUBLIC_EXPONENT = Uint8Array.from([1, 0, 1]);
const IMPORT = { name: 'RSA-PSS', hash: 'SHA-384' } as const;

/** A well-formed blinded message (and blind signature) is exactly the modulus size in bytes. */
export const BLINDED_MESSAGE_BYTES = MODULUS_LENGTH / 8;

export type SigningKeyPair = { publicKeyJwk: JsonWebKey; privateKeyJwk: JsonWebKey };

const suite = () => RSABSSA.SHA384.PSS.Randomized();
const subtle = webcrypto.subtle as unknown as SubtleCrypto;

/** One fresh key pair per (community, period) — the module generates and stores it. */
export async function generateSigningKeyPair(): Promise<SigningKeyPair> {
  const { publicKey, privateKey } = await suite().generateKey({
    modulusLength: MODULUS_LENGTH,
    publicExponent: PUBLIC_EXPONENT,
  });
  const [publicKeyJwk, privateKeyJwk] = await Promise.all([
    subtle.exportKey('jwk', publicKey),
    subtle.exportKey('jwk', privateKey),
  ]);
  return { publicKeyJwk, privateKeyJwk };
}

/** Only the public parts of the key (what the client receives). */
export function publicJwk(jwk: JsonWebKey): { kty: 'RSA'; n: string; e: string } {
  if (jwk.kty !== 'RSA' || !jwk.n || !jwk.e) throw new Error('not an RSA public key');
  return { kty: 'RSA', n: jwk.n, e: jwk.e };
}

export class InvalidBlindedMessage extends Error {
  override name = 'InvalidBlindedMessage';
}

/** Issuance: signs the blinded value without ever seeing the prepared message. Validates the input size first. */
export async function blindSign(privateKeyJwk: JsonWebKey, blindedMsgB64: string): Promise<string> {
  let blinded: Uint8Array;
  try {
    blinded = base64UrlToBytes(blindedMsgB64);
  } catch {
    throw new InvalidBlindedMessage('malformed base64url');
  }
  if (blinded.length !== BLINDED_MESSAGE_BYTES) throw new InvalidBlindedMessage('unexpected size');
  const key = await subtle.importKey('jwk', privateKeyJwk, IMPORT, true, ['sign']);
  return bytesToBase64Url(await suite().blindSign(key, blinded));
}

/**
 * At vote time: the token traces back to a signature of this (community, period)'s key, without revealing to
 * whom. Inputs are attacker-controlled: anything malformed is `false`, never a thrown error.
 */
export async function verifyToken(
  publicKeyJwk: JsonWebKey,
  preparedMsgB64: string,
  signatureB64: string,
): Promise<boolean> {
  try {
    const key = await subtle.importKey('jwk', publicKeyJwk, IMPORT, true, ['verify']);
    return await suite().verify(key, base64UrlToBytes(signatureB64), base64UrlToBytes(preparedMsgB64));
  } catch {
    return false;
  }
}

/** The opaque, unlinkable value stored as voter_tag: hex SHA-256 of the prepared message (same as the client). */
export function voterTag(preparedMsgB64: string): string {
  return createHash('sha256').update(base64UrlToBytes(preparedMsgB64)).digest('hex');
}

export { base64UrlToBytes, bytesToBase64Url };

// ---------- flows shared by the modules ----------

export type IssueResult =
  { ok: true; blindSignatureB64: string } | { ok: false; reason: 'ALREADY_ISSUED' | 'INVALID_BLINDED_MESSAGE' };

/**
 * Token issuance (authenticated route): validate the blinded message, claim the person's single issuance for
 * the period, then blind-sign. Run it in the module's community transaction: if signing fails, the claim
 * rolls back with it.
 */
export async function issueToken(
  deps: { keys: SigningKeyRepository; issuances: TokenIssuanceRepository },
  input: { userId: string; period: string; blindedMsgB64: string },
): Promise<IssueResult> {
  let size = 0;
  try {
    size = base64UrlToBytes(input.blindedMsgB64).length;
  } catch {
    return { ok: false, reason: 'INVALID_BLINDED_MESSAGE' };
  }
  if (size !== BLINDED_MESSAGE_BYTES) return { ok: false, reason: 'INVALID_BLINDED_MESSAGE' };
  const { privateKeyJwk } = await deps.keys.getOrCreateKeyPair(input.period);
  if (!(await deps.issuances.tryClaimIssuance(input.userId, input.period)))
    return { ok: false, reason: 'ALREADY_ISSUED' };
  return { ok: true, blindSignatureB64: await blindSign(privateKeyJwk, input.blindedMsgB64) };
}

/**
 * Ballot check (anonymous route): the token must verify against THIS community's key for the period — a token
 * from another community or period fails here (ARQUITETURA §4.5). Returns the voter_tag, or null.
 */
export async function verifyBallot(
  deps: { keys: SigningKeyRepository },
  input: { period: string; preparedMsgB64: string; signatureB64: string },
): Promise<string | null> {
  const publicKey = await deps.keys.getPublicKey(input.period);
  if (!publicKey) return null;
  if (!(await verifyToken(publicKey, input.preparedMsgB64, input.signatureB64))) return null;
  return voterTag(input.preparedMsgB64);
}
