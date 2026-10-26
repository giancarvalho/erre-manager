-- Transactions without a person (jobs, anonymous routes) leave app.user_id empty. The "own membership"
-- policy cast it to uuid and errored, so ctx.members failed in jobs even though the community isolation
-- policy allows the read. Now an empty or missing app.user_id simply matches no row (still fail-closed).

DROP POLICY propria_membership ON core_community_memberships;
CREATE POLICY propria_membership ON core_community_memberships FOR SELECT
  USING (user_id = nullif(current_setting('app.user_id', true), '')::uuid);

-- migrate:down
DROP POLICY propria_membership ON core_community_memberships;
CREATE POLICY propria_membership ON core_community_memberships FOR SELECT
  USING (user_id = current_setting('app.user_id')::uuid);
