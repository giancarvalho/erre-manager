import { describe, expect, it } from 'vitest';

import { routeInCommunity } from '../src/server/modules/runtime';

const C = '11111111-1111-4111-8111-111111111111';

describe('routeInCommunity (push routes, Sprint 20)', () => {
  it('adds the community to a plain route', () => {
    expect(routeInCommunity('/avisos', C)).toBe(`/avisos?comunidade=${C}`);
  });

  it('keeps the existing query', () => {
    expect(routeInCommunity('/eventos/1/votar?origem=push', C)).toBe(`/eventos/1/votar?origem=push&comunidade=${C}`);
  });

  it('keeps a route that already names the community', () => {
    expect(routeInCommunity(`/errometro?comunidade=${C}`, 'outra')).toBe(`/errometro?comunidade=${C}`);
  });
});
