-- Sprint 19: indexes of community tables start with community_id. Reading a voter's ballot is by
-- (community, event, tag), which the primary key already covers.
DROP INDEX eventos_votes_voter_tag_idx;

-- migrate:down
CREATE INDEX eventos_votes_voter_tag_idx ON eventos_votes (voter_tag, community_id, event_id);
