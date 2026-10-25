-- Push subscriptions and notification preferences (D-012). Global tables (per person, not per community).

CREATE TABLE core_push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('webpush', 'expo')),
  -- Web Push endpoint URL or Expo push token. A device belongs to whoever registered it last.
  endpoint text NOT NULL UNIQUE,
  keys jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((kind = 'webpush') = (keys IS NOT NULL))
);
CREATE INDEX core_push_subscriptions_user_id_idx ON core_push_subscriptions (user_id);

-- Only the choices a person made; without a row, the manifest default applies.
CREATE TABLE core_notification_preferences (
  user_id uuid NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE,
  type text NOT NULL,
  enabled boolean NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, type)
);

-- migrate:down
DROP TABLE core_notification_preferences;
DROP TABLE core_push_subscriptions;
