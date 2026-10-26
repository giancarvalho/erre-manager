// Portado de queridometro@7c5c5bf:src/lib/trophies/event-trophy-wins.test.ts, contra a agregação pura.
import { DEFAULT_TROPHY_GLOW_RGB, DEFAULT_TROPHY_NAME } from '@erre/emoji';
import { describe, expect, it } from 'vitest';

import type { ResolvedEventEmoji } from '../../domain/emoji-config';
import { memberEventTrophies, type EventInfo, type TrophyWinRow } from '../../domain/trophies';

const emoji = (id: string, over: Partial<ResolvedEventEmoji> = {}): ResolvedEventEmoji => ({
  id,
  char: '⭐',
  label: id,
  trophyName: `Troféu ${id}`,
  isCustom: false,
  description: null,
  glowRgb: '1 2 3',
  scaleMax: null,
  ...over,
});
const win = (over: Partial<TrophyWinRow>): TrophyWinRow => ({
  eventId: 'e1',
  emojiId: 'coracao',
  votingType: 'categorical',
  magnitude: 3,
  wonAt: new Date('2026-01-01T00:00:00Z'),
  ...over,
});

describe('memberEventTrophies', () => {
  it('sem troféus, listas vazias', () => {
    expect(memberEventTrophies([], new Map())).toEqual({ categorical: [], scale: [] });
  });

  it('junta vitórias categóricas do mesmo emoji em vários eventos num ×N', () => {
    const events = new Map<string, EventInfo>([
      ['e1', { title: 'A', roster: [emoji('coracao')] }],
      ['e2', { title: 'B', roster: [emoji('coracao')] }],
    ]);
    const r = memberEventTrophies([win({}), win({ eventId: 'e2' })], events);
    expect(r.categorical).toEqual([
      { emojiId: 'coracao', char: '⭐', trophyName: 'Troféu coracao', glowRgb: '1 2 3', winCount: 2 },
    ]);
  });

  it('mesmo id em dois eventos com rosters diferentes: vale o do troféu mais RECENTE, não a ordem de leitura', () => {
    const events = new Map<string, EventInfo>([
      ['old', { title: 'Velho', roster: [emoji('custom-a', { char: '🐢', trophyName: 'Velho' })] }],
      ['new', { title: 'Novo', roster: [emoji('custom-a', { char: '🚀', trophyName: 'Novo' })] }],
    ]);
    const r = memberEventTrophies(
      [
        win({ eventId: 'old', emojiId: 'custom-a', wonAt: new Date('2026-01-01T00:00:00Z') }),
        win({ eventId: 'new', emojiId: 'custom-a', wonAt: new Date('2026-03-01T00:00:00Z') }),
      ],
      events,
    );
    expect(r.categorical[0]).toEqual(expect.objectContaining({ char: '🚀', trophyName: 'Novo', winCount: 2 }));
  });

  it('vitória de escala traz o título do evento, o eixo do roster, a média e o teto do eixo vencido', () => {
    const events = new Map<string, EventInfo>([
      [
        'e1',
        {
          title: 'Churrasco',
          roster: [emoji('limao', { scaleMax: 3 }), emoji('estrela', { char: '🌟', scaleMax: 10 })],
        },
      ],
    ]);
    const r = memberEventTrophies([win({ votingType: 'scale', emojiId: 'estrela', magnitude: 7.33 })], events);
    expect(r.scale).toEqual([
      {
        eventId: 'e1',
        eventTitle: 'Churrasco',
        emojiId: 'estrela',
        char: '🌟',
        label: 'estrela',
        trophyName: 'Troféu estrela',
        glowRgb: '1 2 3',
        average: 7.33,
        scaleMax: 10,
        wonAt: '2026-01-01T00:00:00.000Z',
      },
    ]);
  });

  it('ordena as vitórias de escala da mais recente para a mais antiga', () => {
    const r = memberEventTrophies(
      [
        win({ votingType: 'scale', eventId: 'a', wonAt: new Date('2026-01-01T00:00:00Z') }),
        win({ votingType: 'scale', eventId: 'b', wonAt: new Date('2026-02-01T00:00:00Z') }),
      ],
      new Map(),
    );
    expect(r.scale.map((s) => s.eventId)).toEqual(['b', 'a']);
  });

  it('evento ou eixo que não resolve mais cai nos padrões, sem quebrar', () => {
    const r = memberEventTrophies([win({ votingType: 'scale' }), win({ emojiId: 'sumiu' })], new Map());
    expect(r.scale[0]).toEqual(
      expect.objectContaining({ eventTitle: 'Evento', char: '🏆', trophyName: DEFAULT_TROPHY_NAME, scaleMax: null }),
    );
    expect(r.categorical[0]).toEqual(
      expect.objectContaining({ char: '🏆', trophyName: DEFAULT_TROPHY_NAME, glowRgb: DEFAULT_TROPHY_GLOW_RGB }),
    );
  });
});
