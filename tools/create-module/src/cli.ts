// pnpm create-module <id> [--nome "Nome"] [--anon]
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { generate, GenerateError } from './generate';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: { nome: { type: 'string' }, anon: { type: 'boolean', default: false } },
  });
  const id = positionals[0];
  if (!id) {
    console.error('uso: pnpm create-module <id> [--nome "Nome do módulo"] [--anon]');
    process.exitCode = 1;
    return;
  }
  const result = generate(root, { id, anon: values.anon, ...(values.nome ? { name: values.nome } : {}) });
  // Same formatting as the rest of the repository (lines get longer once the placeholders are replaced).
  execFileSync(
    'pnpm',
    ['exec', 'prettier', '--write', '--ignore-unknown', '--log-level', 'warn', ...result.created, ...result.changed],
    {
      cwd: root,
      stdio: 'inherit',
    },
  );
  process.stdout.write(`Módulo "${id}" criado:\n${result.created.map((f) => `  + ${f}`).join('\n')}\n`);
  process.stdout.write(`Registrado em:\n${result.changed.map((f) => `  ~ ${f}`).join('\n')}\n`);
  process.stdout.write(`
Próximos passos (docs/criando-um-modulo.md):
  1. pnpm install
  2. MODULES_ENABLED=...,${id} no apps/api/.env
  3. pnpm --filter @erre/db db:migrate
  4. pnpm --filter @erre/${id} test && pnpm --filter @erre/mobile test -- ${id}\n`);
}

try {
  main();
} catch (err) {
  console.error(err instanceof GenerateError ? `Não deu: ${err.message}` : err);
  process.exitCode = 1;
}
