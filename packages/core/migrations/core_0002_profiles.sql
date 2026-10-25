-- Profile shown to others (global). name_confirmed_at stays null until the person confirms the
-- name on first sign-in (onboarding, CORE-04).
CREATE TABLE core_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth_user(id) ON DELETE CASCADE,
  display_name text NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 32),
  avatar_variant text NOT NULL
    CHECK (avatar_variant IN ('indigo', 'violet', 'emerald', 'amber', 'sky', 'rose', 'slate', 'teal')),
  name_confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- migrate:down
DROP TABLE core_profiles;
