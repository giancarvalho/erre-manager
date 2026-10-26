// Portado de queridometro@7c5c5bf:src/lib/emojis/emoji-limits.ts
/**
 * Pure constants shared between the server resolver (group-emoji-config.ts)
 * and the client settings form (EmojiRosterForm.tsx). Kept dependency-free
 * on purpose — group-emoji-config.ts pulls in server-only persistence
 * modules (eventually the Node `pg` driver), which must never end up in a
 * client bundle.
 */
export const MAX_ACTIVE_EMOJIS = 15;
export const MIN_ACTIVE_EMOJIS = 1;
export const MAX_DESCRIPTION_LENGTH = 140;
