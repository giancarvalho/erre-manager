-- Tenant anchor and the helper every community table uses (ARQUITETURA §4.2).

CREATE TABLE communities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON communities TO erre_jobs;

-- Turns a table into a community table: RLS enabled and forced, isolation policy (fail closed:
-- current_setting without missing_ok), index on community_id and UNIQUE (community_id, id) when the
-- table has an id, so child tables can use composite FKs (D-015).
-- Usage in a migration, right after CREATE TABLE: SELECT erre_tenant_table('my_table');
CREATE FUNCTION erre_tenant_table(tbl regclass) RETURNS void
LANGUAGE plpgsql AS $fn$
DECLARE
  tname text := (SELECT relname FROM pg_class WHERE oid = tbl);
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_attribute
    WHERE attrelid = tbl AND attname = 'community_id' AND NOT attisdropped
      AND attnotnull AND atttypid = 'uuid'::regtype
  ) THEN
    RAISE EXCEPTION '%: community_id uuid NOT NULL is required', tname;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid = tbl AND c.contype = 'f' AND c.confrelid = 'communities'::regclass
      AND c.conkey = ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = tbl AND attname = 'community_id')]
  ) THEN
    RAISE EXCEPTION '%: community_id must reference communities(id)', tname;
  END IF;

  EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', tbl);
  EXECUTE format('ALTER TABLE %s FORCE ROW LEVEL SECURITY', tbl);
  EXECUTE format(
    $p$CREATE POLICY isolamento_comunidade ON %s
       USING (community_id = current_setting('app.community_id')::uuid)
       WITH CHECK (community_id = current_setting('app.community_id')::uuid)$p$,
    tbl);
  EXECUTE format('CREATE INDEX %I ON %s (community_id)', tname || '_community_id_idx', tbl);
  IF EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = tbl AND attname = 'id' AND NOT attisdropped) THEN
    EXECUTE format('ALTER TABLE %s ADD CONSTRAINT %I UNIQUE (community_id, id)', tbl, tname || '_community_id_id_key');
  END IF;
END
$fn$;

REVOKE EXECUTE ON FUNCTION erre_tenant_table(regclass) FROM PUBLIC;

-- migrate:down

DROP FUNCTION erre_tenant_table(regclass);
DROP TABLE communities;
