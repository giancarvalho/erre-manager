-- Invite links and join intents (D-023). The public code is base64url(community id) + secret, so the API
-- opens the community's transaction from the code and checks the secret inside it (no RLS exception).

CREATE TABLE core_community_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL REFERENCES communities(id),
  secret text NOT NULL CHECK (secret ~ '^[A-Za-z0-9_-]{12}$'),
  intent text,
  created_by uuid REFERENCES auth_user(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  UNIQUE (community_id, secret)
);
SELECT erre_tenant_table('core_community_invites');

-- Intent carried by a pending request (one request only, D-023); handled when the request is approved.
ALTER TABLE core_community_memberships ADD COLUMN join_intent text;

-- migrate:down
ALTER TABLE core_community_memberships DROP COLUMN join_intent;
DROP TABLE core_community_invites;
