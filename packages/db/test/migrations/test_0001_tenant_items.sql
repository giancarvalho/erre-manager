-- Test-only community table for the isolation tests (PLANO, Sprint 4, task 7).
CREATE TABLE test_tenant_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL REFERENCES communities(id),
  label text NOT NULL
);
SELECT erre_tenant_table('test_tenant_items');

-- migrate:down
DROP TABLE test_tenant_items;
