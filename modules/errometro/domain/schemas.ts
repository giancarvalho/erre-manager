// Request schemas of the Errômetro API, shared with the app (same rules on both sides).
import { z } from 'zod';

import { MAX_TARGETS } from './limits';

const hour = z.number().int().min(0).max(23);
const weekday = z.number().int().min(1).max(7);

/** Release cadence (R-CAL-02). "daily"/"weekly" are legacy values the app no longer creates. */
export const ReleaseConfigSchema = z.discriminatedUnion('frequency', [
  z
    .object({ frequency: z.literal('custom'), releaseHour: hour, releaseWeekdays: z.array(weekday).min(1).max(7) })
    .strict(),
  z.object({ frequency: z.literal('manual'), releaseHour: hour }).strict(),
  z.object({ frequency: z.literal('daily'), releaseHour: hour }).strict(),
  z.object({ frequency: z.literal('weekly'), releaseHour: hour, releaseWeekday: weekday }).strict(),
]);

/** The full active roster (always a full replace). Limits and messages come from buildEmojiConfigRows. */
export const EmojiEntriesSchema = z
  .object({
    entries: z
      .array(
        z.discriminatedUnion('isCustom', [
          z.object({ isCustom: z.literal(false), emojiId: z.string().min(1).max(40) }).strict(),
          z
            .object({
              isCustom: z.literal(true),
              emojiId: z
                .string()
                .regex(/^custom-[A-Za-z0-9_-]{1,40}$/)
                .optional(),
              char: z.string().max(64),
              label: z.string().max(200),
              trophyName: z.string().max(200),
              description: z.string().max(1000).optional(),
              glowRgb: z.string().max(20).optional(),
            })
            .strict(),
        ]),
      )
      .max(50),
  })
  .strict();

export const TokenRequestSchema = z.object({ blindedMsgB64: z.string().min(1).max(1024) }).strict();

/** Anonymous ballot: token + targetId -> emojiId. Over MAX_TARGETS targets is invalid (R-ANON-04). */
export const BallotSchema = z
  .object({
    preparedMsgB64: z.string().min(1).max(4096),
    signatureB64: z.string().min(1).max(4096),
    votes: z
      .record(z.string().min(1).max(64), z.string().min(1).max(64))
      .refine((v) => Object.keys(v).length <= MAX_TARGETS, { message: 'Dados inválidos.' }),
  })
  .strict();

/** The voter tag is hex SHA-256 of the prepared message (64 chars). */
export const MyVotesSchema = z.object({ voterTag: z.string().regex(/^[0-9a-f]{64}$/) }).strict();
