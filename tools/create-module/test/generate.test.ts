import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { addToEnvExample, generate, idProblems, registerInList, render } from '../src/generate';

const API_REGISTRY = `// registry
import type { ModuleApi } from '@erre/core/server';
import errometro from '@erre/errometro/api';
import eventos from '@erre/eventos/api';

export const MODULES: readonly ModuleApi[] = [errometro, eventos];
`;
const UI_REGISTRY = `import type { ModuleUi } from '@erre/core/client';
import errometro from '@erre/errometro/ui';
import eventos from '@erre/eventos/ui';

export const MODULE_UIS: readonly ModuleUi[] = [errometro, eventos];
`;
const PKG = (name: string) =>
  `${JSON.stringify({ name, dependencies: { '@erre/core': 'workspace:*', hono: '4.13.13' } }, null, 2)}\n`;

let roots: string[] = [];
afterEach(() => {
  for (const r of roots) rmSync(r, { recursive: true, force: true });
  roots = [];
});

/** A minimal workspace with the files the generator edits. */
function fakeRoot(): string {
  const root = mkdtempSync(path.join(tmpdir(), 'create-module-'));
  roots.push(root);
  const write = (rel: string, text: string) => {
    mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    writeFileSync(path.join(root, rel), text);
  };
  write('apps/api/src/modules.ts', API_REGISTRY);
  write('apps/mobile/src/modules.ts', UI_REGISTRY);
  write('apps/api/package.json', PKG('@erre/api'));
  write('apps/mobile/package.json', PKG('@erre/mobile'));
  write('apps/api/.env.example', '# Modules turned on, comma separated (e.g. errometro,eventos)\nMODULES_ENABLED=\n');
  mkdirSync(path.join(root, 'modules/eventos'), { recursive: true });
  return root;
}

const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((e) => {
    const full = path.join(dir, e);
    return statSync(full).isDirectory() ? files(full) : [full];
  });

describe('generate', () => {
  it('creates the module, the route, the app test and registers it everywhere', () => {
    const root = fakeRoot();
    const { created, changed } = generate(root, { id: 'avisos', name: 'Mural de avisos' });
    expect(created).toEqual(
      expect.arrayContaining([
        'modules/avisos/manifest.ts',
        'modules/avisos/api/index.ts',
        'modules/avisos/db/migrations/avisos_0001_base.sql',
        'modules/avisos/tests/integration/permissions.test.ts',
        'modules/avisos/tests/integration/isolation.test.ts',
        'apps/mobile/src/app/(app)/avisos/index.tsx',
        'apps/mobile/test/avisos.test.tsx',
      ]),
    );
    expect(created.some((f) => f.includes('/anon'))).toBe(false);
    expect(changed.sort()).toEqual([
      'apps/api/.env.example',
      'apps/api/package.json',
      'apps/api/src/modules.ts',
      'apps/mobile/package.json',
      'apps/mobile/src/modules.ts',
    ]);

    // Every placeholder is gone, and the name and type names went in.
    for (const f of files(path.join(root, 'modules/avisos'))) expect(readFileSync(f, 'utf8')).not.toMatch(/__\w+__/);
    const read = (rel: string) => readFileSync(path.join(root, rel), 'utf8');
    expect(read('modules/avisos/manifest.ts')).toContain("name: 'Mural de avisos'");
    expect(read('modules/avisos/api/index.ts')).toContain('export type AvisosApi = typeof api;');
    expect(read('modules/avisos/api/index.ts')).not.toContain('anon');
    expect(read('modules/avisos/package.json')).toContain('"name": "@erre/avisos"');

    // Imports in alphabetical order; the new module goes last in the hub.
    expect(read('apps/api/src/modules.ts')).toContain(
      "import avisos from '@erre/avisos/api';\nimport errometro from '@erre/errometro/api';",
    );
    expect(read('apps/api/src/modules.ts')).toContain('[errometro, eventos, avisos];');
    expect(read('apps/mobile/src/modules.ts')).toContain('[errometro, eventos, avisos];');
    expect(JSON.parse(read('apps/mobile/package.json')).dependencies).toEqual({
      '@erre/avisos': 'workspace:*',
      '@erre/core': 'workspace:*',
      hono: '4.13.13',
    });
    expect(read('apps/api/.env.example')).toContain('(e.g. errometro,eventos,avisos)');
  });

  it('with --anon, adds the anonymous route and its test', () => {
    const root = fakeRoot();
    const { created } = generate(root, { id: 'enquete', anon: true });
    expect(created).toEqual(
      expect.arrayContaining(['modules/enquete/api/anon/index.ts', 'modules/enquete/tests/integration/anon.test.ts']),
    );
    const api = readFileSync(path.join(root, 'modules/enquete/api/index.ts'), 'utf8');
    expect(api).toContain("import { anon } from './anon';");
    expect(api).toMatch(/\n\s+anon,\n/);
    expect(readFileSync(path.join(root, 'modules/enquete/manifest.ts'), 'utf8')).toContain("name: 'Enquete'");
  });

  it('refuses invalid, reserved and existing ids before writing anything', () => {
    const root = fakeRoot();
    expect(idProblems(root, { id: 'Avisos' })[0]).toMatch(/letras minúsculas/);
    expect(idProblems(root, { id: 'meu-modulo' })[0]).toMatch(/letras minúsculas/);
    expect(idProblems(root, { id: 'auth' })).toEqual(['id "auth" is reserved']);
    expect(idProblems(root, { id: 'eventos' })).toEqual(['modules/eventos already exists']);
    expect(() => generate(root, { id: 'auth' })).toThrow(/reserved/);
    expect(readFileSync(path.join(root, 'apps/api/src/modules.ts'), 'utf8')).toBe(API_REGISTRY);
  });
});

describe('helpers', () => {
  it('render drops anon blocks unless asked', () => {
    const text = "a\n// <anon>\nimport { anon } from './anon';\n// </anon>\nb __id__ __Nome__ __Pascal__";
    expect(render(text, { id: 'x1', name: 'X um', anon: false })).toBe('a\nb x1 X um X1');
    expect(render(text, { id: 'x1', name: 'X um', anon: true })).toBe(
      "a\nimport { anon } from './anon';\nb x1 X um X1",
    );
  });

  it('registerInList appends to an empty list and after the last import', () => {
    const src = "import type { M } from 'x';\nimport a from '@erre/a/api';\n\nexport const L: readonly M[] = [];\n";
    expect(registerInList(src, 'zeta', '@erre/zeta/api', /export const L: readonly M\[\] = \[/)).toBe(
      "import type { M } from 'x';\nimport a from '@erre/a/api';\nimport zeta from '@erre/zeta/api';\n\nexport const L: readonly M[] = [zeta];\n",
    );
  });

  it('addToEnvExample does not repeat the id', () => {
    const env = '# Modules turned on, comma separated (e.g. errometro,eventos)\n';
    expect(addToEnvExample(addToEnvExample(env, 'x'), 'x')).toBe(
      '# Modules turned on, comma separated (e.g. errometro,eventos,x)\n',
    );
  });
});
