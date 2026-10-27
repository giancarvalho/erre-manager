// Request limits of the module runtime (Sprint 19) on the Errômetro: token issuance per person, anonymous ballots
// per community (never per IP).
import { createModuleHarness, type RoleFixture } from '@erre/core/testing';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';

import moduleApi from '../../api';
import { helpers } from './helpers';

const h = createModuleHarness({
  urls: inject('db'),
  modules: [moduleApi],
  rateLimits: { token: { windowMs: 60_000, max: 1 }, anon: { windowMs: 60_000, max: 2 } },
});
const t = helpers(h, inject('db').admin);

let fx: RoleFixture;
beforeAll(async () => {
  fx = await h.fixture();
});
afterAll(() => h.close());

describe('rate limits', () => {
  it('token issuance: one per window per person, then 429 RATE_LIMITED with Retry-After', async () => {
    const ana = await t.newVoter(fx, 'Ana');
    await t.getToken(fx, ana);
    const res = await t.call(ana, 'POST', '/token', fx.communityId, { blindedMsgB64: 'AAAA' });
    expect(res.status).toBe(429);
    expect(Number(res.headers.get('retry-after'))).toBeGreaterThan(0);
    expect(((await res.json()) as { code: string }).code).toBe('RATE_LIMITED');
    // Another person is not affected.
    const bia = await t.newVoter(fx, 'Bia');
    await t.getToken(fx, bia);
  });

  it('anonymous routes: limited per community, whatever the sender says about itself', async () => {
    const other = await h.fixture();
    const tag = { voterTag: 'a'.repeat(64) };
    const myVotes = (communityId: string, ip: string) =>
      h.req(null, 'POST', `/v1/errometro/anon/c/${communityId}/meus-votos`, {
        body: tag,
        headers: { 'x-forwarded-for': ip },
      });
    expect((await myVotes(fx.communityId, '203.0.113.1')).status).toBe(200);
    expect((await myVotes(fx.communityId, '203.0.113.2')).status).toBe(200);
    expect((await myVotes(fx.communityId, '203.0.113.3')).status).toBe(429);
    expect((await myVotes(other.communityId, '203.0.113.3')).status).toBe(200);
  });
});
