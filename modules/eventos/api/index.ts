import { issueToken, publicJwk } from '@erre/anon-vote/server';
import { createModuleApp, defineModuleApi, errors, validate, type ModuleContext } from '@erre/core/server';
import { z } from 'zod';

import { buildEventEmojiRows } from '../domain/emoji-config';
import { applyDraftPatch, validateNewEvent } from '../domain/lifecycle';
import { DraftPatchSchema, EventEmojiEntriesSchema, NewEventSchema, TokenRequestSchema } from '../domain/schemas';
import manifest from '../manifest';
import { closeDueEvents, closeEvent, openDueEvents, type EventNotifier } from './server/close';
import {
  createEvent,
  listEvents,
  loadEvent,
  loadRoster,
  openVoting,
  publish,
  saveRosterIfDraft,
  softDelete,
  updateDraft,
  type EventRow,
  type TransitionResult,
} from './server/events';
import { lockEvent } from './server/lock';
import {
  isParticipant,
  participantIds,
  participantMembers,
  participateOnJoin,
  participationOnLeave,
  signUp,
} from './server/participants';
import { signingKeyRepository, tokenIssuanceRepository } from './server/repositories';
import { eventView, loadEventResults, memberTrophies } from './server/results';
import { anon } from './anon';

async function requirePermission(ctx: ModuleContext, permission: string) {
  if (!(await ctx.can(permission))) throw errors.forbidden();
}

const notFound = () => errors.notFound('Evento não encontrado.');

/**
 * The event as the caller may see it: drafts exist only for whoever can create or moderate events; for
 * everyone else a draft is "not found", like a deleted event.
 */
async function visibleEvent(ctx: ModuleContext, eventId: string): Promise<EventRow> {
  await requirePermission(ctx, 'eventos.ver');
  const event = await loadEvent(ctx.tx, ctx.community.id, eventId);
  if (!event) throw notFound();
  if (event.status === 'draft' && !(await canManage(ctx))) throw notFound();
  return event;
}

async function canManage(ctx: ModuleContext) {
  return (await ctx.can('eventos.criar')) || (await ctx.can('eventos.moderar'));
}

/** Voting needs the permission, an open event and being one of its participants. */
async function requireVoter(ctx: ModuleContext, eventId: string): Promise<EventRow> {
  await requirePermission(ctx, 'eventos.votar');
  const event = await visibleEvent(ctx, eventId);
  if (event.status !== 'open') throw errors.conflict('EVENT_NOT_OPEN', 'Este evento não está aberto para votos.');
  if (!(await isParticipant(ctx.tx, ctx.community.id, eventId, ctx.user.id)))
    throw errors.forbidden('Você não se inscreveu neste evento.');
  return event;
}

function transition(result: TransitionResult) {
  if (result.ok) return eventView(result.event);
  switch (result.code) {
    case 'NOT_FOUND':
      throw notFound();
    case 'LIVE_EVENT_EXISTS':
      throw errors.conflict(
        'LIVE_EVENT_EXISTS',
        'Esta comunidade já tem um evento em andamento. Feche-o antes de publicar outro.',
      );
    case 'PUBLISH_RULE':
      throw errors.rule('PUBLISH_BLOCKED', result.message ?? 'Não é possível publicar este evento.');
    default:
      throw errors.conflict('INVALID_TRANSITION', 'Essa ação não vale para a situação atual do evento.');
  }
}

const notifierOf = (ctx: ModuleContext): EventNotifier => ({
  community: ctx.community,
  members: ctx.members,
  notify: ctx.notify,
});

const EventParam = z.object({ id: z.uuid() });

const api = createModuleApp()
  // Events of the community, newest first (D-026: every member sees them and signs up if they want).
  .get('/', async (c) => {
    const { ctx } = c.var;
    await requirePermission(ctx, 'eventos.ver');
    const manage = await canManage(ctx);
    const rows = await listEvents(ctx.tx, ctx.community.id, manage);
    const list = [];
    for (const row of rows) {
      const ids = await participantIds(ctx.tx, ctx.community.id, row.id);
      list.push({ ...eventView(row), participantCount: ids.length, participating: ids.includes(ctx.user.id) });
    }
    return c.json({
      events: list,
      canCreate: await ctx.can('eventos.criar'),
      canModerate: await ctx.can('eventos.moderar'),
    });
  })

  .post('/', validate('json', NewEventSchema), async (c) => {
    const { ctx } = c.var;
    await requirePermission(ctx, 'eventos.criar');
    const input = c.req.valid('json');
    const checked = validateNewEvent(input, new Date());
    if (!checked.ok) throw errors.rule('INVALID_EVENT', checked.error);
    const event = await createEvent(ctx.tx, ctx.community.id, {
      fields: checked.fields,
      votingType: input.votingType,
      createdBy: ctx.user.id,
    });
    return c.json(eventView(event), 201);
  })

  // One event: fields, roster, participants (still members) and where the caller stands.
  .get('/:id', validate('param', EventParam), async (c) => {
    const { ctx } = c.var;
    const event = await visibleEvent(ctx, c.req.valid('param').id);
    const participants = await participantMembers(ctx.tx, ctx.community.id, event.id, ctx.members);
    return c.json({
      event: eventView(event),
      emojis: await loadRoster(ctx.tx, ctx.community.id, event.id),
      participants: participants.map((m) => ({
        userId: m.userId,
        displayName: m.displayName,
        avatarVariant: m.avatarVariant,
      })),
      participating: participants.some((m) => m.userId === ctx.user.id),
      // The ballot leaves the viewer out: nobody votes on themselves (R-ANON-09).
      viewerId: ctx.user.id,
      canVote: await ctx.can('eventos.votar'),
      canEdit: event.status === 'draft' && (await ctx.can('eventos.criar')),
      canModerate: await ctx.can('eventos.moderar'),
    });
  })

  // ---- drafts (R-EVT-04, R-EVT-05) ----
  .patch('/:id', validate('param', EventParam), validate('json', DraftPatchSchema), async (c) => {
    const { ctx } = c.var;
    await requirePermission(ctx, 'eventos.criar');
    const event = await loadEvent(ctx.tx, ctx.community.id, c.req.valid('param').id);
    if (!event) throw notFound();
    if (event.status !== 'draft')
      throw errors.conflict('NOT_DRAFT', 'Só é possível editar um evento enquanto ele está em rascunho.');
    const checked = applyDraftPatch(event, c.req.valid('json'), new Date());
    if (!checked.ok) throw errors.rule('INVALID_EVENT', checked.error);
    const updated = await updateDraft(ctx.tx, ctx.community.id, event.id, checked.fields);
    if (!updated) throw errors.conflict('NOT_DRAFT', 'Só é possível editar um evento enquanto ele está em rascunho.');
    return c.json(eventView(updated));
  })
  .put('/:id/emojis', validate('param', EventParam), validate('json', EventEmojiEntriesSchema), async (c) => {
    const { ctx } = c.var;
    await requirePermission(ctx, 'eventos.criar');
    const event = await loadEvent(ctx.tx, ctx.community.id, c.req.valid('param').id);
    if (!event) throw notFound();
    if (event.status !== 'draft')
      throw errors.conflict('NOT_DRAFT', 'Só é possível editar o roster enquanto o evento está em rascunho.');
    const built = buildEventEmojiRows(event.votingType, c.req.valid('json').entries);
    if (!built.ok) throw errors.rule('INVALID_EMOJIS', built.error);
    const saved = await saveRosterIfDraft(ctx.tx, ctx.community.id, event.id, built.rows);
    if (saved === 'NOT_FOUND') throw notFound();
    if (saved === 'NOT_DRAFT')
      throw errors.conflict('NOT_DRAFT', 'Só é possível editar o roster enquanto o evento está em rascunho.');
    return c.json({ emojis: await loadRoster(ctx.tx, ctx.community.id, event.id) });
  })

  // ---- lifecycle (R-EVT-01, R-EVT-02, R-EVT-03, R-EVT-06) ----
  .post('/:id/publicar', validate('param', EventParam), async (c) => {
    const { ctx } = c.var;
    await requirePermission(ctx, 'eventos.moderar');
    return c.json(transition(await publish(ctx.tx, ctx.community.id, c.req.valid('param').id, new Date())));
  })
  .post('/:id/abrir', validate('param', EventParam), async (c) => {
    const { ctx } = c.var;
    await requirePermission(ctx, 'eventos.moderar');
    return c.json(transition(await openVoting(ctx.tx, ctx.community.id, c.req.valid('param').id, new Date())));
  })
  .post('/:id/encerrar', validate('param', EventParam), async (c) => {
    const { ctx } = c.var;
    await requirePermission(ctx, 'eventos.moderar');
    const result = await closeEvent(ctx.tx, notifierOf(ctx), c.req.valid('param').id, new Date());
    if (!result.ok) return c.json(transition(result));
    return c.json(eventView(result.event));
  })
  .delete('/:id', validate('param', EventParam), async (c) => {
    const { ctx } = c.var;
    await requirePermission(ctx, 'eventos.moderar');
    if (!(await softDelete(ctx.tx, ctx.community.id, c.req.valid('param').id, new Date()))) throw notFound();
    return c.json({ ok: true });
  })

  // ---- participation and voting ----
  // Any approved member who can vote signs up while the event is live (P-014 B, provisional).
  .post('/:id/inscricao', validate('param', EventParam), async (c) => {
    const { ctx } = c.var;
    await requirePermission(ctx, 'eventos.votar');
    const event = await visibleEvent(ctx, c.req.valid('param').id);
    if (!(await signUp(ctx.tx, ctx.community.id, event, ctx.user.id)))
      throw errors.conflict('EVENT_NOT_LIVE', 'As inscrições deste evento não estão abertas.');
    return c.json({ participating: true });
  })

  // Public key of the event. Gated to its voters so strangers can't make the server create key pairs.
  .get('/:id/chave', validate('param', EventParam), async (c) => {
    const { ctx } = c.var;
    const event = await requireVoter(ctx, c.req.valid('param').id);
    const { publicKeyJwk } = await signingKeyRepository(ctx.tx, ctx.community.id).getOrCreateKeyPair(event.id);
    return c.json({ eventId: event.id, publicKeyJwk: publicJwk(publicKeyJwk) });
  })

  // Blind-signs the client's blinded token, once per person and event (R-ANON-01). The one identity-aware
  // step: it stores only (person, community, event) without a timestamp (R-ANON-02).
  .post('/:id/token', validate('param', EventParam), validate('json', TokenRequestSchema), async (c) => {
    const { ctx } = c.var;
    const event = await requireVoter(ctx, c.req.valid('param').id);
    await lockEvent(ctx.tx, event.id, 'shared');
    const result = await issueToken(
      {
        keys: signingKeyRepository(ctx.tx, ctx.community.id),
        issuances: tokenIssuanceRepository(ctx.tx, ctx.community.id),
      },
      { userId: ctx.user.id, period: event.id, blindedMsgB64: c.req.valid('json').blindedMsgB64 },
    );
    if (result.ok) return c.json({ eventId: event.id, blindSignatureB64: result.blindSignatureB64 });
    if (result.reason === 'ALREADY_ISSUED')
      throw errors.conflict('TOKEN_ALREADY_ISSUED', 'Você já retirou seu voto deste evento.');
    throw errors.validation('Requisição inválida.');
  })

  // ---- result of a closed event: any member who can see events ----
  .get('/:id/resultados', validate('param', EventParam), async (c) => {
    const { ctx } = c.var;
    const event = await visibleEvent(ctx, c.req.valid('param').id);
    const results =
      event.status === 'closed' ? await loadEventResults(ctx.tx, ctx.community.id, event, ctx.members) : null;
    if (!results) throw errors.conflict('EVENT_NOT_CLOSED', 'O resultado deste evento ainda não saiu.');
    return c.json(results);
  });

export type EventosApi = typeof api;

export default defineModuleApi(manifest, {
  api,
  anon,
  jobs: [
    // The legacy opened, then closed, on the same 15-minute tick (legado:src/instrumentation.ts).
    {
      id: 'eventos.abrir_agendados',
      schedule: '*/15 * * * *',
      run: async (ctx) => {
        await openDueEvents(ctx.tx, ctx.community.id, ctx.now);
      },
    },
    {
      id: 'eventos.fechar_agendados',
      schedule: '*/15 * * * *',
      run: async (ctx) => {
        await closeDueEvents(ctx.tx, ctx, ctx.now);
      },
    },
  ],
  profileSections: [
    {
      id: 'eventos.trofeus',
      load: (ctx, userId) => memberTrophies(ctx.tx, ctx.community.id, userId),
    },
  ],
  onJoinApproved: {
    'eventos.participar': (ctx) => participateOnJoin(ctx.tx, ctx.communityId, ctx.userId),
  },
  onMemberLeft: (ctx) => participationOnLeave(ctx.tx, ctx.communityId, ctx.userId),
});
