// Portado de queridometro@7c5c5bf:src/lib/voting/filter-existing-votes.ts
/** targetId -> emojiId, as kept by the voting screen and the device. */
export type VoteMap = Record<string, string>;

/**
 * Drops votes cast for members who are no longer voting targets (e.g. removed after the vote was cast).
 * Without this, a stale targetId pre-filled into the voting form would be sent again on the next update.
 */
export function filterVotesToCurrentMembers(votes: VoteMap, currentMembers: readonly { id: string }[]): VoteMap {
  const validIds = new Set(currentMembers.map((m) => m.id));
  const out: VoteMap = {};
  for (const [targetId, emojiId] of Object.entries(votes)) {
    if (validIds.has(targetId)) out[targetId] = emojiId;
  }
  return out;
}

/**
 * Drops votes whose emoji is no longer in the active roster (e.g. removed since the vote was remembered).
 * If every remembered vote used a stale emoji, the batch would end up empty server-side and the submit
 * would fail with "Nenhum voto válido." for something the person did nothing wrong to cause.
 */
export function filterVotesToKnownEmojis(votes: VoteMap, validEmojiIds: readonly string[]): VoteMap {
  const validIds = new Set(validEmojiIds);
  const out: VoteMap = {};
  for (const [targetId, emojiId] of Object.entries(votes)) {
    if (validIds.has(emojiId)) out[targetId] = emojiId;
  }
  return out;
}
