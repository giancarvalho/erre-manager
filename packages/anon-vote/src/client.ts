// Portado de queridometro@7c5c5bf:src/domain/voting/blind-signature.ts (parte do cliente), reescrito em JS
// puro no protótipo do Sprint 2 (prototypes/anon-vote) para rodar no Hermes (D-011).
// Client side of RFC 9474 (RSABSSA-SHA384-PSS-Randomized) in pure JS.
// No WebCrypto: runs on Hermes (React Native), browsers and Node alike.
// Interoperates with @cloudflare/blindrsa-ts on the server.
import { sha256, sha384 } from '@noble/hashes/sha2.js';

export type RandomBytes = (length: number) => Uint8Array;

export type RsaPublicJwk = { kty: 'RSA'; n: string; e: string };

const HASH_LEN = 48; // SHA-384
const SALT_LEN = 48; // RSABSSA-SHA384-PSS: sLen = hLen
const PREFIX_LEN = 32; // Randomized preparation: 32-byte msg_prefix

/** Same label the legacy app signs (legado:src/domain/voting/blind-signature.ts:16). */
export const TOKEN_LABEL = asciiBytes('karmometro-vote-token-v1');

function asciiBytes(text: string): Uint8Array {
  const out = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) out[i] = text.charCodeAt(i) & 0x7f;
  return out;
}

export function defaultRandomBytes(length: number): Uint8Array {
  const out = new Uint8Array(length);
  const c = (globalThis as { crypto?: { getRandomValues?: (a: Uint8Array) => Uint8Array } }).crypto;
  if (!c?.getRandomValues) {
    throw new Error('No secure random source: pass randomBytes explicitly (expo-crypto on React Native).');
  }
  c.getRandomValues(out);
  return out;
}

// ---------- byte and bigint helpers ----------

// Manual base64url: Hermes has no atob/btoa/TextEncoder of its own.
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const B64_INDEX: Record<string, number> = {};
for (let i = 0; i < B64.length; i++) B64_INDEX[B64[i]!] = i;
B64_INDEX['+'] = 62;
B64_INDEX['/'] = 63;

export function base64UrlToBytes(b64url: string): Uint8Array {
  const clean = b64url.replace(/=+$/, '');
  if (clean.length % 4 === 1) throw new Error('Invalid base64url');
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let buffer = 0;
  let bits = 0;
  let o = 0;
  for (const ch of clean) {
    const v = B64_INDEX[ch];
    if (v === undefined) throw new Error('Invalid base64url');
    buffer = (buffer << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[o++] = (buffer >> bits) & 0xff;
    }
  }
  return out;
}

export function bytesToBase64Url(bytes: Uint8Array): string {
  let out = '';
  let i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    const n = (bytes[i]! << 16) | (bytes[i + 1]! << 8) | bytes[i + 2]!;
    out += B64[(n >> 18) & 63]! + B64[(n >> 12) & 63]! + B64[(n >> 6) & 63]! + B64[n & 63]!;
  }
  const rest = bytes.length - i;
  if (rest === 1) {
    const n = bytes[i]! << 16;
    out += B64[(n >> 18) & 63]! + B64[(n >> 12) & 63]!;
  } else if (rest === 2) {
    const n = (bytes[i]! << 16) | (bytes[i + 1]! << 8);
    out += B64[(n >> 18) & 63]! + B64[(n >> 12) & 63]! + B64[(n >> 6) & 63]!;
  }
  return out;
}

export function bytesToHex(bytes: Uint8Array): string {
  let out = '';
  for (const b of bytes) out += b.toString(16).padStart(2, '0');
  return out;
}

export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/\s+/g, '');
  if (clean.length % 2 !== 0) throw new Error('Odd-length hex');
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export function bytesToBigInt(bytes: Uint8Array): bigint {
  let hex = '';
  for (const b of bytes) hex += b.toString(16).padStart(2, '0');
  return hex.length === 0 ? 0n : BigInt('0x' + hex);
}

export function bigIntToBytes(value: bigint, length: number): Uint8Array {
  if (value < 0n) throw new Error('Negative integer');
  let hex = value.toString(16);
  if (hex.length % 2) hex = '0' + hex;
  if (hex.length / 2 > length) throw new Error('Integer too large');
  const out = new Uint8Array(length);
  const raw = hexToBytes(hex);
  out.set(raw, length - raw.length);
  return out;
}

function bitLength(n: bigint): number {
  return n.toString(2).length;
}

export function modPow(base: bigint, exponent: bigint, modulus: bigint): bigint {
  if (modulus === 1n) return 0n;
  let result = 1n;
  let b = base % modulus;
  let e = exponent;
  while (e > 0n) {
    if (e & 1n) result = (result * b) % modulus;
    e >>= 1n;
    b = (b * b) % modulus;
  }
  return result;
}

function gcd(a: bigint, b: bigint): bigint {
  while (b !== 0n) [a, b] = [b, a % b];
  return a;
}

export function modInverse(a: bigint, modulus: bigint): bigint {
  let [oldR, r] = [a % modulus, modulus];
  let [oldS, s] = [1n, 0n];
  while (r !== 0n) {
    const q = oldR / r;
    [oldR, r] = [r, oldR - q * r];
    [oldS, s] = [s, oldS - q * s];
  }
  if (oldR !== 1n) throw new Error('Not invertible');
  return ((oldS % modulus) + modulus) % modulus;
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}

function equalBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!;
  return diff === 0;
}

// ---------- RSA public key ----------

export type PublicKey = { n: bigint; e: bigint; modulusBytes: number; modulusBits: number };

export function importPublicJwk(jwk: RsaPublicJwk | { n?: string; e?: string }): PublicKey {
  if (!jwk.n || !jwk.e) throw new Error('Invalid RSA public JWK');
  const n = bytesToBigInt(base64UrlToBytes(jwk.n));
  const e = bytesToBigInt(base64UrlToBytes(jwk.e));
  const modulusBits = bitLength(n);
  return { n, e, modulusBits, modulusBytes: Math.ceil(modulusBits / 8) };
}

// ---------- EMSA-PSS (RFC 8017 §9.1) with MGF1-SHA384 ----------

function mgf1(seed: Uint8Array, maskLen: number): Uint8Array {
  const out = new Uint8Array(maskLen);
  let filled = 0;
  for (let counter = 0; filled < maskLen; counter++) {
    const c = new Uint8Array([
      (counter >>> 24) & 0xff,
      (counter >>> 16) & 0xff,
      (counter >>> 8) & 0xff,
      counter & 0xff,
    ]);
    const block = sha384(concat(seed, c));
    const take = Math.min(block.length, maskLen - filled);
    out.set(block.subarray(0, take), filled);
    filled += take;
  }
  return out;
}

export function emsaPssEncode(msg: Uint8Array, emBits: number, salt: Uint8Array): Uint8Array {
  const emLen = Math.ceil(emBits / 8);
  if (emLen < HASH_LEN + salt.length + 2) throw new Error('Encoding error');
  const mHash = sha384(msg);
  const mPrime = concat(new Uint8Array(8), mHash, salt);
  const h = sha384(mPrime);
  const ps = new Uint8Array(emLen - salt.length - HASH_LEN - 2);
  const db = concat(ps, new Uint8Array([0x01]), salt);
  const dbMask = mgf1(h, emLen - HASH_LEN - 1);
  const maskedDb = new Uint8Array(db.length);
  for (let i = 0; i < db.length; i++) maskedDb[i] = db[i]! ^ dbMask[i]!;
  const zeroBits = 8 * emLen - emBits;
  maskedDb[0] = maskedDb[0]! & (0xff >>> zeroBits);
  return concat(maskedDb, h, new Uint8Array([0xbc]));
}

export function emsaPssVerify(msg: Uint8Array, em: Uint8Array, emBits: number): boolean {
  const emLen = Math.ceil(emBits / 8);
  if (em.length !== emLen || emLen < HASH_LEN + SALT_LEN + 2) return false;
  if (em[emLen - 1] !== 0xbc) return false;
  const maskedDb = em.subarray(0, emLen - HASH_LEN - 1);
  const h = em.subarray(emLen - HASH_LEN - 1, emLen - 1);
  const zeroBits = 8 * emLen - emBits;
  if ((maskedDb[0]! & ~(0xff >>> zeroBits) & 0xff) !== 0) return false;
  const dbMask = mgf1(h, emLen - HASH_LEN - 1);
  const db = new Uint8Array(maskedDb.length);
  for (let i = 0; i < db.length; i++) db[i] = maskedDb[i]! ^ dbMask[i]!;
  db[0] = db[0]! & (0xff >>> zeroBits);
  const psLen = emLen - HASH_LEN - SALT_LEN - 2;
  for (let i = 0; i < psLen; i++) if (db[i] !== 0) return false;
  if (db[psLen] !== 0x01) return false;
  const salt = db.subarray(db.length - SALT_LEN);
  const hPrime = sha384(concat(new Uint8Array(8), sha384(msg), salt));
  return equalBytes(h, hPrime);
}

// ---------- RFC 9474 client operations ----------

/** Randomized preparation: 32 random bytes prefixed to the message. */
export function prepare(msg: Uint8Array = TOKEN_LABEL, randomBytes: RandomBytes = defaultRandomBytes): Uint8Array {
  return concat(randomBytes(PREFIX_LEN), msg);
}

function randomIntegerUniform(min: bigint, max: bigint, randomBytes: RandomBytes): bigint {
  // Uniform in [min, max) by rejection sampling over bitLength(max) bits.
  const bits = bitLength(max);
  const bytes = Math.ceil(bits / 8);
  const excess = BigInt(bytes * 8 - bits);
  for (let attempt = 0; attempt < 1000; attempt++) {
    const candidate = bytesToBigInt(randomBytes(bytes)) >> excess;
    if (candidate >= min && candidate < max) return candidate;
  }
  throw new Error('Could not sample a random integer');
}

export type BlindOptions = {
  randomBytes?: RandomBytes;
  /** Test only: fixed salt (48 bytes). */
  salt?: Uint8Array;
  /** Test only: fixed blinding factor r. */
  r?: bigint;
};

export type BlindResult = { blindedMsg: Uint8Array; inv: Uint8Array; encodedMsg: Uint8Array };

export function blind(pk: PublicKey, preparedMsg: Uint8Array, options: BlindOptions = {}): BlindResult {
  const randomBytes = options.randomBytes ?? defaultRandomBytes;
  const salt = options.salt ?? randomBytes(SALT_LEN);
  const encodedMsg = emsaPssEncode(preparedMsg, pk.modulusBits - 1, salt);
  const m = bytesToBigInt(encodedMsg);
  if (gcd(m, pk.n) !== 1n) throw new Error('Invalid input');
  for (let attempt = 0; attempt < 100; attempt++) {
    const r = options.r ?? randomIntegerUniform(1n, pk.n, randomBytes);
    let inv: bigint;
    try {
      inv = modInverse(r, pk.n);
    } catch {
      if (options.r !== undefined) throw new Error('Invalid blinding factor');
      continue;
    }
    const x = modPow(r, pk.e, pk.n);
    const z = (m * x) % pk.n;
    return {
      blindedMsg: bigIntToBytes(z, pk.modulusBytes),
      inv: bigIntToBytes(inv, pk.modulusBytes),
      encodedMsg,
    };
  }
  throw new Error('Could not find an invertible blinding factor');
}

export function verify(pk: PublicKey, msg: Uint8Array, signature: Uint8Array): boolean {
  if (signature.length !== pk.modulusBytes) return false;
  const s = bytesToBigInt(signature);
  if (s >= pk.n) return false;
  const m = modPow(s, pk.e, pk.n);
  const emBits = pk.modulusBits - 1;
  const emLen = Math.ceil(emBits / 8);
  let em: Uint8Array;
  try {
    em = bigIntToBytes(m, emLen);
  } catch {
    return false;
  }
  return emsaPssVerify(msg, em, emBits);
}

export function finalize(pk: PublicKey, preparedMsg: Uint8Array, blindSig: Uint8Array, inv: Uint8Array): Uint8Array {
  if (blindSig.length !== pk.modulusBytes) throw new Error('Unexpected input size');
  const z = bytesToBigInt(blindSig);
  const s = (z * bytesToBigInt(inv)) % pk.n;
  const sig = bigIntToBytes(s, pk.modulusBytes);
  if (!verify(pk, preparedMsg, sig)) throw new Error('Invalid signature');
  return sig;
}

/** Opaque, unlinkable tag stored with the votes (legado:src/domain/voting/blind-signature.ts:154-163). */
export function voterTagFromPreparedMsg(preparedMsg: Uint8Array): string {
  return bytesToHex(sha256(preparedMsg));
}

// ---------- token flow (what the app calls) ----------

export type IssuanceRequest = { preparedMsg: Uint8Array; blindedMsgB64: string; invB64: string };

/** Step 1–2: prepare a fresh token and blind it with the period's public key. Keep `preparedMsg` and `invB64`. */
export function startToken(
  publicKeyJwk: RsaPublicJwk | { n?: string; e?: string },
  randomBytes: RandomBytes = defaultRandomBytes,
): IssuanceRequest {
  const pk = importPublicJwk(publicKeyJwk);
  const preparedMsg = prepare(TOKEN_LABEL, randomBytes);
  const { blindedMsg, inv } = blind(pk, preparedMsg, { randomBytes });
  return { preparedMsg, blindedMsgB64: bytesToBase64Url(blindedMsg), invB64: bytesToBase64Url(inv) };
}

/** Step 3: unblind the server's signature. Throws if it doesn't verify against the period's key. */
export function finishToken(
  publicKeyJwk: RsaPublicJwk | { n?: string; e?: string },
  preparedMsg: Uint8Array,
  blindSignatureB64: string,
  invB64: string,
): { preparedMsgB64: string; signatureB64: string; voterTag: string } {
  const pk = importPublicJwk(publicKeyJwk);
  const sig = finalize(pk, preparedMsg, base64UrlToBytes(blindSignatureB64), base64UrlToBytes(invB64));
  return {
    preparedMsgB64: bytesToBase64Url(preparedMsg),
    signatureB64: bytesToBase64Url(sig),
    voterTag: voterTagFromPreparedMsg(preparedMsg),
  };
}
