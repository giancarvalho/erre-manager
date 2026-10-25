-- Community memberships and role permissions (ARQUITETURA §4.1, §5.3).

CREATE TABLE core_community_memberships (
  community_id uuid NOT NULL REFERENCES communities(id),
  user_id uuid NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner', 'admin', 'moderador', 'membro')),
  status text NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'removed')),
  requested_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES auth_user(id) ON DELETE SET NULL,
  PRIMARY KEY (community_id, user_id)
);
SELECT erre_tenant_table('core_community_memberships');
CREATE INDEX core_community_memberships_user_id_idx ON core_community_memberships (user_id);

-- "My communities": a person reads their own memberships in any community. Queries run with
-- app.community_id set to the nil uuid (withUserTx), so the isolation policy matches nothing and
-- still fails closed when nothing is set.
CREATE POLICY propria_membership ON core_community_memberships FOR SELECT
  USING (user_id = current_setting('app.user_id')::uuid);

CREATE TABLE core_role_permissions (
  community_id uuid NOT NULL REFERENCES communities(id),
  role text NOT NULL CHECK (role IN ('owner', 'admin', 'moderador', 'membro')),
  permission text NOT NULL CHECK (permission ~ '^[a-z][a-z0-9_]*\.[a-z0-9_.]+$'),
  PRIMARY KEY (community_id, role, permission)
);
SELECT erre_tenant_table('core_role_permissions');

-- migrate:down
DROP TABLE core_role_permissions;
DROP TABLE core_community_memberships;
