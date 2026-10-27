import { describe, expect, it } from 'vitest';

import { PUSH_BODY_MAX, avisoPush, truncate } from '../../domain/push';
import { NewAvisoSchema } from '../../domain/schemas';

describe('avisoPush', () => {
  it('names the community in the title and carries the notice title as body', () => {
    expect(avisoPush('Turma do vôlei', 'Treino cancelado')).toEqual({
      title: '📌 Aviso novo em Turma do vôlei',
      body: 'Treino cancelado',
    });
  });

  it('cuts long titles with an ellipsis and collapses whitespace', () => {
    const body = avisoPush('C', 'a'.repeat(150)).body;
    expect(body).toHaveLength(PUSH_BODY_MAX);
    expect(body.endsWith('…')).toBe(true);
    expect(truncate('  um   dois \n três ', 50)).toBe('um dois três');
  });
});

describe('NewAvisoSchema', () => {
  it('trims and requires title and text', () => {
    expect(NewAvisoSchema.parse({ title: ' Oi ', body: ' Texto ' })).toEqual({ title: 'Oi', body: 'Texto' });
    expect(NewAvisoSchema.safeParse({ title: 'Oi', body: '   ' }).success).toBe(false);
    expect(NewAvisoSchema.safeParse({ title: 'Oi' }).success).toBe(false);
    expect(NewAvisoSchema.safeParse({ title: 'Oi', body: 'x', extra: 1 }).success).toBe(false);
  });
});
