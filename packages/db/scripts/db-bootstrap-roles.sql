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
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('CREATE ROLE %I LOGIN', r);
    END IF;
    EXECUTE format('ALTER ROLE %I LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD %L',
      r, current_setting('erre.' || substr(r, 6) || '_password'));
  END LOOP;
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
