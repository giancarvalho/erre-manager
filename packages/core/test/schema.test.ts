import { schemaDifferences } from '@erre/db/testing';
import { expect, it, inject } from 'vitest';

import * as schema from '../src/server/schema';

it('Drizzle definitions of the core match the migrations', async () => {
  const tables = [
    schema.authUser,
    schema.authSession,
    schema.authAccount,
    schema.authVerification,
    schema.coreProfiles,
    schema.memberships,
    schema.rolePermissions,
    schema.invites,
  ];
  expect(await schemaDifferences(inject('db').admin, tables)).toEqual([]);
});
