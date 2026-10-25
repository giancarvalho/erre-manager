import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { TestProject } from 'vitest/node';

import { createTestDatabase, type TestDatabaseUrls } from '../src/testing';

const here = path.dirname(fileURLToPath(import.meta.url));
export const root = path.resolve(here, '../../..');
export const testMigrations = { owner: 'test', dir: path.join(here, 'migrations') };

declare module 'vitest' {
  export interface ProvidedContext {
    db: TestDatabaseUrls;
  }
}

export default async function setup(project: TestProject) {
  const db = await createTestDatabase({ root, extraSources: [testMigrations] });
  project.provide('db', db.urls);
  return () => db.drop();
}
