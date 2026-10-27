// API of Mural de avisos, mounted by the core at /v1/avisos. Every route already has a session, a community validated
// against the person's membership and `ctx.tx`, a transaction limited to that community by RLS (ARQUITETURA §4).
// What is left to each route: check the permission and validate the input with Zod.
import { createModuleApp, defineModuleApi, errors, validate, type ModuleContext } from '@erre/core/server';
import { and, desc, eq } from '@erre/db';
import { z } from 'zod';

import { posts } from '../db/schema';
import { avisoPush } from '../domain/push';
import { NewAvisoSchema } from '../domain/schemas';
import manifest from '../manifest';
import { avisosData } from './server/privacy';

async function requirePermission(ctx: ModuleContext, permission: string) {
  if (!(await ctx.can(permission))) throw errors.forbidden();
}

const api = createModuleApp()
  // GET /v1/avisos (the module root has no trailing slash): every notice, newest first, with its author.
  .get('', async (c) => {
    const { ctx } = c.var;
    await requirePermission(ctx, 'avisos.ver');
    const [rows, members] = await Promise.all([
      ctx.tx.select().from(posts).orderBy(desc(posts.createdAt)),
      ctx.members.list(),
    ]);
    const byId = new Map(members.map((m) => [m.userId, m]));
    return c.json({
      avisos: rows.map((r) => {
        const author = byId.get(r.createdBy);
        return {
          id: r.id,
          title: r.title,
          body: r.body,
          createdAt: r.createdAt,
          // null: the author is no longer an approved member (left, was removed or erased).
          author: author
            ? { userId: author.userId, displayName: author.displayName, avatarVariant: author.avatarVariant }
            : null,
        };
      }),
      canPublish: await ctx.can('avisos.publicar'),
    });
  })
  // POST /v1/avisos: publishes and pushes every other approved member (sent after the commit).
  .post('', validate('json', NewAvisoSchema), async (c) => {
    const { ctx } = c.var;
    await requirePermission(ctx, 'avisos.publicar');
    const input = c.req.valid('json');
    const [row] = await ctx.tx
      .insert(posts)
      .values({ communityId: ctx.community.id, title: input.title, body: input.body, createdBy: ctx.user.id })
      .returning({ id: posts.id });
    const others = (await ctx.members.list()).map((m) => m.userId).filter((id) => id !== ctx.user.id);
    if (others.length > 0) {
      await ctx.notify({
        userIds: others,
        type: 'avisos.novo',
        ...avisoPush(ctx.community.name, input.title),
        // The core adds ?comunidade=<id>, so the push opens the board in this community.
        route: '/avisos',
      });
    }
    return c.json({ id: row!.id }, 201);
  })
  .delete('/:id', validate('param', z.object({ id: z.uuid() })), async (c) => {
    const { ctx } = c.var;
    await requirePermission(ctx, 'avisos.publicar');
    const deleted = await ctx.tx
      .delete(posts)
      .where(and(eq(posts.communityId, ctx.community.id), eq(posts.id, c.req.valid('param').id)))
      .returning({ id: posts.id });
    if (deleted.length === 0) throw errors.notFound('Esse aviso não existe mais.');
    return c.json({ ok: true });
  });

/** Type of the API for the typed client of the UI (useModuleClient<AvisosApi>). */
export type AvisosApi = typeof api;

export default defineModuleApi(manifest, {
  api,
  data: avisosData,
});
