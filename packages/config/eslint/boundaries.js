// erre/boundaries: who may import whom (docs/migration/ARQUITETURA.md §3).
import path from 'node:path';

import { areaOfImport, areaOfPath, findWorkspaceRoot } from './areas.js';

/** @typedef {import('./areas.js').Area} Area */

const isCoreServer = (/** @type {{ subpath?: string }} */ to) =>
  to.subpath === 'server' || to.subpath?.startsWith('server/');
// @erre/core/client carries React (module host); the API and manifests use @erre/core/manifest instead.
const isCoreClient = (/** @type {{ subpath?: string }} */ to) =>
  to.subpath === 'client' || to.subpath?.startsWith('client/');

/**
 * @param {Area} from
 * @param {Area & { subpath?: string }} to
 * @param {boolean} typeOnly
 * @returns {string | null} reason when the import is not allowed
 */
export function checkImport(from, to, typeOnly) {
  if (to.kind === 'config' || to.kind === 'unknown') return null;

  // Same package (or same module) is always fine, except across module parts (handled below).
  const samePackage =
    from.kind === to.kind &&
    (from.kind !== 'shared' || from.sharedName === to.sharedName) &&
    (from.kind !== 'module' || from.module === to.module);
  if (samePackage && from.kind !== 'module') return null;

  switch (from.kind) {
    case 'config':
      return 'packages/config não importa outros pacotes do projeto';
    case 'db':
      return 'packages/db só importa packages/config';
    case 'core':
      return to.kind === 'db' ? null : 'packages/core só importa packages/db e packages/config';
    case 'ui':
      return to.kind === 'shared' && to.sharedName === 'emoji'
        ? null
        : 'packages/ui só importa @erre/emoji e packages/config';
    case 'shared':
      return 'pacotes compartilhados só importam packages/config';
    case 'module':
      return checkFromModule(from, to, typeOnly);
    case 'app-api':
      if (to.kind === 'ui') return 'apps/api não importa packages/ui';
      if (to.kind === 'core' && isCoreClient(to)) return 'apps/api não importa @erre/core/client (traz React)';
      if (to.kind === 'module' && to.part === 'ui') return 'apps/api não importa a UI de um módulo';
      if (to.kind === 'app-mobile') return 'apps/api não importa apps/mobile';
      return null;
    case 'app-mobile':
      if (to.kind === 'db') return 'apps/mobile não importa packages/db';
      if (to.kind === 'core' && isCoreServer(to)) return 'apps/mobile não importa @erre/core/server';
      if (to.kind === 'module' && (to.part === 'api' || to.part === 'db') && !typeOnly)
        return 'apps/mobile só importa tipos (import type) da API de um módulo';
      if (to.kind === 'app-api' && !typeOnly) return 'apps/mobile só importa tipos (import type) de apps/api';
      return null;
    default:
      return null;
  }
}

/**
 * @param {Area} from
 * @param {Area & { subpath?: string }} to
 * @param {boolean} typeOnly
 */
function checkFromModule(from, to, typeOnly) {
  if (to.kind === 'module' && to.module !== from.module)
    return `módulos não importam outros módulos (${from.module} → ${to.module})`;
  if (to.kind === 'app-api' || to.kind === 'app-mobile') return 'módulos não importam apps';

  const part = from.part;
  if (to.kind === 'module') {
    // Same module, different part.
    if (part === 'api' && to.part === 'ui') return 'a API de um módulo não importa a UI dele';
    if (part === 'ui' && (to.part === 'api' || to.part === 'db') && !typeOnly)
      return 'a UI de um módulo só importa tipos (import type) da API dele';
    return null;
  }
  if (part === 'ui') {
    if (to.kind === 'db') return 'a UI de um módulo não importa packages/db';
    if (to.kind === 'core' && isCoreServer(to)) return 'a UI de um módulo não importa @erre/core/server';
    return null;
  }
  if (part === 'root') {
    if (to.kind === 'db' || (to.kind === 'core' && isCoreServer(to)))
      return 'o manifesto do módulo só usa partes do core sem servidor';
    if (to.kind === 'core' && isCoreClient(to))
      return 'o manifesto do módulo importa @erre/core/manifest, não @erre/core/client (a API também importa o manifesto)';
    if (to.kind === 'ui') return 'o manifesto do módulo não importa packages/ui';
    return null;
  }
  if (part === 'db') {
    return to.kind === 'db' ? null : 'o schema do módulo só importa packages/db';
  }
  // api and tests
  if (to.kind === 'ui' && part !== 'tests') return 'a API de um módulo não importa packages/ui';
  if (part === 'api' && to.kind === 'core' && isCoreClient(to))
    return 'a API de um módulo não importa @erre/core/client';
  return null;
}

/** @param {any} node */
function isTypeOnly(node) {
  if (node.importKind === 'type' || node.exportKind === 'type') return true;
  if (node.type === 'ImportDeclaration' && node.specifiers.length > 0) {
    return node.specifiers.every((/** @type {any} */ s) => s.importKind === 'type');
  }
  return false;
}

/** @type {import('eslint').Rule.RuleModule} */
export const boundariesRule = {
  meta: {
    type: 'problem',
    docs: { description: 'Fronteiras de dependência entre pacotes, módulos e apps (ARQUITETURA §3)' },
    schema: [],
    messages: { forbidden: 'Import proibido: {{reason}} ("{{specifier}}").' },
  },
  create(context) {
    const file = context.filename;
    const found = findWorkspaceRoot(file);
    if (!found) return {};
    const root = found;
    const rel = path.relative(root, file).split(path.sep).join('/');
    const from = areaOfPath(rel);
    if (from.kind === 'unknown') return {};

    /** @param {any} node @param {any} source @param {boolean} typeOnly */
    function check(node, source, typeOnly) {
      if (!source || typeof source.value !== 'string') return;
      const to = areaOfImport(source.value, file, root);
      if (!to) return;
      const reason = checkImport(from, to, typeOnly);
      if (reason) context.report({ node, messageId: 'forbidden', data: { reason, specifier: source.value } });
    }

    return {
      ImportDeclaration: (node) => check(node, node.source, isTypeOnly(node)),
      ExportNamedDeclaration: (node) => check(node, node.source, isTypeOnly(node)),
      ExportAllDeclaration: (node) => check(node, node.source, isTypeOnly(node)),
      ImportExpression: (node) => check(node, node.source, false),
      CallExpression: (node) => {
        if (node.callee.type === 'Identifier' && node.callee.name === 'require') check(node, node.arguments[0], false);
      },
    };
  },
};
