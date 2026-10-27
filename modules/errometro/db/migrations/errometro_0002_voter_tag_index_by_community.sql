-- Sprint 19: indexes of community tables start with community_id. Annulling a ballot looks up a tag in one
-- community, across rounds (the primary key already covers community + round + tag).
DROP INDEX errometro_votes_voter_tag_idx;
CREATE INDEX errometro_votes_community_voter_tag_idx ON errometro_votes (community_id, voter_tag);

-- migrate:down
DROP INDEX errometro_votes_community_voter_tag_idx;
CREATE INDEX errometro_votes_voter_tag_idx ON errometro_votes (voter_tag, community_id, period);
