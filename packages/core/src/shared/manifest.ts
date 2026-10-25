// Module manifest (ARQUITETURA §5, D-019): pure metadata, imported by the API and by the app.
import { z } from 'zod';

import { ROLES } from './community';

/** Ids that would collide with core routes under /v1/<id>. */
export const RESERVED_MODULE_IDS = new Set([
  'core',
  'auth',
  'me',
  'communities',
  'invites',
  'modules',
  'internal',
  'profile',
  'health',
  'test',
  'db',
]);

const MODULE_ID = /^[a-z][a-z0-9]*$/;
const DOTTED = /^[a-z][a-z0-9]*\.[a-z0-9_.]+$/;

export const ManifestSchema = z
  .object({
    id: z.string().regex(MODULE_ID, 'id: letras minúsculas e números, começando por letra'),
    name: z.string().min(1),
    icon: z.string().min(1),
    permissions: z
      .array(
        z
          .object({ id: z.string().regex(DOTTED), label: z.string().optional(), defaultRoles: z.array(z.enum(ROLES)) })
          .strict(),
      )
      .default([]),
    menu: z.array(z.object({ label: z.string().min(1), route: z.string().startsWith('/') }).strict()).default([]),
    notifications: z
      .array(z.object({ id: z.string().regex(DOTTED), label: z.string().min(1), defaultEnabled: z.boolean() }).strict())
      .default([]),
    joinIntents: z.array(z.object({ id: z.string().regex(DOTTED), label: z.string().min(1) }).strict()).default([]),
    /** WhatsApp bot commands (future phase). */
    commands: z.array(z.unknown()).default([]),
  })
  .strict();

export type ModuleManifestInput = z.input<typeof ManifestSchema>;
export type ModuleManifest = z.output<typeof ManifestSchema>;

/**
 * Problems in one manifest, beyond the schema: ids of permissions, notifications and intents must start
 * with `<id>.`; menu routes with `/<id>`; reserved ids are refused. Empty list = valid.
 */
export function manifestProblems(input: unknown): string[] {
  const parsed = ManifestSchema.safeParse(input);
  if (!parsed.success) return parsed.error.issues.map((i) => `${i.path.join('.') || 'manifest'}: ${i.message}`);
  const m = parsed.data;
  const problems: string[] = [];
  if (RESERVED_MODULE_IDS.has(m.id)) problems.push(`id "${m.id}" is reserved`);
  const prefix = `${m.id}.`;
  for (const [kind, list] of [
    ['permission', m.permissions],
    ['notification', m.notifications],
    ['joinIntent', m.joinIntents],
  ] as const) {
    for (const item of list)
      if (!item.id.startsWith(prefix)) problems.push(`${kind} "${item.id}" must start with "${prefix}"`);
  }
  for (const item of m.menu) {
    if (item.route !== `/${m.id}` && !item.route.startsWith(`/${m.id}/`)) {
      problems.push(`menu route "${item.route}" must start with "/${m.id}"`);
    }
  }
  return problems;
}

/** Declares a module manifest. Throws on invalid input, so a broken manifest fails at import time. */
export function defineManifest<const T extends ModuleManifestInput>(input: T): ModuleManifest & { id: T['id'] } {
  const problems = manifestProblems(input);
  if (problems.length) throw new Error(`Invalid module manifest: ${problems.join('; ')}`);
  return ManifestSchema.parse(input) as ModuleManifest & { id: T['id'] };
}
