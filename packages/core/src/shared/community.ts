// Portado de queridometro@7c5c5bf:src/lib/groups/group-slug-schema.ts
// In the legacy app the group's name is also its code: lowercase letters, digits and hyphens.
import { z } from 'zod';

export const COMMUNITY_NAME_PATTERN = /^[a-z0-9-]+$/;

export const CommunityNameSchema = z
  .string()
  .trim()
  .min(1, 'Nome da comunidade é obrigatório.')
  .max(32, 'Máximo 32 caracteres.')
  .regex(COMMUNITY_NAME_PATTERN, 'O nome deve conter apenas letras minúsculas, números e hífens (ex: minha-bagunca)')
  .refine((s) => s !== 'demo', { message: 'Este nome é reservado.' });

export const ROLES = ['owner', 'admin', 'moderador', 'membro'] as const;
export type Role = (typeof ROLES)[number];

/** Roles a manager can assign. `owner` is not assignable here (no ownership transfer in v1). */
export const ASSIGNABLE_ROLES = ['admin', 'moderador', 'membro'] as const satisfies readonly Role[];

export type PermissionDef = { id: string; defaultRoles: readonly Role[] };

/** Core permissions, seeded into core_role_permissions when a community is created. */
export const CORE_PERMISSIONS = [
  { id: 'core.membros.gerenciar', defaultRoles: ['owner', 'admin'] },
  { id: 'core.convites.gerenciar', defaultRoles: ['owner', 'admin'] },
] as const satisfies readonly PermissionDef[];
