import { readFileSync } from 'node:fs';
import { RSABSSA } from '@cloudflare/blindrsa-ts';
import { describe, expect, it } from 'vitest';
import {
  blind,
  bytesToBase64Url,
  base64UrlToBytes,
  bytesToHex,
  finalize,
  hexToBytes,
  importPublicJwk,
  modInverse,
  bytesToBigInt,
  prepare,
  verify,
  voterTagFromPreparedMsg,
  TOKEN_LABEL,
  type PublicKey,
} from '../src/client';

type Vector = Record<'n' | 'e' | 'msg' | 'msg_prefix' | 'prepared_msg' | 'salt' | 'encoded_msg' | 'inv' | 'blinded_msg' | 'blind_sig' | 'sig', string>;
const v = JSON.parse(readFileSync(new URL('./rfc9474-a1.json', import.meta.url), 'utf8')) as Vector;

function vectorKey(): PublicKey {
  return importPublicJwk({
    n: bytesToBase64Url(hexToBytes(v.n)),
    e: bytesToBase64Url(hexToBytes(v.e)),
  });
}

describe('RFC 9474 A.1 (RSABSSA-SHA384-PSS-Randomized)', () => {
  const pk = vectorKey();

  it('prepare prefixes the message with msg_prefix', () => {
    const prepared = prepare(hexToBytes(v.msg), () => hexToBytes(v.msg_prefix));
    expect(bytesToHex(prepared)).toBe(v.prepared_msg);
  });

  it('blind reproduces encoded_msg and blinded_msg', () => {
    const r = modInverse(bytesToBigInt(hexToBytes(v.inv)), pk.n);
    const out = blind(pk, hexToBytes(v.prepared_msg), { salt: hexToBytes(v.salt), r });
    expect(bytesToHex(out.encodedMsg)).toBe(v.encoded_msg);
    expect(bytesToHex(out.blindedMsg)).toBe(v.blinded_msg);
    expect(bytesToHex(out.inv)).toBe(v.inv);
  });

  it('finalize reproduces sig and it verifies', () => {
    const sig = finalize(pk, hexToBytes(v.prepared_msg), hexToBytes(v.blind_sig), hexToBytes(v.inv));
    expect(bytesToHex(sig)).toBe(v.sig);
    expect(verify(pk, hexToBytes(v.prepared_msg), sig)).toBe(true);
  });

  it('rejects a tampered signature or message', () => {
    const sig = hexToBytes(v.sig);
    sig[10] = sig[10]! ^ 1;
    expect(verify(pk, hexToBytes(v.prepared_msg), sig)).toBe(false);
    const msg = hexToBytes(v.prepared_msg);
    msg[0] = msg[0]! ^ 1;
    expect(verify(pk, msg, hexToBytes(v.sig))).toBe(false);
  });

  it('finalize refuses a wrong blind signature', () => {
    const bad = hexToBytes(v.blind_sig);
    bad[5] = bad[5]! ^ 1;
    expect(() => finalize(pk, hexToBytes(v.prepared_msg), bad, hexToBytes(v.inv))).toThrow('Invalid signature');
  });
});

describe('interop with @cloudflare/blindrsa-ts (the server library)', () => {
  const suite = RSABSSA.SHA384.PSS.Randomized();

  async function serverKeys() {
    const { publicKey, privateKey } = await suite.generateKey({
      modulusLength: 2048,
      publicExponent: Uint8Array.from([1, 0, 1]),
    });
    const jwk = (await crypto.subtle.exportKey('jwk', publicKey)) as { n: string; e: string };
    return { publicKey, privateKey, jwk };
  }

  it('pure-JS client token is accepted by the server (legacy flow)', async () => {
    const { publicKey, privateKey, jwk } = await serverKeys();
    const pk = importPublicJwk(jwk);
    const prepared = prepare(TOKEN_LABEL);
    const { blindedMsg, inv } = blind(pk, prepared);
    const blindSig = await suite.blindSign(privateKey, blindedMsg);
    const sig = finalize(pk, prepared, blindSig, inv);
    expect(await suite.verify(publicKey, sig, prepared)).toBe(true);
  }, 30_000);

  it('server-library client token verifies in the pure-JS client', async () => {
    const { publicKey, privateKey, jwk } = await serverKeys();
    const prepared = suite.prepare(TOKEN_LABEL);
    const { blindedMsg, inv } = await suite.blind(publicKey, prepared);
    const blindSig = await suite.blindSign(privateKey, blindedMsg);
    const sig = await suite.finalize(publicKey, prepared, blindSig, inv);
    expect(verify(importPublicJwk(jwk), prepared, sig)).toBe(true);
  }, 30_000);

  it('a token signed by one period key does not verify under another', async () => {
    const a = await serverKeys();
    const b = await serverKeys();
    const pkA = importPublicJwk(a.jwk);
    const prepared = prepare();
    const { blindedMsg, inv } = blind(pkA, prepared);
    const sig = finalize(pkA, prepared, await suite.blindSign(a.privateKey, blindedMsg), inv);
    expect(await suite.verify(b.publicKey, sig, prepared)).toBe(false);
  }, 30_000);

  it('voter tag matches the legacy derivation (hex sha256 of the prepared message)', async () => {
    const prepared = prepare();
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', Uint8Array.from(prepared)));
    expect(voterTagFromPreparedMsg(prepared)).toBe(bytesToHex(digest));
  });
});

describe('base64url (manual, no atob/btoa)', () => {
  it('round-trips every length and matches Node', () => {
    for (let len = 0; len < 70; len++) {
      const bytes = Uint8Array.from({ length: len }, (_, i) => (i * 37 + len) & 0xff);
      const b64 = bytesToBase64Url(bytes);
      expect(b64).toBe(Buffer.from(bytes).toString('base64url'));
      expect(Array.from(base64UrlToBytes(b64))).toEqual(Array.from(bytes));
    }
  });
  it('rejects invalid input', () => {
    expect(() => base64UrlToBytes('a')).toThrow();
    expect(() => base64UrlToBytes('ab$c')).toThrow();
  });
});
