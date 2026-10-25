-- Test-only module tables (never applied in production: modules/_* are skipped by discoverSources).

CREATE TABLE contratoteste_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL REFERENCES communities(id),
  label text NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
SELECT erre_tenant_table('contratoteste_items');

CREATE TABLE contratoteste_participants (
  community_id uuid NOT NULL REFERENCES communities(id),
  user_id uuid NOT NULL,
  PRIMARY KEY (community_id, user_id)
);
SELECT erre_tenant_table('contratoteste_participants');

CREATE TABLE contratoteste_job_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL REFERENCES communities(id),
  items_seen integer NOT NULL,
  ran_at timestamptz NOT NULL DEFAULT now()
);
SELECT erre_tenant_table('contratoteste_job_runs');

-- migrate:down
DROP TABLE contratoteste_job_runs;
DROP TABLE contratoteste_participants;
DROP TABLE contratoteste_items;
