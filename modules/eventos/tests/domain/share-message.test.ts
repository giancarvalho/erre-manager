// Portado de queridometro@7c5c5bf:src/lib/events/event-share-message.test.ts
import { describe, it, expect } from 'vitest';
import { buildEventShareMessage } from '../../domain/share-message';
import type { EventShareCategoricalRow, EventShareScaleAxis, EventShareTrophyRow } from '../../domain/share-message';

describe('buildEventShareMessage', () => {
  it('builds full categorical message with trophies before ranking, sections separated by blank line', () => {
    const trophies: EventShareTrophyRow[] = [{ char: '🥇', trophyName: 'Mais Amado', winnerName: 'Ana' }];
    const rows: EventShareCategoricalRow[] = [
      { name: 'Ana', emojis: [{ char: '😍', count: 3 }] },
      { name: 'Beto', emojis: [{ char: '😢', count: 2 }] },
    ];

    const message = buildEventShareMessage({
      eventTitle: 'Amigo Secreto',
      closedAtLabel: '10 de setembro de 2026',
      votingType: 'categorical',
      trophies,
      rows,
      resultsUrl: 'https://example.com/group/g1/events/e1/results',
    });

    const sections = message.split('\n\n');
    expect(sections.length).toBe(4);
    const [header, trophySection, ranking, footer] = sections;
    expect(header).toBe('📊 Amigo Secreto — 10 de setembro de 2026');
    expect(trophySection).toBe('🏆 Troféus do evento\n🥇 Ana — Mais Amado');
    expect(ranking).toBe('1. Ana 😍×3\n2. Beto 😢×2');
    expect(footer).toBe('Resultado completo: https://example.com/group/g1/events/e1/results');

    expect(message.indexOf('🏆 Troféus do evento')).toBeLessThan(message.indexOf('1. Ana'));
  });

  it('omits the trophies section when nobody won anything', () => {
    const message = buildEventShareMessage({
      eventTitle: 'Amigo Secreto',
      closedAtLabel: '10 de setembro de 2026',
      votingType: 'categorical',
      trophies: [],
      rows: [{ name: 'Ana', emojis: [{ char: '😍', count: 1 }] }],
      resultsUrl: 'https://example.com',
    });

    expect(message).not.toContain('🏆 Troféus do evento');
    expect(message.split('\n\n').length).toBe(3);
  });

  it('gives a single winner with 2 trophies two separate lines, not merged', () => {
    const trophies: EventShareTrophyRow[] = [
      { char: '🥇', trophyName: 'Mais Amado', winnerName: 'Ana' },
      { char: '😭', trophyName: 'Mais Choroso', winnerName: 'Ana' },
    ];
    const message = buildEventShareMessage({
      eventTitle: 'Amigo Secreto',
      closedAtLabel: '10 de setembro de 2026',
      votingType: 'categorical',
      trophies,
      rows: [],
      resultsUrl: 'https://example.com',
    });

    const trophySection = message.split('\n\n').find((s) => s.startsWith('🏆 Troféus do evento'));
    expect(trophySection).toBe('🏆 Troféus do evento\n🥇 Ana — Mais Amado\n😭 Ana — Mais Choroso');
  });

  it('renders an em dash for a categorical row with no emojis', () => {
    const message = buildEventShareMessage({
      eventTitle: 'Amigo Secreto',
      closedAtLabel: '10 de setembro de 2026',
      votingType: 'categorical',
      trophies: [],
      rows: [{ name: 'Ana', emojis: [] }],
      resultsUrl: 'https://example.com',
    });

    const rankingSection = message.split('\n\n')[1];
    expect(rankingSection).toBe('1. Ana —');
  });

  it('omits the ranking section entirely for categorical with zero rows', () => {
    const message = buildEventShareMessage({
      eventTitle: 'Amigo Secreto',
      closedAtLabel: '10 de setembro de 2026',
      votingType: 'categorical',
      trophies: [],
      rows: [],
      resultsUrl: 'https://example.com',
    });

    const sections = message.split('\n\n');
    expect(sections.length).toBe(2);
    expect(sections[0]).toBe('📊 Amigo Secreto — 10 de setembro de 2026');
    expect(sections[1]).toBe('Resultado completo: https://example.com');
  });

  it('builds a scale message with one block per axis, blank-line separated, axes in given order', () => {
    const axes: EventShareScaleAxis[] = [
      {
        char: '🔥',
        label: 'Disposição',
        rows: [
          { name: 'Ana', magnitudeLabel: '90%' },
          { name: 'Beto', magnitudeLabel: '60%' },
        ],
      },
      {
        char: '😴',
        label: 'Cansaço',
        rows: [{ name: 'Caio', magnitudeLabel: '×3' }],
      },
    ];

    const message = buildEventShareMessage({
      eventTitle: 'Retrô do time',
      closedAtLabel: '10 de setembro de 2026',
      votingType: 'scale',
      trophies: [],
      axes,
      resultsUrl: 'https://example.com',
    });

    const sections = message.split('\n\n');
    expect(sections.length).toBe(4);
    expect(sections[1]).toBe('🔥 Disposição\n1. Ana 90%\n2. Beto 60%');
    expect(sections[2]).toBe('😴 Cansaço\n1. Caio ×3');
  });

  it('skips an axis with zero rows (nobody rated it) without leaving a blank block', () => {
    const axes: EventShareScaleAxis[] = [
      { char: '🔥', label: 'Disposição', rows: [] },
      { char: '😴', label: 'Cansaço', rows: [{ name: 'Caio', magnitudeLabel: '×1' }] },
    ];

    const message = buildEventShareMessage({
      eventTitle: 'Retrô do time',
      closedAtLabel: '10 de setembro de 2026',
      votingType: 'scale',
      trophies: [],
      axes,
      resultsUrl: 'https://example.com',
    });

    expect(message).not.toContain('🔥 Disposição');
    const sections = message.split('\n\n');
    expect(sections.length).toBe(3);
  });

  it('omits the ranking section entirely when scale has no axes with votes', () => {
    const message = buildEventShareMessage({
      eventTitle: 'Retrô do time',
      closedAtLabel: '10 de setembro de 2026',
      votingType: 'scale',
      trophies: [],
      axes: [],
      resultsUrl: 'https://example.com',
    });

    const sections = message.split('\n\n');
    expect(sections.length).toBe(2);
  });

  it('inserts resultsUrl verbatim in the footer, including query strings', () => {
    const resultsUrl = 'https://example.com/group/g1/events/e1/results?voteStatus=inserted';
    const message = buildEventShareMessage({
      eventTitle: 'Amigo Secreto',
      closedAtLabel: '10 de setembro de 2026',
      votingType: 'categorical',
      trophies: [],
      rows: [],
      resultsUrl,
    });

    const footer = message.split('\n\n').pop();
    expect(footer).toBe(`Resultado completo: ${resultsUrl}`);
  });

  it('preserves the given order of multiple emojis on one categorical row (no re-sort)', () => {
    const rows: EventShareCategoricalRow[] = [
      {
        name: 'Ana',
        emojis: [
          { char: '😢', count: 1 },
          { char: '😍', count: 5 },
          { char: '😂', count: 3 },
        ],
      },
    ];

    const message = buildEventShareMessage({
      eventTitle: 'Amigo Secreto',
      closedAtLabel: '10 de setembro de 2026',
      votingType: 'categorical',
      trophies: [],
      rows,
      resultsUrl: 'https://example.com',
    });

    const rankingSection = message.split('\n\n')[1];
    expect(rankingSection).toBe('1. Ana 😢×1 😍×5 😂×3');
  });
});
