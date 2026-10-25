// Portado de queridometro@7c5c5bf:src/lib/auth/display-name.ts e
// src/infrastructure/auth/postgres-user.repository.ts (nome inicial de quem entra com Google).
import { z } from 'zod';

/** The name shown to others. Profile editing and onboarding use the same rule. */
export const DisplayNameSchema = z.string().trim().min(2, 'Mínimo 2 caracteres.').max(32, 'Máximo 32 caracteres.');

/** First display name of a Google sign-in: Google's name, or the e-mail's local part, cut to 32. */
export function initialDisplayName(googleName: string | null | undefined, email: string): string {
  const base =
    (email.split('@')[0] ?? 'user')
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '')
      .slice(0, 20) || 'user';
  return ((googleName ?? '').trim() || base).slice(0, 32);
}
