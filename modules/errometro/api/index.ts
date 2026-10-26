import { issueToken, publicJwk } from '@erre/anon-vote/server';
import { createModuleApp, defineModuleApi, errors, validate, type ModuleContext } from '@erre/core/server';
import { z } from 'zod';

import { activeEmojiOptions, buildEmojiConfigRows, emojiCatalog } from '../domain/emoji-config';
import { describeReleaseCadence } from '../domain/release-cadence-copy';
import { assertValidConfig, type ReleaseConfig } from '../domain/release-window';
import { releaseConfigOrDefault } from '../domain/schedule';
import { EmojiEntriesSchema, ReleaseConfigSchema, TokenRequestSchema } from '../domain/schemas';
import manifest from '../manifest';
import { closeRound } from './server/close';
import { loadEmojiRows, saveEmojiRows } from './server/emojis';
import {
  approvedParticipants,
  getParticipation,
  listParticipants,
  moderateParticipation,
  participateOnJoin,
  participationOnLeave,
  participationView,
  requestParticipation,
  type ModerationAction,
} from './server/participants';
import { signingKeyRepository, tokenIssuanceRepository } from './server/repositories';
import { lockRound, resolveRound, saveReleaseConfig } from './server/round';
import { anon } from './anon';

async function requirePermission(ctx: ModuleContext, permission: string) {
  if (!(await ctx.can(permission))) throw errors.forbidden();
}

/** Voting needs the permission and an approved participation (legacy isVotingMember). */
async function requireVoter(ctx: ModuleContext) {
  await requirePermission(ctx, 'errometro.votar');
  const p = await getParticipation(ctx.tx, ctx.community.id, ctx.user.id);
  if (p?.status !== 'approved') throw errors.forbidden('Você ainda não participa do Errômetro desta comunidade.');
}

function sameConfig(a: ReleaseConfig, b: ReleaseConfig): boolean {
  if (a.frequency !== b.frequency || a.releaseHour !== b.releaseHour) return false;
  if (a.frequency === 'weekly') return a.releaseWeekday === b.releaseWeekday;
  if (a.frequency === 'custom') {
    const as = [...new Set(a.releaseWeekdays ?? [])].sort();
    const bs = [...new Set(b.releaseWeekdays ?? [])].sort();
    return as.length === bs.length && as.every((v, i) => v === bs[i]);
  }
  return true;
}

const cadenceView = (config: ReleaseConfig | null) => {
  const effective = releaseConfigOrDefault(config);
  return { config: effective, isDefault: config === null, description: describeReleaseCadence(effective) };
};

const ACTIONS: Record<string, ModerationAction> = { aprovar: 'approve', rejeitar: 'reject', remover: 'remove' };

const api = createModuleApp()
  // Current round: window, cadence, emojis, targets and my participation. Any member who can see the
  // Errômetro reads it, voting or not (D-026, R-RES-06).
  .get('/rodada', async (c) => {
    const { ctx } = c.var;
    await requirePermission(ctx, 'errometro.ver');
    const round = await resolveRound(ctx.tx, ctx.community);
    const rows = await loadEmojiRows(ctx.tx, ctx.community.id);
    const targets = await approvedParticipants(ctx.tx, ctx.community.id, ctx.members);
    return c.json({
      period: { label: round.label, from: round.from.toISOString(), to: round.to.toISOString() },
      cadence: cadenceView(round.config),
      emojis: activeEmojiOptions(rows),
      targets: targets.map((m) => ({ userId: m.userId, displayName: m.displayName, avatarVariant: m.avatarVariant })),
      participation: await participationView(ctx.tx, ctx.community.id, ctx.user.id),
    });
  })

  .get('/participacao', async (c) => {
    const { ctx } = c.var;
    await requirePermission(ctx, 'errometro.ver');
    return c.json(await participationView(ctx.tx, ctx.community.id, ctx.user.id));
  })
  .post('/participacao', async (c) => {
    const { ctx } = c.var;
    await requirePermission(ctx, 'errometro.votar');
    return c.json(await requestParticipation(ctx.tx, ctx.community.id, ctx.user.id));
  })

  .get('/participantes', async (c) => {
    const { ctx } = c.var;
    await requirePermission(ctx, 'errometro.moderar');
    return c.json(await listParticipants(ctx.tx, ctx.community.id, ctx.members));
  })
  .post(
    '/participantes/:userId/:acao',
    validate('param', z.object({ userId: z.uuid(), acao: z.enum(['aprovar', 'rejeitar', 'remover']) })),
    async (c) => {
      const { ctx } = c.var;
      await requirePermission(ctx, 'errometro.moderar');
      const { userId, acao } = c.req.valid('param');
      const result = await moderateParticipation(ctx.tx, ctx.community.id, ctx.members, {
        userId,
        moderatorId: ctx.user.id,
        action: ACTIONS[acao]!,
      });
      if (result.ok) return c.json({ status: result.status });
      switch (result.code) {
        case 'NOT_FOUND':
          throw errors.notFound('Essa pessoa não pediu para participar do Errômetro.');
        case 'MEMBERSHIP_REQUIRED':
          throw errors.rule('MEMBERSHIP_REQUIRED', 'Essa pessoa precisa ser membro aprovado da comunidade.');
        case 'FULL':
          throw errors.rule('PARTICIPANTS_FULL', 'O Errômetro já tem 50 votantes. Remova alguém para abrir vaga.');
        default:
          throw errors.conflict('INVALID_TRANSITION', 'Essa ação não vale para a situação atual dessa pessoa.');
      }
    },
  )

  // Public key of the current round. Gated to voters so strangers can't make the server create key pairs.
  .get('/chave', async (c) => {
    const { ctx } = c.var;
    await requireVoter(ctx);
    await lockRound(ctx.tx, ctx.community.id, 'shared');
    const round = await resolveRound(ctx.tx, ctx.community);
    const { publicKeyJwk } = await signingKeyRepository(ctx.tx, ctx.community.id).getOrCreateKeyPair(round.label);
    return c.json({ period: round.label, publicKeyJwk: publicJwk(publicKeyJwk) });
  })

  // Blind-signs the client's blinded token, once per person and round (R-ANON-01). The one identity-aware
  // step: it knows who asks, and stores only (person, community, round) without a timestamp (R-ANON-02).
  .post('/token', validate('json', TokenRequestSchema), async (c) => {
    const { ctx } = c.var;
    await requireVoter(ctx);
    await lockRound(ctx.tx, ctx.community.id, 'shared');
    const round = await resolveRound(ctx.tx, ctx.community);
    const result = await issueToken(
      {
        keys: signingKeyRepository(ctx.tx, ctx.community.id),
        issuances: tokenIssuanceRepository(ctx.tx, ctx.community.id),
      },
      { userId: ctx.user.id, period: round.label, blindedMsgB64: c.req.valid('json').blindedMsgB64 },
    );
    if (result.ok) return c.json({ period: round.label, blindSignatureB64: result.blindSignatureB64 });
    if (result.reason === 'ALREADY_ISSUED')
      throw errors.conflict('TOKEN_ALREADY_ISSUED', 'Você já retirou seu voto desta rodada.');
    throw errors.validation('Requisição inválida.');
  })

  .get('/config/emojis', async (c) => {
    const { ctx } = c.var;
    await requirePermission(ctx, 'errometro.moderar');
    const rows = await loadEmojiRows(ctx.tx, ctx.community.id);
    const catalog = emojiCatalog(rows);
    return c.json({
      active: activeEmojiOptions(rows),
      inactiveCustom: rows.filter((r) => r.isCustom && !r.active).map((r) => catalog.get(r.emojiId)!),
    });
  })
  .put('/config/emojis', validate('json', EmojiEntriesSchema), async (c) => {
    const { ctx } = c.var;
    await requirePermission(ctx, 'errometro.moderar');
    const built = buildEmojiConfigRows(c.req.valid('json').entries);
    if (!built.ok) throw errors.rule('INVALID_EMOJIS', built.error);
    await saveEmojiRows(ctx.tx, ctx.community.id, built.rows);
    return c.json({ active: activeEmojiOptions(await loadEmojiRows(ctx.tx, ctx.community.id)) });
  })

  .get('/config/cadencia', async (c) => {
    const { ctx } = c.var;
    await requirePermission(ctx, 'errometro.moderar');
    return c.json(cadenceView((await resolveRound(ctx.tx, ctx.community)).config));
  })
  // A cadence change closes the current round first (its votes are counted), then the clock restarts under
  // the new cadence, in the same transaction (legacy saveGroupReleaseConfigAction). The exclusive round lock
  // keeps tokens and ballots out while it happens. No push for this forced close (R-RES-05).
  .put('/config/cadencia', validate('json', z.object({ config: ReleaseConfigSchema }).strict()), async (c) => {
    const { ctx } = c.var;
    await requirePermission(ctx, 'errometro.moderar');
    const config: ReleaseConfig = c.req.valid('json').config;
    try {
      assertValidConfig(config);
    } catch {
      throw errors.validation('Cadência inválida.');
    }
    await lockRound(ctx.tx, ctx.community.id, 'exclusive');
    const round = await resolveRound(ctx.tx, ctx.community);
    const roundClosedEarly = !sameConfig(releaseConfigOrDefault(round.config), config);
    if (roundClosedEarly) await closeRound(ctx.tx, ctx.community.id, round.label, new Date());
    await saveReleaseConfig(ctx.tx, ctx.community.id, config);
    return c.json({ roundClosedEarly, ...cadenceView(config) });
  });

export type ErrometroApi = typeof api;

export default defineModuleApi(manifest, {
  api,
  anon,
  onJoinApproved: {
    'errometro.participar': (ctx) => participateOnJoin(ctx.tx, ctx.communityId, ctx.userId, ctx.actorId),
  },
  onMemberLeft: (ctx) => participationOnLeave(ctx.tx, ctx.communityId, ctx.userId, ctx.actorId),
});
