import { issueToken, publicJwk } from '@erre/anon-vote/server';
import { createModuleApp, defineModuleApi, errors, validate, type ModuleContext } from '@erre/core/server';
import { z } from 'zod';

import { activeEmojiOptions, buildEmojiConfigRows, emojiCatalog } from '../domain/emoji-config';
import { getVotingTimeZone } from '../domain/calendar';
import { describeReleaseCadence, formatReleaseInstant } from '../domain/release-cadence-copy';
import { assertValidConfig, type ReleaseConfig } from '../domain/release-window';
import { releaseConfigOrDefault } from '../domain/schedule';
import { EmojiEntriesSchema, ReleaseConfigSchema, TokenRequestSchema } from '../domain/schemas';
import manifest from '../manifest';
import {
  annulVotes,
  closeDueRounds,
  closeRound,
  listRoundsForModerators,
  recomputeRound,
  releaseNow,
  setRoundHidden,
  type RoundNotifier,
} from './server/close';
import { addComment, COMMENT_MAX_LENGTH, deleteComment, editComment, listComments } from './server/comments';
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
import { sendClosingReminder } from './server/reminders';
import { signingKeyRepository, tokenIssuanceRepository } from './server/repositories';
import { loadResults, memberTrophies } from './server/results';
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

const notifierOf = (ctx: ModuleContext): RoundNotifier => ({
  community: ctx.community,
  members: ctx.members,
  notify: ctx.notify,
});

const Period = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const CommentText = z
  .string()
  .transform((t) => t.trim())
  .pipe(
    z
      .string()
      .min(1, 'Comentário não pode ser vazio.')
      .max(COMMENT_MAX_LENGTH, `Máximo de ${COMMENT_MAX_LENGTH} caracteres.`),
  );

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
      cadence: {
        ...cadenceView(round.config),
        // Manual cadence has no date: the moderators release when they want.
        nextRelease:
          releaseConfigOrDefault(round.config).frequency === 'manual'
            ? null
            : { at: round.to.toISOString(), label: formatReleaseInstant(round.to, getVotingTimeZone()) },
      },
      emojis: activeEmojiOptions(rows),
      targets: targets.map((m) => ({ userId: m.userId, displayName: m.displayName, avatarVariant: m.avatarVariant })),
      participation: await participationView(ctx.tx, ctx.community.id, ctx.user.id),
      // The voting grid leaves the viewer out: nobody votes on themselves (R-ANON-09).
      viewerId: ctx.user.id,
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
  })

  // ---- closing and moderation of rounds (R-RES-03, R-RES-07, R-RES-08, R-RES-09) ----
  .post('/rodada/liberar', async (c) => {
    const { ctx } = c.var;
    await requirePermission(ctx, 'errometro.moderar');
    return c.json(await releaseNow(ctx.tx, notifierOf(ctx), new Date()));
  })
  .get('/rodadas', async (c) => {
    const { ctx } = c.var;
    await requirePermission(ctx, 'errometro.moderar');
    return c.json(await listRoundsForModerators(ctx.tx, ctx.community.id));
  })
  .post('/rodadas/:period/recalcular', validate('param', z.object({ period: Period })), async (c) => {
    const { ctx } = c.var;
    await requirePermission(ctx, 'errometro.moderar');
    return c.json(await recomputeRound(ctx.tx, notifierOf(ctx), c.req.valid('param').period, new Date()));
  })
  .post(
    '/rodadas/:period/ocultar',
    validate('param', z.object({ period: Period })),
    validate('json', z.object({ hidden: z.boolean() }).strict()),
    async (c) => {
      const { ctx } = c.var;
      await requirePermission(ctx, 'errometro.moderar');
      const { period } = c.req.valid('param');
      const { hidden } = c.req.valid('json');
      if (!(await setRoundHidden(ctx.tx, ctx.community.id, period, hidden)))
        throw errors.notFound('Rodada não encontrada.');
      return c.json({ period, hidden });
    },
  )
  .post(
    '/votos/anular',
    validate(
      'json',
      z
        .object({
          voterTag: z
            .string()
            .transform((t) => t.trim().toLowerCase())
            .pipe(z.string().regex(/^[0-9a-f]{64}$/, 'Código inválido.')),
        })
        .strict(),
    ),
    async (c) => {
      const { ctx } = c.var;
      await requirePermission(ctx, 'errometro.moderar');
      return c.json({ deletedCount: await annulVotes(ctx.tx, ctx.community.id, c.req.valid('json').voterTag) });
    },
  )

  // ---- results (R-RES-06): any member who can see the Errômetro, voting or not ----
  .get('/resultados', validate('query', z.object({ rodada: Period.optional() })), async (c) => {
    const { ctx } = c.var;
    await requirePermission(ctx, 'errometro.ver');
    const isModerator = await ctx.can('errometro.moderar');
    return c.json(
      await loadResults(
        ctx.tx,
        { community: ctx.community, members: ctx.members, isModerator },
        c.req.valid('query').rodada,
      ),
    );
  })

  // ---- comments ----
  .get('/comentarios', validate('query', z.object({ alvo: z.uuid(), rodada: Period })), async (c) => {
    const { ctx } = c.var;
    await requirePermission(ctx, 'errometro.ver');
    const { alvo, rodada } = c.req.valid('query');
    return c.json(await listComments(ctx.tx, ctx.community.id, ctx.members, { targetId: alvo, period: rodada }));
  })
  .post(
    '/comentarios',
    validate('json', z.object({ targetId: z.uuid(), period: Period, text: CommentText }).strict()),
    async (c) => {
      const { ctx } = c.var;
      await requirePermission(ctx, 'errometro.ver');
      const body = c.req.valid('json');
      return c.json(await addComment(ctx.tx, ctx.community.id, ctx.members, { authorId: ctx.user.id, ...body }), 201);
    },
  )
  .patch(
    '/comentarios/:id',
    validate('param', z.object({ id: z.uuid() })),
    validate('json', z.object({ text: CommentText }).strict()),
    async (c) => {
      const { ctx } = c.var;
      await requirePermission(ctx, 'errometro.ver');
      const updated = await editComment(ctx.tx, ctx.community.id, ctx.members, {
        id: c.req.valid('param').id,
        authorId: ctx.user.id,
        text: c.req.valid('json').text,
      });
      if (!updated) throw errors.notFound('Comentário não encontrado ou sem permissão.');
      return c.json(updated);
    },
  )
  .delete('/comentarios/:id', validate('param', z.object({ id: z.uuid() })), async (c) => {
    const { ctx } = c.var;
    await requirePermission(ctx, 'errometro.ver');
    const deleted = await deleteComment(ctx.tx, ctx.community.id, {
      id: c.req.valid('param').id,
      actorId: ctx.user.id,
      isModerator: await ctx.can('errometro.moderar'),
    });
    if (!deleted) throw errors.notFound('Comentário não encontrado ou sem permissão.');
    return c.json({ ok: true });
  });

export type ErrometroApi = typeof api;

export default defineModuleApi(manifest, {
  api,
  anon,
  jobs: [
    {
      id: 'errometro.fechar_rodadas',
      schedule: '*/15 * * * *',
      run: async (ctx) => {
        await closeDueRounds(ctx.tx, ctx, ctx.now);
      },
    },
    {
      id: 'errometro.lembrete_fechamento',
      schedule: '*/15 * * * *',
      run: async (ctx) => {
        await sendClosingReminder(ctx.tx, ctx, ctx.now);
      },
    },
  ],
  profileSections: [
    {
      id: 'errometro.trofeus',
      load: (ctx, userId) => memberTrophies(ctx.tx, ctx.community.id, userId),
    },
  ],
  onJoinApproved: {
    'errometro.participar': (ctx) => participateOnJoin(ctx.tx, ctx.communityId, ctx.userId, ctx.actorId),
  },
  onMemberLeft: (ctx) => participationOnLeave(ctx.tx, ctx.communityId, ctx.userId, ctx.actorId),
});
