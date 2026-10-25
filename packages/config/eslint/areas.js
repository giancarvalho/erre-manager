// Classifies files and import specifiers into architecture areas (docs/migration/ARQUITETURA.md §3).
import { existsSync } from 'node:fs';
import path from 'node:path';

/** Packages under packages/ that are not "shared" libraries. */
const NAMED_PACKAGES = new Set(['config', 'db', 'core', 'ui']);
/** Shared libraries any module may use (anon-vote, emoji, ...). */
export const SHARED_PACKAGES = new Set(['anon-vote', 'emoji']);

/**
 * @typedef {{ kind: 'config' | 'db' | 'core' | 'ui' | 'shared' | 'app-api' | 'app-mobile' | 'module' | 'unknown', module?: string, part?: string, sharedName?: string }} Area
 */

const rootCache = new Map();

/**
 * Walks up from a file until it finds pnpm-workspace.yaml.
 * @param {string} fromFile
 * @returns {string | null}
 */
export function findWorkspaceRoot(fromFile) {
  let dir = path.dirname(fromFile);
  if (rootCache.has(dir)) return rootCache.get(dir);
  const start = dir;
  while (true) {
    if (existsSync(path.join(dir, 'pnpm-workspace.yaml'))) {
      rootCache.set(start, dir);
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      rootCache.set(start, null);
      return null;
    }
    dir = parent;
  }
}

/**
 * Area of a file, from its path relative to the workspace root.
 * @param {string} relPath posix path relative to the workspace root
 * @returns {Area}
 */
export function areaOfPath(relPath) {
  const parts = relPath.split('/');
  const [top, name, sub] = parts;
  if (top === 'packages' && name) {
    if (name === 'config') return { kind: 'config' };
    if (name === 'db') return { kind: 'db' };
    if (name === 'core') return { kind: 'core' };
    if (name === 'ui') return { kind: 'ui' };
    return { kind: 'shared', sharedName: name };
  }
  if (top === 'apps' && name === 'api') return { kind: 'app-api' };
  if (top === 'apps' && name === 'mobile') return { kind: 'app-mobile' };
  if (top === 'modules' && name) {
    const part = sub === 'api' || sub === 'ui' || sub === 'db' ? sub : sub === 'tests' ? 'tests' : 'root';
    return { kind: 'module', module: name, part };
  }
  return { kind: 'unknown' };
}

/**
 * Area targeted by an import specifier. Relative imports are resolved against the importing file.
 * @param {string} specifier
 * @param {string} fileAbs absolute path of the importing file
 * @param {string} root workspace root
 * @returns {(Area & { subpath: string }) | null} null for third-party packages
 */
export function areaOfImport(specifier, fileAbs, root) {
  if (specifier.startsWith('.')) {
    const target = path.resolve(path.dirname(fileAbs), specifier);
    const rel = path.relative(root, target).split(path.sep).join('/');
    if (rel.startsWith('..')) return null;
    return { ...areaOfPath(rel), subpath: rel };
  }
  if (!specifier.startsWith('@erre/')) return null;
  const [, pkg = '', ...rest] = specifier.split('/');
  const subpath = rest.join('/');
  if (NAMED_PACKAGES.has(pkg)) return { kind: /** @type {Area['kind']} */ (pkg), subpath };
  if (SHARED_PACKAGES.has(pkg)) return { kind: 'shared', sharedName: pkg, subpath };
  if (pkg === 'api') return { kind: 'app-api', subpath };
  if (pkg === 'mobile') return { kind: 'app-mobile', subpath };
  // Any other @erre/<name> is a module: @erre/errometro, @erre/errometro/api, @erre/errometro/ui ...
  const part =
    rest[0] === 'api' || rest[0] === 'ui' || rest[0] === 'db'
      ? rest[0]
      : rest[0] === 'manifest' || rest[0] === undefined
        ? 'root'
        : rest[0];
  return { kind: 'module', module: pkg, part, subpath };
}
