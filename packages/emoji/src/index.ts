export { EMOJI_DESCRIPTIONS, EMOJI_OPTIONS, type EmojiOption } from './catalog';
export { inferEmojiGlowColor } from './glow';
export { countGraphemesFallback, isSingleGrapheme } from './grapheme';
export { MAX_ACTIVE_EMOJIS, MAX_DESCRIPTION_LENGTH, MIN_ACTIVE_EMOJIS } from './limits';
export {
  DEFAULT_TROPHY_GLOW_RGB,
  DEFAULT_TROPHY_NAME,
  TROPHY_GLOW_RGB,
  TROPHY_NAMES,
  trophyGlowRgbForEmoji,
  trophyNameForEmoji,
} from './trophy-catalog';
export {
  computeRoundTrophies,
  emojiIdsInSnapshot,
  MIN_COUNT_FOR_TROPHY,
  trophyStatusByTarget,
  type MemberRoundTrophyStatus,
  type RoundTargets,
  type RoundTrophyResult,
} from './trophies';
