// Portado de queridometro@7c5c5bf:src/lib/results/share-message.test.ts
import { describe, it, expect } from 'vitest';
import { buildShareMessage } from '../../domain/share-message';
import type { ShareRankingRow } from '../../domain/share-message';

describe('buildShareMessage', () => {
  it('builds full message with trophies and ranking, trophies before ranking, sections separated by blank line', () => {
    const rows: ShareRankingRow[] = [
      {
        name: 'Ana',
        emojis: [{ char: '😍', count: 3 }],
        trophies: [{ char: '🥇', trophyName: 'Mais Amada' }],
      },
      {
        name: 'Beto',
        emojis: [{ char: '😢', count: 2 }],
      },
    ];

    const message = buildShareMessage({
      rows,
      viewingDay: '2026-09-01',
      shareUrl: 'https://example.com/results',
    });

    const sections = message.split('\n\n');
    expect(sections.length).toBe(4);

    const [header, trophies, ranking, footer] = sections;
    expect(header).toBe('📊 Errômetro — 1 de setembro de 2026');
    expect(trophies).toBe('🏆 Troféus da rodada\n🥇 Ana — Mais Amada');
    expect(ranking).toBe('1. Ana 😍×3\n2. Beto 😢×2');
    expect(footer).toBe('Vote você também: https://example.com/results');

    // trophies section appears before ranking section in the overall message
    expect(message.indexOf('🏆 Troféus da rodada')).toBeLessThan(message.indexOf('1. Ana'));
  });

  it('omits trophies section entirely when no row has trophies', () => {
    const rows: ShareRankingRow[] = [
      { name: 'Ana', emojis: [{ char: '😍', count: 1 }] },
      { name: 'Beto', emojis: [{ char: '😢', count: 1 }], trophies: [] },
      { name: 'Caio', emojis: [{ char: '😂', count: 1 }], trophies: undefined },
    ];

    const message = buildShareMessage({
      rows,
      viewingDay: '2026-09-01',
      shareUrl: 'https://example.com',
    });

    expect(message).not.toContain('🏆 Troféus da rodada');

    const sections = message.split('\n\n');
    expect(sections.length).toBe(3);
  });

  it('treats a row with trophies: [] the same as trophies: undefined (no lines, no crash)', () => {
    const rowsEmpty: ShareRankingRow[] = [
      { name: 'Ana', emojis: [], trophies: [] },
      { name: 'Beto', emojis: [], trophies: [{ char: '🏅', trophyName: 'Campeão' }] },
    ];
    const rowsUndefined: ShareRankingRow[] = [
      { name: 'Ana', emojis: [], trophies: undefined },
      { name: 'Beto', emojis: [], trophies: [{ char: '🏅', trophyName: 'Campeão' }] },
    ];

    const msgEmpty = buildShareMessage({
      rows: rowsEmpty,
      viewingDay: '2026-09-01',
      shareUrl: 'https://example.com',
    });
    const msgUndefined = buildShareMessage({
      rows: rowsUndefined,
      viewingDay: '2026-09-01',
      shareUrl: 'https://example.com',
    });

    expect(msgEmpty).toBe(msgUndefined);

    const sections = msgEmpty.split('\n\n');
    const trophiesSection = sections.find((s) => s.startsWith('🏆 Troféus da rodada'));
    expect(trophiesSection).toBe('🏆 Troféus da rodada\n🏅 Beto — Campeão');
  });

  it('gives a single row with 2 trophies two separate lines, not merged', () => {
    const rows: ShareRankingRow[] = [
      {
        name: 'Ana',
        emojis: [],
        trophies: [
          { char: '🥇', trophyName: 'Mais Amada' },
          { char: '😭', trophyName: 'Mais Chorona' },
        ],
      },
    ];

    const message = buildShareMessage({
      rows,
      viewingDay: '2026-09-01',
      shareUrl: 'https://example.com',
    });

    const sections = message.split('\n\n');
    const trophiesSection = sections.find((s) => s.startsWith('🏆 Troféus da rodada'));
    expect(trophiesSection).toBe('🏆 Troféus da rodada\n🥇 Ana — Mais Amada\n😭 Ana — Mais Chorona');
  });

  it('gives each row with exactly 1 trophy its own line, in row order', () => {
    const rows: ShareRankingRow[] = [
      { name: 'Ana', emojis: [], trophies: [{ char: '🥇', trophyName: 'Primeiro' }] },
      { name: 'Beto', emojis: [], trophies: [{ char: '🥈', trophyName: 'Segundo' }] },
      { name: 'Caio', emojis: [], trophies: [{ char: '🥉', trophyName: 'Terceiro' }] },
    ];

    const message = buildShareMessage({
      rows,
      viewingDay: '2026-09-01',
      shareUrl: 'https://example.com',
    });

    const sections = message.split('\n\n');
    const trophiesSection = sections.find((s) => s.startsWith('🏆 Troféus da rodada'));
    expect(trophiesSection).toBe('🏆 Troféus da rodada\n🥇 Ana — Primeiro\n🥈 Beto — Segundo\n🥉 Caio — Terceiro');
  });

  it('renders an em dash for a row with empty emojis array', () => {
    const rows: ShareRankingRow[] = [{ name: 'Ana', emojis: [] }];

    const message = buildShareMessage({
      rows,
      viewingDay: '2026-09-01',
      shareUrl: 'https://example.com',
    });

    const sections = message.split('\n\n');
    const rankingSection = sections[sections.length - 2];
    expect(rankingSection).toBe('1. Ana —');
  });

  it('preserves the given order of multiple emojis on one row (no re-sort)', () => {
    // deliberately not alphabetical and not sorted by count, to catch any re-sort
    const rows: ShareRankingRow[] = [
      {
        name: 'Ana',
        emojis: [
          { char: '😢', count: 1 },
          { char: '😍', count: 5 },
          { char: '😂', count: 3 },
        ],
      },
    ];

    const message = buildShareMessage({
      rows,
      viewingDay: '2026-09-01',
      shareUrl: 'https://example.com',
    });

    const sections = message.split('\n\n');
    const rankingSection = sections[sections.length - 2];
    expect(rankingSection).toBe('1. Ana 😢×1 😍×5 😂×3');
  });

  it('formats the header date in pt-BR long form, matching the input day exactly (UTC-safe)', () => {
    const cases: [string, string][] = [
      ['2026-09-01', '1 de setembro de 2026'],
      ['2026-12-31', '31 de dezembro de 2026'],
      ['2026-01-05', '5 de janeiro de 2026'],
    ];

    for (const [viewingDay, expectedDate] of cases) {
      const message = buildShareMessage({
        rows: [],
        viewingDay,
        shareUrl: 'https://example.com',
      });
      const header = message.split('\n\n')[0];
      expect(header).toBe(`📊 Errômetro — ${expectedDate}`);
    }
  });

  it('inserts shareUrl verbatim in the footer line, including query strings', () => {
    const shareUrl = 'https://example.com/results?group=abc';
    const message = buildShareMessage({
      rows: [{ name: 'Ana', emojis: [{ char: '😍', count: 1 }] }],
      viewingDay: '2026-09-01',
      shareUrl,
    });

    const sections = message.split('\n\n');
    const footer = sections[sections.length - 1];
    expect(footer).toBe(`Vote você também: ${shareUrl}`);
  });

  it('handles an empty rows array without throwing, with header and footer present and ordered', () => {
    expect(() =>
      buildShareMessage({
        rows: [],
        viewingDay: '2026-09-01',
        shareUrl: 'https://example.com',
      }),
    ).not.toThrow();

    const message = buildShareMessage({
      rows: [],
      viewingDay: '2026-09-01',
      shareUrl: 'https://example.com',
    });

    expect(message).not.toContain('🏆 Troféus da rodada');
    expect(message).toContain('📊 Errômetro — 1 de setembro de 2026');
    expect(message).toContain('Vote você também: https://example.com');
    expect(message.indexOf('📊 Errômetro')).toBeLessThan(message.indexOf('Vote você também'));
  });
});
