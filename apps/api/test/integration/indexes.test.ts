// Every index of a community table starts with community_id (D-015, PLANO Sprint 19), over every migration of
// the workspace (core, modules and the contract test module).
import { indexProblems } from '@erre/db/testing';
import { expect, inject, it } from 'vitest';

it('community tables are indexed by community first', async () => {
  const allow = [
    // "My communities" looks a person up across communities (withUserTx, propria_membership): by person first.
    'core_community_memberships_user_id_idx',
  ];
  expect(await indexProblems(inject('db').admin, { allow })).toEqual([]);
});
