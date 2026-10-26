// Portado de queridometro@7c5c5bf:src/domain/voting/release-window.test.ts
import { describe, expect, it } from 'vitest';
import {
  getReleaseWindow,
  getReleaseAnchorDay,
  getNextReleaseInstant,
  getGroupReleaseWindow,
  DEFAULT_RELEASE_CONFIG,
  ACTIVE_RELEASE_CONFIG,
  type ReleaseConfig,
} from '../../domain/release-window';
import { getNoonCutWindow, getVotingDay } from '../../domain/calendar';
import { formatInTimeZone } from 'date-fns-tz';

const ZONE = 'America/Sao_Paulo';

function formatInTimeZoneYmd(date: Date): string {
  return formatInTimeZone(date, ZONE, 'yyyy-MM-dd');
}

describe('release-window', () => {
  describe('config diária (default) — regressão contra calendar.ts', () => {
    const instants = [
      '2026-07-01T00:00:00.000Z',
      '2026-07-01T11:59:00.000Z', // pouco antes do meio-dia BRT
      '2026-07-01T15:00:00.000Z', // meio-dia BRT em ponto (UTC-3)
      '2026-07-01T15:01:00.000Z',
      '2026-07-01T23:59:00.000Z',
      '2026-07-04T12:00:00.000Z',
    ];

    for (const iso of instants) {
      it(`bate exatamente com getNoonCutWindow/getVotingDay em ${iso}`, () => {
        const now = new Date(iso);
        expect(getReleaseWindow(DEFAULT_RELEASE_CONFIG, now, ZONE)).toEqual(getNoonCutWindow(now, ZONE));
        expect(getReleaseAnchorDay(DEFAULT_RELEASE_CONFIG, now, ZONE)).toBe(getVotingDay(now, ZONE));
      });
    }
  });

  describe('config semanal', () => {
    const weekly: ReleaseConfig = {
      frequency: 'weekly',
      releaseHour: 19,
      releaseWeekday: 7, // domingo
    };

    it('a janela abrange exatamente 7 dias', () => {
      const { from, to } = getReleaseWindow(weekly, new Date('2026-07-08T12:00:00.000Z'), ZONE);
      const diffDays = (to.getTime() - from.getTime()) / 86_400_000;
      expect(diffDays).toBe(7);
    });

    it('a âncora do período é a MESMA em qualquer dia dentro da janela — é isso que garante que atualizar votos em dias diferentes sobrescreve', () => {
      // Domingo 2026-07-05 19h BRT é um corte; o próximo é domingo 2026-07-12 19h BRT.
      // Qualquer instante entre esses dois (exclusive/inclusive nas bordas) deve
      // resolver a MESMA âncora — segunda, quarta, sábado da mesma semana.
      const monday = new Date('2026-07-06T15:00:00.000Z');
      const wednesday = new Date('2026-07-08T20:00:00.000Z');
      const saturday = new Date('2026-07-11T23:00:00.000Z');

      const anchorMon = getReleaseAnchorDay(weekly, monday, ZONE);
      const anchorWed = getReleaseAnchorDay(weekly, wednesday, ZONE);
      const anchorSat = getReleaseAnchorDay(weekly, saturday, ZONE);

      expect(anchorMon).toBe(anchorWed);
      expect(anchorWed).toBe(anchorSat);
    });

    it('a âncora muda ao cruzar a fronteira de liberação (domingo 19h no fuso)', () => {
      const beforeCutover = new Date('2026-07-05T21:59:00.000Z'); // 18:59 BRT (UTC-3) de domingo
      const afterCutover = new Date('2026-07-05T22:01:00.000Z'); // 19:01 BRT de domingo

      const anchorBefore = getReleaseAnchorDay(weekly, beforeCutover, ZONE);
      const anchorAfter = getReleaseAnchorDay(weekly, afterCutover, ZONE);

      expect(anchorBefore).not.toBe(anchorAfter);
    });

    it('janelas semanais consecutivas têm âncoras 7 dias civis apartadas', () => {
      const week1 = getReleaseAnchorDay(weekly, new Date('2026-07-08T15:00:00.000Z'), ZONE);
      const week2 = getReleaseAnchorDay(weekly, new Date('2026-07-15T15:00:00.000Z'), ZONE);
      const d1 = new Date(week1 + 'T12:00:00.000Z');
      const d2 = new Date(week2 + 'T12:00:00.000Z');
      const diffDays = (d2.getTime() - d1.getTime()) / 86_400_000;
      expect(diffDays).toBe(7);
    });
  });

  describe('getNextReleaseInstant — âncora olhando pra frente a partir da última liberação real', () => {
    const MONDAY_NOON = ACTIVE_RELEASE_CONFIG; // semanal, segunda 12h

    it("transição de cadência: 'from' é HOJE (não segunda) -> 'to' é a PRÓXIMA segunda, não a passada", () => {
      // Hoje é sexta-feira 2026-07-03 — se a fórmula olhasse "pra trás" a
      // partir de agora, ela acharia a segunda passada (2026-06-29). A
      // fórmula correta, ancorada em 'from', deve achar a PRÓXIMA segunda.
      const from = new Date('2026-07-03T15:00:00.000Z'); // sexta
      const next = getNextReleaseInstant(MONDAY_NOON, from, ZONE);
      expect(formatInTimeZoneYmd(next)).toBe('2026-07-06'); // próxima segunda
      expect(next.getTime()).toBeGreaterThan(from.getTime());
    });

    it("regime estável: 'from' já é uma segunda 12h -> 'to' é a segunda SEGUINTE (7 dias depois)", () => {
      const from = new Date('2026-07-06T15:00:00.000Z'); // segunda 12h BRT em ponto
      const next = getNextReleaseInstant(MONDAY_NOON, from, ZONE);
      expect(formatInTimeZoneYmd(next)).toBe('2026-07-13');
    });

    it("'from' um instante antes da segunda 12h no mesmo dia -> 'to' é a MESMA segunda", () => {
      const from = new Date('2026-07-06T14:59:00.000Z'); // 11:59 BRT de segunda
      const next = getNextReleaseInstant(MONDAY_NOON, from, ZONE);
      expect(formatInTimeZoneYmd(next)).toBe('2026-07-06');
    });

    it("frequência diária: sempre o próximo releaseHour estritamente após 'from'", () => {
      const daily: ReleaseConfig = { frequency: 'daily', releaseHour: 12 };
      const from = new Date('2026-07-03T15:00:00.000Z'); // exatamente meio-dia BRT
      const next = getNextReleaseInstant(daily, from, ZONE);
      expect(next.getTime()).toBeGreaterThan(from.getTime());
      expect(formatInTimeZoneYmd(next)).toBe('2026-07-04');
    });
  });

  describe('getGroupReleaseWindow — janela ancorada na última liberação do grupo', () => {
    it('bootstrap: sem liberação anterior, ancora na data de criação do grupo (from = essa data)', () => {
      const createdAt = new Date('2026-07-01T12:00:00.000Z'); // quarta
      const { from, to } = getGroupReleaseWindow(ACTIVE_RELEASE_CONFIG, createdAt, ZONE);
      expect(from).toEqual(createdAt);
      expect(formatInTimeZoneYmd(to)).toBe('2026-07-06'); // próxima segunda 12h
    });

    it('a âncora (YYYY-MM-DD) é estável em qualquer instante entre a última liberação e a próxima', () => {
      const lastReleaseAt = new Date('2026-07-06T15:00:00.000Z'); // segunda 12h BRT
      const { to } = getGroupReleaseWindow(ACTIVE_RELEASE_CONFIG, lastReleaseAt, ZONE);
      expect(formatInTimeZoneYmd(to)).toBe('2026-07-13');
    });

    it('regime estável ao longo de vários ciclos: cada liberação real ancora a próxima 7 dias depois', () => {
      let lastReleaseAt = new Date('2026-07-06T15:00:00.000Z'); // segunda 12h BRT
      const anchors: string[] = [];
      for (let i = 0; i < 3; i++) {
        const { to } = getGroupReleaseWindow(ACTIVE_RELEASE_CONFIG, lastReleaseAt, ZONE);
        anchors.push(formatInTimeZoneYmd(to));
        lastReleaseAt = to; // a próxima liberação acontece no horário agendado
      }
      expect(anchors).toEqual(['2026-07-13', '2026-07-20', '2026-07-27']);
    });
  });

  describe('cadência manual', () => {
    it("getNextReleaseInstant nunca fica no passado nem próximo — ~100 anos à frente de 'from'", () => {
      const manual: ReleaseConfig = { frequency: 'manual', releaseHour: 12 };
      const from = new Date('2026-07-03T15:00:00.000Z');
      const next = getNextReleaseInstant(manual, from);
      const diffYears = (next.getTime() - from.getTime()) / (365 * 86_400_000);
      expect(diffYears).toBeGreaterThan(50);
    });

    it('rounds diferentes (from diferente) geram âncoras diferentes — não trava no mesmo dia pra sempre', () => {
      const manual: ReleaseConfig = { frequency: 'manual', releaseHour: 12 };
      const round1 = getNextReleaseInstant(manual, new Date('2026-07-03T15:00:00.000Z'));
      const round2 = getNextReleaseInstant(manual, new Date('2026-08-03T15:00:00.000Z'));
      expect(formatInTimeZoneYmd(round1)).not.toBe(formatInTimeZoneYmd(round2));
    });

    it('getReleaseWindow/getReleaseAnchorDay rejeitam cadência manual (não fazem sentido pra ela)', () => {
      const manual: ReleaseConfig = { frequency: 'manual', releaseHour: 12 };
      expect(() => getReleaseWindow(manual, new Date())).toThrow(/manual/);
      expect(() => getReleaseAnchorDay(manual, new Date())).toThrow(/manual/);
    });

    it("getGroupReleaseWindow: 'from' fica intacto, 'to' é o placeholder distante", () => {
      const manual: ReleaseConfig = { frequency: 'manual', releaseHour: 12 };
      const lastReleaseAt = new Date('2026-07-03T15:00:00.000Z');
      const { from, to } = getGroupReleaseWindow(manual, lastReleaseAt);
      expect(from).toEqual(lastReleaseAt);
      expect(to.getTime()).toBeGreaterThan(lastReleaseAt.getTime());
    });
  });

  describe('cadência personalizada (custom) — equivalência com daily/weekly', () => {
    // Mesmos instantes/cadência do bloco "config semanal" acima, só que
    // expressos como custom com 1 dia só — prova que o novo algoritmo de
    // varredura produz resultado IDÊNTICO ao código fechado de "weekly"
    // pro caso de um dia só, não só "parecido".
    const weekly: ReleaseConfig = { frequency: 'weekly', releaseHour: 19, releaseWeekday: 7 };
    const customOneDay: ReleaseConfig = {
      frequency: 'custom',
      releaseHour: 19,
      releaseWeekdays: [7],
    };
    const instants = [
      new Date('2026-07-08T12:00:00.000Z'),
      new Date('2026-07-06T15:00:00.000Z'),
      new Date('2026-07-08T20:00:00.000Z'),
      new Date('2026-07-11T23:00:00.000Z'),
      new Date('2026-07-05T21:59:00.000Z'),
      new Date('2026-07-05T22:01:00.000Z'),
    ];

    for (const now of instants) {
      it(`custom com 1 dia bate exatamente com weekly em ${now.toISOString()}`, () => {
        expect(getReleaseWindow(customOneDay, now, ZONE)).toEqual(getReleaseWindow(weekly, now, ZONE));
        expect(getReleaseAnchorDay(customOneDay, now, ZONE)).toBe(getReleaseAnchorDay(weekly, now, ZONE));
      });
    }

    it('getNextReleaseInstant com 1 dia bate exatamente com weekly em regime estável e em transição', () => {
      const stableFrom = new Date('2026-07-05T22:00:00.000Z'); // domingo 19h BRT em ponto
      const transitionFrom = new Date('2026-07-03T15:00:00.000Z'); // sexta

      expect(getNextReleaseInstant(customOneDay, stableFrom, ZONE)).toEqual(
        getNextReleaseInstant(weekly, stableFrom, ZONE),
      );
      expect(getNextReleaseInstant(customOneDay, transitionFrom, ZONE)).toEqual(
        getNextReleaseInstant(weekly, transitionFrom, ZONE),
      );
    });

    // Mesma ideia, mas com os 7 dias marcados — deve bater com "daily".
    const customAllDays: ReleaseConfig = {
      frequency: 'custom',
      releaseHour: 12,
      releaseWeekdays: [1, 2, 3, 4, 5, 6, 7],
    };
    const dailyInstants = [
      new Date('2026-07-01T00:00:00.000Z'),
      new Date('2026-07-01T11:59:00.000Z'),
      new Date('2026-07-01T15:00:00.000Z'),
      new Date('2026-07-01T15:01:00.000Z'),
      new Date('2026-07-01T23:59:00.000Z'),
      new Date('2026-07-04T12:00:00.000Z'),
    ];

    for (const now of dailyInstants) {
      it(`custom com os 7 dias bate exatamente com daily em ${now.toISOString()}`, () => {
        expect(getReleaseWindow(customAllDays, now, ZONE)).toEqual(getReleaseWindow(DEFAULT_RELEASE_CONFIG, now, ZONE));
      });
    }

    it('getNextReleaseInstant com os 7 dias bate exatamente com daily', () => {
      const from = new Date('2026-07-03T15:00:00.000Z');
      expect(getNextReleaseInstant(customAllDays, from, ZONE)).toEqual(
        getNextReleaseInstant(DEFAULT_RELEASE_CONFIG, from, ZONE),
      );
    });
  });

  describe('cadência personalizada (custom) — múltiplos dias, comportamento genuinamente novo', () => {
    // Terça, quinta e sábado às 18h — janelas assimétricas (2, 2 e 3 dias).
    const custom: ReleaseConfig = {
      frequency: 'custom',
      releaseHour: 18,
      releaseWeekdays: [2, 4, 6],
    };

    it('getNextReleaseInstant acha o PRÓXIMO dia do conjunto, não o mais distante', () => {
      // Segunda 10h -> próximo é terça 18h (o dia seguinte, não quinta).
      const fromMonday = new Date('2026-07-06T13:00:00.000Z'); // segunda 10h BRT
      const next = getNextReleaseInstant(custom, fromMonday, ZONE);
      expect(formatInTimeZoneYmd(next)).toBe('2026-07-07'); // terça
    });

    it('regime estável: terça -> quinta (2 dias) -> sábado (2 dias) -> terça seguinte (3 dias)', () => {
      let from = new Date('2026-07-07T21:00:00.000Z'); // terça 18h BRT em ponto
      const anchors: string[] = [];
      for (let i = 0; i < 3; i++) {
        const { to } = getGroupReleaseWindow(custom, from, ZONE);
        anchors.push(formatInTimeZoneYmd(to));
        from = to;
      }
      expect(anchors).toEqual(['2026-07-09', '2026-07-11', '2026-07-14']); // qui, sáb, terça seguinte
    });

    it('getReleaseWindow (pra trás) acha o dia do conjunto mais recente <= now, sem ambiguidade', () => {
      // Sexta 10h BRT: o dia mais recente do conjunto {ter,qui,sáb} é quinta.
      const friday = new Date('2026-07-10T13:00:00.000Z');
      const { to, from } = getReleaseWindow(custom, friday, ZONE);
      expect(formatInTimeZoneYmd(to)).toBe('2026-07-09'); // quinta
      expect(formatInTimeZoneYmd(from)).toBe('2026-07-07'); // terça anterior
    });
  });

  describe('validação de config', () => {
    it('rejeita releaseHour fora de 0-23', () => {
      expect(() => getReleaseWindow({ frequency: 'daily', releaseHour: 24 }, new Date())).toThrow(/releaseHour/);
      expect(() => getReleaseWindow({ frequency: 'daily', releaseHour: -1 }, new Date())).toThrow(/releaseHour/);
    });

    it('rejeita frequência semanal sem releaseWeekday', () => {
      expect(() => getReleaseWindow({ frequency: 'weekly', releaseHour: 12 }, new Date())).toThrow(/releaseWeekday/);
    });

    it('rejeita releaseWeekday fora de 1-7', () => {
      expect(() => getReleaseWindow({ frequency: 'weekly', releaseHour: 12, releaseWeekday: 0 }, new Date())).toThrow(
        /releaseWeekday/,
      );
      expect(() => getReleaseWindow({ frequency: 'weekly', releaseHour: 12, releaseWeekday: 8 }, new Date())).toThrow(
        /releaseWeekday/,
      );
    });

    it('rejeita cadência custom sem nenhum dia marcado', () => {
      expect(() => getReleaseWindow({ frequency: 'custom', releaseHour: 12, releaseWeekdays: [] }, new Date())).toThrow(
        /releaseWeekdays/,
      );
      expect(() => getReleaseWindow({ frequency: 'custom', releaseHour: 12 }, new Date())).toThrow(/releaseWeekdays/);
    });

    it('rejeita cadência custom com dia fora de 1-7', () => {
      expect(() =>
        getReleaseWindow({ frequency: 'custom', releaseHour: 12, releaseWeekdays: [1, 8] }, new Date()),
      ).toThrow(/1.*7|weekday/i);
    });

    it('rejeita cadência custom com dia repetido', () => {
      expect(() =>
        getReleaseWindow({ frequency: 'custom', releaseHour: 12, releaseWeekdays: [1, 3, 1] }, new Date()),
      ).toThrow(/Duplicate/);
    });
  });
});
