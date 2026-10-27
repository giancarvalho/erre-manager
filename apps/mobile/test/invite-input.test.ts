import { parseInviteInput } from '@/lib/invite-input';

const CODE = 'AAAAAAAAAAAAAAAAAAAAAAsegredo12345';

describe('parseInviteInput', () => {
  it.each([
    [CODE],
    [`  ${CODE}\n`],
    [`https://errometro.app/convite/${CODE}`],
    [`https://errometro.app/convite/${CODE}/`],
    [`https://errometro.app/convite/${CODE}?utm=zap`],
    [`errometro.app/convite/${CODE}`],
    [`erre://convite/${CODE}`],
  ])('finds the code in %j', (input) => {
    expect(parseInviteInput(input)).toBe(CODE);
  });

  it.each([[''], ['turma'], [CODE.slice(1)], [`${CODE}x`], ['https://errometro.app/convite/'], [`https://x/${CODE}`]])(
    'refuses %j',
    (input) => {
      expect(parseInviteInput(input)).toBeNull();
    },
  );
});
