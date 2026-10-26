// Portado de queridometro@7c5c5bf:src/lib/notifications/notification-copy.ts
/**
 * Push notification copy, in the same voice as the rest of the app — see
 * trophy-catalog.ts's TROPHY_NAMES ("Troféu Rei dos Asnos", "Troféu Balde
 * de Água Fria") for the register this is meant to match: playful, a
 * little ácida, in on the joke that Errômetro is a friendly weapon, not a
 * cold survey tool. Bodies rotate randomly per send (see pickRandom) so
 * the same phone doesn't see the exact same line every round.
 */

/** "Resultado saiu" — shown alongside a title naming the group. */
export const RESULT_READY_BODIES: readonly string[] = [
  'Fofoca fresquinha: o resultado já saiu.',
  'Vai lá descobrir o quanto te odeiam.',
  'Bora inflar o ego ou destruir mais ele?',
  'Vem ver se te amam ou só te toleram.',
  'Vish, só veio emoji ruim.',
];

/** "Faltam 3h pra fechar" — shown alongside a title naming the group. */
export const CLOSING_REMINDER_BODIES: readonly string[] = [
  'Vai lá falar mal dos seus amigos',
  'Ainda dá tempo de mandar aquela indireta.',
  'Ninguém vai saber que foi você. Aproveita',
  'Faltam só 3h. Não deixa pra depois.',
  'Corre lá antes que a rodada feche sem você.',
];

/** Picks one line at random — deliberately not persisted/tracked, a missed rotation here and there doesn't matter. */
export function pickRandom(lines: readonly string[]): string {
  return lines[Math.floor(Math.random() * lines.length)]!;
}
