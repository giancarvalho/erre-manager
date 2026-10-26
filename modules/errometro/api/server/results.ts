// Results of closed rounds for members (R-RES-06, R-RES-07) and the all-time trophy tally.
// Ported from queridometro@7c5c5bf: src/app/results/page.tsx (real-group branch),
// src/lib/persistence/daily-snapshots.ts and src/lib/trophies/group-trophy-tally.ts.
import type { MembersApi } from '@erre/core/server';
import { computeRoundTrophies, emojiIdsInSnapshot, trophyStatusByTarget } from '@erre/emoji';
import { and, count, desc, eq, type Tx } from '@erre/db';

import { emojiCatalog } from '../../domain/emoji-config';
import { roundToRankingEntries } from '../../domain/ranking';
import { releaseConfigOrDefault } from '../../domain/schedule';
import { computeTrophyTally, tallyForMember } from '../../domain/trophy-tally';
import { comments, snapshots } from '../../db/schema';
import { loadEmojiRows } from './emojis';
import { resolveRound } from './round';

/** Closed rounds members can see, newest first. Hidden ones are indistinguishable from "never closed". */
export async function visibleRounds(tx: Tx, communityId: string): Promise<string[]> {
  const rows = await tx
    .select({ period: snapshots.period })
    .from(snapshots)
    .where(and(eq(snapshots.communityId, communityId), eq(snapshots.hidden, false)))
    .orderBy(desc(snapshots.period));
  return rows.map((r) => r.period);
}

async function hiddenCount(tx: Tx, communityId: string): Promise<number> {
  const [row] = await tx
    .select({ n: count() })
    .from(snapshots)
    .where(and(eq(snapshots.communityId, communityId), eq(snapshots.hidden, true)));
  return row?.n ?? 0;
}

async function payloadOf(tx: Tx, communityId: string, period: string) {
  const [row] = await tx
    .select({ payload: snapshots.payload })
    .from(snapshots)
    .where(and(eq(snapshots.communityId, communityId), eq(snapshots.period, period), eq(snapshots.hidden, false)));
  return row?.payload ?? null;
}

/**
 * One visible round (the requested one, or the latest): ranking of the current members, trophies and comment
 * counts. Moderators also learn how many rounds are hidden (members never do).
 */
export async function loadResults(
  tx: Tx,
  ctx: { community: { id: string; createdAt: Date }; members: MembersApi; isModerator: boolean },
  requested: string | undefined,
) {
  const communityId = ctx.community.id;
  const days = await visibleRounds(tx, communityId);
  const round = await resolveRound(tx, ctx.community);
  const nextReleaseAt = releaseConfigOrDefault(round.config).frequency === 'manual' ? null : round.to.toISOString();
  // Only moderators learn about hidden rounds; for members it's always null (R-RES-07).
  const hidden = { hiddenCount: ctx.isModerator ? await hiddenCount(tx, communityId) : null };
  const period = requested && days.includes(requested) ? requested : days[0];
  if (!period) return { days, period: null, ranking: [], trophies: [], commentCounts: {}, nextReleaseAt, ...hidden };

  const payload = (await payloadOf(tx, communityId, period))!;
  const catalog = emojiCatalog(await loadEmojiRows(tx, communityId));
  const members = (await ctx.members.list()).map((m) => ({
    userId: m.userId,
    displayName: m.displayName,
    avatarVariant: m.avatarVariant,
  }));
  const roundTrophies = computeRoundTrophies(payload, emojiIdsInSnapshot(payload));
  const status = trophyStatusByTarget(roundTrophies);
  const ranking = roundToRankingEntries(payload, members, catalog).map((e) => ({
    ...e,
    trophies: status[e.member.userId] ?? { wins: [], nearMisses: [] },
  }));
  const counts = await tx
    .select({ targetId: comments.targetId, n: count() })
    .from(comments)
    .where(and(eq(comments.communityId, communityId), eq(comments.period, period)))
    .groupBy(comments.targetId);
  return {
    days,
    period,
    ranking,
    trophies: roundTrophies.map((t) => {
      const emoji = catalog.get(t.emojiId);
      return { ...t, char: emoji?.char ?? '❓', trophyName: emoji?.trophyName ?? '' };
    }),
    commentCounts: Object.fromEntries(counts.map((c) => [c.targetId, c.n])),
    nextReleaseAt,
    ...hidden,
  };
}

/** A member's all-time trophies over the visible rounds, with char and trophy name, or null when none. */
export async function memberTrophies(tx: Tx, communityId: string, userId: string) {
  const rows = await tx
    .select({ payload: snapshots.payload })
    .from(snapshots)
    .where(and(eq(snapshots.communityId, communityId), eq(snapshots.hidden, false)));
  const catalog = emojiCatalog(await loadEmojiRows(tx, communityId));
  const mine = tallyForMember(computeTrophyTally(rows.map((r) => r.payload)), userId, [...catalog.keys()]);
  if (mine.length === 0) return null;
  return mine.map((t) => {
    const emoji = catalog.get(t.emojiId);
    return {
      emojiId: t.emojiId,
      char: emoji?.char ?? '❓',
      trophyName: emoji?.trophyName ?? '',
      glowRgb: emoji?.glowRgb ?? null,
      winCount: t.winCount,
    };
  });
}
