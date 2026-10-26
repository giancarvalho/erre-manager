// Ported in behavior from queridometro@7c5c5bf:src/app/actions/group-release-config.test.ts and
// src/app/actions/group-emoji-config.test.ts.
import { createModuleHarness, type RoleFixture } from '@erre/core/testing';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';

import moduleApi from '../../api';
import { helpers } from './helpers';

const h = createModuleHarness({ urls: inject('db'), modules: [moduleApi] });
const t = helpers(h, inject('db').admin);
let fx: RoleFixture;

type Cadence = { config: Record<string, unknown>; isDefault: boolean; description: string };
type Saved = Cadence & { roundClosedEarly: boolean };

beforeAll(async () => {
  fx = await h.fixture();
});
afterAll(() => h.close());

const put = (config: unknown, c = fx) => t.call(c.users.owner, 'PUT', '/config/cadencia', c.communityId, { config });
const snapshots = async (c: RoleFixture) =>
  Number(
    (
      await t.admin<{ n: string }>('SELECT count(*) AS n FROM errometro_snapshots WHERE community_id = $1', [
        c.communityId,
      ])
    )[0]!.n,
  );

describe('release cadence', () => {
  it('without a saved config: weekly, Monday at noon (R-CAL-04)', async () => {
    expect(await t.json<Cadence>(t.call(fx.users.owner, 'GET', '/config/cadencia', fx.communityId))).toEqual({
      config: { frequency: 'weekly', releaseHour: 12, releaseWeekday: 1 },
      isDefault: true,
      description: 'Toda segunda às 12h',
    });
  });

  it('saving the same cadence as the current one does not close the round', async () => {
    const res = await t.json<Saved>(put({ frequency: 'weekly', releaseHour: 12, releaseWeekday: 1 }));
    expect(res.roundClosedEarly).toBe(false);
    expect(res.isDefault).toBe(false);
    expect(await snapshots(fx)).toBe(0);
  });

  it('a legacy weekly config moving to custom for the first time closes the round', async () => {
    const res = await t.json<Saved>(put({ frequency: 'custom', releaseHour: 18, releaseWeekdays: [5, 2] }));
    expect(res).toMatchObject({ roundClosedEarly: true, description: 'Toda terça e sexta às 18h' });
    expect(await snapshots(fx)).toBe(1);
  });

  it('custom with the same days in another order does not close the round', async () => {
    expect(
      (await t.json<Saved>(put({ frequency: 'custom', releaseHour: 18, releaseWeekdays: [2, 5] }))).roundClosedEarly,
    ).toBe(false);
    expect(await snapshots(fx)).toBe(1);
  });

  it('custom with different days closes the round', async () => {
    expect(
      (await t.json<Saved>(put({ frequency: 'custom', releaseHour: 18, releaseWeekdays: [3] }))).roundClosedEarly,
    ).toBe(true);
  });

  it('refuses invalid configs: weekly without weekday, hour out of 0-23, custom empty or repeated', async () => {
    for (const bad of [
      { frequency: 'weekly', releaseHour: 12 },
      { frequency: 'daily', releaseHour: 24 },
      { frequency: 'custom', releaseHour: 9, releaseWeekdays: [] },
      { frequency: 'custom', releaseHour: 9, releaseWeekdays: [2, 2] },
      { frequency: 'custom', releaseHour: 9, releaseWeekdays: [8] },
      { frequency: 'semanal', releaseHour: 9 },
    ])
      expect((await put(bad)).status, JSON.stringify(bad)).toBe(400);
  });

  it('only moderators change it', async () => {
    expect(
      (
        await t.call(fx.users.membro, 'PUT', '/config/cadencia', fx.communityId, {
          config: { frequency: 'manual', releaseHour: 9 },
        })
      ).status,
    ).toBe(403);
  });

  it('the current round shows the cadence in words for everyone', async () => {
    const round = await t.json<{ cadence: Cadence; period: { label: string } }>(
      t.call(fx.users.membro, 'GET', '/rodada', fx.communityId),
    );
    expect(round.cadence.description).toBe('Toda quarta às 18h');
    expect(round.period.label).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('emoji roster', () => {
  type Option = { id: string; char: string; isCustom: boolean };

  it('default: the 11 catalog emojis (R-EMO-01, R-EMO-02)', async () => {
    const round = await t.json<{ emojis: Option[] }>(t.call(fx.users.membro, 'GET', '/rodada', fx.communityId));
    expect(round.emojis).toHaveLength(11);
  });

  it('saves catalog + custom in order; a removed custom is deactivated, never deleted (R-EMO-04)', async () => {
    const saved = await t.json<{ active: Option[] }>(
      t.call(fx.users.owner, 'PUT', '/config/emojis', fx.communityId, {
        entries: [
          { isCustom: false, emojiId: 'coracao' },
          { isCustom: true, char: '🦄', label: 'Unicórnio', trophyName: 'Troféu Mágico', glowRgb: '255 0 128' },
        ],
      }),
    );
    expect(saved.active.map((o) => o.char)).toEqual(['❤️', '🦄']);
    const customId = saved.active[1]!.id;
    expect(customId).toMatch(/^custom-/);

    await t.json(
      t.call(fx.users.owner, 'PUT', '/config/emojis', fx.communityId, {
        entries: [{ isCustom: false, emojiId: 'cobra' }],
      }),
    );
    const config = await t.json<{ active: Option[]; inactiveCustom: Option[] }>(
      t.call(fx.users.owner, 'GET', '/config/emojis', fx.communityId),
    );
    expect(config.active.map((o) => o.id)).toEqual(['cobra']);
    expect(config.inactiveCustom.map((o) => o.id)).toEqual([customId]);
  });

  it('a deactivated emoji is dropped from ballots (R-ANON-05)', async () => {
    const c = await h.fixture();
    const v = await t.newVoter(c, 'Hugo');
    await t.makeVoter(c, c.users.membro);
    await t.json(
      t.call(c.users.owner, 'PUT', '/config/emojis', c.communityId, {
        entries: [{ isCustom: false, emojiId: 'planta' }],
      }),
    );
    const tk = await t.getToken(c, v);
    expect((await t.vote(c.communityId, tk, { [c.users.membro.id]: 'coracao' })).status).toBe(422);
    await t.json(t.vote(c.communityId, tk, { [c.users.membro.id]: 'planta' }));
  });

  it('validation errors come back in pt-BR as 422; shape errors as 400; only moderators save', async () => {
    const res = await t.json<{ code: string; message: string }>(
      t.call(fx.users.owner, 'PUT', '/config/emojis', fx.communityId, {
        entries: [{ isCustom: true, char: '🦄🐍', label: 'Duplo', trophyName: 'Troféu' }],
      }),
      422,
    );
    expect(res).toEqual({ code: 'INVALID_EMOJIS', message: 'O emoji custom precisa ser um único emoji.' });
    expect((await t.call(fx.users.owner, 'PUT', '/config/emojis', fx.communityId, { entries: [] })).status).toBe(422);
    expect(
      (
        await t.call(fx.users.owner, 'PUT', '/config/emojis', fx.communityId, {
          entries: [{ isCustom: true, emojiId: 'coracao', char: '🦄', label: 'x', trophyName: 'y' }],
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await t.call(fx.users.membro, 'PUT', '/config/emojis', fx.communityId, {
          entries: [{ isCustom: false, emojiId: 'cobra' }],
        })
      ).status,
    ).toBe(403);
  });
});
