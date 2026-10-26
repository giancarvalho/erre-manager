-- Eventos (PLANO Sprint 16). Every table is per community (erre_tenant_table: RLS + community index); children
-- reference the event by (community_id, event_id) (D-015).

CREATE TABLE eventos_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL REFERENCES communities(id),
  title text NOT NULL,
  description text,
  voting_type text NOT NULL CHECK (voting_type IN ('categorical', 'scale')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'accepting_applications', 'open', 'closed')),
  release_mode text NOT NULL CHECK (release_mode IN ('manual', 'scheduled')),
  scheduled_open_at timestamptz,
  scheduled_release_at timestamptz,
  banner_rgb text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  opened_at timestamptz,
  closed_at timestamptz,
  deleted_at timestamptz
);
SELECT erre_tenant_table('eventos_events');
CREATE INDEX eventos_events_status_idx ON eventos_events (community_id, status);
-- At most one live event per community (R-EVT-03); drafts, closed and deleted ones don't count.
CREATE UNIQUE INDEX eventos_events_one_live_idx ON eventos_events (community_id)
  WHERE status IN ('accepting_applications', 'open') AND deleted_at IS NULL;

CREATE TABLE eventos_emoji_config (
  community_id uuid NOT NULL REFERENCES communities(id),
  event_id uuid NOT NULL,
  emoji_id text NOT NULL,
  sort_order integer NOT NULL,
  is_custom boolean NOT NULL DEFAULT false,
  char text,
  label text,
  trophy_name text,
  description text,
  glow_rgb text,
  scale_max integer CHECK (scale_max BETWEEN 1 AND 10),
  PRIMARY KEY (community_id, event_id, emoji_id),
  CONSTRAINT eventos_emoji_config_event_fk FOREIGN KEY (community_id, event_id)
    REFERENCES eventos_events (community_id, id)
);
SELECT erre_tenant_table('eventos_emoji_config');

CREATE TABLE eventos_participants (
  community_id uuid NOT NULL REFERENCES communities(id),
  event_id uuid NOT NULL,
  user_id uuid NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (community_id, event_id, user_id),
  CONSTRAINT eventos_participants_event_fk FOREIGN KEY (community_id, event_id)
    REFERENCES eventos_events (community_id, id)
);
SELECT erre_tenant_table('eventos_participants');

CREATE TABLE eventos_signing_keys (
  community_id uuid NOT NULL REFERENCES communities(id),
  event_id uuid NOT NULL,
  public_key_jwk jsonb NOT NULL,
  private_key_jwk jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (community_id, event_id),
  CONSTRAINT eventos_signing_keys_event_fk FOREIGN KEY (community_id, event_id)
    REFERENCES eventos_events (community_id, id)
);
SELECT erre_tenant_table('eventos_signing_keys');

-- Gate: one blind-signed token per (person, event), the only link between a person and voting.
-- Deliberately NO timestamp (R-ANON-02): issued_at next to the votes' voted_at would re-link voter and vote.
CREATE TABLE eventos_token_issuances (
  community_id uuid NOT NULL REFERENCES communities(id),
  user_id uuid NOT NULL,
  event_id uuid NOT NULL,
  PRIMARY KEY (community_id, user_id, event_id),
  CONSTRAINT eventos_token_issuances_event_fk FOREIGN KEY (community_id, event_id)
    REFERENCES eventos_events (community_id, id)
);
SELECT erre_tenant_table('eventos_token_issuances');

-- No user column: the voter tag is derived from the verified token.
CREATE TABLE eventos_votes (
  community_id uuid NOT NULL REFERENCES communities(id),
  event_id uuid NOT NULL,
  voter_tag text NOT NULL,
  target_id uuid NOT NULL,
  emoji_id text NOT NULL,
  value integer CHECK (value BETWEEN 1 AND 10),
  voted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (community_id, event_id, voter_tag, target_id, emoji_id),
  CONSTRAINT eventos_votes_event_fk FOREIGN KEY (community_id, event_id)
    REFERENCES eventos_events (community_id, id)
);
SELECT erre_tenant_table('eventos_votes');
CREATE INDEX eventos_votes_voter_tag_idx ON eventos_votes (voter_tag, community_id, event_id);

CREATE TABLE eventos_snapshots (
  community_id uuid NOT NULL REFERENCES communities(id),
  event_id uuid NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  notified_at timestamptz,
  PRIMARY KEY (community_id, event_id),
  CONSTRAINT eventos_snapshots_event_fk FOREIGN KEY (community_id, event_id)
    REFERENCES eventos_events (community_id, id)
);
SELECT erre_tenant_table('eventos_snapshots');

CREATE TABLE eventos_trophy_wins (
  community_id uuid NOT NULL REFERENCES communities(id),
  event_id uuid NOT NULL,
  emoji_id text NOT NULL,
  winner_user_id uuid NOT NULL,
  voting_type text NOT NULL CHECK (voting_type IN ('categorical', 'scale')),
  magnitude numeric(8, 2) NOT NULL,
  won_at timestamptz NOT NULL,
  PRIMARY KEY (community_id, event_id, emoji_id),
  CONSTRAINT eventos_trophy_wins_event_fk FOREIGN KEY (community_id, event_id)
    REFERENCES eventos_events (community_id, id)
);
SELECT erre_tenant_table('eventos_trophy_wins');
CREATE INDEX eventos_trophy_wins_winner_idx ON eventos_trophy_wins (community_id, winner_user_id);

-- migrate:down
DROP TABLE eventos_trophy_wins;
DROP TABLE eventos_snapshots;
DROP TABLE eventos_votes;
DROP TABLE eventos_token_issuances;
DROP TABLE eventos_signing_keys;
DROP TABLE eventos_participants;
DROP TABLE eventos_emoji_config;
DROP TABLE eventos_events;
