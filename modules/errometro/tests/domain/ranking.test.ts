// Portado de queridometro@7c5c5bf:src/lib/daily-results-to-ranking.test.ts e src/lib/ranking.test.ts
// (sortRankingEntries). blurredRankingRows não foi portado: só o demo usava (P-003).
import { EMOJI_OPTIONS } from '@erre/emoji';
import { describe, expect, it } from 'vitest';

import { roundToRankingEntries, sortRankingEntries, type RankingEntry } from '../../domain/ranking';

const members = [
  { userId: 'u1', displayName: 'Ana', avatarVariant: 'indigo' },
  { userId: 'u2', displayName: 'Bruno', avatarVariant: 'rose' },
  { userId: 'u3', displayName: 'Carla', avatarVariant: 'amber' },
];
const CATALOG = new Map(EMOJI_OPTIONS.map((o) => [o.id, { char: o.char }]));

const round = (targets: { targetId: string; votes: { emojiId: string; count: number }[] }[]) => ({
  targets: targets.map(({ targetId, votes }) => ({
    targetId,
    byEmoji: votes,
    total: votes.reduce((s, v) => s + v.count, 0),
  })),
});

describe('roundToRankingEntries', () => {
  it('mapeia votos para entries e ordena por total', () => {
    const rows = roundToRankingEntries(
      round([
        { targetId: 'u1', votes: [{ emojiId: 'coracao', count: 3 }] },
        { targetId: 'u2', votes: [{ emojiId: 'coracao', count: 10 }] },
      ]),
      members,
      CATALOG,
    );
    expect(rows.map((r) => [r.member.userId, r.total])).toEqual([
      ['u2', 10],
      ['u1', 3],
      ['u3', 0],
    ]);
  });

  it('inclui todos os membros mesmo sem votos', () => {
    const rows = roundToRankingEntries(
      round([{ targetId: 'u1', votes: [{ emojiId: 'coracao', count: 5 }] }]),
      members,
      CATALOG,
    );
    expect(rows).toHaveLength(3);
    expect(rows.find((r) => r.member.userId === 'u3')!.total).toBe(0);
  });

  it('deixa de fora alvos que não são mais membros', () => {
    const rows = roundToRankingEntries(
      round([{ targetId: 'saiu', votes: [{ emojiId: 'coracao', count: 5 }] }]),
      members,
      CATALOG,
    );
    expect(rows.map((r) => r.member.userId)).not.toContain('saiu');
  });

  it('byEmoji só contém emojis que de fato receberam voto, não o catálogo inteiro', () => {
    const first = EMOJI_OPTIONS[0]!;
    const rows = roundToRankingEntries(
      round([{ targetId: 'u1', votes: [{ emojiId: first.id, count: 2 }] }]),
      members,
      CATALOG,
    );
    expect(rows.find((r) => r.member.userId === 'u1')!.byEmoji).toEqual([
      { emojiId: first.id, char: first.char, count: 2 },
    ]);
  });

  it('resolve o char de um emoji custom via o catálogo da comunidade', () => {
    const rows = roundToRankingEntries(
      round([{ targetId: 'u1', votes: [{ emojiId: 'custom-abc123', count: 4 }] }]),
      members,
      new Map([['custom-abc123', { char: '🦄' }]]),
    );
    expect(rows.find((r) => r.member.userId === 'u1')!.byEmoji).toEqual([
      { emojiId: 'custom-abc123', char: '🦄', count: 4 },
    ]);
  });

  it('retorna array vazio para lista de membros vazia', () => {
    expect(roundToRankingEntries(round([]), [], CATALOG)).toEqual([]);
  });
});

const entry = (userId: string, displayName: string, total: number): RankingEntry => ({
  member: { userId, displayName, avatarVariant: 'indigo' },
  byEmoji: [],
  total,
});

describe('sortRankingEntries', () => {
  it('ordena por total decrescente', () => {
    expect(
      sortRankingEntries([entry('a', 'Ana', 3), entry('b', 'Bruno', 10), entry('c', 'Carlos', 5)]).map((e) => e.total),
    ).toEqual([10, 5, 3]);
  });

  it('empurra totais zero para o final', () => {
    expect(sortRankingEntries([entry('a', 'Ana', 0), entry('b', 'Bruno', 5)]).map((e) => e.total)).toEqual([5, 0]);
  });

  it('desempata alfabeticamente pelo nome', () => {
    expect(sortRankingEntries([entry('a', 'Zeca', 5), entry('b', 'Ana', 5)]).map((e) => e.member.displayName)).toEqual([
      'Ana',
      'Zeca',
    ]);
  });

  it('não muta o array original', () => {
    const entries = [entry('a', 'Ana', 3), entry('b', 'Bruno', 10)];
    sortRankingEntries(entries);
    expect(entries[0]!.member.userId).toBe('a');
  });

  it('lida com array vazio', () => {
    expect(sortRankingEntries([])).toEqual([]);
  });
});
