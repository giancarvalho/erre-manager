import { createAnonApp } from '@erre/core/server';
import { count } from '@erre/db';

import { items } from '../../db/schema';

// Anonymous route: proves the context has only the community and the transaction, and that the request
// reaches the module without identifying headers.
export const anon = createAnonApp().get('/echo', async (c) => {
  const [row] = await c.var.ctx.tx.select({ n: count() }).from(items);
  return c.json({
    community: c.var.ctx.community.id,
    contextKeys: Object.keys(c.var.ctx).sort(),
    headers: [...c.req.raw.headers.keys()].sort(),
    items: row?.n ?? 0,
  });
});
