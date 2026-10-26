// Request schemas of the Eventos API, shared with the app (same rules on both sides). Business limits and
// their pt-BR messages come from lifecycle.ts and emoji-config.ts; these only bound the shapes.
import { z } from 'zod';

import { MAX_EVENT_VOTE_ROWS, MAX_SCALE_MAX } from './limits';

const instant = z.iso.datetime({ offset: true }).transform((s) => new Date(s));

export const NewEventSchema = z
  .object({
    title: z.string().max(500),
    description: z.string().max(2000).optional(),
    votingType: z.enum(['categorical', 'scale']),
    releaseMode: z.enum(['manual', 'scheduled']),
    scheduledOpenAt: instant.optional(),
    scheduledReleaseAt: instant.optional(),
  })
  .strict();

export const DraftPatchSchema = z
  .object({
    title: z.string().max(500).optional(),
    description: z.string().max(2000).nullable().optional(),
    releaseMode: z.enum(['manual', 'scheduled']).optional(),
    scheduledOpenAt: instant.nullable().optional(),
    scheduledReleaseAt: instant.nullable().optional(),
    bannerRgb: z.string().max(20).nullable().optional(),
  })
  .strict();

const scaleMax = z.number().int().min(0).max(100).optional();

export const EventEmojiEntriesSchema = z
  .object({
    entries: z
      .array(
        z.discriminatedUnion('isCustom', [
          z.object({ isCustom: z.literal(false), emojiId: z.string().min(1).max(40), scaleMax }).strict(),
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
              scaleMax,
            })
            .strict(),
        ]),
      )
      .max(50),
  })
  .strict();

export const TokenRequestSchema = z.object({ blindedMsgB64: z.string().min(1).max(1024) }).strict();

/** Anonymous ballot: token + rows (several per target on a scale event). */
export const EventBallotSchema = z
  .object({
    preparedMsgB64: z.string().min(1).max(4096),
    signatureB64: z.string().min(1).max(4096),
    votes: z
      .array(
        z
          .object({
            targetId: z.string().min(1).max(64),
            emojiId: z.string().min(1).max(64),
            value: z.number().int().min(1).max(MAX_SCALE_MAX).nullish(),
          })
          .strict(),
      )
      .min(1)
      .max(MAX_EVENT_VOTE_ROWS),
  })
  .strict();

/** The voter tag is hex SHA-256 of the prepared message (64 chars). */
export const MyVotesSchema = z.object({ voterTag: z.string().regex(/^[0-9a-f]{64}$/) }).strict();
