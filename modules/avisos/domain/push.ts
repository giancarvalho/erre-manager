// Text of the push sent when a notice is published (pure: tested in tests/domain/push.test.ts).

/** Longest push body: lock screens cut around here anyway. */
export const PUSH_BODY_MAX = 100;

export function truncate(text: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1).trimEnd()}…`;
}

/** "📌 Aviso novo em <comunidade>" + the notice title. The full text stays in the app. */
export function avisoPush(communityName: string, title: string): { title: string; body: string } {
  return { title: `📌 Aviso novo em ${communityName}`, body: truncate(title, PUSH_BODY_MAX) };
}
