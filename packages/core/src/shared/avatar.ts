// Portado de queridometro@7c5c5bf:src/lib/avatar/variants.ts
export const AVATAR_VARIANTS = ['indigo', 'violet', 'emerald', 'amber', 'sky', 'rose', 'slate', 'teal'] as const;

export type AvatarVariant = (typeof AVATAR_VARIANTS)[number];

export function isAvatarVariant(value: string): value is AvatarVariant {
  return (AVATAR_VARIANTS as readonly string[]).includes(value);
}

/** Deterministic variant from any stable id (e.g. user UUID). Same seed → same color. */
export function deriveAvatarVariantFromSeed(seed: string): AvatarVariant {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const idx = Math.abs(h) % AVATAR_VARIANTS.length;
  return AVATAR_VARIANTS[idx] ?? 'indigo';
}
