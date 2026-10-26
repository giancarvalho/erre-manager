// Persistence of the emoji roster. Ported from queridometro@7c5c5bf:
// src/infrastructure/emojis/postgres-group-emoji-config.repository.ts
import { and, asc, eq, notInArray, type Tx } from '@erre/db';

import type { EmojiConfigRow } from '../../domain/emoji-config';
import { emojiConfig } from '../../db/schema';

/** Every saved row, inactive included, in display order. Empty = the community never saved a roster. */
export async function loadEmojiRows(tx: Tx, communityId: string): Promise<EmojiConfigRow[]> {
  const rows = await tx
    .select()
    .from(emojiConfig)
    .where(eq(emojiConfig.communityId, communityId))
    .orderBy(asc(emojiConfig.sortOrder));
  return rows.map(({ communityId: _c, ...r }) => r);
}

/**
 * Upserts the new active roster and deactivates every other row. Never deletes: an inactive custom emoji
 * keeps resolving for past trophies (R-EMO-04). Runs in the route's transaction.
 */
export async function saveEmojiRows(tx: Tx, communityId: string, rows: readonly EmojiConfigRow[]): Promise<void> {
  for (const r of rows) {
    const { emojiId, ...rest } = r;
    await tx
      .insert(emojiConfig)
      .values({ communityId, emojiId, ...rest, active: true })
      .onConflictDoUpdate({ target: [emojiConfig.communityId, emojiConfig.emojiId], set: { ...rest, active: true } });
  }
  await tx
    .update(emojiConfig)
    .set({ active: false })
    .where(
      and(
        eq(emojiConfig.communityId, communityId),
        notInArray(
          emojiConfig.emojiId,
          rows.map((r) => r.emojiId),
        ),
      ),
    );
}
