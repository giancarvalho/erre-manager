-- Database roles (docs/migration/ARQUITETURA.md §4.3). Idempotent: safe to run again.
--
-- Local/dev: `pnpm --filter @erre/db db:bootstrap` runs this file with DATABASE_ADMIN_URL.
-- Production: a human runs it, connected as an administrator to the target database:
--   psql "$ADMIN_URL" -v migrator_password=... -v app_password=... -v jobs_password=... -f db-bootstrap-roles.sql
--
-- erre_migrator  owns the tables, runs migrations
-- erre_app       API requests and per-community jobs: NOSUPERUSER NOBYPASSRLS, DML only, owns nothing
-- erre_jobs      lists communities for the job runner: SELECT on communities only (granted by db_0001)

SELECT
  set_config('erre.migrator_password', :'migrator_password', false),
  set_config('erre.app_password', :'app_password', false),
  set_config('erre.jobs_password', :'jobs_password', false);

DO $$
DECLARE
  r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['erre_migrator', 'erre_app', 'erre_jobs'] LOOP
    -- CREATE ROLE defaults are NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS. Those attributes are
    -- checked below instead of set: on managed Postgres (Neon, Supabase) the admin is not a superuser and may not
    -- change them, even to turn them off.
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('CREATE ROLE %I LOGIN PASSWORD %L', r, current_setting('erre.' || substr(r, 6) || '_password'));
    ELSE
      EXECUTE format('ALTER ROLE %I LOGIN PASSWORD %L', r, current_setting('erre.' || substr(r, 6) || '_password'));
    END IF;
    IF EXISTS (
      SELECT 1 FROM pg_roles
      WHERE rolname = r AND (rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls)
    ) THEN
      RAISE EXCEPTION 'role % has an attribute it must not have (superuser, createdb, createrole, replication or bypassrls)', r;
    END IF;
  END LOOP;
  -- ALTER DEFAULT PRIVILEGES FOR ROLE erre_migrator (below) needs the admin to be a member of erre_migrator; a
  -- superuser already is, a CREATEROLE admin (Postgres 16+) only has ADMIN OPTION on the roles it created.
  IF NOT pg_has_role(current_user, 'erre_migrator', 'USAGE') THEN
    EXECUTE format('GRANT erre_migrator TO %I', current_user);
  END IF;
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO erre_migrator, erre_app, erre_jobs', current_database());
END
$$;

SELECT
  set_config('erre.migrator_password', '', false),
  set_config('erre.app_password', '', false),
  set_config('erre.jobs_password', '', false);

REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE, CREATE ON SCHEMA public TO erre_migrator;
GRANT USAGE ON SCHEMA public TO erre_app, erre_jobs;

-- Everything erre_migrator creates is readable/writable by erre_app (DML only).
ALTER DEFAULT PRIVILEGES FOR ROLE erre_migrator IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO erre_app;
ALTER DEFAULT PRIVILEGES FOR ROLE erre_migrator IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO erre_app;
ALTER DEFAULT PRIVILEGES FOR ROLE erre_migrator IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
