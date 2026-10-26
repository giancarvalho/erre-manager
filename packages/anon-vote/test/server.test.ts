// Portado de queridometro@7c5c5bf:src/domain/voting/blind-signature.test.ts, com o cliente JS puro (D-011)
// no lugar das funções de cliente do @cloudflare/blindrsa-ts.
import { describe, expect, it } from 'vitest';

import { bytesToBase64Url, finishToken, prepare, startToken } from '../src/client';
import {
  blindSign,
  BLINDED_MESSAGE_BYTES,
  generateSigningKeyPair,
  InvalidBlindedMessage,
  issueToken,
  publicJwk,
  verifyBallot,
  verifyToken,
  voterTag,
  type SigningKeyPair,
} from '../src/server';
import type { SigningKeyRepository, TokenIssuanceRepository } from '../src/repositories';

/** Full client <-> server issuance handshake. */
async function issue(keys: SigningKeyPair) {
  const pub = publicJwk(keys.publicKeyJwk);
  const req = startToken(pub);
  const blindSig = await blindSign(keys.privateKeyJwk, req.blindedMsgB64);
  return { req, ...finishToken(pub, req.preparedMsg, blindSig, req.invB64) };
}

describe('blind signature', () => {
  it('valid token round-trips: issue -> finalize -> verify', async () => {
    const keys = await generateSigningKeyPair();
    const t = await issue(keys);
    expect(await verifyToken(keys.publicKeyJwk, t.preparedMsgB64, t.signatureB64)).toBe(true);
  });

  it('rejeita assinatura adulterada', async () => {
    const keys = await generateSigningKeyPair();
    const t = await issue(keys);
    const tampered = t.signatureB64.slice(0, -4) + (t.signatureB64.slice(-4) === 'AAAA' ? 'BBBB' : 'AAAA');
    expect(await verifyToken(keys.publicKeyJwk, t.preparedMsgB64, tampered)).toBe(false);
  });

  it('rejeita mensagem preparada adulterada (mesma assinatura)', async () => {
    const keys = await generateSigningKeyPair();
    const t = await issue(keys);
    const msg = new Uint8Array(t.req.preparedMsg);
    msg[0] = msg[0]! ^ 0xff;
    expect(await verifyToken(keys.publicKeyJwk, bytesToBase64Url(msg), t.signatureB64)).toBe(false);
  });

  it('rejeita a chave pública de outro par (outra comunidade ou período)', async () => {
    const a = await generateSigningKeyPair();
    const b = await generateSigningKeyPair();
    const t = await issue(a);
    expect(await verifyToken(b.publicKeyJwk, t.preparedMsgB64, t.signatureB64)).toBe(false);
  });

  it('rejeita um token nunca assinado (assinatura forjada)', async () => {
    const keys = await generateSigningKeyPair();
    const fake = bytesToBase64Url(new Uint8Array(256).fill(7));
    expect(await verifyToken(keys.publicKeyJwk, bytesToBase64Url(prepare()), fake)).toBe(false);
  });

  it('entrada malformada dá false, nunca erro (é controlada pelo atacante)', async () => {
    const keys = await generateSigningKeyPair();
    await expect(verifyToken(keys.publicKeyJwk, bytesToBase64Url(prepare()), '!!!not-base64!!!')).resolves.toBe(false);
    await expect(verifyToken(keys.publicKeyJwk, '@@@@', 'AAAA')).resolves.toBe(false);
    await expect(
      verifyToken(
        { kty: 'RSA', n: 'lixo', e: 'AQAB' },
        bytesToBase64Url(prepare()),
        bytesToBase64Url(new Uint8Array(256).fill(1)),
      ),
    ).resolves.toBe(false);
  });

  it('dois prepare() geram mensagens e voter_tags diferentes', () => {
    const a = bytesToBase64Url(prepare());
    const b = bytesToBase64Url(prepare());
    expect(a).not.toBe(b);
    expect(voterTag(a)).not.toBe(voterTag(b));
  });

  it('voter_tag é determinístico, SHA-256 hex, igual no cliente e no servidor', async () => {
    const t = await issue(await generateSigningKeyPair());
    expect(voterTag(t.preparedMsgB64)).toBe(voterTag(t.preparedMsgB64));
    expect(voterTag(t.preparedMsgB64)).toMatch(/^[0-9a-f]{64}$/);
    expect(t.voterTag).toBe(voterTag(t.preparedMsgB64));
  });

  it('o servidor só vê o valor cegado', async () => {
    const keys = await generateSigningKeyPair();
    const req = startToken(publicJwk(keys.publicKeyJwk));
    expect(req.blindedMsgB64).not.toBe(bytesToBase64Url(req.preparedMsg));
    expect(await blindSign(keys.privateKeyJwk, req.blindedMsgB64)).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('recusa valor cegado de tamanho errado ou malformado antes de assinar', async () => {
    const keys = await generateSigningKeyPair();
    await expect(blindSign(keys.privateKeyJwk, bytesToBase64Url(new Uint8Array(10)))).rejects.toBeInstanceOf(
      InvalidBlindedMessage,
    );
    await expect(blindSign(keys.privateKeyJwk, '!!!')).rejects.toBeInstanceOf(InvalidBlindedMessage);
    expect(BLINDED_MESSAGE_BYTES).toBe(256);
  });
});

describe('issuance and ballot flows', () => {
  function memoryRepos() {
    const pairs = new Map<string, SigningKeyPair>();
    const claims = new Set<string>();
    const keys: SigningKeyRepository = {
      async getOrCreateKeyPair(period) {
        if (!pairs.has(period)) pairs.set(period, await generateSigningKeyPair());
        return pairs.get(period)!;
      },
      async getPublicKey(period) {
        return pairs.get(period)?.publicKeyJwk ?? null;
      },
    };
    const issuances: TokenIssuanceRepository = {
      async tryClaimIssuance(userId, period) {
        const k = `${userId}|${period}`;
        if (claims.has(k)) return false;
        claims.add(k);
        return true;
      },
    };
    return { keys, issuances };
  }

  it('one token per person and period; the ballot verifies only for its period', async () => {
    const repos = memoryRepos();
    const pub = publicJwk((await repos.keys.getOrCreateKeyPair('r1')).publicKeyJwk);
    const req = startToken(pub);
    const first = await issueToken(repos, { userId: 'ana', period: 'r1', blindedMsgB64: req.blindedMsgB64 });
    expect(first.ok).toBe(true);
    const again = await issueToken(repos, {
      userId: 'ana',
      period: 'r1',
      blindedMsgB64: startToken(pub).blindedMsgB64,
    });
    expect(again).toEqual({ ok: false, reason: 'ALREADY_ISSUED' });

    const t = finishToken(pub, req.preparedMsg, (first as { blindSignatureB64: string }).blindSignatureB64, req.invB64);
    expect(await verifyBallot(repos, { period: 'r1', ...t })).toBe(t.voterTag);
    await repos.keys.getOrCreateKeyPair('r2');
    expect(await verifyBallot(repos, { period: 'r2', ...t })).toBeNull();
    expect(await verifyBallot(repos, { period: 'nunca', ...t })).toBeNull();
  });

  it("an invalid blinded message does not spend the person's issuance", async () => {
    const repos = memoryRepos();
    expect(await issueToken(repos, { userId: 'bia', period: 'r1', blindedMsgB64: 'AAAA' })).toEqual({
      ok: false,
      reason: 'INVALID_BLINDED_MESSAGE',
    });
    // Right size, but not below the modulus: signing would fail after the claim.
    const tooBig = bytesToBase64Url(new Uint8Array(BLINDED_MESSAGE_BYTES).fill(0xff));
    expect(await issueToken(repos, { userId: 'bia', period: 'r1', blindedMsgB64: tooBig })).toEqual({
      ok: false,
      reason: 'INVALID_BLINDED_MESSAGE',
    });
    const pub = publicJwk((await repos.keys.getOrCreateKeyPair('r1')).publicKeyJwk);
    expect(
      (await issueToken(repos, { userId: 'bia', period: 'r1', blindedMsgB64: startToken(pub).blindedMsgB64 })).ok,
    ).toBe(true);
  });
});
