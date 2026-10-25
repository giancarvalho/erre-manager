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

export default async function setup(project: TestProject) {
  // The contract test module's migrations are added explicitly (modules/_* are skipped by default).
  const db = await createTestDatabase({
    root,
    extraSources: [{ owner: 'contratoteste', dir: path.join(root, 'modules/_contrato-teste/db/migrations') }],
  });
  project.provide('db', db.urls);
  return () => db.drop();
}
