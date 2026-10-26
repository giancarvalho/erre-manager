// Portado de queridometro@7c5c5bf:src/lib/notifications/notification-copy.test.ts
import { describe, expect, it, vi } from 'vitest';
import { CLOSING_REMINDER_BODIES, pickRandom, RESULT_READY_BODIES } from '../../domain/notification-copy';

describe('notification-copy', () => {
  it('tem exatamente 5 linhas rotativas por tipo', () => {
    expect(RESULT_READY_BODIES).toHaveLength(5);
    expect(CLOSING_REMINDER_BODIES).toHaveLength(5);
  });

  it('pickRandom sempre devolve uma linha do próprio array', () => {
    for (let i = 0; i < 20; i++) {
      expect(RESULT_READY_BODIES).toContain(pickRandom(RESULT_READY_BODIES));
      expect(CLOSING_REMINDER_BODIES).toContain(pickRandom(CLOSING_REMINDER_BODIES));
    }
  });

  it('pickRandom respeita o índice sorteado (extremos inclusive)', () => {
    const spy = vi.spyOn(Math, 'random');
    spy.mockReturnValueOnce(0);
    expect(pickRandom(RESULT_READY_BODIES)).toBe(RESULT_READY_BODIES[0]);
    spy.mockReturnValueOnce(0.999999);
    expect(pickRandom(RESULT_READY_BODIES)).toBe(RESULT_READY_BODIES[RESULT_READY_BODIES.length - 1]);
    spy.mockRestore();
  });
});
