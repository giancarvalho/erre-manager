import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createTestDatabase, type TestDatabaseUrls } from '@erre/db/testing';
import type { TestProject } from 'vitest/node';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');

declare module 'vitest' {
  export interface ProvidedContext {
    db: TestDatabaseUrls;
  }
}

// A disposable database with every migration of the workspace (Mural de avisos included). Needs DATABASE_ADMIN_URL
// (local Postgres, see packages/db/.env.example).
export default async function setup(project: TestProject) {
  const db = await createTestDatabase({ root });
  project.provide('db', db.urls);
  return () => db.drop();
}
