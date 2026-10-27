// Module generator (PLANO Sprint 20, task 1). Copies template/ with the placeholders replaced and registers the
// module in the API, the app, its app links and .env.example. Pure file operations over a root folder, so tests can run it on a
// copy of the workspace.
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { manifestProblems } from '@erre/core/manifest';

export const TEMPLATE_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../template');

export type GenerateOptions = {
  /** Module id: lowercase letters and digits, starting with a letter (e.g. "avisos"). */
  id: string;
  /** Display name (pt-BR). Default: the id with a capital letter. */
  name?: string;
  /** Also generate an anonymous route (api/anon) and its test. */
  anon?: boolean;
};

export type GenerateResult = { created: string[]; changed: string[] };

export class GenerateError extends Error {
  override name = 'GenerateError';
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Problems with the id or name before anything is written. Empty = ok. */
export function idProblems(root: string, { id, name }: GenerateOptions): string[] {
  const problems = manifestProblems({ id, name: name ?? capitalize(id), icon: 'x' });
  if (existsSync(path.join(root, 'modules', id))) problems.push(`modules/${id} already exists`);
  if (existsSync(path.join(root, 'apps/mobile/src/app/(app)', id)))
    problems.push(`apps/mobile/src/app/(app)/${id} already exists`);
  return problems;
}

/** Replaces the placeholders and drops `// <anon>` … `// </anon>` blocks when there is no anonymous route. */
export function render(text: string, { id, name, anon }: Required<GenerateOptions>): string {
  const lines = text.split('\n');
  const kept: string[] = [];
  let inAnon = false;
  for (const line of lines) {
    const marker = line.trim();
    if (marker === '// <anon>') {
      inAnon = true;
      continue;
    }
    if (marker === '// </anon>') {
      inAnon = false;
      continue;
    }
    if (inAnon && !anon) continue;
    kept.push(line);
  }
  return kept.join('\n').replaceAll('__id__', id).replaceAll('__Nome__', name).replaceAll('__Pascal__', capitalize(id));
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const ANON_ONLY = new Set(['api/anon/index.ts.tmpl', 'tests/integration/anon.test.ts.tmpl']);

/** Where each template file goes, relative to the root. */
function targets(id: string, anon: boolean): { from: string; to: string }[] {
  const moduleDir = path.join(TEMPLATE_DIR, 'module');
  const files = walk(moduleDir)
    .map((full) => path.relative(moduleDir, full))
    .filter((rel) => anon || !ANON_ONLY.has(rel))
    .map((rel) => ({
      from: path.join(moduleDir, rel),
      to: path.join('modules', id, rel.replace(/\.tmpl$/, '').replaceAll('__id__', id)),
    }));
  return [
    ...files,
    { from: path.join(TEMPLATE_DIR, 'app/route.tsx.tmpl'), to: `apps/mobile/src/app/(app)/${id}/index.tsx` },
    { from: path.join(TEMPLATE_DIR, 'app/test.tsx.tmpl'), to: `apps/mobile/test/${id}.test.tsx` },
  ];
}

/**
 * Adds `import <id> from '<specifier>'` among the module imports (alphabetical) and `<id>` at the end of the
 * registry array (the array order is the order of the sections in the hub).
 */
export function registerInList(source: string, id: string, specifier: string, arrayDecl: RegExp): string {
  const imports = [...source.matchAll(/^import \w+ from '(@erre\/[a-z0-9-]+\/(?:api|ui))';$/gm)];
  if (imports.length === 0) throw new GenerateError('module imports not found in the registry');
  const line = `import ${id} from '${specifier}';`;
  const next = imports.find((m) => m[1]!.localeCompare(specifier) > 0);
  let out: string;
  if (next) {
    out = `${source.slice(0, next.index)}${line}\n${source.slice(next.index)}`;
  } else {
    const last = imports.at(-1)!;
    const at = last.index + last[0].length;
    out = `${source.slice(0, at)}\n${line}${source.slice(at)}`;
  }
  const match = arrayDecl.exec(out);
  if (!match) throw new GenerateError('module list not found in the registry');
  const start = match.index + match[0].length;
  const close = out.indexOf('];', start);
  const list = out.slice(start, close).trim().replace(/,$/, '');
  return `${out.slice(0, start)}${list ? `${list}, ` : ''}${id}${out.slice(close)}`;
}

/** Adds "@erre/<id>": "workspace:*" to dependencies, keeping them sorted. */
export function addDependency(packageJson: string, id: string): string {
  const pkg = JSON.parse(packageJson) as { dependencies?: Record<string, string> };
  const deps = { ...pkg.dependencies, [`@erre/${id}`]: 'workspace:*' };
  pkg.dependencies = Object.fromEntries(Object.entries(deps).sort(([a], [b]) => a.localeCompare(b)));
  return `${JSON.stringify(pkg, null, 2)}\n`;
}

/** Adds '/<id>/*' to the paths the native app opens instead of the browser (universal links / app links). */
export function addAppPath(source: string, id: string): string {
  return source.replace(/^(const APP_PATHS = \[)([^\]]*)(\];)$/m, (_m, a, list: string, b) =>
    list.includes(`'/${id}/*'`)
      ? `${a}${list}${b}`
      : `${a}${list.replace("'/comunidade/*'", `'/${id}/*', '/comunidade/*'`)}${b}`,
  );
}

/** Adds the id to the example list of MODULES_ENABLED in the comment above it. */
export function addToEnvExample(env: string, id: string): string {
  return env.replace(/^(# Modules turned on, comma separated \(e\.g\. )([a-z0-9,]+)(\))$/m, (_m, a, list, b) =>
    (list as string).split(',').includes(id) ? `${a}${list}${b}` : `${a}${list},${id}${b}`,
  );
}

export function generate(root: string, options: GenerateOptions): GenerateResult {
  const opts = { id: options.id, name: options.name ?? capitalize(options.id), anon: options.anon ?? false };
  const problems = idProblems(root, opts);
  if (problems.length) throw new GenerateError(problems.join('; '));

  const created: string[] = [];
  for (const { from, to } of targets(opts.id, opts.anon)) {
    const dest = path.join(root, to);
    mkdirSync(path.dirname(dest), { recursive: true });
    writeFileSync(dest, render(readFileSync(from, 'utf8'), opts));
    created.push(to);
  }

  const changed: string[] = [];
  const edit = (rel: string, fn: (text: string) => string) => {
    const file = path.join(root, rel);
    const before = readFileSync(file, 'utf8');
    const after = fn(before);
    if (after !== before) {
      writeFileSync(file, after);
      changed.push(rel);
    }
  };
  edit('apps/api/src/modules.ts', (s) =>
    registerInList(s, opts.id, `@erre/${opts.id}/api`, /export const MODULES: readonly ModuleApi\[\] = \[/),
  );
  edit('apps/mobile/src/modules.ts', (s) =>
    registerInList(s, opts.id, `@erre/${opts.id}/ui`, /export const MODULE_UIS: readonly ModuleUi\[\] = \[/),
  );
  edit('apps/api/package.json', (s) => addDependency(s, opts.id));
  edit('apps/mobile/package.json', (s) => addDependency(s, opts.id));
  edit('apps/api/.env.example', (s) => addToEnvExample(s, opts.id));
  edit('apps/mobile/src/web/well-known.ts', (s) => addAppPath(s, opts.id));
  return { created, changed };
}
