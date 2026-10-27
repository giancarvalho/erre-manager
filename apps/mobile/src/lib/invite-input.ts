// What a person pastes to join (CORE-07): the whole invite link, a link without the scheme, or just the code.
// The code format is core's (packages/core/src/server/invites.ts): 22 chars of community id + 12 of secret.
const CODE_RE = /^[A-Za-z0-9_-]{34}$/;

/** The invite code inside `input`, or null when it doesn't look like an invite. */
export function parseInviteInput(input: string): string | null {
  const text = input.trim();
  if (CODE_RE.test(text)) return text;
  const match = /(?:^|\/)convite\/([^/?#\s]+)\/?(?:[?#].*)?$/.exec(text);
  const code = match?.[1] ?? '';
  return CODE_RE.test(code) ? code : null;
}
