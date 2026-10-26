// Ordens e rótulos das telas de evento, portados em comportamento de queridometro@7c5c5bf:
// src/components/group/events/EventResultsRanking.tsx, EventResultsTrophyList.tsx e
// src/app/group/[id]/page.tsx (banner do hub).
import { describe, expect, it } from 'vitest';

import {
  categoricalRanking,
  hubEvent,
  RESULTS_BANNER_GRACE_MS,
  scaleAxes,
  scaleMagnitudeLabel,
  scalePercent,
  shareOptions,
  sortEvents,
  trophyViews,
  type EmojiInfo,
} from '../../domain/presentation';
import { buildEventShareMessage } from '../../domain/share-message';
import type { EventSnapshotPayload } from '../../domain/snapshot';

const people = { a: { displayName: 'Ana', avatarVariant: 'cyan' }, b: { displayName: 'Bia', avatarVariant: 'rose' } };
const coracao: EmojiInfo = { id: 'coracao', char: '❤️', label: 'Coração', trophyName: 'Mais Amado', scaleMax: 10 };
const cobra: EmojiInfo = { id: 'cobra', char: '🐍', label: 'Cobra', trophyName: 'Mais Cobra', scaleMax: 1 };

describe('hubEvent', () => {
  const now = new Date('2026-05-10T12:00:00Z');
  const ev = (status: string, closedAt: string | null = null) => ({ status, closedAt }) as never;

  it('prefers the open event, then the one taking applications', () => {
    expect(hubEvent([ev('closed', '2026-05-10T00:00:00Z'), ev('accepting_applications'), ev('open')], now)).toEqual(
      ev('open'),
    );
    expect(hubEvent([ev('draft'), ev('accepting_applications')], now)).toEqual(ev('accepting_applications'));
  });

  it('a closed event shows for 2 days after it closed; a draft never does', () => {
    const recent = new Date(now.getTime() - RESULTS_BANNER_GRACE_MS).toISOString();
    const old = new Date(now.getTime() - RESULTS_BANNER_GRACE_MS - 1).toISOString();
    expect(hubEvent([ev('draft'), ev('closed', recent)], now)).toEqual(ev('closed', recent));
    expect(hubEvent([ev('closed', old)], now)).toBeNull();
  });

  it('the most recently CLOSED wins, not the most recently listed', () => {
    const a = ev('closed', '2026-05-09T00:00:00Z');
    const b = ev('closed', '2026-05-10T00:00:00Z');
    expect(hubEvent([a, b], now)).toBe(b);
  });
});

describe('sortEvents', () => {
  it('open, accepting, draft, closed; newest first within each', () => {
    const e = (id: string, status: string, createdAt: string) => ({ id, status, createdAt }) as never;
    const sorted = sortEvents([
      e('c1', 'closed', '2026-01-03'),
      e('d1', 'draft', '2026-01-01'),
      e('o1', 'open', '2026-01-01'),
      e('d2', 'draft', '2026-01-02'),
      e('a1', 'accepting_applications', '2026-01-01'),
    ]);
    expect(sorted.map((x: { id: string }) => x.id)).toEqual(['o1', 'a1', 'd2', 'd1', 'c1']);
  });
});

describe('scale labels', () => {
  it('percent of the axis ceiling; ceiling 1 shows the count', () => {
    expect(scalePercent(7, 10)).toBe(70);
    expect(scalePercent(3.5, 5)).toBe(70);
    expect(scaleMagnitudeLabel(1, 3, 1)).toBe('×3');
    expect(scaleMagnitudeLabel(7.33, 22, 10)).toBe('73%');
  });
});

describe('rankings', () => {
  const categorical: EventSnapshotPayload = {
    votingType: 'categorical',
    targets: [
      { targetId: 'a', byEmoji: [{ emojiId: 'coracao', count: 1 }], total: 1 },
      { targetId: 'b', byEmoji: [{ emojiId: 'coracao', count: 2 }], total: 2 },
      { targetId: 'x', byEmoji: [{ emojiId: 'cobra', count: 1 }], total: 1 },
    ],
    trophies: [],
  };

  it('categorical: by total, ties by name; someone who left shows as "Alguém"', () => {
    const rows = categoricalRanking(categorical as never, new Map([['coracao', coracao]]), people);
    expect(rows.map((r) => r.person.displayName)).toEqual(['Bia', 'Alguém', 'Ana']);
    expect(rows[0]!.byEmoji).toEqual([{ emojiId: 'coracao', char: '❤️', count: 2 }]);
    expect(rows[1]!.byEmoji[0]!.char).toBe('❓');
  });

  const scale: EventSnapshotPayload = {
    votingType: 'scale',
    targets: [
      {
        targetId: 'a',
        byEmoji: [
          { emojiId: 'coracao', average: 6.5, sum: 13, voteCount: 2 },
          { emojiId: 'cobra', average: 1, sum: 2, voteCount: 2 },
        ],
      },
      {
        targetId: 'b',
        byEmoji: [
          { emojiId: 'coracao', average: 9, sum: 9, voteCount: 1 },
          { emojiId: 'cobra', average: 1, sum: 5, voteCount: 5 },
        ],
      },
    ],
    trophies: [
      { emojiId: 'coracao', average: 9, winnerTargetId: 'b', tiedTargetIds: [] },
      { emojiId: 'cobra', average: 5, winnerTargetId: 'b', tiedTargetIds: [] },
    ],
  };

  it('scale: one leaderboard per axis in roster order; by average, or by count on a ceiling-1 axis', () => {
    const axes = scaleAxes(scale as never, [cobra, coracao], people);
    expect(axes.map((a) => a.emoji.id)).toEqual(['cobra', 'coracao']);
    expect(axes[0]!.rows.map((r) => [r.person.displayName, r.label])).toEqual([
      ['Bia', '×5'],
      ['Ana', '×2'],
    ]);
    expect(axes[1]!.rows.map((r) => [r.person.displayName, r.label])).toEqual([
      ['Bia', '90%'],
      ['Ana', '65%'],
    ]);
  });

  it('trophies: name, magnitude and ties', () => {
    const views = trophyViews(
      scale,
      new Map([
        ['coracao', coracao],
        ['cobra', cobra],
      ]),
      people,
    );
    expect(views.map((v) => [v.emoji.id, v.winner?.person.displayName, v.magnitude])).toEqual([
      ['coracao', 'Bia', '90%'],
      ['cobra', 'Bia', '×5'],
    ]);
    const tie = trophyViews(
      {
        votingType: 'categorical',
        targets: [],
        trophies: [{ emojiId: 'coracao', count: 3, winnerTargetId: null, tiedTargetIds: ['a', 'b'] }],
      },
      new Map([['coracao', coracao]]),
      people,
    );
    expect(tie[0]).toEqual(expect.objectContaining({ winner: null, magnitude: '×3' }));
    expect(tie[0]!.tied.map((p) => p.displayName)).toEqual(['Ana', 'Bia']);
  });

  it('share text: legacy format with trophies won and the per-axis ranking', () => {
    const text = buildEventShareMessage(
      shareOptions({
        title: 'Churrasco',
        closedAtLabel: '10 de maio de 2026',
        resultsUrl: 'https://app/eventos/e1/resultados',
        result: scale,
        roster: [coracao, cobra],
        people,
      }),
    );
    expect(text).toBe(
      [
        '📊 Churrasco — 10 de maio de 2026',
        '🏆 Troféus do evento\n❤️ Bia — Mais Amado\n🐍 Bia — Mais Cobra',
        '❤️ Coração\n1. Bia 90%\n2. Ana 65%\n\n🐍 Cobra\n1. Bia ×5\n2. Ana ×2',
        'Resultado completo: https://app/eventos/e1/resultados',
      ].join('\n\n'),
    );
  });
});
