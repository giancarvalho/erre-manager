-- Errômetro (PLANO Sprint 12). Every table is per community (erre_tenant_table: RLS + community index).
-- `period` is the round label (YYYY-MM-DD of the window's `to`), the legacy `voting_day`.

CREATE TABLE errometro_participants (
  community_id uuid NOT NULL REFERENCES communities(id),
  user_id uuid NOT NULL,
  status text NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'removed')),
  requested_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid,
  PRIMARY KEY (community_id, user_id)
);
SELECT erre_tenant_table('errometro_participants');

CREATE TABLE errometro_release_config (
  community_id uuid NOT NULL REFERENCES communities(id),
  frequency text NOT NULL CHECK (frequency IN ('daily', 'weekly', 'custom', 'manual')),
  release_hour integer NOT NULL CHECK (release_hour BETWEEN 0 AND 23),
  release_weekday integer CHECK (release_weekday BETWEEN 1 AND 7),
  release_weekdays integer[],
  PRIMARY KEY (community_id)
);
SELECT erre_tenant_table('errometro_release_config');

CREATE TABLE errometro_emoji_config (
  community_id uuid NOT NULL REFERENCES communities(id),
  emoji_id text NOT NULL,
  sort_order integer NOT NULL,
  is_custom boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  char text,
  label text,
  trophy_name text,
  description text,
  glow_rgb text,
  PRIMARY KEY (community_id, emoji_id)
);
SELECT erre_tenant_table('errometro_emoji_config');
CREATE INDEX errometro_emoji_config_sort_idx ON errometro_emoji_config (community_id, sort_order);

CREATE TABLE errometro_signing_keys (
  community_id uuid NOT NULL REFERENCES communities(id),
  period date NOT NULL,
  public_key_jwk jsonb NOT NULL,
  private_key_jwk jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (community_id, period)
);
SELECT erre_tenant_table('errometro_signing_keys');

-- Gate: one blind-signed token per (person, community, round), the only link between a person and voting.
-- Deliberately NO timestamp (R-ANON-02): issued_at next to the votes' voted_at would re-link voter and vote
-- by timing. The primary key alone is the gate; `period` carries no sub-day timing.
CREATE TABLE errometro_token_issuances (
  community_id uuid NOT NULL REFERENCES communities(id),
  user_id uuid NOT NULL,
  period date NOT NULL,
  PRIMARY KEY (community_id, user_id, period)
);
SELECT erre_tenant_table('errometro_token_issuances');

-- No user column: the voter tag is derived from the verified token.
CREATE TABLE errometro_votes (
  community_id uuid NOT NULL REFERENCES communities(id),
  period date NOT NULL,
  voter_tag text NOT NULL,
  target_id uuid NOT NULL,
  emoji_id text NOT NULL,
  voted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (community_id, period, voter_tag, target_id)
);
SELECT erre_tenant_table('errometro_votes');
CREATE INDEX errometro_votes_period_idx ON errometro_votes (community_id, period);
CREATE INDEX errometro_votes_voter_tag_idx ON errometro_votes (voter_tag, community_id, period);
CREATE INDEX errometro_votes_voted_at_idx ON errometro_votes (community_id, voted_at);

CREATE TABLE errometro_snapshots (
  community_id uuid NOT NULL REFERENCES communities(id),
  period date NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  hidden boolean NOT NULL DEFAULT false,
  notified_at timestamptz,
  PRIMARY KEY (community_id, period)
);
SELECT erre_tenant_table('errometro_snapshots');
CREATE INDEX errometro_snapshots_created_at_idx ON errometro_snapshots (community_id, created_at);

CREATE TABLE errometro_release_reminders (
  community_id uuid NOT NULL REFERENCES communities(id),
  period date NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (community_id, period)
);
SELECT erre_tenant_table('errometro_release_reminders');

CREATE TABLE errometro_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL REFERENCES communities(id),
  target_id uuid NOT NULL,
  author_id uuid NOT NULL,
  period date NOT NULL,
  text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz
);
SELECT erre_tenant_table('errometro_comments');
CREATE INDEX errometro_comments_period_idx ON errometro_comments (community_id, period);
CREATE INDEX errometro_comments_target_idx ON errometro_comments (community_id, target_id, period);

-- migrate:down
DROP TABLE errometro_comments;
DROP TABLE errometro_release_reminders;
DROP TABLE errometro_snapshots;
DROP TABLE errometro_votes;
DROP TABLE errometro_token_issuances;
DROP TABLE errometro_signing_keys;
DROP TABLE errometro_emoji_config;
DROP TABLE errometro_release_config;
DROP TABLE errometro_participants;
