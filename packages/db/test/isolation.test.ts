import { randomUUID } from 'node:crypto';

import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, inject } from 'vitest';

import { closeDb, createDb, type Db } from '../src/client';
import { communities } from '../src/schema';
import { withTenantTx } from '../src/tenant';
import { testTenantItems as items } from './schema';

const urls = inject('db');
let db: Db;
let a: string;
let b: string;
let itemA: string;
let itemB: string;

beforeAll(async () => {
  db = createDb(urls.app);
  const suffix = randomUUID().slice(0, 8);
  [{ id: a }, { id: b }] = (await db
    .insert(communities)
    .values([
      { slug: `a-${suffix}`, name: 'A' },
      { slug: `b-${suffix}`, name: 'B' },
    ])
    .returning({ id: communities.id })) as [{ id: string }, { id: string }];
  itemA = await withTenantTx(db, { communityId: a }, async (tx) => {
    const [row] = await tx.insert(items).values({ communityId: a, label: 'de A' }).returning();
    return row!.id;
  });
  itemB = await withTenantTx(db, { communityId: b }, async (tx) => {
    const [row] = await tx.insert(items).values({ communityId: b, label: 'de B' }).returning();
    return row!.id;
  });
});

afterAll(async () => {
  await closeDb(db);
});

/** Postgres error code of a failed query (Drizzle wraps the driver error in `cause`). */
async function pgCode(promise: PromiseLike<unknown>): Promise<string> {
  try {
    await promise;
  } catch (err) {
    const e = err as { code?: string; cause?: { code?: string } };
    return e.cause?.code ?? e.code ?? 'unknown';
  }
  return 'no error';
}

const RLS_VIOLATION = '42501';
const UNDEFINED_SETTING = '42704';
const INVALID_UUID = '22P02';

const asA = <T>(fn: Parameters<typeof withTenantTx<T>>[2]) => withTenantTx(db, { communityId: a }, fn);

describe('isolation between communities', () => {
  it('reads only rows of the current community', async () => {
    const rows = await asA((tx) => tx.select().from(items));
    expect(rows.map((r) => r.id)).toEqual([itemA]);
    expect(await asA((tx) => tx.select().from(items).where(eq(items.id, itemB)))).toEqual([]);
  });

  it('cannot update or delete rows of another community', async () => {
    const updated = await asA((tx) => tx.update(items).set({ label: 'x' }).where(eq(items.id, itemB)).returning());
    expect(updated).toEqual([]);
    const deleted = await asA((tx) => tx.delete(items).where(eq(items.id, itemB)).returning());
    expect(deleted).toEqual([]);
    const still = await withTenantTx(db, { communityId: b }, (tx) => tx.select().from(items));
    expect(still).toEqual([expect.objectContaining({ id: itemB, label: 'de B' })]);
  });

  it('cannot insert into another community', async () => {
    expect(await pgCode(asA((tx) => tx.insert(items).values({ communityId: b, label: 'invasão' })))).toBe(
      RLS_VIOLATION,
    );
  });

  it('cannot move a row to another community', async () => {
    expect(await pgCode(asA((tx) => tx.update(items).set({ communityId: b }).where(eq(items.id, itemA))))).toBe(
      RLS_VIOLATION,
    );
  });

  it('rejects a community id that is not a uuid', async () => {
    await expect(withTenantTx(db, { communityId: "x' or 1=1 --" }, async () => 1)).rejects.toThrow(/uuid/);
  });
});

describe('fail closed', () => {
  it('errors when app.community_id was never set', async () => {
    const fresh = createDb(urls.app, { max: 1 });
    try {
      expect(await pgCode(fresh.select().from(items))).toBe(UNDEFINED_SETTING);
    } finally {
      await closeDb(fresh);
    }
  });

  it('does not leak the community to the next use of the connection', async () => {
    const single = createDb(urls.app, { max: 1 });
    try {
      await withTenantTx(single, { communityId: a, userId: 'u1' }, (tx) => tx.select().from(items));
      const res = await single.execute<{ c: string | null; u: string | null }>(
        sql`select current_setting('app.community_id', true) as c, current_setting('app.user_id', true) as u`,
      );
      expect(res.rows[0]?.c || null).toBeNull();
      expect(res.rows[0]?.u || null).toBeNull();
      // The setting now exists but is empty: the cast fails, still closed.
      expect(await pgCode(single.select().from(items))).toBe(INVALID_UUID);
    } finally {
      await closeDb(single);
    }
  });
});
