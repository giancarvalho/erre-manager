// Portado de queridometro@7c5c5bf:src/domain/events/trophy-winner.test.ts
import { describe, expect, it } from 'vitest';
import { trophyWinnersFromSnapshot } from '../../domain/trophy-winner';
import type { EventSnapshotPayload as VotingEventSnapshotPayload } from '../../domain/snapshot';

describe('trophyWinnersFromSnapshot', () => {
  it('categórico: projeta cada vencedor solo (count vira magnitude)', () => {
    const payload: VotingEventSnapshotPayload = {
      votingType: 'categorical',
      targets: [],
      trophies: [
        { emojiId: 'coracao', count: 3, winnerTargetId: 'alice', tiedTargetIds: [] },
        { emojiId: 'cobra', count: 2, winnerTargetId: 'bob', tiedTargetIds: [] },
      ],
    };
    expect(trophyWinnersFromSnapshot(payload)).toEqual([
      { emojiId: 'coracao', winnerUserId: 'alice', magnitude: 3 },
      { emojiId: 'cobra', winnerUserId: 'bob', magnitude: 2 },
    ]);
  });

  it('categórico: empate (winnerTargetId null) não gera linha nenhuma', () => {
    const payload: VotingEventSnapshotPayload = {
      votingType: 'categorical',
      targets: [],
      trophies: [
        { emojiId: 'coracao', count: 3, winnerTargetId: null, tiedTargetIds: ['alice', 'bob'] },
        { emojiId: 'cobra', count: 2, winnerTargetId: 'carol', tiedTargetIds: [] },
      ],
    };
    expect(trophyWinnersFromSnapshot(payload)).toEqual([{ emojiId: 'cobra', winnerUserId: 'carol', magnitude: 2 }]);
  });

  it('escala: projeta cada vencedor solo (average vira magnitude)', () => {
    const payload: VotingEventSnapshotPayload = {
      votingType: 'scale',
      targets: [],
      trophies: [
        { emojiId: 'limao', average: 4.5, winnerTargetId: 'alice', tiedTargetIds: [] },
        { emojiId: 'fogo', average: 2.33, winnerTargetId: 'bob', tiedTargetIds: [] },
      ],
    };
    expect(trophyWinnersFromSnapshot(payload)).toEqual([
      { emojiId: 'limao', winnerUserId: 'alice', magnitude: 4.5 },
      { emojiId: 'fogo', winnerUserId: 'bob', magnitude: 2.33 },
    ]);
  });

  it('escala: empate (winnerTargetId null) não gera linha nenhuma', () => {
    const payload: VotingEventSnapshotPayload = {
      votingType: 'scale',
      targets: [],
      trophies: [{ emojiId: 'limao', average: 4.5, winnerTargetId: null, tiedTargetIds: ['alice', 'bob'] }],
    };
    expect(trophyWinnersFromSnapshot(payload)).toEqual([]);
  });

  it('nenhum troféu no snapshot -> lista vazia', () => {
    const payload: VotingEventSnapshotPayload = { votingType: 'categorical', targets: [], trophies: [] };
    expect(trophyWinnersFromSnapshot(payload)).toEqual([]);
  });
});
