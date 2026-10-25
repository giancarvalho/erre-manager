import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { RuleTester } from 'eslint';
import tseslint from 'typescript-eslint';
import { afterAll, describe, it } from 'vitest';

import { noIdentityInAnonRule } from '../eslint/anon.js';
import { boundariesRule } from '../eslint/boundaries.js';

// RuleTester hooks into the test framework through these static fields (not in its type definitions).
const hooks = /** @type {Record<string, unknown>} */ (/** @type {unknown} */ (RuleTester));
hooks.afterAll = afterAll;
hooks.describe = describe;
hooks.it = it;

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const at = (/** @type {string} */ rel) => path.join(root, rel);

const tester = new RuleTester({
  languageOptions: { parser: tseslint.parser, ecmaVersion: 2022, sourceType: 'module' },
});

const ok = (/** @type {string} */ file, /** @type {string} */ code) => ({ filename: at(file), code });
const bad = (/** @type {string} */ file, /** @type {string} */ code) => ({
  filename: at(file),
  code,
  errors: [{ messageId: 'forbidden' }],
});

tester.run('erre/boundaries', boundariesRule, {
  valid: [
    ok('packages/core/src/a.ts', "import { db } from '@erre/db';"),
    ok('packages/db/src/a.ts', "import x from './b';"),
    ok('packages/ui/src/a.tsx', "import { EMOJIS } from '@erre/emoji';"),
    ok(
      'modules/errometro/api/routes.ts',
      "import { createTenantTable } from '@erre/db'; import { defineModuleApi } from '@erre/core/server'; import { blind } from '@erre/anon-vote/server';",
    ),
    ok('modules/errometro/api/routes.ts', "import manifest from '../manifest';"),
    ok(
      'modules/errometro/ui/VoteScreen.tsx',
      "import { Button } from '@erre/ui'; import { useCommunity } from '@erre/core/client';",
    ),
    ok('modules/errometro/ui/client.ts', "import type { ErrometroApi } from '../api';"),
    ok('modules/errometro/ui/client.ts', "import { type ErrometroApi } from '../api';"),
    ok('modules/errometro/manifest.ts', "import { defineManifest } from '@erre/core/manifest';"),
    ok('modules/errometro/ui/index.tsx', "import { defineModuleUi } from '@erre/core/client';"),
    ok('modules/errometro/db/schema.ts', "import { createTenantTable } from '@erre/db';"),
    ok('modules/errometro/tests/vote.test.tsx', "import { Button } from '@erre/ui'; import { app } from '../api';"),
    ok(
      'apps/api/src/modules.ts',
      "import errometro from '@erre/errometro/api'; import manifest from '@erre/errometro';",
    ),
    ok(
      'apps/mobile/src/app/index.tsx',
      "import { Button } from '@erre/ui'; import VoteScreen from '@erre/errometro/ui/screens/VoteScreen';",
    ),
    ok('apps/mobile/src/lib/api.ts', "import type { ErrometroApi } from '@erre/errometro/api';"),
    ok('apps/api/src/index.ts', "import { Hono } from 'hono';"),
    ok('docs/whatever.ts', "import x from '@erre/db';"),
  ],
  invalid: [
    bad('packages/db/src/a.ts', "import { can } from '@erre/core/server';"),
    bad('packages/core/src/a.ts', "import { Button } from '@erre/ui';"),
    bad('packages/core/src/a.ts', "import x from '@erre/errometro';"),
    bad('packages/ui/src/a.tsx', "import { db } from '@erre/db';"),
    bad('packages/anon-vote/src/a.ts', "import { db } from '@erre/db';"),
    bad('modules/errometro/api/routes.ts', "import { x } from '@erre/eventos/api';"),
    bad('modules/errometro/api/routes.ts', "import { x } from '../../eventos/api/internals';"),
    bad('modules/errometro/api/routes.ts', "import { Button } from '@erre/ui';"),
    bad('modules/errometro/api/routes.ts', "import Screen from '../ui/Screen';"),
    bad('modules/errometro/ui/VoteScreen.tsx', "import { db } from '@erre/db';"),
    bad('modules/errometro/ui/VoteScreen.tsx', "import { auth } from '@erre/core/server';"),
    bad('modules/errometro/ui/client.ts', "import { errometroApp } from '../api';"),
    bad('modules/errometro/manifest.ts', "import { db } from '@erre/db';"),
    bad('modules/errometro/db/schema.ts', "import { can } from '@erre/core/client';"),
    bad('modules/errometro/manifest.ts', "import { defineManifest } from '@erre/core/client';"),
    bad('modules/errometro/api/routes.ts', "import { useModuleClient } from '@erre/core/client';"),
    bad('apps/api/src/index.ts', "import { defineModuleUi } from '@erre/core/client';"),
    bad('apps/mobile/src/app/index.tsx', "import { db } from '@erre/db';"),
    bad('apps/mobile/src/app/index.tsx', "import { auth } from '@erre/core/server';"),
    bad('apps/mobile/src/lib/api.ts', "import { errometroApp } from '@erre/errometro/api';"),
    bad('apps/api/src/index.ts', "import { Button } from '@erre/ui';"),
    bad('apps/api/src/index.ts', "import Screen from '@erre/errometro/ui/Screen';"),
    bad('modules/errometro/api/routes.ts', "const m = await import('@erre/eventos');"),
  ],
});

const anonFile = 'modules/errometro/api/anon/votes.ts';
tester.run('erre/no-identity-in-anon', noIdentityInAnonRule, {
  valid: [
    ok(anonFile, "import { verify } from '@erre/anon-vote/server'; app.post('/votes', (c) => c.json({ ok: true }));"),
    ok(
      'modules/errometro/api/routes.ts',
      "import { requireSession } from '@erre/core/server'; c.req.header('authorization'); ctx.user;",
    ),
  ],
  invalid: [
    bad(anonFile, "import { requireSession } from '@erre/core/server';"),
    // module and imported name are both forbidden: two reports
    {
      ...bad(anonFile, "import { getCookie } from 'hono/cookie';"),
      errors: [{ messageId: 'forbidden' }, { messageId: 'forbidden' }],
    },
    {
      ...bad(anonFile, "import { getConnInfo } from '@hono/node-server/conninfo';"),
      errors: [{ messageId: 'forbidden' }, { messageId: 'forbidden' }],
    },
    bad(anonFile, "const s = c.req.header('Cookie');"),
    bad(anonFile, "const a = c.req.header('authorization');"),
    bad(anonFile, "const ip = c.req.header('x-forwarded-for');"),
    bad(anonFile, 'const id = ctx.user;'),
  ],
});
