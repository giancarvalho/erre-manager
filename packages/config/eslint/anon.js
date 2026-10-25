// erre/no-identity-in-anon: anonymous routes never learn who the caller is (AGENTS.md rule 9, D-010).
// Applies to modules/*/api/anon/**. Blocks the obvious ways to reach identity: session/auth helpers,
// cookies, the Authorization header, client IP and a `user` on the context.

const FORBIDDEN_HEADERS = new Set(['cookie', 'authorization', 'x-forwarded-for', 'x-real-ip', 'cf-connecting-ip']);
const FORBIDDEN_IMPORT = /(^|\/)(auth|session)(\/|$)|^hono\/(cookie|conninfo)$|^@hono\/node-server\/conninfo$/;
const FORBIDDEN_NAMES = /^(getSession|requireSession|getCookie|getSignedCookie|getConnInfo|auth)$/;

/** @type {import('eslint').Rule.RuleModule} */
export const noIdentityInAnonRule = {
  meta: {
    type: 'problem',
    docs: { description: 'Rotas anônimas não podem acessar sessão, cookies, Authorization, IP ou usuário' },
    schema: [],
    messages: { forbidden: 'Rota anônima não pode acessar {{what}} (protege o anonimato do voto).' },
  },
  create(context) {
    const file = context.filename.split('\\').join('/');
    if (!/\/modules\/[^/]+\/api\/anon\//.test(file)) return {};
    return {
      ImportDeclaration(node) {
        const src = String(node.source.value);
        if (FORBIDDEN_IMPORT.test(src)) context.report({ node, messageId: 'forbidden', data: { what: `"${src}"` } });
        for (const s of node.specifiers) {
          const name = s.type === 'ImportSpecifier' && s.imported.type === 'Identifier' ? s.imported.name : null;
          if (name && FORBIDDEN_NAMES.test(name))
            context.report({ node: s, messageId: 'forbidden', data: { what: name } });
        }
      },
      Literal(node) {
        if (typeof node.value === 'string' && FORBIDDEN_HEADERS.has(node.value.toLowerCase())) {
          context.report({ node, messageId: 'forbidden', data: { what: `o header "${node.value}"` } });
        }
      },
      MemberExpression(node) {
        if (node.property.type === 'Identifier' && !node.computed && node.property.name === 'user') {
          context.report({ node, messageId: 'forbidden', data: { what: '"user"' } });
        }
      },
    };
  },
};
