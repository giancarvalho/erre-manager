import { createModuleApp, defineModuleApi, errors, validate } from '@erre/core/server';
import { and, count, eq } from '@erre/db';
import { z } from 'zod';

import manifest from '../manifest';
import { items, jobRuns, participants } from '../db/schema';
import { anon } from './anon';

const api = createModuleApp()
  .get('/whoami', (c) => c.json({ user: c.var.ctx.user, community: c.var.ctx.community }))
  .get('/items', async (c) => {
    if (!(await c.var.ctx.can('contratoteste.ver'))) throw errors.forbidden();
    return c.json(await c.var.ctx.tx.select().from(items).orderBy(items.createdAt));
  })
  .post('/items', validate('json', z.object({ label: z.string().min(1).max(50) }).strict()), async (c) => {
    if (!(await c.var.ctx.can('contratoteste.editar'))) throw errors.forbidden();
    const { ctx } = c.var;
    const [row] = await ctx.tx
      .insert(items)
      .values({ communityId: ctx.community.id, label: c.req.valid('json').label, createdBy: ctx.user.id })
      .returning();
    return c.json(row, 201);
  })
  .get('/participants', async (c) => c.json(await c.var.ctx.tx.select().from(participants)))
  // Notifies every member; with ?falhar=1 the route fails after calling notify (nothing must be sent).
  .post('/avisar', async (c) => {
    const { ctx } = c.var;
    const members = await ctx.members.list();
    await ctx.notify({
      userIds: members.map((m) => m.userId),
      type: 'contratoteste.aviso',
      title: 'Aviso',
      body: 'Teste',
      route: '/contratoteste',
    });
    if (c.req.query('falhar')) throw errors.rule('FALHOU', 'Falhou depois de avisar.');
    return c.json({ ok: true });
  });

export type ContratoTesteApi = typeof api;

export default defineModuleApi(manifest, {
  api,
  anon,
  jobs: [
    {
      id: 'contratoteste.contar',
      schedule: '*/5 * * * *',
      async run(ctx) {
        // No filter on purpose: RLS must limit the count to this community.
        const [row] = await ctx.tx.select({ n: count() }).from(items);
        await ctx.tx.insert(jobRuns).values({ communityId: ctx.community.id, itemsSeen: row?.n ?? 0 });
      },
    },
  ],
  profileSections: [
    {
      id: 'contratoteste.resumo',
      async load(ctx, userId) {
        const [row] = await ctx.tx.select({ n: count() }).from(items).where(eq(items.createdBy, userId));
        return row && row.n > 0 ? { itemsCreated: row.n } : null;
      },
    },
  ],
  onJoinApproved: {
    'contratoteste.participar': async (ctx) => {
      await ctx.tx
        .insert(participants)
        .values({ communityId: ctx.communityId, userId: ctx.userId })
        .onConflictDoNothing();
    },
  },
  onMemberLeft: async (ctx) => {
    await ctx.tx
      .delete(participants)
      .where(and(eq(participants.communityId, ctx.communityId), eq(participants.userId, ctx.userId)));
  },
});
