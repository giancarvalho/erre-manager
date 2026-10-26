// erre/no-raw-style: no hex/rgb(a)/hsl(a) color literals and no numeric fontSize outside packages/ui
// (DESIGN §3.5, AGENTS.md rule 12). Screens use tokens; a value that changes with the theme is a token.
import path from 'node:path';

import { areaOfPath, findWorkspaceRoot } from './areas.js';

const COLOR = /^(#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})|(rgba?|hsla?)\s*\()/i;

/** @type {import('eslint').Rule.RuleModule} */
export const noRawStyleRule = {
  meta: {
    type: 'problem',
    docs: { description: 'Cores e tamanhos de fonte só pelos tokens de packages/ui' },
    schema: [],
    messages: {
      color: 'Cor literal "{{value}}": use um token de @erre/ui (DESIGN §3).',
      fontSize: 'fontSize numérico: use uma variante de tipografia de @erre/ui (DESIGN §4).',
    },
  },
  create(context) {
    const file = context.filename;
    const root = findWorkspaceRoot(file);
    if (root) {
      const area = areaOfPath(path.relative(root, file).split(path.sep).join('/'));
      if (area.kind === 'ui') return {};
    }
    return {
      Literal(node) {
        if (typeof node.value === 'string' && COLOR.test(node.value.trim())) {
          context.report({ node, messageId: 'color', data: { value: node.value } });
        }
      },
      TemplateLiteral(node) {
        const head = node.quasis[0]?.value.cooked ?? '';
        if (COLOR.test(head.trim())) context.report({ node, messageId: 'color', data: { value: `${head}…` } });
      },
      Property(node) {
        const key =
          node.key.type === 'Identifier' ? node.key.name : node.key.type === 'Literal' ? node.key.value : null;
        if (key === 'fontSize' && node.value.type === 'Literal' && typeof node.value.value === 'number') {
          context.report({ node, messageId: 'fontSize' });
        }
      },
    };
  },
};
