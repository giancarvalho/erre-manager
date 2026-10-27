-- Mural de avisos: notices of the community board. One migration per change; the next one is avisos_0002_<descricao>.sql.

CREATE TABLE avisos_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL REFERENCES communities(id),
  title text NOT NULL,
  body text NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- Turns on RLS by community and gives the app roles access (packages/db/migrations/db_0001_base.sql).
SELECT erre_tenant_table('avisos_posts');
CREATE INDEX avisos_posts_community_created_idx ON avisos_posts (community_id, created_at);
CREATE INDEX avisos_posts_community_author_idx ON avisos_posts (community_id, created_by);

-- migrate:down
DROP TABLE avisos_posts;
